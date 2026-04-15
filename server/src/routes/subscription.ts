import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import db from '../db/database';
import { createCustomer, createSubscription, cancelSubscription } from '../services/razorpayService';
import { logger } from '../lib/logger';

const router = Router();
router.use(authenticate);

const PLAN_IDS = new Set([
  process.env.RAZORPAY_PLAN_ID_PRO_MONTHLY,
  process.env.RAZORPAY_PLAN_ID_PRO_YEARLY,
  process.env.RAZORPAY_PLAN_ID_BUSINESS_MONTHLY,
  process.env.RAZORPAY_PLAN_ID_BUSINESS_YEARLY,
]);

function tierFromPlanId(planId: string): string {
  if (
    planId === process.env.RAZORPAY_PLAN_ID_PRO_MONTHLY ||
    planId === process.env.RAZORPAY_PLAN_ID_PRO_YEARLY
  ) return 'pro';
  if (
    planId === process.env.RAZORPAY_PLAN_ID_BUSINESS_MONTHLY ||
    planId === process.env.RAZORPAY_PLAN_ID_BUSINESS_YEARLY
  ) return 'business';
  return 'free';
}

// GET /api/subscription — current subscription status
router.get('/', (req: Request, res: Response): void => {
  const userId = req.user!.id;
  const user = db
    .prepare(
      'SELECT subscription_tier, subscription_status, subscription_current_period_end, razorpay_customer_id FROM users WHERE id = ?'
    )
    .get(userId) as {
      subscription_tier: string;
      subscription_status: string;
      subscription_current_period_end: string | null;
      razorpay_customer_id: string | null;
    } | undefined;

  const sub = db
    .prepare('SELECT * FROM subscriptions WHERE user_id = ?')
    .get(userId) as {
      razorpay_subscription_id: string | null;
      cancel_at_period_end: number;
    } | undefined;

  res.json({
    data: {
      tier: user?.subscription_tier ?? 'free',
      status: user?.subscription_status ?? 'active',
      periodEnd: user?.subscription_current_period_end ?? null,
      cancelAtPeriodEnd: sub?.cancel_at_period_end === 1,
      razorpaySubscriptionId: sub?.razorpay_subscription_id ?? null,
    },
  });
});

// POST /api/subscription/create
router.post('/create', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const { planId } = req.body as { planId: string };

  if (!planId || !PLAN_IDS.has(planId)) {
    res.status(400).json({ error: 'Invalid plan' });
    return;
  }

  try {
    const user = db
      .prepare('SELECT name, email, razorpay_customer_id FROM users WHERE id = ?')
      .get(userId) as { name: string; email: string; razorpay_customer_id: string | null };

    // Get or create Razorpay customer
    let customerId = user.razorpay_customer_id;
    if (!customerId) {
      customerId = await createCustomer(user.name, user.email);
      db.prepare('UPDATE users SET razorpay_customer_id = ? WHERE id = ?').run(customerId, userId);
    }

    // Yearly plans get 12 billing cycles, monthly plans get 120 (10 years, effectively recurring)
    const isYearly =
      planId === process.env.RAZORPAY_PLAN_ID_PRO_YEARLY ||
      planId === process.env.RAZORPAY_PLAN_ID_BUSINESS_YEARLY;
    const totalCount = isYearly ? 12 : 120;

    const { subscriptionId, shortUrl } = await createSubscription(customerId, planId, totalCount);

    // Upsert into subscriptions table
    db.prepare(`
      INSERT INTO subscriptions (user_id, razorpay_subscription_id, razorpay_plan_id, status, tier, updated_at)
      VALUES (?, ?, ?, 'created', ?, datetime('now'))
      ON CONFLICT(user_id) DO UPDATE SET
        razorpay_subscription_id = excluded.razorpay_subscription_id,
        razorpay_plan_id = excluded.razorpay_plan_id,
        status = 'created',
        tier = excluded.tier,
        updated_at = datetime('now')
    `).run(userId, subscriptionId, planId, tierFromPlanId(planId));

    res.json({ data: { subscriptionId, paymentUrl: shortUrl } });
  } catch (err) {
    logger.error({ err }, 'Failed to create subscription');
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

// POST /api/subscription/cancel
router.post('/cancel', async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const { atPeriodEnd = true } = req.body as { atPeriodEnd?: boolean };

  const sub = db
    .prepare('SELECT razorpay_subscription_id FROM subscriptions WHERE user_id = ?')
    .get(userId) as { razorpay_subscription_id: string | null } | undefined;

  if (!sub?.razorpay_subscription_id) {
    res.status(400).json({ error: 'No active subscription found' });
    return;
  }

  try {
    await cancelSubscription(sub.razorpay_subscription_id, atPeriodEnd);
    db.prepare(`
      UPDATE subscriptions SET cancel_at_period_end = ?, cancelled_at = datetime('now'), updated_at = datetime('now')
      WHERE user_id = ?
    `).run(atPeriodEnd ? 1 : 0, userId);

    res.json({ data: { cancelled: true, atPeriodEnd } });
  } catch (err) {
    logger.error({ err }, 'Failed to cancel subscription');
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

export default router;
