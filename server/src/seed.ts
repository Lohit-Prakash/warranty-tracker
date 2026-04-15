import dotenv from 'dotenv';
dotenv.config();

import bcrypt from 'bcrypt';
import db from './db/database';

function offsetDate(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

async function seed() {
  console.log('Seeding database...');

  // Delete existing demo user (cascade deletes their products)
  db.prepare("DELETE FROM users WHERE email = 'demo@example.com'").run();
  console.log('Cleared existing demo user.');

  // Create demo user
  const passwordHash = await bcrypt.hash('demo1234', 10);
  const result = db
    .prepare(
      `INSERT INTO users (name, email, password_hash, notifications_enabled, notification_email)
       VALUES (?, ?, ?, 1, ?)`
    )
    .run('Demo User', 'demo@example.com', passwordHash, 'demo@example.com');

  const userId = result.lastInsertRowid as number;
  console.log(`Created demo user with id=${userId}`);

  // Seed products — mix of warranty + no-warranty items with prices
  const products: {
    name: string;
    brand: string;
    category: string;
    purchase_date: string;
    expiry_date: string | null;
    serial_number: string;
    store_name: string;
    notes: string;
    price: number | null;
  }[] = [
    {
      name: 'Samsung 65" OLED TV',
      brand: 'Samsung',
      category: 'Electronics',
      purchase_date: offsetDate(-365 * 2),       // 2 years ago
      expiry_date: offsetDate(365),               // 1 year from now (active)
      serial_number: 'SAM-TV-20220301',
      store_name: 'Best Buy',
      notes: '65-inch OLED smart TV',
      price: 1299.99,
    },
    {
      name: 'iPhone 15 Pro',
      brand: 'Apple',
      category: 'Electronics',
      purchase_date: offsetDate(-180),            // 6 months ago
      expiry_date: offsetDate(180),               // 6 months from now (active)
      serial_number: 'AAPL-IP15P-001',
      store_name: 'Apple Store',
      notes: 'Apple Care+ registered',
      price: 999.00,
    },
    {
      name: 'LG Refrigerator',
      brand: 'LG',
      category: 'Appliances',
      purchase_date: offsetDate(-365 * 3),        // 3 years ago
      expiry_date: offsetDate(25),                // 25 days from now (expiring soon)
      serial_number: 'LG-REF-2021-5578',
      store_name: 'Home Depot',
      notes: '5-year extended warranty',
      price: 1450.00,
    },
    {
      name: 'Dyson Vacuum V15',
      brand: 'Dyson',
      category: 'Appliances',
      purchase_date: offsetDate(-365),            // 1 year ago
      expiry_date: offsetDate(20),                // 20 days from now (expiring soon)
      serial_number: 'DYSON-V15-88421',
      store_name: 'Dyson Direct',
      notes: 'Registered on Dyson website',
      price: 749.99,
    },
    {
      name: 'Toyota Camry Extended Warranty',
      brand: 'Toyota',
      category: 'Vehicles',
      purchase_date: offsetDate(-365 * 4),        // 4 years ago
      expiry_date: offsetDate(-30),               // 30 days ago (expired)
      serial_number: '1HGCM82633A004352',
      store_name: 'Toyota Dealership',
      notes: 'Extended powertrain warranty',
      price: 2800.00,
    },
    {
      name: 'Dell XPS 15 Laptop',
      brand: 'Dell',
      category: 'Electronics',
      purchase_date: offsetDate(-Math.round(365 * 2.5)), // 2.5 years ago
      expiry_date: offsetDate(-180),              // 6 months ago (expired)
      serial_number: 'DELL-XPS15-7X92K',
      store_name: 'Dell Online',
      notes: 'Premium support plan expired',
      price: 1899.00,
    },
    // No-warranty items — general purchase records
    {
      name: 'USB-C Charging Cable (3-pack)',
      brand: 'Anker',
      category: 'Electronics',
      purchase_date: offsetDate(-30),
      expiry_date: null,
      serial_number: '',
      store_name: 'Amazon',
      notes: 'Bought with iPhone — no warranty tracked',
      price: 15.99,
    },
    {
      name: 'IKEA KALLAX Shelf',
      brand: 'IKEA',
      category: 'Furniture',
      purchase_date: offsetDate(-90),
      expiry_date: null,
      serial_number: '',
      store_name: 'IKEA',
      notes: 'Living room — no manufacturer warranty',
      price: 89.99,
    },
  ];

  const insertProduct = db.prepare(
    `INSERT INTO products (user_id, name, brand, category, purchase_date, expiry_date, serial_number, store_name, notes, price)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  for (const p of products) {
    insertProduct.run(
      userId,
      p.name,
      p.brand,
      p.category,
      p.purchase_date,
      p.expiry_date,
      p.serial_number || null,
      p.store_name,
      p.notes,
      p.price
    );
    const expiryLabel = p.expiry_date ? `expires ${p.expiry_date}` : 'no warranty';
    console.log(`  Inserted product: "${p.name}" (${expiryLabel})`);
  }

  console.log('\nSeeding complete!');
  console.log('  Email:    demo@example.com');
  console.log('  Password: demo1234');
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
