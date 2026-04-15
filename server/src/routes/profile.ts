import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import db from '../db/database';
import { authenticate } from '../middleware/auth';
import { logger } from '../lib/logger';

const router = Router();

router.use(authenticate);

interface UserRow {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  notification_email: string | null;
  notifications_enabled: number;
  alert_threshold: number;
  created_at: string;
}

function formatUser(user: Omit<UserRow, 'password_hash'>) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    notificationEmail: user.notification_email,
    notificationsEnabled: Boolean(user.notifications_enabled),
    alertThreshold: user.alert_threshold ?? 30,
    createdAt: user.created_at,
  };
}

// GET /api/profile
router.get('/', (req: Request, res: Response): void => {
  try {
    const user = db
      .prepare(
        'SELECT id, name, email, notification_email, notifications_enabled, alert_threshold, created_at FROM users WHERE id = ?'
      )
      .get(req.user!.id) as Omit<UserRow, 'password_hash'> | undefined;

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ data: formatUser(user) });
  } catch (err) {
    logger.error(err, 'Get profile error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/profile
router.put('/', (req: Request, res: Response): void => {
  try {
    const userId = req.user!.id;
    const { name, email, notification_email, notifications_enabled, alert_threshold } = req.body;

    const currentUser = db
      .prepare(
        'SELECT id, name, email, notification_email, notifications_enabled, alert_threshold, created_at FROM users WHERE id = ?'
      )
      .get(userId) as Omit<UserRow, 'password_hash'> | undefined;

    if (!currentUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
      res.status(400).json({ error: 'Name cannot be empty' });
      return;
    }

    let newEmail = currentUser.email;
    if (email !== undefined) {
      if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        res.status(400).json({ error: 'Valid email is required' });
        return;
      }
      newEmail = email.toLowerCase();

      if (newEmail !== currentUser.email) {
        const existing = db
          .prepare('SELECT id FROM users WHERE email = ? AND id != ?')
          .get(newEmail, userId);
        if (existing) {
          res.status(409).json({ error: 'Email already in use' });
          return;
        }
      }
    }

    const updatedName = name !== undefined ? name.trim() : currentUser.name;
    const updatedNotificationEmail =
      notification_email !== undefined
        ? notification_email?.trim() || null
        : currentUser.notification_email;
    const updatedNotificationsEnabled =
      notifications_enabled !== undefined
        ? notifications_enabled ? 1 : 0
        : currentUser.notifications_enabled;
    const updatedAlertThreshold =
      alert_threshold !== undefined
        ? Math.max(1, Math.min(365, parseInt(alert_threshold, 10) || 30))
        : (currentUser.alert_threshold ?? 30);

    db.prepare(
      `UPDATE users SET
        name = ?,
        email = ?,
        notification_email = ?,
        notifications_enabled = ?,
        alert_threshold = ?
      WHERE id = ?`
    ).run(updatedName, newEmail, updatedNotificationEmail, updatedNotificationsEnabled, updatedAlertThreshold, userId);

    const updatedUser = db
      .prepare(
        'SELECT id, name, email, notification_email, notifications_enabled, alert_threshold, created_at FROM users WHERE id = ?'
      )
      .get(userId) as Omit<UserRow, 'password_hash'>;

    res.json({ data: formatUser(updatedUser) });
  } catch (err) {
    logger.error(err, 'Update profile error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/profile/password
router.put('/password', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'Current password and new password are required' });
      return;
    }
    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters' });
      return;
    }

    const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId) as { password_hash: string } | undefined;
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const match = await bcrypt.compare(currentPassword, user.password_hash);
    if (!match) {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }

    const hash = await bcrypt.hash(newPassword, 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, userId);

    res.json({ data: { message: 'Password changed successfully' } });
  } catch (err) {
    logger.error(err, 'Change password error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
