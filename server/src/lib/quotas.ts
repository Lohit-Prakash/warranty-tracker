import type Database from 'better-sqlite3';

export type Tier = 'free' | 'pro' | 'business';

export interface TierLimits {
  maxProducts: number;           // -1 = unlimited
  maxDocsPerProduct: number;     // -1 = unlimited
  maxSharesPerProduct: number;   // -1 = unlimited
  maxClaims: number;             // -1 = unlimited
  analyticsEnabled: boolean;
  exportEnabled: boolean;
  driveEnabled: boolean;
  alertThresholdCustomizable: boolean;
}

export const TIER_LIMITS: Record<Tier, TierLimits> = {
  free: {
    maxProducts: 5,
    maxDocsPerProduct: 1,
    maxSharesPerProduct: 0,
    maxClaims: 3,
    analyticsEnabled: false,
    exportEnabled: false,
    driveEnabled: false,
    alertThresholdCustomizable: false,
  },
  pro: {
    maxProducts: 100,
    maxDocsPerProduct: 10,
    maxSharesPerProduct: 3,
    maxClaims: 50,
    analyticsEnabled: true,
    exportEnabled: true,
    driveEnabled: true,
    alertThresholdCustomizable: true,
  },
  business: {
    maxProducts: -1,
    maxDocsPerProduct: -1,
    maxSharesPerProduct: 15,
    maxClaims: -1,
    analyticsEnabled: true,
    exportEnabled: true,
    driveEnabled: true,
    alertThresholdCustomizable: true,
  },
};

export function getUserTier(userId: number, db: InstanceType<typeof Database>): Tier {
  const row = db
    .prepare('SELECT subscription_tier, subscription_status FROM users WHERE id = ?')
    .get(userId) as { subscription_tier: string; subscription_status: string } | undefined;

  if (!row) return 'free';
  if (!['active', 'trialing'].includes(row.subscription_status)) return 'free';
  const tier = row.subscription_tier as Tier;
  return ['free', 'pro', 'business'].includes(tier) ? tier : 'free';
}
