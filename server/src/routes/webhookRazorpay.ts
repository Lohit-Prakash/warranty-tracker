import { Router, Request, Response } from 'express';
import db from '../db/database';
import { verifyWebhookSignature } from '../services/razorpayService';
import { logger } from '../lib/logger';

const router = Router();

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

router.post('/', (req: Request, res: Response): void => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    res.status(500).json({ error: 'Webhook secret not configured' });
    return;
  }

  const signature = req.headers['x-razorpay-signature'] as string;
  const eventId = req.headers['x-razorpay-event-id'] as string;
  const rawBody = (req as unknown as { body: Buffer }).body.toString('utf8');

  if (!verifyWebhookSignature(rawBody, signature, secret)) {
    logger.warn('Invalid Razorpay webhook signature');
    res.status(400).json({ error: 'Invalid signature' });
    return;
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    res.status(400).json({ error: 'Invalid JSON' });
    return;
  }

  const eventType = payload.event as string;

  // Idempotency: skip if already processed
  const existing = db
    .prepare('SELECT processed FROM razorpay_events WHERE event_id = ?')
    .get(eventId) as { processed: number } | undefined;

  if (existing) {
    if (existing.processed === 1) {
      res.status(200).json({ status: 'already_processed' });
      return;
    }
  } else {
    db.prepare(
      'INSERT OR IGNORE INTO razorpay_events (event_id, event_type, payload) VALUES (?, ?, ?)'
    ).run(eventId ?? `${eventType}_${Date.now()}`, eventType, rawBody);
  }

  try {
    const subPayload = (payload.payload as Record<string, unknown>)?.subscription as
      | Record<string, unknown>
      | undefined;
    const paymentPayload = (payload.payload as Record<string, unknown>)?.payment as
      | Record<string, unknown>
      | undefined;

    const sub = (subPayload?.entity ?? subPayload) as Record<string, unknown> | undefined;
    const payment = (paymentPayload?.entity ?? paymentPayload) as Record<string, unknown> | undefined;

    switch (eventType) {
      case 'subscription.activated': {
        const subscriptionId = sub?.id as string;
        const planId = sub?.plan_id as string;
        const periodEnd = sub?.current_end
          ? new Date((sub.current_end as number) * 1000).toISOString()
          : null;
        const tier = tierFromPlanId(planId);

        const row = db
          .prepare('SELECT user_id FROM subscriptions WHERE razorpay_subscription_id = ?')
          .get(subscriptionId) as { user_id: number } | undefined;

        if (row) {
          db.prepare(`UPDATE users SET subscription_tier = ?, subscription_status = 'active', subscription_current_period_end = ? WHERE id = ?`)
            .run(tier, periodEnd, row.user_id);
          db.prepare(`UPDATE subscriptions SET status = 'active', tier = ?, current_period_end = ?, updated_at = datetime('now') WHERE user_id = ?`)
            .run(tier, periodEnd, row.user_id);
        }
        break;
      }

      case 'subscription.charged': {
        const subscriptionId = (sub?.id ?? payment?.subscription_id) as string;
        const periodEnd = sub?.current_end
          ? new Date((sub.current_end as number) * 1000).toISOString()
          : null;

        const row = db
          .prepare('SELECT user_id, tier FROM subscriptions WHERE razorpay_subscription_id = ?')
          .get(subscriptionId) as { user_id: number; tier: string } | undefined;

        if (row) {
          db.prepare(`UPDATE users SET subscription_status = 'active', subscription_current_period_end = ? WHERE id = ?`)
            .run(periodEnd, row.user_id);
          db.prepare(`UPDATE subscriptions SET current_period_end = ?, updated_at = datetime('now') WHERE user_id = ?`)
            .run(periodEnd, row.user_id);

          if (payment?.id) {
            db.prepare(`
              INSERT OR IGNORE INTO payments (user_id, razorpay_payment_id, razorpay_subscription_id, amount, currency, status, tier)
              VALUES (?, ?, ?, ?, ?, 'captured', ?)
            `).run(
              row.user_id,
              payment.id,
              subscriptionId,
              payment.amount ?? 0,
              payment.currency ?? 'INR',
              row.tier
            );
          }
        }
        break;
      }

      case 'subscription.pending':
      case 'subscription.halted': {
        const subscriptionId = sub?.id as string;
        const row = db
          .prepare('SELECT user_id FROM subscriptions WHERE razorpay_subscription_id = ?')
          .get(subscriptionId) as { user_id: number } | undefined;
        if (row) {
          db.prepare(`UPDATE users SET subscription_status = 'past_due' WHERE id = ?`).run(row.user_id);
          db.prepare(`UPDATE subscriptions SET status = ?, updated_at = datetime('now') WHERE user_id = ?`)
            .run(eventType === 'subscription.halted' ? 'halted' : 'pending', row.user_id);
        }
        break;
      }

      case 'subscription.cancelled':
      case 'subscription.completed':
      case 'subscription.expired': {
        const subscriptionId = sub?.id as string;
        const row = db
          .prepare('SELECT user_id FROM subscriptions WHERE razorpay_subscription_id = ?')
          .get(subscriptionId) as { user_id: number } | undefined;
        if (row) {
          db.prepare(`UPDATE users SET subscription_tier = 'free', subscription_status = 'cancelled', subscription_current_period_end = NULL WHERE id = ?`)
            .run(row.user_id);
          db.prepare(`UPDATE subscriptions SET status = 'cancelled', tier = 'free', cancelled_at = datetime('now'), updated_at = datetime('now') WHERE user_id = ?`)
            .run(row.user_id);
        }
        break;
      }

      case 'payment.failed': {
        const subscriptionId = payment?.subscription_id as string | undefined;
        const row = subscriptionId
          ? db.prepare('SELECT user_id, tier FROM subscriptions WHERE razorpay_subscription_id = ?')
              .get(subscriptionId) as { user_id: number; tier: string } | undefined
          : undefined;

        if (row && payment?.id) {
          db.prepare(`
            INSERT OR IGNORE INTO payments (user_id, razorpay_payment_id, razorpay_subscription_id, amount, currency, status, tier)
            VALUES (?, ?, ?, ?, ?, 'failed', ?)
          `).run(
            row.user_id,
            payment.id,
            subscriptionId,
            payment.amount ?? 0,
            payment.currency ?? 'INR',
            row.tier
          );
        }
        break;
      }

      default:
        logger.info({ eventType }, 'Unhandled Razorpay webhook event');
    }

    // Mark as processed
    db.prepare('UPDATE razorpay_events SET processed = 1 WHERE event_id = ?').run(eventId);
    res.status(200).json({ status: 'ok' });
  } catch (err) {
    logger.error({ err, eventType }, 'Error processing Razorpay webhook');
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;
