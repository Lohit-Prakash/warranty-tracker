import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { enforceSharingQuota } from '../middleware/quota';
import db from '../db/database';
import { logger } from '../lib/logger';
import { parseISO, differenceInDays } from 'date-fns';
import { userHasDriveAccess, setFilePublicViewer, removeFilePublicViewer } from '../services/googleDriveService';
import { sendProductSharedEmail } from '../services/emailService';

const router = Router();
router.use(authenticate);

interface ShareRow {
  id: number;
  product_id: number;
  owner_id: number;
  shared_with_email: string;
  shared_with_user_id: number | null;
  permission: string;
  created_at: string;
}

function mapShare(row: ShareRow, productName?: string) {
  return {
    id: row.id,
    productId: row.product_id,
    ownerId: row.owner_id,
    sharedWithEmail: row.shared_with_email,
    sharedWithUserId: row.shared_with_user_id,
    permission: row.permission,
    createdAt: row.created_at,
    productName,
  };
}

/** Collect all Drive file IDs associated with a product. */
function getDriveFileIdsForProduct(productId: number): string[] {
  const product = db
    .prepare('SELECT photo_path, document_path FROM products WHERE id = ?')
    .get(productId) as { photo_path: string | null; document_path: string | null } | undefined;

  const ids: string[] = [];
  if (product?.photo_path?.startsWith('drive:')) ids.push(product.photo_path.slice(6));
  if (product?.document_path?.startsWith('drive:')) ids.push(product.document_path.slice(6));

  const extraDocs = db
    .prepare('SELECT file_path FROM product_documents WHERE product_id = ?')
    .all(productId) as Array<{ file_path: string }>;
  for (const doc of extraDocs) {
    if (doc.file_path.startsWith('drive:')) ids.push(doc.file_path.slice(6));
  }

  return ids;
}

