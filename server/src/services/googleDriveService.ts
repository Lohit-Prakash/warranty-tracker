import { Readable } from 'stream';
import { google } from 'googleapis';
import { getValidAccessToken, GoogleTokenRevokedError } from './googleTokenService';
import db from '../db/database';

interface UserDriveRow {
  google_refresh_token: string | null;
  google_drive_folder_id: string | null;
}

/** Returns true if the user has a stored Google refresh token (Drive access available). */
export function userHasDriveAccess(userId: number): boolean {
  const row = db.prepare('SELECT google_refresh_token FROM users WHERE id = ?').get(userId) as
    | { google_refresh_token: string | null }
    | undefined;
  return !!(row && row.google_refresh_token);
}

/** Build an authenticated Drive client for the given user. */
async function buildDriveClient(userId: number) {
  const { OAuth2Client } = await import('google-auth-library');
  const oauth2Client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );
  const accessToken = await getValidAccessToken(userId);
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.drive({ version: 'v3', auth: oauth2Client });
}

/**
 * Ensure the "WarrantyVault" app folder exists in the user's Drive.
 * Returns the folder ID. Caches the ID in the DB after first creation.
 */
export async function ensureWarrantyVaultFolder(userId: number): Promise<string> {
  const row = db.prepare('SELECT google_drive_folder_id FROM users WHERE id = ?').get(userId) as
    | { google_drive_folder_id: string | null }
    | undefined;

  if (row?.google_drive_folder_id) {
    return row.google_drive_folder_id;
  }

  const drive = await buildDriveClient(userId);

  // Check if folder already exists in Drive (handles re-auth after DB wipe)
  const list = await drive.files.list({
    q: "name = 'WarrantyVault' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
    fields: 'files(id)',
    spaces: 'drive',
  });

  let folderId: string;
  if (list.data.files && list.data.files.length > 0) {
    folderId = list.data.files[0].id!;
  } else {
    const folder = await drive.files.create({
      requestBody: {
        name: 'WarrantyVault',
        mimeType: 'application/vnd.google-apps.folder',
      },
      fields: 'id',
    });
    folderId = folder.data.id!;
  }

  db.prepare('UPDATE users SET google_drive_folder_id = ? WHERE id = ?').run(folderId, userId);
  return folderId;
}

/**
 * Ensure a per-product subfolder exists inside the WarrantyVault root folder.
 * Returns the subfolder ID. Does NOT cache — callers should persist the ID.
 */
export async function ensureProductFolder(userId: number, productName: string): Promise<string> {
  const drive = await buildDriveClient(userId);
  const rootFolderId = await ensureWarrantyVaultFolder(userId);

  // Sanitise name for Drive (Drive allows most chars but keep it readable)
  const safeName = productName.trim().replace(/[/\\]/g, '-') || 'Unnamed Product';

  const list = await drive.files.list({
    q: `name = '${safeName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and '${rootFolderId}' in parents and trashed = false`,
    fields: 'files(id)',
    spaces: 'drive',
  });

  if (list.data.files && list.data.files.length > 0) {
    return list.data.files[0].id!;
  }

  const folder = await drive.files.create({
    requestBody: {
      name: safeName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [rootFolderId],
    },
    fields: 'id',
  });

  return folder.data.id!;
}

/**
 * Upload a file buffer to the user's Google Drive.
 * If parentFolderId is provided the file is placed there; otherwise it goes
 * into the WarrantyVault root folder.
 * Returns the Drive file ID.
 */
export async function uploadFileToDrive(
  userId: number,
  buffer: Buffer,
  fileName: string,
  mimeType: string,
  parentFolderId?: string,
): Promise<string> {
  const drive = await buildDriveClient(userId);
  const folderId = parentFolderId ?? await ensureWarrantyVaultFolder(userId);

  const readable = Readable.from(buffer);

  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: readable,
    },
    fields: 'id',
  });

  return response.data.id!;
}

/**
 * Grant "anyone with the link" viewer access to a Drive file.
 * Safe to call multiple times — Drive deduplicates 'anyone' permissions.
 */
export async function setFilePublicViewer(userId: number, driveFileId: string): Promise<void> {
  try {
    const drive = await buildDriveClient(userId);
    await drive.permissions.create({
      fileId: driveFileId,
      requestBody: { role: 'reader', type: 'anyone' },
    });
  } catch (err: unknown) {
    if (err instanceof GoogleTokenRevokedError) return;
    throw err;
  }
}

/**
 * Remove "anyone with the link" viewer access from a Drive file.
 * Silently ignores 404 (permission already gone or file deleted).
 */
export async function removeFilePublicViewer(userId: number, driveFileId: string): Promise<void> {
  try {
    const drive = await buildDriveClient(userId);
    // List permissions to find the 'anyone' entry
    const perms = await drive.permissions.list({ fileId: driveFileId, fields: 'permissions(id,type)' });
    const anyonePerm = perms.data.permissions?.find((p) => p.type === 'anyone');
    if (anyonePerm?.id) {
      await drive.permissions.delete({ fileId: driveFileId, permissionId: anyonePerm.id });
    }
  } catch (err: unknown) {
    if (err instanceof GoogleTokenRevokedError) return;
    const status = (err as { code?: number }).code;
    if (status === 404) return;
    throw err;
  }
}

/**
 * Download a file from Google Drive as a readable stream.
 */
export async function downloadFileFromDrive(userId: number, driveFileId: string): Promise<Readable> {
  const drive = await buildDriveClient(userId);

  const response = await drive.files.get(
    { fileId: driveFileId, alt: 'media' },
    { responseType: 'stream' },
  );

  return response.data as unknown as Readable;
}

/**
 * Delete a file from Google Drive. Silently succeeds if file is not found (404).
 */
export async function deleteFileFromDrive(userId: number, driveFileId: string): Promise<void> {
  try {
    const drive = await buildDriveClient(userId);
    await drive.files.delete({ fileId: driveFileId });
  } catch (err: unknown) {
    // Ignore 404 (already deleted) and token errors (user revoked — file inaccessible anyway)
    if (err instanceof GoogleTokenRevokedError) return;
    const status = (err as { code?: number }).code;
    if (status === 404) return;
    throw err;
  }
}
