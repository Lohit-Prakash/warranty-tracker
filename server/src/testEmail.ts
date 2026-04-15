/**
 * One-off script to manually trigger the notification job for testing.
 * Run with: npx ts-node src/testEmail.ts
 * Delete this file when done testing.
 */
import 'dotenv/config';
import { runNotificationJob } from './services/notificationJob';

console.log('Triggering notification job...');
runNotificationJob()
  .then(() => {
    console.log('Done. Check your Mailtrap inbox (or Gmail).');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Job failed:', err);
    process.exit(1);
  });