// GET /api/sharing/product/:productId
router.get('/product/:productId', (req: Request, res: Response): void => {
  try {
    const userId = req.user!.id;
    const productId = parseInt(req.params.productId, 10);
    if (isNaN(productId)) {
      res.status(400).json({ error: 'Invalid product id' });
      return;
    }
    const product = db
      .prepare('SELECT id FROM products WHERE id = ? AND user_id = ?')
      .get(productId, userId);
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    const rows = db
      .prepare('SELECT * FROM shared_products WHERE product_id = ? ORDER BY created_at DESC')
      .all(productId) as ShareRow[];
    res.json({ data: rows.map((r) => mapShare(r)) });
  } catch (err) {
    logger.error(err, 'List shares error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/sharing/shared-with-me
router.get('/shared-with-me', (req: Request, res: Response): void => {
  try {
    const userId = req.user!.id;
    const userRow = db
      .prepare('SELECT email FROM users WHERE id = ?')
      .get(userId) as { email: string } | undefined;
    if (!userRow) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const rows = db
      .prepare(
        `SELECT sp.*,
                p.name as product_name, p.brand, p.category, p.purchase_date, p.expiry_date,
                p.serial_number, p.store_name, p.notes, p.document_path, p.price,
                p.currency, p.photo_path, p.created_at as product_created_at, p.updated_at as product_updated_at,
                u.name as owner_name, u.email as owner_email
         FROM shared_products sp
         JOIN products p ON p.id = sp.product_id
         JOIN users u ON u.id = sp.owner_id
         WHERE sp.shared_with_user_id = ? OR sp.shared_with_email = ?
         ORDER BY sp.created_at DESC`,
      )
      .all(userId, userRow.email) as (ShareRow & {
        product_name: string; brand: string | null; category: string;
        purchase_date: string; expiry_date: string | null; serial_number: string | null;
        store_name: string | null; notes: string | null; document_path: string | null;
        price: number | null; currency: string | null; photo_path: string | null;
        product_created_at: string; product_updated_at: string;
        owner_name: string; owner_email: string;
      })[];

    // Use the viewer's alert threshold for status computation
    const viewerThreshold = (db
      .prepare('SELECT alert_threshold FROM users WHERE id = ?')
      .get(userId) as { alert_threshold: number } | undefined)?.alert_threshold ?? 30;

    const today = new Date().toISOString().split('T')[0];
    const data = rows.map((r) => {
      // Compute product status
      let daysRemaining: number | null = null;
      let status = 'no_warranty';
      let warrantyProgress = 0;
      if (r.expiry_date) {
        const fromDate = new Date(today); const toDate = new Date(r.expiry_date);
        fromDate.setHours(0,0,0,0); toDate.setHours(0,0,0,0);
        daysRemaining = Math.round((toDate.getTime() - fromDate.getTime()) / 86400000);
        const purchaseDate = new Date(r.purchase_date); purchaseDate.setHours(0,0,0,0);
        const totalDays = Math.round((toDate.getTime() - purchaseDate.getTime()) / 86400000);
        const elapsed = Math.round((fromDate.getTime() - purchaseDate.getTime()) / 86400000);
        warrantyProgress = totalDays > 0 ? Math.min(100, Math.round((elapsed / totalDays) * 100)) : 100;
        if (daysRemaining < 0) status = 'expired';
        else if (daysRemaining <= viewerThreshold) status = 'expiring';
        else status = 'active';
      }
      return {
        ...mapShare(r, r.product_name),
        ownerName: r.owner_name,
        ownerEmail: r.owner_email,
        product: {
          id: r.product_id,
          userId: r.owner_id,
          name: r.product_name,
          brand: r.brand,
          category: r.category,
          purchaseDate: r.purchase_date,
          expiryDate: r.expiry_date,
          serialNumber: r.serial_number,
          storeName: r.store_name,
          notes: r.notes,
          documentPath: r.document_path,
          price: r.price,
          currency: r.currency ?? 'USD',
          photoPath: r.photo_path,
          createdAt: r.product_created_at,
          updatedAt: r.product_updated_at,
          daysRemaining,
          status,
          warrantyProgress,
        },
      };
    });

    res.json({ data });
  } catch (err) {
    logger.error(err, 'Shared with me error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/sharing
router.post('/', enforceSharingQuota, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { productId, email, permission } = req.body as {
      productId?: number;
      email?: string;
      permission?: string;
    };

    if (!productId || !Number.isInteger(productId)) {
      res.status(400).json({ error: 'productId is required' });
      return;
    }
    if (!email || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email)) {
      res.status(400).json({ error: 'Valid email is required' });
      return;
    }
    const perm = permission === 'edit' ? 'edit' : 'view';

    const product = db
      .prepare('SELECT id FROM products WHERE id = ? AND user_id = ?')
      .get(productId, userId);
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Look up target user
    const targetUser = db
      .prepare('SELECT id FROM users WHERE email = ?')
      .get(normalizedEmail) as { id: number } | undefined;

    // Prevent sharing with self
    if (targetUser && targetUser.id === userId) {
      res.status(400).json({ error: 'Cannot share with yourself' });
      return;
    }

    // Check for existing share
    const existing = db
      .prepare(
        'SELECT id FROM shared_products WHERE product_id = ? AND shared_with_email = ?',
      )
      .get(productId, normalizedEmail);
    if (existing) {
      res.status(409).json({ error: 'Already shared with this user' });
      return;
    }

    const result = db
      .prepare(
        `INSERT INTO shared_products (product_id, owner_id, shared_with_email, shared_with_user_id, permission)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(productId, userId, normalizedEmail, targetUser?.id ?? null, perm);

    // Resolve product name and owner name for notifications
    const productRow = db
      .prepare('SELECT name FROM products WHERE id = ?')
      .get(productId) as { name: string } | undefined;
    const ownerRow = db
      .prepare('SELECT name FROM users WHERE id = ?')
      .get(userId) as { name: string } | undefined;
    const productName = productRow?.name ?? 'a product';
    const ownerName = ownerRow?.name ?? 'Someone';

    // In-app notification for registered target users
    if (targetUser) {
      try {
        db.prepare(
          `INSERT INTO in_app_notifications (user_id, product_id, type, title, message)
           VALUES (?, ?, 'product_shared', ?, ?)`,
        ).run(
          targetUser.id,
          productId,
          'Product Shared With You',
          `${ownerName} shared "${productName}" with you (${perm} access).`,
        );
      } catch (e) {
        logger.warn(e, 'Failed to insert share in-app notification');
      }
    }

    // Email notification to the target address (regardless of registration)
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    sendProductSharedEmail(normalizedEmail, ownerName, productName, perm, `${clientUrl}/shared`).catch((e) => {
      logger.warn(e, 'Failed to send product-shared email');
    });

    // Make Drive files accessible to anyone with the link
    if (userHasDriveAccess(userId)) {
      const driveIds = getDriveFileIdsForProduct(productId);
      await Promise.all(driveIds.map((id) => setFilePublicViewer(userId, id).catch((e) => {
        logger.warn(e, 'Failed to set Drive file public viewer');
      })));
    }

    const row = db
      .prepare('SELECT * FROM shared_products WHERE id = ?')
      .get(result.lastInsertRowid) as ShareRow;
    res.status(201).json({ data: mapShare(row) });
  } catch (err) {
    logger.error(err, 'Create share error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/sharing/:id
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid id' });
      return;
    }

    // Fetch the share before deleting so we have product_id and owner_id
    const share = db
      .prepare('SELECT product_id, owner_id FROM shared_products WHERE id = ? AND owner_id = ?')
      .get(id, userId) as { product_id: number; owner_id: number } | undefined;
    if (!share) {
      res.status(404).json({ error: 'Share not found' });
      return;
    }

    db.prepare('DELETE FROM shared_products WHERE id = ?').run(id);

    // If no shares remain for this product, revoke Drive public access
    const remaining = db
      .prepare('SELECT COUNT(*) as cnt FROM shared_products WHERE product_id = ?')
      .get(share.product_id) as { cnt: number };

    if (remaining.cnt === 0 && userHasDriveAccess(share.owner_id)) {
      const driveIds = getDriveFileIdsForProduct(share.product_id);
      await Promise.all(driveIds.map((fileId) => removeFilePublicViewer(share.owner_id, fileId).catch((e) => {
        logger.warn(e, 'Failed to remove Drive file public viewer');
      })));
    }

    res.json({ data: { message: 'Share removed' } });
  } catch (err) {
    logger.error(err, 'Delete share error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
