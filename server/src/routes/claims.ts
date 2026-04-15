import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { enforceClaimsQuota } from '../middleware/quota';
import db from '../db/database';
import { logger } from '../lib/logger';

const router = Router();
router.use(authenticate);

interface ClaimRow {
  id: number;
  product_id: number;
  user_id: number;
  claim_date: string;
  issue_description: string;
  status: string;
  resolution: string | null;
  resolved_date: string | null;
  created_at: string;
  updated_at: string;
}

const VALID_STATUSES = ['submitted', 'in_progress', 'approved', 'denied', 'resolved'];

function mapClaim(row: ClaimRow) {
  return {
    id: row.id,
    productId: row.product_id,
    userId: row.user_id,
    claimDate: row.claim_date,
    issueDescription: row.issue_description,
    status: row.status,
    resolution: row.resolution,
    resolvedDate: row.resolved_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function userCanAccessProduct(productId: number, userId: number): boolean {
  const row = db
    .prepare('SELECT id FROM products WHERE id = ? AND user_id = ?')
    .get(productId, userId);
  if (row) return true;
  const userRow = db.prepare('SELECT email FROM users WHERE id = ?').get(userId) as { email: string } | undefined;
  const hasShare = db
    .prepare('SELECT id FROM shared_products WHERE product_id = ? AND (shared_with_user_id = ? OR shared_with_email = ?)')
    .get(productId, userId, userRow?.email ?? '');
  return !!hasShare;
}

// GET /api/claims/product/:productId
router.get('/product/:productId', (req: Request, res: Response): void => {
  try {
    const userId = req.user!.id;
    const productId = parseInt(req.params.productId, 10);
    if (isNaN(productId)) {
      res.status(400).json({ error: 'Invalid product id' });
      return;
    }
    if (!userCanAccessProduct(productId, userId)) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    const rows = db
      .prepare('SELECT * FROM warranty_claims WHERE product_id = ? ORDER BY claim_date DESC')
      .all(productId) as ClaimRow[];
    res.json({ data: rows.map(mapClaim) });
  } catch (err) {
    logger.error(err, 'List claims error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/claims
router.post('/', enforceClaimsQuota, (req: Request, res: Response): void => {
  try {
    const userId = req.user!.id;
    const { productId, claimDate, issueDescription } = req.body as {
      productId?: number;
      claimDate?: string;
      issueDescription?: string;
    };

    if (!productId || !Number.isInteger(productId)) {
      res.status(400).json({ error: 'productId is required' });
      return;
    }
    if (!claimDate || !/^\d{4}-\d{2}-\d{2}$/.test(claimDate)) {
      res.status(400).json({ error: 'claimDate must be YYYY-MM-DD' });
      return;
    }
    if (!issueDescription || typeof issueDescription !== 'string' || !issueDescription.trim()) {
      res.status(400).json({ error: 'issueDescription is required' });
      return;
    }
    if (!userCanAccessProduct(productId, userId)) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const result = db
      .prepare(
        `INSERT INTO warranty_claims (product_id, user_id, claim_date, issue_description)
         VALUES (?, ?, ?, ?)`,
      )
      .run(productId, userId, claimDate, issueDescription.trim());

    const row = db
      .prepare('SELECT * FROM warranty_claims WHERE id = ?')
      .get(result.lastInsertRowid) as ClaimRow;
    res.status(201).json({ data: mapClaim(row) });
  } catch (err) {
    logger.error(err, 'Create claim error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/claims/:id
router.put('/:id', (req: Request, res: Response): void => {
  try {
    const userId = req.user!.id;
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid id' });
      return;
    }
    const existing = db
      .prepare('SELECT * FROM warranty_claims WHERE id = ? AND user_id = ?')
      .get(id, userId) as ClaimRow | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Claim not found' });
      return;
    }

    const { claimDate, issueDescription, status, resolution, resolvedDate } = req.body as {
      claimDate?: string;
      issueDescription?: string;
      status?: string;
      resolution?: string | null;
      resolvedDate?: string | null;
    };

    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      res.status(400).json({ error: `status must be one of ${VALID_STATUSES.join(', ')}` });
      return;
    }

    db.prepare(
      `UPDATE warranty_claims SET
         claim_date = ?,
         issue_description = ?,
         status = ?,
         resolution = ?,
         resolved_date = ?,
         updated_at = datetime('now')
       WHERE id = ?`,
    ).run(
      claimDate ?? existing.claim_date,
      issueDescription?.trim() ?? existing.issue_description,
      status ?? existing.status,
      resolution !== undefined ? resolution : existing.resolution,
      resolvedDate !== undefined ? resolvedDate : existing.resolved_date,
      id,
    );

    const updated = db.prepare('SELECT * FROM warranty_claims WHERE id = ?').get(id) as ClaimRow;
    res.json({ data: mapClaim(updated) });
  } catch (err) {
    logger.error(err, 'Update claim error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/claims/:id
router.delete('/:id', (req: Request, res: Response): void => {
  try {
    const userId = req.user!.id;
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid id' });
      return;
    }
    const result = db
      .prepare('DELETE FROM warranty_claims WHERE id = ? AND user_id = ?')
      .run(id, userId);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Claim not found' });
      return;
    }
    res.json({ data: { message: 'Claim deleted' } });
  } catch (err) {
    logger.error(err, 'Delete claim error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
