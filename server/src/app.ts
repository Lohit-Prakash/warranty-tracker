import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';

// Initialize DB (runs table creation)
import './db/database';

import authRouter from './routes/auth';
import googleAuthRouter from './routes/googleAuth';
import productsRouter from './routes/products';
import profileRouter from './routes/profile';
import uploadsRouter from './routes/uploads';
import notificationsRouter from './routes/notifications';
import claimsRouter from './routes/claims';
import sharingRouter from './routes/sharing';
import subscriptionRouter from './routes/subscription';
import webhookRazorpayRouter from './routes/webhookRazorpay';
import { uploadsDir } from './middleware/multer';
import { logger } from './lib/logger';
import { apiLimiter } from './middleware/rateLimiter';
import { sanitizeInput } from './middleware/sanitize';

export function createApp() {
  const app = express();
  const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

  app.use(
    cors({
      origin: CLIENT_URL,
      credentials: true,
    }),
  );
  // Razorpay webhook — must be mounted BEFORE express.json() to get raw body
  app.post('/api/webhook/razorpay', express.raw({ type: 'application/json' }), webhookRazorpayRouter);

  app.use(express.json());
  app.use(cookieParser());
  app.use(sanitizeInput);

  // Skip http logging during tests to keep output clean
  if (process.env.NODE_ENV !== 'test') {
    app.use(pinoHttp({ logger }));
  }

  // Rate limiting (disabled in tests)
  if (process.env.NODE_ENV !== 'test') {
    app.use('/api', apiLimiter);
  }

  // Serve uploaded files statically (legacy, kept for backward compat)
  app.use('/uploads', express.static(uploadsDir));

  // --- Routes ---
  app.use('/api/auth', authRouter);
  app.use('/api/auth/google', googleAuthRouter);
  app.use('/api/products', productsRouter);
  app.use('/api/profile', profileRouter);
  app.use('/api/uploads', uploadsRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/claims', claimsRouter);
  app.use('/api/sharing', sharingRouter);
  app.use('/api/subscription', subscriptionRouter);

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });

  // Global error handler
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error(err, 'Unhandled error');
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
