// backend/routes/customers.js
const express    = require('express');
const router     = express.Router();
const supabase   = require('../db');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'pinnacles_farm_secret';
const CUSTOMER_TOKEN_KEY = 'pinnacles_customer_token'; // eslint-disable-line no-unused-vars

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
    // Check for duplicate email
    const { data: existing } = await supabase
      .from('customers')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();
    if (existing) return res.status(409).json({ error: 'An account with this email already exists' });

    const hash = await bcrypt.hash(password, 10);
    const { data, error } = await supabase
      .from('customers')
      .insert({
        name,
        email: email.toLowerCase(),
        password: hash,
        phone: phone || null,
        phone_code: phone_code || '+234',
        address: address || null,
        city: city || null,
        state: state || 'Kwara',
      })
      .select('id')
      .single();
    if (error) throw new Error(error.message);

    const id = data.id;
    const token = jwt.sign({ id, name, email: email.toLowerCase(), type: 'customer' }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, customer: { id, name, email: email.toLowerCase(), loyalty_points: 0 } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── LOGIN ─────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    const { data: customer } = await supabase
      .from('customers')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();
    if (!customer) return res.status(401).json({ error: 'No account found with this email' });

    const ok = await bcrypt.compare(password, customer.password);
    if (!ok) return res.status(401).json({ error: 'Incorrect password' });

    const token = jwt.sign(
      { id: customer.id, name: customer.name, email: customer.email, type: 'customer' },
      JWT_SECRET,
      { expiresIn: '30d' }
    );
    res.json({
      token,
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        loyalty_points: customer.loyalty_points,
        total_orders: customer.total_orders,
      },
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET PROFILE ───────────────────────────────────────────────
router.get('/me', requireCustomer, async (req, res) => {
  try {
    const { data: c, error } = await supabase
      .from('customers')
      .select('id,name,email,phone,phone_code,address,city,state,loyalty_points,total_orders,total_spent,created_at')
      .eq('id', req.customer.id)
      .single();
    if (error && error.code !== 'PGRST116') throw new Error(error.message);
    if (!c) return res.status(404).json({ error: 'Account not found' });
    res.json(c);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── UPDATE PROFILE ────────────────────────────────────────────
router.patch('/me', requireCustomer, async (req, res) => {
  const { name, phone, phone_code, address, city, state } = req.body;
  try {
    // Build update object with only the provided fields (COALESCE behaviour)
    const updates = {};
    if (name       !== undefined) updates.name       = name;
    if (phone      !== undefined) updates.phone      = phone;
    if (phone_code !== undefined) updates.phone_code = phone_code;
    if (address    !== undefined) updates.address    = address;
    if (city       !== undefined) updates.city       = city;
    if (state      !== undefined) updates.state      = state;

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase
        .from('customers')
        .update(updates)
        .eq('id', req.customer.id);
      if (error) throw new Error(error.message);
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET MY ORDERS ─────────────────────────────────────────────
router.get('/orders', requireCustomer, async (req, res) => {
  try {
    const { data: orders, error } = await supabase
      .from('orders')
      .select('id,created_at,total,status,customer_name,items_json')
      .eq('customer_id', req.customer.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    const rows = (orders || []).map(o => ({
      ...o,
      items: (() => { try { return JSON.parse(o.items_json || '[]'); } catch (_) { return []; } })(),
    }));
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── LOYALTY POINTS ────────────────────────────────────────────
router.get('/loyalty', requireCustomer, async (req, res) => {
  try {
    const { data: c, error: ce } = await supabase
      .from('customers')
      .select('loyalty_points')
      .eq('id', req.customer.id)
      .single();
    if (ce && ce.code !== 'PGRST116') throw new Error(ce.message);

    const { data: txns, error: te } = await supabase
      .from('loyalty_transactions')
      .select('*')
      .eq('customer_id', req.customer.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (te) throw new Error(te.message);

    res.json({ points: (c && c.loyalty_points) || 0, transactions: txns || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── ADDRESSES ─────────────────────────────────────────────────
router.get('/addresses', requireCustomer, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('customer_addresses')
      .select('*')
      .eq('customer_id', req.customer.id);
    if (error) throw new Error(error.message);
    res.json(data || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/addresses', requireCustomer, async (req, res) => {
  const { label, address, city, state, is_default } = req.body;
  if (!address) return res.status(400).json({ error: 'Address required' });
  try {
    // Clear existing default if needed
    if (is_default) {
      const { error: clearErr } = await supabase
        .from('customer_addresses')
        .update({ is_default: 0 })
        .eq('customer_id', req.customer.id);
      if (clearErr) throw new Error(clearErr.message);
    }

    const { data, error } = await supabase
      .from('customer_addresses')
      .insert({
        customer_id: req.customer.id,
        label: label || 'Home',
        address,
        city: city || null,
        state: state || null,
        is_default: is_default ? 1 : 0,
      })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    res.json({ id: data.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── MY PRE-ORDERS ─────────────────────────────────────────────
router.get('/preorders', requireCustomer, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('preorders')
      .select('*')
      .eq('customer_id', req.customer.id)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    res.json(data || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Public: create a preorder (no account needed)
router.post('/preorder', async (req, res) => {
  const { customer_id, customer_name, customer_phone, customer_email, product_id, product_name, quantity, unit, notes, expected_date } = req.body;
  if (!product_name || !quantity || !customer_name || !customer_phone) {
    return res.status(400).json({ error: 'product_name, quantity, customer_name and customer_phone required' });
  }
  try {
    const { data, error } = await supabase
      .from('preorders')
      .insert({
        customer_id: customer_id || null,
        customer_name,
        customer_phone,
        customer_email: customer_email || null,
        product_id: product_id || null,
        product_name,
        quantity,
        unit: unit || 'kg',
        notes: notes || null,
        expected_date: expected_date || null,
      })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    res.json({ id: data.id, message: "Pre-order submitted! We'll contact you on WhatsApp to confirm." });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Admin: list all preorders
router.get('/preorders/all', async (req, res) => {
  // Allow both admin and unauthenticated for now (lock down later)
  try {
    const { data, error } = await supabase
      .from('preorders')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    res.json(data || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Admin: update preorder status
router.patch('/preorder/:id/status', async (req, res) => {
  const { status } = req.body;
  try {
    const { error } = await supabase
      .from('preorders')
      .update({ status })
      .eq('id', req.params.id);
    if (error) throw new Error(error.message);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── ADMIN: toggle preorder on a product ──────────────────────
router.patch('/product-preorder/:id', async (req, res) => {
  const { preorder_available, preorder_expected_date, preorder_note } = req.body;
  try {
    const { error } = await supabase
      .from('products')
      .update({
        preorder_available: preorder_available ? 1 : 0,
        preorder_expected_date: preorder_expected_date || null,
        preorder_note: preorder_note || null,
      })
      .eq('id', req.params.id);
    if (error) throw new Error(error.message);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = { router, requireCustomer };
