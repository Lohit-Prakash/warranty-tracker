import cron from 'node-cron';
import db from '../db/database';
import { sendExpiringWarrantyEmail, sendExpiredWarrantyEmail } from './emailService';
import { logger } from '../lib/logger';

interface ProductWithUser {
  product_id: number;
  product_name: string;
  expiry_date: string;
  user_id: number;
  user_email: string;
  notification_email: string | null;
  alert_threshold: number;
}

interface NotificationLogRow {
  id: number;
}

type ExpiryGroup = Map<
  number,
  {
    user: { user_id: number; user_email: string; notification_email: string | null };
    products: Array<{ id: number; name: string; expiryDate: string; daysRemaining: number }>;
  }
>;

function todayString(): string {
  return new Date().toISOString().split('T')[0];
}

function alreadySentToday(
  productId: number,
  notificationType: string,
  today: string,
): boolean {
  const row = db
    .prepare(
      `SELECT id FROM notification_log
       WHERE product_id = ?
         AND notification_type = ?
         AND DATE(sent_at) = ?`,
    )
    .get(productId, notificationType, today) as NotificationLogRow | undefined;
  return Boolean(row);
}

function logNotificationSent(userId: number, productId: number, notificationType: string): void {
  db.prepare(
    `INSERT INTO notification_log (user_id, product_id, notification_type) VALUES (?, ?, ?)`,
  ).run(userId, productId, notificationType);
}

