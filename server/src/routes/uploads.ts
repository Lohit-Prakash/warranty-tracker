import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { authenticate } from '../middleware/auth';
import db from '../db/database';
import { uploadsDir } from '../middleware/multer';
import { downloadFileFromDrive } from '../services/googleDriveService';
import { GoogleTokenRevokedError } from '../services/googleTokenService';

const router = Router();
router.use(authenticate);

// GET /api/uploads/drive/:driveFileId — proxy a Google Drive file to the client
router.get('/drive/:driveFileId', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const driveFileId = req.params.driveFileId;
    const driveKey = `drive:${driveFileId}`;

    // Ownership check: user must own a product or document with this Drive key,
    // OR the product must be shared with them.
    const legacyDoc = db
      .prepare('SELECT id FROM products WHERE user_id = ? AND (document_path = ? OR photo_path = ?)')
      .get(userId, driveKey, driveKey) as { id: number } | undefined;

    const multiDoc = db
      .prepare(
        `SELECT pd.id FROM product_documents pd
         INNER JOIN products p ON p.id = pd.product_id
         WHERE p.user_id = ? AND pd.file_path = ?`,
      )
      .get(userId, driveKey) as { id: number } | undefined;

    const sharedDoc = !legacyDoc && !multiDoc
      ? db.prepare(
          `SELECT p.id FROM products p
           JOIN shared_products sp ON sp.product_id = p.id
           WHERE (p.document_path = ? OR p.photo_path = ?)
             AND (sp.shared_with_user_id = ? OR sp.shared_with_email = (SELECT email FROM users WHERE id = ?))`,
        ).get(driveKey, driveKey, userId, userId) as { id: number } | undefined
      : undefined;

    const sharedMultiDoc = !legacyDoc && !multiDoc && !sharedDoc
      ? db.prepare(
          `SELECT pd.id FROM product_documents pd
           JOIN products p ON p.id = pd.product_id
           JOIN shared_products sp ON sp.product_id = p.id
           WHERE pd.file_path = ?
             AND (sp.shared_with_user_id = ? OR sp.shared_with_email = (SELECT email FROM users WHERE id = ?))`,
        ).get(driveKey, userId, userId) as { id: number } | undefined
      : undefined;

    if (!legacyDoc && !multiDoc && !sharedDoc && !sharedMultiDoc) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Look up mime type for Content-Type header
    const mimeRow = db
      .prepare('SELECT mime_type FROM product_documents WHERE file_path = ? LIMIT 1')
      .get(driveKey) as { mime_type: string | null } | undefined;

    const stream = await downloadFileFromDrive(userId, driveFileId);

    if (mimeRow?.mime_type) {
      res.setHeader('Content-Type', mimeRow.mime_type);
    }

    stream.pipe(res);
  } catch (err) {
    if (err instanceof GoogleTokenRevokedError) {
      res.status(503).json({ error: 'Google Drive access has been revoked. Please sign in with Google again.' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// GET /api/uploads/:filename
router.get('/:filename', (req: Request, res: Response): void => {
  try {
    const filename = path.basename(req.params.filename); // prevent path traversal
    const filePath = path.join(uploadsDir, filename);

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    // Verify user owns a product with this document or photo (legacy single or multi-doc)
    const userId = req.user!.id;
    const legacy = db
      .prepare("SELECT id FROM products WHERE user_id = ? AND (document_path LIKE ? OR photo_path LIKE ?)")
      .get(userId, `%${filename}`, `%${filename}`) as { id: number } | undefined;

    const multi = db
      .prepare(
        `SELECT pd.id FROM product_documents pd
         INNER JOIN products p ON p.id = pd.product_id
         WHERE p.user_id = ? AND pd.file_path LIKE ?`,
      )
      .get(userId, `%${filename}`) as { id: number } | undefined;

    if (!legacy && !multi) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    res.sendFile(filePath);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
