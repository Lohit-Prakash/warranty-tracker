import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import db from '../db/database';
import { logger } from '../lib/logger';
import { generateToken, issueRefreshToken, setAuthCookies, formatUser } from './auth';
import { encryptToken } from '../services/googleTokenService';
import { ensureWarrantyVaultFolder } from '../services/googleDriveService';

const router = Router();

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const ACCESS_TOKEN_TTL_SEC = 15 * 60;
const REFRESH_TOKEN_TTL_SEC = 30 * 24 * 60 * 60;

function getOAuth2Client() {
  return new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );
}

function stateCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 10 * 60 * 1000, // 10 minutes
  };
}

function generateState(): string {
  const nonce = crypto.randomBytes(16).toString('hex');
  const secret = process.env.OAUTH_STATE_SECRET;
  if (!secret) throw new Error('OAUTH_STATE_SECRET not configured');
  const hmac = crypto.createHmac('sha256', secret).update(nonce).digest('hex');
  return `${nonce}.${hmac}`;
}

function verifyState(state: string): boolean {
  const parts = state.split('.');
  if (parts.length !== 2) return false;
  const [nonce, hmac] = parts;
  const secret = process.env.OAUTH_STATE_SECRET;
  if (!secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(nonce).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(hmac, 'hex'), Buffer.from(expected, 'hex'));
}

interface GoogleUserRow {
  id: number;
  name: string;
  email: string;
  notification_email: string | null;
  notifications_enabled: number;
  google_id: string | null;
  google_refresh_token: string | null;
  created_at: string;
  subscription_tier: string | null;
  subscription_status: string | null;
  subscription_current_period_end: string | null;
}

// GET /api/auth/google — initiate OAuth flow
router.get('/', (_req: Request, res: Response): void => {
  try {
    const state = generateState();
    res.cookie('oauth_state', state, stateCookieOptions());

    const oauth2Client = getOAuth2Client();
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['openid', 'email', 'profile', 'https://www.googleapis.com/auth/drive.file'],
      state,
    });

    res.redirect(authUrl);
  } catch (err) {
    logger.error(err, 'Google OAuth initiation error');
    res.redirect(`${CLIENT_URL}/login?error=google_error`);
  }
});

// GET /api/auth/google/callback — OAuth callback
router.get('/callback', async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, state, error } = req.query as Record<string, string | undefined>;

    // User denied consent
    if (error) {
      res.clearCookie('oauth_state');
      res.redirect(`${CLIENT_URL}/login?error=google_denied`);
      return;
    }

    // CSRF state verification
    const cookieState = req.cookies?.oauth_state as string | undefined;
    res.clearCookie('oauth_state');

    if (!state || !cookieState || state !== cookieState || !verifyState(state)) {
      res.redirect(`${CLIENT_URL}/login?error=invalid_state`);
      return;
    }

    if (!code) {
      res.redirect(`${CLIENT_URL}/login?error=google_error`);
      return;
    }

    // Exchange code for tokens
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.id_token) {
      res.redirect(`${CLIENT_URL}/login?error=google_error`);
      return;
    }

    // Verify and decode the ID token
    const ticket = await oauth2Client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.sub || !payload.email) {
      res.redirect(`${CLIENT_URL}/login?error=google_error`);
      return;
    }

    const googleId = payload.sub;
    const email = payload.email.toLowerCase();
    const name = payload.name || payload.email.split('@')[0];

    // Encrypt refresh token if present
    const encryptedRefreshToken = tokens.refresh_token
      ? encryptToken(tokens.refresh_token)
      : null;

    // Find or create user
    let userId: number;

    // Case A: known Google user
    const existingByGoogleId = db
      .prepare('SELECT * FROM users WHERE google_id = ?')
      .get(googleId) as GoogleUserRow | undefined;

    if (existingByGoogleId) {
      userId = existingByGoogleId.id;
      // Only update refresh token if Google gave us a new one
      if (encryptedRefreshToken) {
        db.prepare('UPDATE users SET google_refresh_token = ? WHERE id = ?').run(
          encryptedRefreshToken,
          userId,
        );
      }
    } else {
      // Case B: existing email/password account — link Google
      const existingByEmail = db
        .prepare('SELECT * FROM users WHERE email = ?')
        .get(email) as GoogleUserRow | undefined;

      if (existingByEmail) {
        userId = existingByEmail.id;
        db.prepare(
          'UPDATE users SET google_id = ?, google_refresh_token = COALESCE(?, google_refresh_token) WHERE id = ?',
        ).run(googleId, encryptedRefreshToken, userId);
      } else {
        // Case C: brand new user — create account
        // Use a random bcrypt hash as placeholder (user has no password, can't log in via email/password)
        const placeholderHash = await bcrypt.hash(crypto.randomUUID(), 10);
        const result = db
          .prepare(
            'INSERT INTO users (name, email, password_hash, notification_email, google_id, google_refresh_token) VALUES (?, ?, ?, ?, ?, ?)',
          )
          .run(name, email, placeholderHash, email, googleId, encryptedRefreshToken);
        userId = result.lastInsertRowid as number;
      }
    }

    // Ensure WarrantyVault folder exists in Drive (only if we have a refresh token)
    const userRow = db
      .prepare('SELECT google_refresh_token FROM users WHERE id = ?')
      .get(userId) as { google_refresh_token: string | null } | undefined;

    if (userRow?.google_refresh_token) {
      try {
        await ensureWarrantyVaultFolder(userId);
      } catch (driveErr) {
        // Non-fatal — folder will be created on first upload
        logger.warn({ userId, err: driveErr }, 'Could not ensure Drive folder on login');
      }
    }

    // Issue app JWT + refresh token (same as local auth)
    const fullUser = db
      .prepare(
        'SELECT id, name, email, notification_email, notifications_enabled, google_id, created_at, subscription_tier, subscription_status, subscription_current_period_end FROM users WHERE id = ?',
      )
      .get(userId) as Omit<GoogleUserRow, 'password_hash' | 'failed_login_attempts' | 'locked_until' | 'google_refresh_token'>;

    const accessToken = generateToken({ id: fullUser.id, email: fullUser.email, name: fullUser.name });
    const refreshToken = issueRefreshToken(fullUser.id);
    setAuthCookies(res, accessToken, refreshToken);

    res.redirect(`${CLIENT_URL}/dashboard`);
  } catch (err) {
    logger.error(err, 'Google OAuth callback error');
    res.redirect(`${CLIENT_URL}/login?error=google_error`);
  }
});

export default router;

// Re-export token TTL constants for cookieOptions reuse
export { ACCESS_TOKEN_TTL_SEC, REFRESH_TOKEN_TTL_SEC };
