import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';

const app = createApp();

describe('Auth routes', () => {
  let cookie: string;

  it('rejects registration with invalid email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test', email: 'notanemail', password: 'password123' });
    expect(res.status).toBe(400);
  });

  it('registers a new user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test User', email: 'test@example.com', password: 'password123' });
    expect(res.status).toBe(201);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.email).toBe('test@example.com');
  });

  it('rejects duplicate email on registration', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Dup', email: 'test@example.com', password: 'password123' });
    expect(res.status).toBe(409);
  });

  it('logs in with valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });
    expect(res.status).toBe(200);
    const setCookie = res.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    cookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  });

  it('rejects login with wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'wrongpass' });
    expect(res.status).toBe(401);
  });

  it('returns current user with valid cookie', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('test@example.com');
  });

  it('rejects /me without cookie', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});

describe('Products routes', () => {
  let cookie: string;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });
    const setCookie = res.headers['set-cookie'];
    cookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  });

  it('returns empty product list initially', async () => {
    const res = await request(app)
      .get('/api/products')
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.products).toEqual([]);
    expect(res.body.data.pagination.total).toBe(0);
  });

  it('creates a product', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Cookie', cookie)
      .field('name', 'Test Laptop')
      .field('brand', 'TestBrand')
      .field('category', 'Electronics')
      .field('purchase_date', '2025-01-01')
      .field('expiry_date', '2027-01-01');
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Test Laptop');
    expect(res.body.data.status).toBeDefined();
  });

  it('returns stats', async () => {
    const res = await request(app)
      .get('/api/products/stats')
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.stats.total).toBe(1);
  });

  it('rejects product creation without name', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Cookie', cookie)
      .field('purchase_date', '2025-01-01')
      .field('expiry_date', '2027-01-01');
    expect(res.status).toBe(400);
  });

  it('creates a product without expiry_date (no_warranty status)', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Cookie', cookie)
      .field('name', 'No-Warranty Item')
      .field('category', 'Other')
      .field('purchase_date', '2025-06-01');
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('no_warranty');
    expect(res.body.data.daysRemaining).toBeNull();
    expect(res.body.data.expiryDate).toBeNull();
  });

  it('creates a product with price', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Cookie', cookie)
      .field('name', 'Priced Item')
      .field('purchase_date', '2025-01-01')
      .field('expiry_date', '2027-01-01')
      .field('price', '299.99');
    expect(res.status).toBe(201);
    expect(res.body.data.price).toBeCloseTo(299.99);
  });

  it('includes noWarranty count in stats', async () => {
    const res = await request(app)
      .get('/api/products/stats')
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(typeof res.body.data.stats.noWarranty).toBe('number');
    expect(res.body.data.stats.noWarranty).toBeGreaterThanOrEqual(1);
  });

  it('bulk-deletes products', async () => {
    // Create 2 more products
    const c1 = await request(app)
      .post('/api/products')
      .set('Cookie', cookie)
      .field('name', 'P1')
      .field('purchase_date', '2025-01-01')
      .field('expiry_date', '2027-01-01');
    const c2 = await request(app)
      .post('/api/products')
      .set('Cookie', cookie)
      .field('name', 'P2')
      .field('purchase_date', '2025-01-01')
      .field('expiry_date', '2027-01-01');

    const ids = [c1.body.data.id, c2.body.data.id];
    const res = await request(app)
      .post('/api/products/bulk-delete')
      .set('Cookie', cookie)
      .send({ ids });
    expect(res.status).toBe(200);
    expect(res.body.data.deleted).toBe(2);
  });
});
