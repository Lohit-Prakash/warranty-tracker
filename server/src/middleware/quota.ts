import { Request, Response, NextFunction } from 'express';
import db from '../db/database';
import { getUserTier, TIER_LIMITS, TierLimits } from '../lib/quotas';

function quotaExceeded(
  res: Response,
  feature: string,
  limit: number,
  current: number,
  tier: string
): void {
  res.status(402).json({
    error: 'quota_exceeded',
    feature,
    limit,
    current,
    tier,
    upgradeUrl: '/pricing',
  });
}

export function enforceProductQuota(req: Request, res: Response, next: NextFunction): void {
  const userId = req.user!.id;
  const tier = getUserTier(userId, db);
  const limits = TIER_LIMITS[tier];

  if (limits.maxProducts === -1) { next(); return; }

  const row = db
    .prepare('SELECT COUNT(*) as count FROM products WHERE user_id = ?')
    .get(userId) as { count: number };

  if (row.count >= limits.maxProducts) {
    quotaExceeded(res, 'products', limits.maxProducts, row.count, tier);
    return;
  }
  next();
}

export function enforceDocumentQuota(req: Request, res: Response, next: NextFunction): void {
  const userId = req.user!.id;
  const productId = parseInt(req.params.id, 10);
  const tier = getUserTier(userId, db);
  const limits = TIER_LIMITS[tier];

  if (limits.maxDocsPerProduct === -1) { next(); return; }

  // Verify the product belongs to this user
  const product = db
    .prepare('SELECT id FROM products WHERE id = ? AND user_id = ?')
    .get(productId, userId);
  if (!product) { next(); return; } // let the route handle 404

  const row = db
    .prepare('SELECT COUNT(*) as count FROM product_documents WHERE product_id = ?')
    .get(productId) as { count: number };

  if (row.count >= limits.maxDocsPerProduct) {
    quotaExceeded(res, 'documents', limits.maxDocsPerProduct, row.count, tier);
    return;
  }
  next();
}

export function enforceSharingQuota(req: Request, res: Response, next: NextFunction): void {
  const userId = req.user!.id;
  const productId = parseInt(req.body.productId, 10);
  const tier = getUserTier(userId, db);
  const limits = TIER_LIMITS[tier];

  if (limits.maxSharesPerProduct === -1) { next(); return; }

  if (limits.maxSharesPerProduct === 0) {
    quotaExceeded(res, 'sharing', 0, 1, tier);
    return;
  }

  const row = db
    .prepare('SELECT COUNT(*) as count FROM shared_products WHERE product_id = ? AND owner_id = ?')
    .get(productId, userId) as { count: number };

  if (row.count >= limits.maxSharesPerProduct) {
    quotaExceeded(res, 'sharing', limits.maxSharesPerProduct, row.count, tier);
    return;
  }
  next();
}

export function enforceClaimsQuota(req: Request, res: Response, next: NextFunction): void {
  const userId = req.user!.id;
  const tier = getUserTier(userId, db);
  const limits = TIER_LIMITS[tier];

  if (limits.maxClaims === -1) { next(); return; }

  const row = db
    .prepare('SELECT COUNT(*) as count FROM warranty_claims WHERE user_id = ?')
    .get(userId) as { count: number };

  if (row.count >= limits.maxClaims) {
    quotaExceeded(res, 'claims', limits.maxClaims, row.count, tier);
    return;
  }
  next();
}

export function requireFeature(feature: keyof TierLimits) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userId = req.user!.id;
    const tier = getUserTier(userId, db);
    const limits = TIER_LIMITS[tier];

    if (!limits[feature]) {
      quotaExceeded(res, String(feature), 0, 1, tier);
      return;
    }
    next();
  };
}
