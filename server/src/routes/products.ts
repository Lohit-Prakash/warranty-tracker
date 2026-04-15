import { Router, Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { authenticate } from '../middleware/auth';
import { enforceProductQuota, enforceDocumentQuota, requireFeature } from '../middleware/quota';
import db from '../db/database';
import { upload, memoryUpload, uploadsDir } from '../middleware/multer';
import { userHasDriveAccess, uploadFileToDrive, deleteFileFromDrive, ensureProductFolder } from '../services/googleDriveService';
import { logger } from '../lib/logger';

const router = Router();

router.use(authenticate);

interface ProductRow {
  id: number;
  user_id: number;
  name: string;
  brand: string | null;
  category: string;
  purchase_date: string;
  expiry_date: string | null;
  serial_number: string | null;
  store_name: string | null;
  notes: string | null;
  document_path: string | null;
  price: number | null;
  currency: string | null;
  photo_path: string | null;
  google_drive_folder_id: string | null;
  created_at: string;
  updated_at: string;
}

// Exchange rates relative to USD (1 unit of currency = X USD)
const EXCHANGE_RATES_TO_USD: Record<string, number> = {
  USD: 1, EUR: 1.09, GBP: 1.27, JPY: 0.0067, CAD: 0.74, AUD: 0.65,
  SGD: 0.75, INR: 0.012, CHF: 1.12, HKD: 0.128, MYR: 0.213, CNY: 0.138,
};

function convertToBaseCurrency(price: number, fromCurrency: string, baseCurrency: string): number {
  const toUSD = EXCHANGE_RATES_TO_USD[fromCurrency] ?? 1;
  const fromUSD = EXCHANGE_RATES_TO_USD[baseCurrency] ?? 1;
  return price * toUSD / fromUSD;
}

function getDateDiffInDays(from: string, to: string): number {
  const fromDate = new Date(from);
  const toDate = new Date(to);
  fromDate.setHours(0, 0, 0, 0);
  toDate.setHours(0, 0, 0, 0);
  return Math.round((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
}

function getUserAlertThreshold(userId: number): number {
  const row = db.prepare('SELECT alert_threshold FROM users WHERE id = ?').get(userId) as { alert_threshold: number } | undefined;
  return row?.alert_threshold ?? 30;
}

function computeProductFields(product: ProductRow, alertThreshold = 30) {
  const today = new Date().toISOString().split('T')[0];

  let daysRemaining: number | null;
  let status: 'active' | 'expiring' | 'expired' | 'no_warranty';
  let warrantyProgress: number;

  if (!product.expiry_date) {
    daysRemaining = null;
    status = 'no_warranty';
    warrantyProgress = 0;
  } else {
    daysRemaining = getDateDiffInDays(today, product.expiry_date);
    const daysSincePurchase = getDateDiffInDays(product.purchase_date, today);
    const totalWarrantyDays = getDateDiffInDays(product.purchase_date, product.expiry_date);
    warrantyProgress =
      totalWarrantyDays > 0
        ? Math.min(100, Math.round((daysSincePurchase / totalWarrantyDays) * 100))
        : 100;
    if (daysRemaining < 0) {
      status = 'expired';
    } else if (daysRemaining <= alertThreshold) {
      status = 'expiring';
    } else {
      status = 'active';
    }
  }

  return {
    id: product.id,
    userId: product.user_id,
    name: product.name,
    brand: product.brand,
    category: product.category,
    purchaseDate: product.purchase_date,
    expiryDate: product.expiry_date,
    serialNumber: product.serial_number,
    storeName: product.store_name,
    notes: product.notes,
    documentPath: product.document_path,
    price: product.price,
    currency: product.currency ?? 'USD',
    photoPath: product.photo_path,
    createdAt: product.created_at,
    updatedAt: product.updated_at,
    daysRemaining,
    status,
    warrantyProgress,
  };
}

// GET /api/products/stats
router.get('/stats', (req: Request, res: Response): void => {
  try {
    const userId = req.user!.id;
    const threshold = getUserAlertThreshold(userId);
    const rows = db.prepare('SELECT * FROM products WHERE user_id = ?').all(userId) as ProductRow[];
    const products = rows.map((p) => computeProductFields(p, threshold));

    const stats = {
      total: products.length,
      active: products.filter((p) => p.status === 'active').length,
      expiring: products.filter((p) => p.status === 'expiring').length,
      expired: products.filter((p) => p.status === 'expired').length,
      noWarranty: products.filter((p) => p.status === 'no_warranty').length,
    };

    // Category counts
    const categories: Record<string, number> = {};
    products.forEach((p) => {
      categories[p.category] = (categories[p.category] || 0) + 1;
    });

    res.json({ data: { stats, categories } });
  } catch (err) {
    logger.error(err, 'Get stats error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/products/export
router.get('/export', requireFeature('exportEnabled'), (req: Request, res: Response): void => {
  try {
    const userId = req.user!.id;
    const format = req.query.format as string || 'csv';
    const threshold = getUserAlertThreshold(userId);

    const rows = db.prepare('SELECT * FROM products WHERE user_id = ? ORDER BY expiry_date ASC').all(userId) as ProductRow[];
    const products = rows.map((p) => computeProductFields(p, threshold));

    if (format === 'csv') {
      const header = 'Name,Brand,Category,Purchase Date,Expiry Date,Status,Days Remaining,Price,Currency,Serial Number,Store,Notes';
      const csvRows = products.map((p) =>
        [
          `"${(p.name || '').replace(/"/g, '""')}"`,
          `"${(p.brand || '').replace(/"/g, '""')}"`,
          p.category,
          p.purchaseDate,
          p.expiryDate ?? '',
          p.status,
          p.daysRemaining ?? '',
          p.price != null ? p.price.toFixed(2) : '',
          p.currency ?? 'USD',
          `"${(p.serialNumber || '').replace(/"/g, '""')}"`,
          `"${(p.storeName || '').replace(/"/g, '""')}"`,
          `"${(p.notes || '').replace(/"/g, '""')}"`,
        ].join(',')
      );
      const csv = [header, ...csvRows].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=warranties.csv');
      res.send(csv);
    } else {
      // JSON export as fallback
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=warranties.json');
      res.json(products);
    }
  } catch (err) {
    logger.error(err, 'Export error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/products/charts
router.get('/charts', requireFeature('analyticsEnabled'), (req: Request, res: Response): void => {
  try {
    const userId = req.user!.id;
    const threshold = getUserAlertThreshold(userId);
    const rows = db.prepare('SELECT * FROM products WHERE user_id = ?').all(userId) as ProductRow[];
    const products = rows.map((p) => computeProductFields(p, threshold));

    // Category breakdown
    const categoryMap: Record<string, number> = {};
    products.forEach((p) => {
      categoryMap[p.category] = (categoryMap[p.category] || 0) + 1;
    });
    const categoryBreakdown = Object.entries(categoryMap).map(([name, value]) => ({ name, value }));

    // Status breakdown
    const statusBreakdown = [
      { name: 'Active', value: products.filter((p) => p.status === 'active').length },
      { name: 'Expiring', value: products.filter((p) => p.status === 'expiring').length },
      { name: 'Expired', value: products.filter((p) => p.status === 'expired').length },
      { name: 'No Warranty', value: products.filter((p) => p.status === 'no_warranty').length },
    ].filter((s) => s.value > 0);

    // Expiry timeline (next 12 months) — only products with expiry dates
    const now = new Date();
    const months: { month: string; expiring: number }[] = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.push({ month: ym, expiring: 0 });
    }
    products.forEach((p) => {
      if (!p.expiryDate) return;
      const ym = p.expiryDate.slice(0, 7);
      const m = months.find((x) => x.month === ym);
      if (m) m.expiring += 1;
    });

    res.json({ data: { categoryBreakdown, statusBreakdown, expiryTimeline: months } });
  } catch (err) {
    logger.error(err, 'Charts error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/products/analytics
router.get('/analytics', requireFeature('analyticsEnabled'), (req: Request, res: Response): void => {
  try {
    const userId = req.user!.id;
    const baseCurrency = typeof req.query.baseCurrency === 'string' && EXCHANGE_RATES_TO_USD[req.query.baseCurrency]
      ? req.query.baseCurrency
      : 'USD';
    const threshold = getUserAlertThreshold(userId);
    const rows = db.prepare('SELECT * FROM products WHERE user_id = ?').all(userId) as ProductRow[];
    const products = rows.map((p) => computeProductFields(p, threshold));

    // Helper: convert a product's price to base currency
    const toBase = (price: number, currency: string) => convertToBaseCurrency(price, currency, baseCurrency);

    // Summary stats
    const itemsWithPrice = products.filter((p) => p.price != null);
    const totalSpent = itemsWithPrice.reduce((sum, p) => sum + toBase(p.price ?? 0, p.currency ?? 'USD'), 0);
    const avgPrice = itemsWithPrice.length > 0 ? totalSpent / itemsWithPrice.length : 0;

    const summary = {
      totalItems: products.length,
      totalSpent,
      avgPrice,
      itemsWithPrice: itemsWithPrice.length,
      itemsWithWarranty: products.filter((p) => p.status !== 'no_warranty').length,
      itemsNoWarranty: products.filter((p) => p.status === 'no_warranty').length,
      activeWarranties: products.filter((p) => p.status === 'active').length,
      expiringWarranties: products.filter((p) => p.status === 'expiring').length,
      expiredWarranties: products.filter((p) => p.status === 'expired').length,
    };

    // Spend by year
    const yearMap = new Map<string, { total: number; count: number }>();
    products.forEach((p) => {
      const year = p.purchaseDate.slice(0, 4);
      const ex = yearMap.get(year) ?? { total: 0, count: 0 };
      yearMap.set(year, { total: ex.total + (p.price != null ? toBase(p.price, p.currency ?? 'USD') : 0), count: ex.count + 1 });
    });
    const spendByYear = Array.from(yearMap.entries())
      .map(([year, d]) => ({ year, total: d.total, count: d.count }))
      .sort((a, b) => a.year.localeCompare(b.year));

    // Spend by month (all months that have at least one purchase)
    const monthMap = new Map<string, { total: number; count: number }>();
    products.forEach((p) => {
      const month = p.purchaseDate.slice(0, 7);
      const ex = monthMap.get(month) ?? { total: 0, count: 0 };
      monthMap.set(month, { total: ex.total + (p.price != null ? toBase(p.price, p.currency ?? 'USD') : 0), count: ex.count + 1 });
    });
    const spendByMonth = Array.from(monthMap.entries())
      .map(([month, d]) => ({ month, total: d.total, count: d.count }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // Spend + count by category
    const catMap = new Map<string, { total: number; count: number; priceCount: number }>();
    products.forEach((p) => {
      const ex = catMap.get(p.category) ?? { total: 0, count: 0, priceCount: 0 };
      catMap.set(p.category, {
        total: ex.total + (p.price != null ? toBase(p.price, p.currency ?? 'USD') : 0),
        count: ex.count + 1,
        priceCount: ex.priceCount + (p.price != null ? 1 : 0),
      });
    });
    const spendByCategory = Array.from(catMap.entries())
      .map(([category, d]) => ({
        category,
        total: d.total,
        count: d.count,
        avgPrice: d.priceCount > 0 ? d.total / d.priceCount : 0,
      }))
      .sort((a, b) => b.total - a.total);

    // Top 10 purchases by price (converted to base currency)
    const topPurchases = [...products]
      .filter((p) => p.price != null)
      .sort((a, b) => toBase(b.price ?? 0, b.currency ?? 'USD') - toBase(a.price ?? 0, a.currency ?? 'USD'))
      .slice(0, 10)
      .map((p) => ({
        id: p.id,
        name: p.name,
        brand: p.brand,
        category: p.category,
        price: p.price,
        currency: p.currency ?? 'USD',
        priceInBase: p.price != null ? toBase(p.price, p.currency ?? 'USD') : null,
        purchaseDate: p.purchaseDate,
        status: p.status,
      }));

    // Status breakdown
    const statusBreakdown = [
      { name: 'Active', value: summary.activeWarranties },
      { name: 'Expiring', value: summary.expiringWarranties },
      { name: 'Expired', value: summary.expiredWarranties },
      { name: 'No Warranty', value: summary.itemsNoWarranty },
    ].filter((s) => s.value > 0);

    // Category breakdown (count)
    const categoryBreakdown = spendByCategory.map((c) => ({ name: c.category, value: c.count }));

    // Expiry timeline (next 12 months)
    const now = new Date();
    const expiryMonths: { month: string; expiring: number }[] = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      expiryMonths.push({ month: ym, expiring: 0 });
    }
    products.forEach((p) => {
      if (!p.expiryDate) return;
      const ym = p.expiryDate.slice(0, 7);
      const m = expiryMonths.find((x) => x.month === ym);
      if (m) m.expiring += 1;
    });

    res.json({
      data: {
        baseCurrency,
        summary,
        spendByYear,
        spendByMonth,
        spendByCategory,
        topPurchases,
        categoryBreakdown,
        statusBreakdown,
        expiryTimeline: expiryMonths,
      },
    });
  } catch (err) {
    logger.error(err, 'Analytics error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/products/bulk-delete
router.post('/bulk-delete', (req: Request, res: Response): void => {
  try {
    const userId = req.user!.id;
    const { ids } = req.body as { ids?: unknown };
    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: 'ids array is required' });
      return;
    }
    const numericIds = ids.map((i) => Number(i)).filter((i) => Number.isInteger(i) && i > 0);
    if (numericIds.length === 0) {
      res.status(400).json({ error: 'No valid ids provided' });
      return;
    }

    const placeholders = numericIds.map(() => '?').join(',');
    const owned = db
      .prepare(`SELECT * FROM products WHERE id IN (${placeholders}) AND user_id = ?`)
      .all(...numericIds, userId) as ProductRow[];

    // Delete files
    owned.forEach((p) => {
      for (const fp of [p.document_path, p.photo_path]) {
        if (fp) {
          const filePath = path.join(uploadsDir, path.basename(fp));
          if (fs.existsSync(filePath)) {
            try { fs.unlinkSync(filePath); } catch (e) { logger.warn(e, 'Failed to delete file'); }
          }
        }
      }
    });

    const ownedIds = owned.map((p) => p.id);
    if (ownedIds.length > 0) {
      const ownedPlaceholders = ownedIds.map(() => '?').join(',');
      db.prepare(`DELETE FROM products WHERE id IN (${ownedPlaceholders}) AND user_id = ?`).run(
        ...ownedIds,
        userId,
      );
    }

    res.json({ data: { deleted: ownedIds.length } });
  } catch (err) {
    logger.error(err, 'Bulk delete error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/products/bulk-update-category
router.post('/bulk-update-category', (req: Request, res: Response): void => {
  try {
    const userId = req.user!.id;
    const { ids, category } = req.body as { ids?: unknown; category?: unknown };
    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: 'ids array is required' });
      return;
    }
    if (typeof category !== 'string' || !category.trim()) {
      res.status(400).json({ error: 'category is required' });
      return;
    }
    const numericIds = ids.map((i) => Number(i)).filter((i) => Number.isInteger(i) && i > 0);
    if (numericIds.length === 0) {
      res.status(400).json({ error: 'No valid ids provided' });
      return;
    }

    const placeholders = numericIds.map(() => '?').join(',');
    const result = db
      .prepare(
        `UPDATE products SET category = ?, updated_at = datetime('now') WHERE id IN (${placeholders}) AND user_id = ?`,
      )
      .run(category.trim(), ...numericIds, userId);

    res.json({ data: { updated: result.changes } });
  } catch (err) {
    logger.error(err, 'Bulk update error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/products
router.get('/', (req: Request, res: Response): void => {
  try {
    const userId = req.user!.id;
    const { search, category, status, sort, page, limit } = req.query;

    let query = 'SELECT * FROM products WHERE user_id = ?';
    const params: (string | number)[] = [userId];

    if (search && typeof search === 'string' && search.trim()) {
      query += ' AND (name LIKE ? OR brand LIKE ?)';
      const searchTerm = `%${search.trim()}%`;
      params.push(searchTerm, searchTerm);
    }

    if (category && typeof category === 'string' && category.trim()) {
      query += ' AND category = ?';
      params.push(category.trim());
    }

    // Default ordering before client-side sort
    query += ' ORDER BY created_at DESC';

    const threshold = getUserAlertThreshold(userId);
    let products = (db.prepare(query).all(...params) as ProductRow[]).map((p) => computeProductFields(p, threshold));

    // Filter by status after computing fields
    if (status && typeof status === 'string') {
      products = products.filter((p) => p.status === status);
    }

    if (sort && typeof sort === 'string') {
      switch (sort) {
        case 'expiring_soonest':
          products.sort((a, b) => (a.daysRemaining ?? Infinity) - (b.daysRemaining ?? Infinity));
          break;
        case 'recently_added':
          products.sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          break;
        case 'alphabetical':
          products.sort((a, b) => a.name.localeCompare(b.name));
          break;
      }
    }

    // Pagination
    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 12));
    const total = products.length;
    const totalPages = Math.ceil(total / limitNum);
    const offset = (pageNum - 1) * limitNum;
    const paginatedProducts = products.slice(offset, offset + limitNum);

    res.json({
      data: {
        products: paginatedProducts,
        pagination: { page: pageNum, limit: limitNum, total, totalPages },
      },
    });
  } catch (err) {
    logger.error(err, 'Get products error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** Apply disk or memory upload middleware depending on whether the user has Drive access. */
function selectUpload(req: Request, res: Response, next: NextFunction) {
  const userId = req.user!.id;
  const middleware = userHasDriveAccess(userId)
    ? memoryUpload.fields([{ name: 'document', maxCount: 1 }, { name: 'photo', maxCount: 1 }])
    : upload.fields([{ name: 'document', maxCount: 1 }, { name: 'photo', maxCount: 1 }]);
  middleware(req, res, next);
}

function selectSingleUpload(fieldName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user!.id;
    const middleware = userHasDriveAccess(userId)
      ? memoryUpload.single(fieldName)
      : upload.single(fieldName);
    middleware(req, res, next);
  };
}

/** Store a file from an upload to either Drive or local disk. Returns the stored path/key. */
async function storeFile(userId: number, file: Express.Multer.File, driveFolderId?: string | null): Promise<string> {
  if (file.buffer) {
    const driveId = await uploadFileToDrive(userId, file.buffer, file.originalname, file.mimetype, driveFolderId ?? undefined);
    return `drive:${driveId}`;
  }
  return `/uploads/${file.filename}`;
}

/** Delete a stored file from Drive or local disk. */
async function removeFile(userId: number, filePath: string): Promise<void> {
  if (filePath.startsWith('drive:')) {
    await deleteFileFromDrive(userId, filePath.slice(6));
  } else {
    const localPath = path.join(uploadsDir, path.basename(filePath));
    if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
  }
}

// POST /api/products
router.post('/', enforceProductQuota, (req: Request, res: Response): void => {
  selectUpload(req, res, (err) => {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }

    (async () => {
      try {
        const userId = req.user!.id;
        const files = req.files as { [f: string]: Express.Multer.File[] } | undefined;
        const {
          name,
          brand,
          category,
          purchase_date,
          expiry_date,
          serial_number,
          store_name,
          notes,
          price: priceRaw,
          currency: currencyRaw,
        } = req.body;

        if (!name || typeof name !== 'string' || name.trim().length === 0) {
          res.status(400).json({ error: 'Product name is required' });
          return;
        }
        if (!purchase_date) {
          res.status(400).json({ error: 'Purchase date is required' });
          return;
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(purchase_date)) {
          res.status(400).json({ error: 'Purchase date must be in YYYY-MM-DD format' });
          return;
        }
        const expiryDateVal: string | null = expiry_date && expiry_date.trim() ? expiry_date.trim() : null;
        if (expiryDateVal && !/^\d{4}-\d{2}-\d{2}$/.test(expiryDateVal)) {
          res.status(400).json({ error: 'Expiry date must be in YYYY-MM-DD format' });
          return;
        }

        let priceVal: number | null = null;
        if (priceRaw !== undefined && priceRaw !== '' && priceRaw !== null) {
          const parsed = parseFloat(priceRaw);
          if (isNaN(parsed) || parsed < 0) {
            res.status(400).json({ error: 'Price must be a non-negative number' });
            return;
          }
          priceVal = parsed;
        }

        const currencyVal = (typeof currencyRaw === 'string' && EXCHANGE_RATES_TO_USD[currencyRaw.toUpperCase()])
          ? currencyRaw.toUpperCase() : 'USD';

        // Create a per-product subfolder in Drive when the user has Drive access and is uploading files
        let productFolderId: string | null = null;
        if (userHasDriveAccess(userId) && (files?.['document']?.[0] || files?.['photo']?.[0])) {
          productFolderId = await ensureProductFolder(userId, name.trim());
        }

        const documentPath = files?.['document']?.[0]
          ? await storeFile(userId, files['document'][0], productFolderId)
          : null;
        const photoPath = files?.['photo']?.[0]
          ? await storeFile(userId, files['photo'][0], productFolderId)
          : null;

        const result = db
          .prepare(
            `INSERT INTO products (user_id, name, brand, category, purchase_date, expiry_date, serial_number, store_name, notes, document_path, price, currency, photo_path, google_drive_folder_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            userId,
            name.trim(),
            brand?.trim() || null,
            category?.trim() || 'Other',
            purchase_date,
            expiryDateVal,
            serial_number?.trim() || null,
            store_name?.trim() || null,
            notes?.trim() || null,
            documentPath,
            priceVal,
            currencyVal,
            photoPath,
            productFolderId
          );

        const product = db
          .prepare('SELECT * FROM products WHERE id = ?')
          .get(result.lastInsertRowid) as ProductRow;

        res.status(201).json({ data: computeProductFields(product, getUserAlertThreshold(userId)) });
      } catch (err) {
        logger.error(err, 'Create product error');
        res.status(500).json({ error: 'Internal server error' });
      }
    })();
  });
});

// GET /api/products/:id
router.get('/:id', (req: Request, res: Response): void => {
  try {
    const userId = req.user!.id;
    const productId = parseInt(req.params.id, 10);

    if (isNaN(productId)) {
      res.status(400).json({ error: 'Invalid product ID' });
      return;
    }

    // Try own product first
    let product = db
      .prepare('SELECT * FROM products WHERE id = ? AND user_id = ?')
      .get(productId, userId) as ProductRow | undefined;

    // Fall back to shared product
    if (!product) {
      const userRow = db.prepare('SELECT email FROM users WHERE id = ?').get(userId) as { email: string } | undefined;
      const hasShare = db
        .prepare('SELECT id FROM shared_products WHERE product_id = ? AND (shared_with_user_id = ? OR shared_with_email = ?)')
        .get(productId, userId, userRow?.email ?? '') as { id: number } | undefined;
      if (hasShare) {
        product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId) as ProductRow | undefined;
      }
    }

    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    res.json({ data: computeProductFields(product, getUserAlertThreshold(userId)) });
  } catch (err) {
    logger.error(err, 'Get product error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/products/:id
router.put('/:id', (req: Request, res: Response): void => {
  selectUpload(req, res, (err) => {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }

    (async () => {
      try {
        const userId = req.user!.id;
        const productId = parseInt(req.params.id, 10);
        const files = req.files as { [f: string]: Express.Multer.File[] } | undefined;

        if (isNaN(productId)) {
          res.status(400).json({ error: 'Invalid product ID' });
          return;
        }

        const existing = db
          .prepare('SELECT * FROM products WHERE id = ? AND user_id = ?')
          .get(productId, userId) as ProductRow | undefined;

        if (!existing) {
          res.status(404).json({ error: 'Product not found' });
          return;
        }

        const {
          name,
          brand,
          category,
          purchase_date,
          expiry_date,
          serial_number,
          store_name,
          notes,
          price: priceRaw,
          currency: currencyRaw,
        } = req.body;

        if (purchase_date && !/^\d{4}-\d{2}-\d{2}$/.test(purchase_date)) {
          res.status(400).json({ error: 'Purchase date must be in YYYY-MM-DD format' });
          return;
        }
        // Allow empty string to clear expiry_date (set to null)
        const expiryDateUpdate: string | null | undefined =
          expiry_date === '' || expiry_date === null
            ? null
            : expiry_date !== undefined
            ? expiry_date
            : undefined;
        if (expiryDateUpdate && !/^\d{4}-\d{2}-\d{2}$/.test(expiryDateUpdate)) {
          res.status(400).json({ error: 'Expiry date must be in YYYY-MM-DD format' });
          return;
        }

        let priceUpdate: number | null | undefined = undefined;
        if (priceRaw !== undefined) {
          if (priceRaw === '' || priceRaw === null) {
            priceUpdate = null;
          } else {
            const parsed = parseFloat(priceRaw);
            if (isNaN(parsed) || parsed < 0) {
              res.status(400).json({ error: 'Price must be a non-negative number' });
              return;
            }
            priceUpdate = parsed;
          }
        }

        const currencyUpdate = (typeof currencyRaw === 'string' && EXCHANGE_RATES_TO_USD[currencyRaw.toUpperCase()])
          ? currencyRaw.toUpperCase() : undefined;

        // Resolve the product's Drive folder: use existing one or create if needed
        let productFolderId = existing.google_drive_folder_id;
        const hasNewFiles = !!(files?.['document']?.[0] || files?.['photo']?.[0]);
        if (!productFolderId && userHasDriveAccess(userId) && hasNewFiles) {
          const resolvedName = (name?.trim() ?? existing.name);
          productFolderId = await ensureProductFolder(userId, resolvedName);
          db.prepare('UPDATE products SET google_drive_folder_id = ? WHERE id = ?').run(productFolderId, productId);
        }

        let documentPath = existing.document_path;
        if (files?.['document']?.[0]) {
          if (existing.document_path) await removeFile(userId, existing.document_path);
          documentPath = await storeFile(userId, files['document'][0], productFolderId);
        }

        let photoPath = existing.photo_path;
        if (files?.['photo']?.[0]) {
          if (existing.photo_path) await removeFile(userId, existing.photo_path);
          photoPath = await storeFile(userId, files['photo'][0], productFolderId);
        }

        db.prepare(
          `UPDATE products SET
            name = ?,
            brand = ?,
            category = ?,
            purchase_date = ?,
            expiry_date = ?,
            serial_number = ?,
            store_name = ?,
            notes = ?,
            document_path = ?,
            price = ?,
            currency = ?,
            photo_path = ?,
            updated_at = datetime('now')
          WHERE id = ? AND user_id = ?`
        ).run(
          name?.trim() ?? existing.name,
          brand !== undefined ? brand?.trim() || null : existing.brand,
          category?.trim() ?? existing.category,
          purchase_date ?? existing.purchase_date,
          expiryDateUpdate !== undefined ? expiryDateUpdate : existing.expiry_date,
          serial_number !== undefined ? serial_number?.trim() || null : existing.serial_number,
          store_name !== undefined ? store_name?.trim() || null : existing.store_name,
          notes !== undefined ? notes?.trim() || null : existing.notes,
          documentPath,
          priceUpdate !== undefined ? priceUpdate : existing.price,
          currencyUpdate ?? existing.currency ?? 'USD',
          photoPath,
          productId,
          userId
        );

        const updated = db
          .prepare('SELECT * FROM products WHERE id = ?')
          .get(productId) as ProductRow;

        res.json({ data: computeProductFields(updated, getUserAlertThreshold(userId)) });
      } catch (err) {
        logger.error(err, 'Update product error');
        res.status(500).json({ error: 'Internal server error' });
      }
    })();
  });
});

// DELETE /api/products/:id
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const productId = parseInt(req.params.id, 10);

    if (isNaN(productId)) {
      res.status(400).json({ error: 'Invalid product ID' });
      return;
    }

    const product = db
      .prepare('SELECT * FROM products WHERE id = ? AND user_id = ?')
      .get(productId, userId) as ProductRow | undefined;

    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    // Delete associated files (local or Drive)
    for (const fp of [product.document_path, product.photo_path]) {
      if (fp) {
        try {
          await removeFile(userId, fp);
        } catch (e) {
          logger.warn(e, 'Failed to delete product file');
        }
      }
    }

    // Also delete any additional product_documents
    const docs = db
      .prepare('SELECT file_path FROM product_documents WHERE product_id = ?')
      .all(productId) as Array<{ file_path: string }>;
    for (const doc of docs) {
      try {
        await removeFile(userId, doc.file_path);
      } catch (e) {
        logger.warn(e, 'Failed to delete product document');
      }
    }

    db.prepare('DELETE FROM products WHERE id = ? AND user_id = ?').run(productId, userId);

    res.json({ data: { message: 'Product deleted successfully' } });
  } catch (err) {
    logger.error(err, 'Delete product error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

interface ProductDocumentRow {
  id: number;
  product_id: number;
  file_path: string;
  file_name: string;
  file_size: number;
  mime_type: string | null;
  created_at: string;
}

function mapDocument(row: ProductDocumentRow) {
  return {
    id: row.id,
    productId: row.product_id,
    filePath: row.file_path,
    fileName: row.file_name,
    fileSize: row.file_size,
    mimeType: row.mime_type,
    createdAt: row.created_at,
  };
}

// GET /api/products/:id/documents
router.get('/:id/documents', (req: Request, res: Response): void => {
  try {
    const userId = req.user!.id;
    const productId = parseInt(req.params.id, 10);
    if (isNaN(productId)) {
      res.status(400).json({ error: 'Invalid product ID' });
      return;
    }
    let product = db
      .prepare('SELECT id FROM products WHERE id = ? AND user_id = ?')
      .get(productId, userId);
    if (!product) {
      const userRow = db.prepare('SELECT email FROM users WHERE id = ?').get(userId) as { email: string } | undefined;
      const hasShare = db
        .prepare('SELECT id FROM shared_products WHERE product_id = ? AND (shared_with_user_id = ? OR shared_with_email = ?)')
        .get(productId, userId, userRow?.email ?? '') as { id: number } | undefined;
      if (hasShare) {
        product = db.prepare('SELECT id FROM products WHERE id = ?').get(productId);
      }
    }
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    const docs = db
      .prepare('SELECT * FROM product_documents WHERE product_id = ? ORDER BY created_at DESC')
      .all(productId) as ProductDocumentRow[];
    res.json({ data: docs.map(mapDocument) });
  } catch (err) {
    logger.error(err, 'List documents error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/products/:id/documents
router.post('/:id/documents', enforceDocumentQuota, (req: Request, res: Response): void => {
  selectSingleUpload('document')(req, res, (err) => {
    if (err) {
      res.status(400).json({ error: err.message });
      return;
    }
    (async () => {
      try {
        const userId = req.user!.id;
        const productId = parseInt(req.params.id, 10);
        if (isNaN(productId)) {
          res.status(400).json({ error: 'Invalid product ID' });
          return;
        }
        if (!req.file) {
          res.status(400).json({ error: 'File is required' });
          return;
        }
        const product = db
          .prepare('SELECT id, google_drive_folder_id FROM products WHERE id = ? AND user_id = ?')
          .get(productId, userId) as { id: number; google_drive_folder_id: string | null } | undefined;
        if (!product) {
          // Clean up uploaded file since product doesn't belong to user
          if (!req.file.buffer && req.file.filename) {
            const fp = path.join(uploadsDir, req.file.filename);
            if (fs.existsSync(fp)) fs.unlinkSync(fp);
          }
          res.status(404).json({ error: 'Product not found' });
          return;
        }

        // Use the product's Drive folder; create it if missing
        let driveFolderId = product.google_drive_folder_id;
        if (!driveFolderId && req.file.buffer && userHasDriveAccess(userId)) {
          const productRow = db.prepare('SELECT name FROM products WHERE id = ?').get(productId) as { name: string };
          driveFolderId = await ensureProductFolder(userId, productRow.name);
          db.prepare('UPDATE products SET google_drive_folder_id = ? WHERE id = ?').run(driveFolderId, productId);
        }

        const storedPath = await storeFile(userId, req.file, driveFolderId);
        const storageType = storedPath.startsWith('drive:') ? 'drive' : 'local';

        const result = db
          .prepare(
            `INSERT INTO product_documents (product_id, file_path, file_name, file_size, mime_type, storage_type)
             VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .run(productId, storedPath, req.file.originalname, req.file.size, req.file.mimetype || null, storageType);

        const doc = db
          .prepare('SELECT * FROM product_documents WHERE id = ?')
          .get(result.lastInsertRowid) as ProductDocumentRow;
        res.status(201).json({ data: mapDocument(doc) });
      } catch (err) {
        logger.error(err, 'Upload document error');
        res.status(500).json({ error: 'Internal server error' });
      }
    })();
  });
});

// DELETE /api/products/:id/documents/:docId
router.delete('/:id/documents/:docId', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const productId = parseInt(req.params.id, 10);
    const docId = parseInt(req.params.docId, 10);
    if (isNaN(productId) || isNaN(docId)) {
      res.status(400).json({ error: 'Invalid ID' });
      return;
    }
    const product = db
      .prepare('SELECT id FROM products WHERE id = ? AND user_id = ?')
      .get(productId, userId);
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    const doc = db
      .prepare('SELECT * FROM product_documents WHERE id = ? AND product_id = ?')
      .get(docId, productId) as ProductDocumentRow | undefined;
    if (!doc) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    try {
      await removeFile(userId, doc.file_path);
    } catch (e) {
      logger.warn(e, 'Failed to delete document file');
    }

    db.prepare('DELETE FROM product_documents WHERE id = ?').run(docId);
    res.json({ data: { message: 'Document deleted' } });
  } catch (err) {
    logger.error(err, 'Delete document error');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
