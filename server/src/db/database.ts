import Database from 'better-sqlite3';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const dbPath = process.env.DB_PATH || './purchasevault.db';

const db = new Database(path.resolve(dbPath));

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    notification_email TEXT,
    notifications_enabled INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    brand TEXT,
    category TEXT DEFAULT 'Other',
    purchase_date TEXT NOT NULL,
    expiry_date TEXT,
    serial_number TEXT,
    store_name TEXT,
    notes TEXT,
    document_path TEXT,
    price REAL,
    currency TEXT DEFAULT 'USD',
    photo_path TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS notification_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    notification_type TEXT NOT NULL,
    sent_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  );

  -- Migration: add lockout columns if not present
`);

const columns = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
const colNames = columns.map((c) => c.name);
if (!colNames.includes('failed_login_attempts')) {
  db.exec('ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0');
}
if (!colNames.includes('locked_until')) {
  db.exec('ALTER TABLE users ADD COLUMN locked_until TEXT DEFAULT NULL');
}
if (!colNames.includes('alert_threshold')) {
  db.exec('ALTER TABLE users ADD COLUMN alert_threshold INTEGER DEFAULT 30');
}

// Migration: add new columns to products if missing
const productCols = (db.prepare("PRAGMA table_info(products)").all() as Array<{ name: string; notnull: number }>);
const productColNames = productCols.map((c) => c.name);
if (!productColNames.includes('price')) {
  db.exec('ALTER TABLE products ADD COLUMN price REAL');
}
if (!productColNames.includes('currency')) {
  db.exec("ALTER TABLE products ADD COLUMN currency TEXT DEFAULT 'USD'");
}
if (!productColNames.includes('photo_path')) {
  db.exec('ALTER TABLE products ADD COLUMN photo_path TEXT');
}
if (!productColNames.includes('google_drive_folder_id')) {
  db.exec('ALTER TABLE products ADD COLUMN google_drive_folder_id TEXT');
}

// Migration: Google OAuth columns on users
const googleCols = (db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>).map((c) => c.name);
if (!googleCols.includes('google_id'))
  db.exec('ALTER TABLE users ADD COLUMN google_id TEXT');
if (!googleCols.includes('google_refresh_token'))
  db.exec('ALTER TABLE users ADD COLUMN google_refresh_token TEXT');
if (!googleCols.includes('google_drive_folder_id'))
  db.exec('ALTER TABLE users ADD COLUMN google_drive_folder_id TEXT');
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL');

// Migration: storage_type on product_documents
const docCols = (db.prepare('PRAGMA table_info(product_documents)').all() as Array<{ name: string }>).map((c) => c.name);
if (!docCols.includes('storage_type'))
  db.exec("ALTER TABLE product_documents ADD COLUMN storage_type TEXT DEFAULT 'local'");

// Migration: drop NOT NULL constraint on expiry_date for existing DBs
// SQLite can't ALTER constraints, so we must rebuild the table if needed
const expiryCol = productCols.find((c) => c.name === 'expiry_date');
if (expiryCol && expiryCol.notnull === 1) {
  db.exec(`
    PRAGMA foreign_keys = OFF;
    BEGIN TRANSACTION;
    CREATE TABLE products_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      brand TEXT,
      category TEXT DEFAULT 'Other',
      purchase_date TEXT NOT NULL,
      expiry_date TEXT,
      serial_number TEXT,
      store_name TEXT,
      notes TEXT,
      document_path TEXT,
      price REAL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    INSERT INTO products_new (id, user_id, name, brand, category, purchase_date, expiry_date, serial_number, store_name, notes, document_path, price, created_at, updated_at)
      SELECT id, user_id, name, brand, category, purchase_date, expiry_date, serial_number, store_name, notes, document_path, NULL, created_at, updated_at FROM products;
    DROP TABLE products;
    ALTER TABLE products_new RENAME TO products;
    COMMIT;
    PRAGMA foreign_keys = ON;
  `);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    used INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS in_app_notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    product_id INTEGER,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
  );

  -- Indexes for performance
  CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);
  CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
  CREATE INDEX IF NOT EXISTS idx_products_expiry_date ON products(expiry_date);
  CREATE INDEX IF NOT EXISTS idx_products_purchase_date ON products(purchase_date);
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_notification_log_user_id ON notification_log(user_id);
  CREATE INDEX IF NOT EXISTS idx_notification_log_product_id ON notification_log(product_id);
  CREATE INDEX IF NOT EXISTS idx_notification_log_sent_at ON notification_log(sent_at);
  CREATE INDEX IF NOT EXISTS idx_in_app_notifications_user_id ON in_app_notifications(user_id);
  CREATE INDEX IF NOT EXISTS idx_in_app_notifications_read ON in_app_notifications(read);
  CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);

  CREATE TABLE IF NOT EXISTS product_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_product_documents_product_id ON product_documents(product_id);

  CREATE TABLE IF NOT EXISTS warranty_claims (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    claim_date TEXT NOT NULL,
    issue_description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'submitted',
    resolution TEXT,
    resolved_date TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_warranty_claims_product_id ON warranty_claims(product_id);
  CREATE INDEX IF NOT EXISTS idx_warranty_claims_user_id ON warranty_claims(user_id);

  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    revoked INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
  CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);

  CREATE TABLE IF NOT EXISTS shared_products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL,
    owner_id INTEGER NOT NULL,
    shared_with_email TEXT NOT NULL,
    shared_with_user_id INTEGER,
    permission TEXT NOT NULL DEFAULT 'view',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (shared_with_user_id) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_shared_products_product_id ON shared_products(product_id);
  CREATE INDEX IF NOT EXISTS idx_shared_products_shared_with_user_id ON shared_products(shared_with_user_id);
  CREATE INDEX IF NOT EXISTS idx_shared_products_email ON shared_products(shared_with_email);
`);

// Migration: subscription columns on users
const subUserCols = (db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>).map((c) => c.name);
if (!subUserCols.includes('subscription_tier'))
  db.exec("ALTER TABLE users ADD COLUMN subscription_tier TEXT DEFAULT 'free'");
if (!subUserCols.includes('subscription_status'))
  db.exec("ALTER TABLE users ADD COLUMN subscription_status TEXT DEFAULT 'active'");
if (!subUserCols.includes('razorpay_customer_id'))
  db.exec('ALTER TABLE users ADD COLUMN razorpay_customer_id TEXT');
if (!subUserCols.includes('subscription_current_period_end'))
  db.exec('ALTER TABLE users ADD COLUMN subscription_current_period_end TEXT');

// Migration: subscription, payment, and webhook event tables
db.exec(`
  CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    razorpay_subscription_id TEXT UNIQUE,
    razorpay_plan_id TEXT,
    status TEXT NOT NULL DEFAULT 'created',
    tier TEXT NOT NULL DEFAULT 'free',
    current_period_start TEXT,
    current_period_end TEXT,
    cancel_at_period_end INTEGER DEFAULT 0,
    cancelled_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_subs_user ON subscriptions(user_id);
  CREATE INDEX IF NOT EXISTS idx_subs_rzp ON subscriptions(razorpay_subscription_id);

  CREATE TABLE IF NOT EXISTS razorpay_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT NOT NULL UNIQUE,
    event_type TEXT NOT NULL,
    payload TEXT NOT NULL,
    processed INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_rzp_events ON razorpay_events(event_id);

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    razorpay_payment_id TEXT UNIQUE,
    razorpay_subscription_id TEXT,
    amount INTEGER NOT NULL,
    currency TEXT DEFAULT 'INR',
    status TEXT NOT NULL,
    tier TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
`);

export default db;
