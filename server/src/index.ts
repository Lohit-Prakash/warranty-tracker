import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app';
import { startNotificationJob } from './services/notificationJob';
import { uploadsDir } from './middleware/multer';
import { logger } from './lib/logger';

const app = createApp();
const PORT = process.env.PORT || 3001;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

app.listen(PORT, () => {
  logger.info(`PurchaseVault server running on http://localhost:${PORT}`);
  logger.info(`Uploads served from: ${uploadsDir}`);
  logger.info(`Accepting requests from: ${CLIENT_URL}`);
});

startNotificationJob();

export default app;
