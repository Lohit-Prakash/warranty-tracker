import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import db from '../db/database';
import { authenticate } from '../middleware/auth';
import { logger } from '../lib/logger';
import { loginLimiter, registerLimiter } from '../middleware/rateLimiter';
import { sendPasswordResetEmail } from '../services/emailService';

const router = Router();

export interface UserRow {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  notification_email: string | null;
  notifications_enabled: number;
  failed_login_attempts: number;
  locked_until: string | null;
  google_id: string | null;
  created_at: string;
  subscription_tier: string | null;
  subscription_status: string | null;
  subscription_current_period_end: string | null;
}

const ACCESS_TOKEN_TTL_SEC = 15 * 60; // 15 minutes
const REFRESH_TOKEN_TTL_SEC = 30 * 24 * 60 * 60; // 30 days

export function generateToken(user: { id: number; email: string; name: string }): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');
  return jwt.sign({ id: user.id, email: user.email, name: user.name }, secret, {
    expiresIn: ACCESS_TOKEN_TTL_SEC,
  });
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function issueRefreshToken(userId: number): string {
  const raw = crypto.randomBytes(48).toString('hex');
  const hash = hashToken(raw);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SEC * 1000).toISOString();
  db.prepare(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
  ).run(userId, hash, expiresAt);
  return raw;
}

export function cookieOptions(maxAgeSec: number = ACCESS_TOKEN_TTL_SEC) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: maxAgeSec * 1000,
  };
}

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  res.cookie('token', accessToken, cookieOptions(ACCESS_TOKEN_TTL_SEC));
  res.cookie('refresh_token', refreshToken, {
    ...cookieOptions(REFRESH_TOKEN_TTL_SEC),
    path: '/api/auth',
  });
}

export function formatUser(user: Omit<UserRow, 'password_hash' | 'failed_login_attempts' | 'locked_until'>) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    notificationEmail: user.notification_email,
    notificationsEnabled: Boolean(user.notifications_enabled),
    googleId: user.google_id ?? null,
    createdAt: user.created_at,
    subscriptionTier: user.subscription_tier ?? 'free',
    subscriptionStatus: user.subscription_status ?? 'active',
    subscriptionPeriodEnd: user.subscription_current_period_end ?? null,
  };
}

