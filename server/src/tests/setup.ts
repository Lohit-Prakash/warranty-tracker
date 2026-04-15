import fs from 'fs';
import path from 'path';

// Use a separate test database
process.env.NODE_ENV = 'test';
process.env.DB_PATH = path.join(__dirname, '../../.test-data/test.db');
process.env.JWT_SECRET = 'test-secret-do-not-use-in-production';
process.env.UPLOADS_DIR = path.join(__dirname, '../../.test-data/uploads');

// Ensure directories exist and DB is fresh
const dbDir = path.dirname(process.env.DB_PATH);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
if (!fs.existsSync(process.env.UPLOADS_DIR)) fs.mkdirSync(process.env.UPLOADS_DIR, { recursive: true });

// Remove previous test DB so each run starts fresh
const files = [
  process.env.DB_PATH,
  `${process.env.DB_PATH}-wal`,
  `${process.env.DB_PATH}-shm`,
];
files.forEach((f) => {
  if (fs.existsSync(f)) fs.unlinkSync(f);
});