function insertInAppNotification(
  userId: number,
  productId: number,
  type: string,
  title: string,
  message: string,
): void {
  db.prepare(
    `INSERT INTO in_app_notifications (user_id, product_id, type, title, message)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(userId, productId, type, title, message);
}

/**
 * Send expiring-soon alerts for a specific day threshold (e.g. 30, 7, 1).
 * Uses SQLite date arithmetic to match each user's per-row threshold where needed,
 * or a fixed offset when called for secondary reminders.
 *
 * @param daysAhead    How many days ahead to check (expiry_date = today + daysAhead)
 * @param notifType    notification_type string stored in notification_log
 * @param emailSubject Short label used in the email/in-app title ("30 days", "7 days", etc.)
 * @param onlyIfThresholdGte  Only include users whose alert_threshold >= this value
 *                            (avoids sending a 30-day alert to a user who set threshold 7)
 * @param today        Today's date string (YYYY-MM-DD)
 */
async function runExpiringSoonAlerts(
  daysAhead: number,
  notifType: string,
  daysLabel: string,
  onlyIfThresholdGte: number,
  today: string,
): Promise<void> {
  const targetDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    return d.toISOString().split('T')[0];
  })();

  const rows = db
    .prepare(
      `SELECT
        p.id          AS product_id,
        p.name        AS product_name,
        p.expiry_date,
        u.id          AS user_id,
        u.email       AS user_email,
        u.notification_email,
        u.alert_threshold
       FROM products p
       JOIN users u ON p.user_id = u.id
       WHERE p.expiry_date = ?
         AND u.notifications_enabled = 1
         AND u.alert_threshold >= ?`,
    )
    .all(targetDate, onlyIfThresholdGte) as ProductWithUser[];

  if (rows.length === 0) return;

  // Group by user, skip already-notified products
  const byUser: ExpiryGroup = new Map();

  for (const row of rows) {
    if (alreadySentToday(row.product_id, notifType, today)) {
      logger.debug({ productId: row.product_id, notifType }, 'Skipping duplicate notification');
      continue;
    }

    if (!byUser.has(row.user_id)) {
      byUser.set(row.user_id, {
        user: {
          user_id: row.user_id,
          user_email: row.user_email,
          notification_email: row.notification_email,
        },
        products: [],
      });
    }

    byUser.get(row.user_id)!.products.push({
      id: row.product_id,
      name: row.product_name,
      expiryDate: row.expiry_date,
      daysRemaining: daysAhead,
    });
  }

  for (const [, { user, products }] of byUser) {
    if (products.length === 0) continue;
    const emailTo = user.notification_email || user.user_email;

    try {
      await sendExpiringWarrantyEmail(
        emailTo,
        products.map((p) => ({ name: p.name, expiryDate: p.expiryDate, daysRemaining: p.daysRemaining })),
      );
      logger.info({ emailTo, count: products.length, notifType }, 'Sent expiring email');

      for (const product of products) {
        logNotificationSent(user.user_id, product.id, notifType);

        const title = `Warranty Expiring in ${daysLabel}`;
        const message = `Your ${product.name} warranty expires on ${product.expiryDate}.`;
        insertInAppNotification(user.user_id, product.id, notifType, title, message);
      }
    } catch (emailErr) {
      logger.error({ emailTo, err: emailErr, notifType }, 'Failed to send expiring email');
    }
  }
}

async function runExpiredAlerts(today: string): Promise<void> {
  const rows = db
    .prepare(
      `SELECT
        p.id          AS product_id,
        p.name        AS product_name,
        p.expiry_date,
        u.id          AS user_id,
        u.email       AS user_email,
        u.notification_email,
        u.alert_threshold
       FROM products p
       JOIN users u ON p.user_id = u.id
       WHERE p.expiry_date = ?
         AND u.notifications_enabled = 1`,
    )
    .all(today) as ProductWithUser[];

  if (rows.length === 0) return;

  type ExpiredGroup = Map<
    number,
    {
      user: { user_id: number; user_email: string; notification_email: string | null };
      products: Array<{ id: number; name: string; expiryDate: string }>;
    }
  >;

  const byUser: ExpiredGroup = new Map();

  for (const row of rows) {
    if (alreadySentToday(row.product_id, 'expired', today)) {
      logger.debug({ productId: row.product_id }, 'Skipping duplicate expired notification');
      continue;
    }

    if (!byUser.has(row.user_id)) {
      byUser.set(row.user_id, {
        user: {
          user_id: row.user_id,
          user_email: row.user_email,
          notification_email: row.notification_email,
        },
        products: [],
      });
    }

    byUser.get(row.user_id)!.products.push({
      id: row.product_id,
      name: row.product_name,
      expiryDate: row.expiry_date,
    });
  }

  for (const [, { user, products }] of byUser) {
    if (products.length === 0) continue;
    const emailTo = user.notification_email || user.user_email;

    try {
      await sendExpiredWarrantyEmail(
        emailTo,
        products.map((p) => ({ name: p.name, expiryDate: p.expiryDate })),
      );
      logger.info({ emailTo, count: products.length }, 'Sent expired email');

      for (const product of products) {
        logNotificationSent(user.user_id, product.id, 'expired');

        insertInAppNotification(
          user.user_id,
          product.id,
          'expired',
          'Warranty Expired',
          `Your ${product.name} warranty expired today (${product.expiryDate}).`,
        );
      }
    } catch (emailErr) {
      logger.error({ emailTo, err: emailErr }, 'Failed to send expired email');
    }
  }
}

/**
 * Also send alerts for the user's configured threshold (any value not already
 * covered by the fixed milestones above).  This handles custom thresholds like
 * 14, 60, 90 days that are not in the fixed-milestone list.
 */
async function runThresholdAlerts(today: string): Promise<void> {
  // Get all distinct alert_threshold values in use (excluding the fixed milestones
  // we already cover: 1, 7, 30 — those run separately with correct onlyIfThresholdGte).
  // We still want custom thresholds (14, 60, 90) to fire their primary alert.
  const thresholds = db
    .prepare(
      `SELECT DISTINCT alert_threshold
       FROM users
       WHERE notifications_enabled = 1
         AND alert_threshold NOT IN (1, 7, 30)`,
    )
    .all() as Array<{ alert_threshold: number }>;

  for (const { alert_threshold } of thresholds) {
    await runExpiringSoonAlerts(
      alert_threshold,
      `expiring_${alert_threshold}d`,
      `${alert_threshold} days`,
      alert_threshold,
      today,
    );
  }
}

export async function runNotificationJob(): Promise<void> {
  const today = todayString();
  logger.info({ today }, 'NotificationJob running');

  try {
    // --- Fixed milestones ---
    // 30-day alert: only for users with threshold >= 30
    await runExpiringSoonAlerts(30, 'expiring_30d', '30 days', 30, today);

    // 7-day alert: for users with threshold >= 7 (catches thresholds 7, 14, 30, 60, 90)
    await runExpiringSoonAlerts(7, 'expiring_7d', '7 days', 7, today);

    // 1-day alert: for all users who have notifications enabled
    await runExpiringSoonAlerts(1, 'expiring_1d', '1 day', 1, today);

    // --- Custom thresholds (14, 60, 90, etc.) primary alert ---
    await runThresholdAlerts(today);

    // --- Expired today ---
    await runExpiredAlerts(today);

    logger.info('NotificationJob completed successfully');
  } catch (err) {
    logger.error(err, 'NotificationJob failed');
  }
}

export function startNotificationJob(): void {
  cron.schedule('0 8 * * *', runNotificationJob, {
    timezone: 'UTC',
  });
  logger.info('NotificationJob scheduled daily at 08:00 UTC');
}
