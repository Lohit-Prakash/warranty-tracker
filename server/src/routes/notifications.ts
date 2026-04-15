import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import db from '../db/database';
import { logger } from '../lib/logger';

const router = Router();
router.use(authenticate);

interface NotificationRow {
  id: number;
  user_id: number;
  product_id: number | null;
  type: string;
  title: string;
  message: string;
  read: number;
  created_at: string;
}

// GET /api/notifications
router.get('/', (req: Request, res: Response): void => {
  try {
    const userId = req.user!.id;
    const unreadOnly = req.query.unread_only === 'true';

    let query = 'SELECT * FROM in_app_notifications WHERE user_id = ?';
    if (unreadOnly) query += ' AND read = 0';
    query += ' ORDER BY created_at DESC LIMIT 50';

    const notifications = db.prepare(query).all(userId) as NotificationRow[];

    const unreadCount = (db.prepare(
      'SELECT COUNT(*) as count FROM in_app_notifications WHERE user_id = ? AND read = 0'
    ).get(userId) as { count: number }).count;

    res.json({
      data: {
        notifications: notifications.map((n) => ({
          id: n.id,
          productId: n.product_id,
          type: n.type,
          title: n.title,
          message: n.message,
          read: Boolean(n.read),
          createdAt: n.created_at,
        })),
        unreadCount,
      },
    });
  } catch (err) {
    logger.error(err, 'Get notifications error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', (req: Request, res: Response): void => {
  try {
    const userId = req.user!.id;
    const notifId = parseInt(req.params.id, 10);

    db.prepare(
      'UPDATE in_app_notifications SET read = 1 WHERE id = ? AND user_id = ?'
    ).run(notifId, userId);

    res.json({ data: { message: 'Marked as read' } });
  } catch (err) {
    logger.error(err, 'Mark notification read error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/notifications/read-all
router.put('/read-all', (req: Request, res: Response): void => {
  try {
    const userId = req.user!.id;
    db.prepare('UPDATE in_app_notifications SET read = 1 WHERE user_id = ?').run(userId);
    res.json({ data: { message: 'All notifications marked as read' } });
  } catch (err) {
    logger.error(err, 'Mark all notifications read error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/notifications/:id
router.delete('/:id', (req: Request, res: Response): void => {
  try {
    const userId = req.user!.id;
    const notifId = parseInt(req.params.id, 10);

    db.prepare('DELETE FROM in_app_notifications WHERE id = ? AND user_id = ?').run(notifId, userId);
    res.json({ data: { message: 'Notification deleted' } });
  } catch (err) {
    logger.error(err, 'Delete notification error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