// POST /api/auth/register
router.post('/register', registerLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Valid email is required' });
      return;
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
    if (existing) {
      res.status(409).json({ error: 'Email already in use' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = db
      .prepare(
        'INSERT INTO users (name, email, password_hash, notification_email) VALUES (?, ?, ?, ?)'
      )
      .run(name.trim(), email.toLowerCase(), passwordHash, email.toLowerCase());

    const userId = result.lastInsertRowid as number;
    const user = db.prepare('SELECT id, name, email, notification_email, notifications_enabled, google_id, created_at, subscription_tier, subscription_status, subscription_current_period_end FROM users WHERE id = ?').get(userId) as Omit<UserRow, 'password_hash' | 'failed_login_attempts' | 'locked_until'>;

    const token = generateToken({ id: user.id, email: user.email, name: user.name });
    const refreshToken = issueRefreshToken(user.id);
    setAuthCookies(res, token, refreshToken);

    res.status(201).json({ data: formatUser(user) });
  } catch (err) {
    logger.error(err, 'Register error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/login
router.post('/login', loginLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const user = db
      .prepare('SELECT * FROM users WHERE email = ?')
      .get(email.toLowerCase()) as UserRow | undefined;

    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Check account lockout
    if (user.locked_until) {
      const lockedUntil = new Date(user.locked_until);
      if (lockedUntil > new Date()) {
        const minsLeft = Math.ceil((lockedUntil.getTime() - Date.now()) / 60000);
        res.status(423).json({ error: `Account locked. Try again in ${minsLeft} minute(s).` });
        return;
      }
      // Lock expired, reset
      db.prepare('UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?').run(user.id);
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      const attempts = (user.failed_login_attempts || 0) + 1;
      if (attempts >= 5) {
        // Lock for 15 minutes
        const lockUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        db.prepare('UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?').run(attempts, lockUntil, user.id);
        res.status(423).json({ error: 'Account locked due to too many failed attempts. Try again in 15 minutes.' });
      } else {
        db.prepare('UPDATE users SET failed_login_attempts = ? WHERE id = ?').run(attempts, user.id);
        res.status(401).json({ error: 'Invalid email or password' });
      }
      return;
    }

    // Successful login — reset failed attempts
    db.prepare('UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?').run(user.id);

    const token = generateToken({ id: user.id, email: user.email, name: user.name });
    const refreshToken = issueRefreshToken(user.id);
    setAuthCookies(res, token, refreshToken);

    res.json({
      data: formatUser({
        id: user.id,
        name: user.name,
        email: user.email,
        notification_email: user.notification_email,
        notifications_enabled: user.notifications_enabled,
        google_id: user.google_id ?? null,
        created_at: user.created_at,
        subscription_tier: user.subscription_tier ?? null,
        subscription_status: user.subscription_status ?? null,
        subscription_current_period_end: user.subscription_current_period_end ?? null,
      }),
    });
  } catch (err) {
    logger.error(err, 'Login error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', (req: Request, res: Response): void => {
  try {
    const refreshToken = req.cookies?.refresh_token as string | undefined;
    if (!refreshToken || typeof refreshToken !== 'string') {
      res.status(401).json({ error: 'Refresh token missing' });
      return;
    }
    const hash = hashToken(refreshToken);
    const row = db
      .prepare('SELECT * FROM refresh_tokens WHERE token_hash = ? AND revoked = 0')
      .get(hash) as
      | { id: number; user_id: number; expires_at: string; revoked: number }
      | undefined;

    if (!row) {
      res.status(401).json({ error: 'Invalid refresh token' });
      return;
    }
    if (new Date(row.expires_at) < new Date()) {
      db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE id = ?').run(row.id);
      res.status(401).json({ error: 'Refresh token expired' });
      return;
    }

    const user = db
      .prepare('SELECT id, name, email FROM users WHERE id = ?')
      .get(row.user_id) as { id: number; name: string; email: string } | undefined;
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    // Rotate refresh token: revoke old, issue new
    db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE id = ?').run(row.id);
    const newAccess = generateToken(user);
    const newRefresh = issueRefreshToken(user.id);
    setAuthCookies(res, newAccess, newRefresh);

    res.json({ data: { message: 'Token refreshed' } });
  } catch (err) {
    logger.error(err, 'Refresh error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req: Request, res: Response): void => {
  // Revoke refresh token if present
  const refreshToken = req.cookies?.refresh_token as string | undefined;
  if (refreshToken) {
    try {
      db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?').run(
        hashToken(refreshToken),
      );
    } catch {
      // ignore
    }
  }
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });
  res.clearCookie('refresh_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth',
  });
  res.json({ data: { message: 'Logged out successfully' } });
});

// GET /api/auth/me
router.get('/me', authenticate, (req: Request, res: Response): void => {
  try {
    const user = db
      .prepare(
        'SELECT id, name, email, notification_email, notifications_enabled, google_id, created_at, subscription_tier, subscription_status, subscription_current_period_end FROM users WHERE id = ?'
      )
      .get(req.user!.id) as Omit<UserRow, 'password_hash' | 'failed_login_attempts' | 'locked_until'> | undefined;

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ data: formatUser(user) });
  } catch (err) {
    logger.error(err, 'Me error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    // Always return success to prevent email enumeration
    const successMsg = { data: { message: 'If that email exists, a reset link has been sent.' } };

    if (!email || typeof email !== 'string') {
      res.json(successMsg);
      return;
    }

    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase()) as { id: number } | undefined;
    if (!user) {
      res.json(successMsg);
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    // Invalidate any existing tokens for this user
    db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE user_id = ? AND used = 0').run(user.id);

    db.prepare(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)'
    ).run(user.id, token, expiresAt);

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const resetUrl = `${clientUrl}/reset-password?token=${token}`;

    logger.info({ userId: user.id }, 'Password reset token generated');

    try {
      await sendPasswordResetEmail(email.toLowerCase(), resetUrl);
    } catch (emailErr) {
      // Log but don't expose email failure — token is still saved
      logger.error({ err: emailErr }, 'Failed to send password reset email');
    }

    res.json(successMsg);
  } catch (err) {
    logger.error(err, 'Forgot password error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, newPassword } = req.body;

    if (!token || typeof token !== 'string') {
      res.status(400).json({ error: 'Reset token is required' });
      return;
    }
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    const resetToken = db.prepare(
      'SELECT * FROM password_reset_tokens WHERE token = ? AND used = 0'
    ).get(token) as { id: number; user_id: number; expires_at: string } | undefined;

    if (!resetToken) {
      res.status(400).json({ error: 'Invalid or expired reset token' });
      return;
    }

    if (new Date(resetToken.expires_at) < new Date()) {
      db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE id = ?').run(resetToken.id);
      res.status(400).json({ error: 'Reset token has expired' });
      return;
    }

    const hash = await bcrypt.hash(newPassword, 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, resetToken.user_id);
    db.prepare('UPDATE password_reset_tokens SET used = 1 WHERE id = ?').run(resetToken.id);

    res.json({ data: { message: 'Password reset successfully. You can now log in.' } });
  } catch (err) {
    logger.error(err, 'Reset password error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
