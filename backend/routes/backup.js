// backend/routes/backup.js
// ══════════════════════════════════════════════════════════════
// Pinnacles Farm — Data Backup & Export API (Owner Only)
// ══════════════════════════════════════════════════════════════
const express  = require('express');
const router   = express.Router();
const supabase = require('../db');
const { requireAuth } = require('../middleware/auth');
const { logActivity } = require('./activity');

// Restrict all backup endpoints to Owner role
function requireOwner(req, res, next) {
  const role = (req.user?.role || '').toLowerCase();
  if (role !== 'owner' && role !== 'super_admin') {
    return res.status(403).json({ error: 'Access denied. Owner role required for backups.' });
  }
  next();
}

router.use(requireAuth);
router.use(requireOwner);

// ── GET /api/backup/orders — all orders as JSON ───────────────
router.get('/orders', async (req, res) => {
  try {
    const { data: orders, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    const formatted = (orders || []).map(o => {
      let items = [];
      try { items = JSON.parse(o.items_json || '[]'); } catch (_) { items = o.items || []; }
      return { ...o, items };
    });

    logActivity({
      admin_name: req.user?.username || 'Owner',
      admin_email: req.user?.email || '',
      action: 'backup_orders',
      details: `Exported ${formatted.length} orders`
    }).catch(() => {});

    res.setHeader('Content-Disposition', `attachment; filename="pinnacles-orders-${new Date().toISOString().slice(0, 10)}.json"`);
    res.setHeader('Content-Type', 'application/json');
    res.json({
      type: 'orders_backup',
      exported_at: new Date().toISOString(),
      count: formatted.length,
      orders: formatted
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to backup orders: ' + err.message });
  }
});

// ── GET /api/backup/products — all products as JSON ───────────
router.get('/products', async (req, res) => {
  try {
    const { data: products, error } = await supabase
      .from('products')
      .select('*')
      .order('id', { ascending: true });

    if (error) throw new Error(error.message);

    logActivity({
      admin_name: req.user?.username || 'Owner',
      admin_email: req.user?.email || '',
      action: 'backup_products',
      details: `Exported ${(products || []).length} products`
    }).catch(() => {});

    res.setHeader('Content-Disposition', `attachment; filename="pinnacles-products-${new Date().toISOString().slice(0, 10)}.json"`);
    res.setHeader('Content-Type', 'application/json');
    res.json({
      type: 'products_backup',
      exported_at: new Date().toISOString(),
      count: (products || []).length,
      products: products || []
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to backup products: ' + err.message });
  }
});

// ── GET /api/backup/customers — derived customer list ─────────
router.get('/customers', async (req, res) => {
  try {
    // 1. Fetch direct customers table if populated
    let directCustomers = [];
    try {
      const { data } = await supabase.from('customers').select('*');
      if (Array.isArray(data)) directCustomers = data;
    } catch (_) {}

    // 2. Fetch all orders to build aggregated profiles
    const { data: orders } = await supabase.from('orders').select('*');
    const customerMap = new Map();

    (directCustomers || []).forEach(c => {
      const key = (c.phone || c.email || c.name || String(c.id)).toLowerCase();
      customerMap.set(key, {
        id: c.id,
        name: c.name || 'Customer',
        phone: c.phone || '',
        email: c.email || '',
        total_spent: Number(c.total_spent || 0),
        total_orders: Number(c.total_orders || 0),
        loyalty_points: Number(c.loyalty_points || 0),
        created_at: c.created_at || null
      });
    });

    (orders || []).forEach(o => {
      const phoneKey = (o.customer_phone || o.customer_name || 'unknown').toLowerCase();
      const existing = customerMap.get(phoneKey);
      const total = Number(o.total || 0);

      if (existing) {
        existing.total_orders = Math.max(existing.total_orders, existing.total_orders + 1);
        existing.total_spent += total;
        if (!existing.phone && o.customer_phone) existing.phone = o.customer_phone;
      } else {
        customerMap.set(phoneKey, {
          id: o.customer_id || null,
          name: o.customer_name || 'Walk-in Customer',
          phone: o.customer_phone || '',
          email: o.customer_email || '',
          total_spent: total,
          total_orders: 1,
          loyalty_points: Math.floor(total / 100),
          created_at: o.created_at
        });
      }
    });

    const customers = Array.from(customerMap.values());

    logActivity({
      admin_name: req.user?.username || 'Owner',
      admin_email: req.user?.email || '',
      action: 'backup_customers',
      details: `Exported ${customers.length} customer records`
    }).catch(() => {});

    res.setHeader('Content-Disposition', `attachment; filename="pinnacles-customers-${new Date().toISOString().slice(0, 10)}.json"`);
    res.setHeader('Content-Type', 'application/json');
    res.json({
      type: 'customers_backup',
      exported_at: new Date().toISOString(),
      count: customers.length,
      customers
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to backup customers: ' + err.message });
  }
});

// ── GET /api/backup/full — complete system snapshot ───────────
router.get('/full', async (req, res) => {
  try {
    const [ordersRes, prodsRes, custRes, expRes, farmRes] = await Promise.allSettled([
      supabase.from('orders').select('*').order('id', { ascending: false }),
      supabase.from('products').select('*').order('id', { ascending: true }),
      supabase.from('customers').select('*'),
      supabase.from('expenses').select('*'),
      supabase.from('farm_activities').select('*')
    ]);

    const orders   = ordersRes.status === 'fulfilled' ? (ordersRes.value.data || []) : [];
    const products = prodsRes.status === 'fulfilled'  ? (prodsRes.value.data || []) : [];
    const customers= custRes.status === 'fulfilled'   ? (custRes.value.data || []) : [];
    const expenses = expRes.status === 'fulfilled'    ? (expRes.value.data || []) : [];
    const farm     = farmRes.status === 'fulfilled'   ? (farmRes.value.data || []) : [];

    const fullBackup = {
      system: 'Pinnacles Resource Centre Farm',
      version: '2.0.0',
      exported_at: new Date().toISOString(),
      exported_by: req.user?.username || 'Owner',
      summary: {
        total_orders: orders.length,
        total_products: products.length,
        total_customers: customers.length,
        total_expenses: expenses.length,
        total_farm_records: farm.length
      },
      data: {
        orders,
        products,
        customers,
        expenses,
        farm
      }
    };

    logActivity({
      admin_name: req.user?.username || 'Owner',
      admin_email: req.user?.email || '',
      action: 'backup_full',
      details: `Full database backup completed (${orders.length} orders, ${products.length} products)`
    }).catch(() => {});

    res.setHeader('Content-Disposition', `attachment; filename="pinnacles-full-backup-${new Date().toISOString().slice(0, 10)}.json"`);
    res.setHeader('Content-Type', 'application/json');
    res.json(fullBackup);
  } catch (err) {
    res.status(500).json({ error: 'Full backup failed: ' + err.message });
  }
});

module.exports = router;
