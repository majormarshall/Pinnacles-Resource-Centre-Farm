// backend/routes/customers.js
const express  = require('express');
const router   = express.Router();
const db       = require('../db');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'pinnacles_farm_secret';
const CUSTOMER_TOKEN_KEY = 'pinnacles_customer_token'; // eslint-disable-line no-unused-vars

// ── DB migration ──────────────────────────────────────────────
async function migrate() {
  const tables = [
    `CREATE TABLE IF NOT EXISTS customers (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      phone_code TEXT DEFAULT '+234',
      password TEXT NOT NULL,
      address TEXT,
      city TEXT,
      state TEXT DEFAULT 'Kwara',
      loyalty_points INTEGER DEFAULT 0,
      total_orders INTEGER DEFAULT 0,
      total_spent REAL DEFAULT 0,
      email_verified INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS customer_addresses (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER REFERENCES customers(id),
      label TEXT DEFAULT 'Home',
      address TEXT NOT NULL,
      city TEXT,
      state TEXT,
      is_default INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS loyalty_transactions (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER REFERENCES customers(id),
      order_id INTEGER,
      points INTEGER NOT NULL,
      type TEXT DEFAULT 'earn',
      description TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS preorders (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER,
      customer_name TEXT,
      customer_phone TEXT,
      customer_email TEXT,
      product_id INTEGER,
      product_name TEXT,
      quantity REAL NOT NULL,
      unit TEXT,
      notes TEXT,
      expected_date DATE,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
  ];
  for (const sql of tables) {
    try { await db.runAsync(sql, []); } catch(e) { console.error('Customer migration:', e.message); }
  }
  // Add customer_id column to orders if missing
  try { await db.runAsync('ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id INTEGER', []); } catch(_){}
  try { await db.runAsync('ALTER TABLE orders ADD COLUMN IF NOT EXISTS loyalty_points_earned INTEGER DEFAULT 0', []); } catch(_){}
  try { await db.runAsync('ALTER TABLE orders ADD COLUMN IF NOT EXISTS loyalty_points_used INTEGER DEFAULT 0', []); } catch(_){}
  // Add preorder flag to products table
  try { await db.runAsync('ALTER TABLE products ADD COLUMN IF NOT EXISTS preorder_available INTEGER DEFAULT 0', []); } catch(_){}
  try { await db.runAsync('ALTER TABLE products ADD COLUMN IF NOT EXISTS preorder_expected_date DATE', []); } catch(_){}
  try { await db.runAsync('ALTER TABLE products ADD COLUMN IF NOT EXISTS preorder_note TEXT', []); } catch(_){}
  console.log('[Customers] Migrations done');
}
migrate();

// ── Helper: requireCustomer ───────────────────────────────────
function requireCustomer(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Login required' });
  try {
    const decoded = jwt.verify(auth.slice(7), JWT_SECRET);
    req.customer = decoded;
    next();
  } catch (e) { res.status(401).json({ error: 'Session expired. Please log in again.' }); }
}

// ── REGISTER ──────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const { name, email, password, phone, phone_code, address, city, state } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  try {
    const existing = await db.getAsync('SELECT id FROM customers WHERE email=?', [email.toLowerCase()]);
    if (existing) return res.status(409).json({ error: 'An account with this email already exists' });
    const hash = await bcrypt.hash(password, 10);
    const r = await db.runAsync(
      'INSERT INTO customers (name,email,password,phone,phone_code,address,city,state) VALUES (?,?,?,?,?,?,?,?) RETURNING id',
      [name, email.toLowerCase(), hash, phone||null, phone_code||'+234', address||null, city||null, state||'Kwara']
    );
    const id = r.lastID || (r.rows && r.rows[0] && r.rows[0].id);
    const token = jwt.sign({ id, name, email: email.toLowerCase(), type: 'customer' }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, customer: { id, name, email: email.toLowerCase(), loyalty_points: 0 } });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── LOGIN ─────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    const customer = await db.getAsync('SELECT * FROM customers WHERE email=?', [email.toLowerCase()]);
    if (!customer) return res.status(401).json({ error: 'No account found with this email' });
    const ok = await bcrypt.compare(password, customer.password);
    if (!ok) return res.status(401).json({ error: 'Incorrect password' });
    const token = jwt.sign({ id: customer.id, name: customer.name, email: customer.email, type: 'customer' }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, customer: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone, loyalty_points: customer.loyalty_points, total_orders: customer.total_orders } });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── GET PROFILE ───────────────────────────────────────────────
router.get('/me', requireCustomer, async (req, res) => {
  const c = await db.getAsync('SELECT id,name,email,phone,phone_code,address,city,state,loyalty_points,total_orders,total_spent,created_at FROM customers WHERE id=?', [req.customer.id]);
  if (!c) return res.status(404).json({ error: 'Account not found' });
  res.json(c);
});

// ── UPDATE PROFILE ────────────────────────────────────────────
router.patch('/me', requireCustomer, async (req, res) => {
  const { name, phone, phone_code, address, city, state } = req.body;
  await db.runAsync(
    'UPDATE customers SET name=COALESCE(?,name), phone=COALESCE(?,phone), phone_code=COALESCE(?,phone_code), address=COALESCE(?,address), city=COALESCE(?,city), state=COALESCE(?,state) WHERE id=?',
    [name, phone, phone_code, address, city, state, req.customer.id]
  );
  res.json({ ok: true });
});

// ── GET MY ORDERS ─────────────────────────────────────────────
router.get('/orders', requireCustomer, async (req, res) => {
  const orders = await db.allAsync(
    'SELECT id, created_at, total, status, customer_name, items_json FROM orders WHERE customer_id=? ORDER BY created_at DESC LIMIT 50',
    [req.customer.id]
  ).catch(() => []);
  res.json(orders.map(o => ({ ...o, items: (() => { try { return JSON.parse(o.items_json || '[]'); } catch(_) { return []; } })() })));
});

// ── LOYALTY POINTS ────────────────────────────────────────────
router.get('/loyalty', requireCustomer, async (req, res) => {
  const c    = await db.getAsync('SELECT loyalty_points FROM customers WHERE id=?', [req.customer.id]);
  const txns = await db.allAsync('SELECT * FROM loyalty_transactions WHERE customer_id=? ORDER BY created_at DESC LIMIT 20', [req.customer.id]).catch(() => []);
  res.json({ points: (c && c.loyalty_points) || 0, transactions: txns });
});

// ── ADDRESSES ─────────────────────────────────────────────────
router.get('/addresses', requireCustomer, async (req, res) => {
  res.json(await db.allAsync('SELECT * FROM customer_addresses WHERE customer_id=?', [req.customer.id]).catch(() => []));
});

router.post('/addresses', requireCustomer, async (req, res) => {
  const { label, address, city, state, is_default } = req.body;
  if (!address) return res.status(400).json({ error: 'Address required' });
  if (is_default) await db.runAsync('UPDATE customer_addresses SET is_default=0 WHERE customer_id=?', [req.customer.id]);
  const r = await db.runAsync(
    'INSERT INTO customer_addresses (customer_id,label,address,city,state,is_default) VALUES (?,?,?,?,?,?) RETURNING id',
    [req.customer.id, label||'Home', address, city||null, state||null, is_default ? 1 : 0]
  );
  res.json({ id: r.lastID || (r.rows && r.rows[0] && r.rows[0].id) });
});

// ── MY PRE-ORDERS ─────────────────────────────────────────────
router.get('/preorders', requireCustomer, async (req, res) => {
  res.json(await db.allAsync('SELECT * FROM preorders WHERE customer_id=? ORDER BY created_at DESC', [req.customer.id]).catch(() => []));
});

// Public: create a preorder (no account needed)
router.post('/preorder', async (req, res) => {
  const { customer_id, customer_name, customer_phone, customer_email, product_id, product_name, quantity, unit, notes, expected_date } = req.body;
  if (!product_name || !quantity || !customer_name || !customer_phone) {
    return res.status(400).json({ error: 'product_name, quantity, customer_name and customer_phone required' });
  }
  try {
    const r = await db.runAsync(
      'INSERT INTO preorders (customer_id,customer_name,customer_phone,customer_email,product_id,product_name,quantity,unit,notes,expected_date) VALUES (?,?,?,?,?,?,?,?,?,?) RETURNING id',
      [customer_id||null, customer_name, customer_phone, customer_email||null, product_id||null, product_name, quantity, unit||'kg', notes||null, expected_date||null]
    );
    res.json({ id: r.lastID || (r.rows && r.rows[0] && r.rows[0].id), message: "Pre-order submitted! We'll contact you on WhatsApp to confirm." });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Admin: list all preorders
router.get('/preorders/all', async (req, res) => {
  // Allow both admin and unauthenticated for now (lock down later)
  res.json(await db.allAsync('SELECT * FROM preorders ORDER BY created_at DESC', []).catch(() => []));
});

// Admin: update preorder status
router.patch('/preorder/:id/status', async (req, res) => {
  const { status } = req.body;
  try {
    await db.runAsync('UPDATE preorders SET status=? WHERE id=?', [status, req.params.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── ADMIN: toggle preorder on a product ──────────────────────
router.patch('/product-preorder/:id', async (req, res) => {
  const { preorder_available, preorder_expected_date, preorder_note } = req.body;
  try {
    await db.runAsync(
      'UPDATE products SET preorder_available=?, preorder_expected_date=?, preorder_note=? WHERE id=?',
      [preorder_available ? 1 : 0, preorder_expected_date||null, preorder_note||null, req.params.id]
    );
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = { router, requireCustomer };
