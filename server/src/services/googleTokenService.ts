import crypto from 'crypto';
import db from '../db/database';

const ALGORITHM = 'aes-256-gcm';

function getEncryptionKey(): Buffer {
  const hex = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error('GOOGLE_TOKEN_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)');
  }
  return Buffer.from(hex, 'hex');
}

export class GoogleTokenRevokedError extends Error {
  constructor() {
    super('Google OAuth token has been revoked. Please sign in with Google again.');
    this.name = 'GoogleTokenRevokedError';
  }
}

/** Encrypt a plaintext token string using AES-256-GCM. Returns base64 iv:authTag:ciphertext. */
export function encryptToken(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join(':');
}

/** Decrypt a token string previously encrypted with encryptToken. */
export function decryptToken(ciphertext: string): string {
  const key = getEncryptionKey();
  const parts = ciphertext.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted token format');
  const [ivB64, authTagB64, encB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const encrypted = Buffer.from(encB64, 'base64');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted) + decipher.final('utf8');
}

/** Clear Google tokens for a user (called when refresh token is revoked). */
export function clearGoogleTokens(userId: number): void {
  db.prepare('UPDATE users SET google_refresh_token = NULL WHERE id = ?').run(userId);
}

interface UserTokenRow {
  google_refresh_token: string | null;
}

/**
 * Get a valid Google access token for the user. Uses google-auth-library to refresh
 * using the stored (encrypted) refresh token. Throws GoogleTokenRevokedError if revoked.
 */
export async function getValidAccessToken(userId: number): Promise<string> {
  const row = db.prepare('SELECT google_refresh_token FROM users WHERE id = ?').get(userId) as UserTokenRow | undefined;

  if (!row || !row.google_refresh_token) {
    throw new GoogleTokenRevokedError();
  }

  const { OAuth2Client } = await import('google-auth-library');
  const oauth2Client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );

  const refreshToken = decryptToken(row.google_refresh_token);
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  try {
    const { token } = await oauth2Client.getAccessToken();
    if (!token) throw new GoogleTokenRevokedError();
    return token;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('invalid_grant') || msg.includes('Token has been expired or revoked')) {
      clearGoogleTokens(userId);
      throw new GoogleTokenRevokedError();
    }
    throw err;
  }
}
