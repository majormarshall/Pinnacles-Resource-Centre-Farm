// ============================================================
// Pinnacles Resource Centre Farm — Express Server
// ============================================================
require('dotenv').config();

// Warn loudly if critical env vars are missing
if (!process.env.DATABASE_URL) {
  console.error('❌ FATAL: DATABASE_URL is not set! Set it in Vercel → Settings → Environment Variables');
}
if (!process.env.JWT_SECRET) {
  console.warn('⚠️  JWT_SECRET not set — using insecure default');
}
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const { globalLimiter } = require('./middleware/rateLimiter');

const app = express();

// ── Middleware ────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Static Files ──────────────────────────────────────────────
// Serve the main farm website from the root folder
app.use(express.static(path.join(__dirname, '..')));
// Serve admin panel
app.use('/admin', express.static(path.join(__dirname, '..', 'admin')));
// Serve uploaded product images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── API Routes ────────────────────────────────────────────────
// Global rate limit applied to all /api/* routes
app.use('/api', globalLimiter);

app.use('/api/auth',     require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders',   require('./routes/orders'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/gallery',  require('./routes/gallery'));
app.use('/api/payment',  require('./routes/payment'));
app.use('/api/harvest',     require('./routes/harvest'));
app.use('/api/harvest-ai',  require('./routes/harvest_ai'));
app.use('/api/maintenance', require('./routes/maintenance'));
app.use('/api/exports',     require('./routes/exports'));
app.use('/api/farm',        require('./routes/farm'));
app.use('/api/admin-users', require('./routes/admin-users'));
app.use('/api/customers',   require('./routes/customers').router);

// Serve worker portal
app.use('/worker', express.static(path.join(__dirname, '..', 'worker')));

// Initialise Supabase JS client (logs on startup)
require('./supabaseClient');


// ── Receipt Routes ────────────────────────────────────────────
const { router: receiptRouter, buildReceiptHtml, verifyToken, streamReceiptPdf } = require('./routes/receipt');
app.use('/api/orders', receiptRouter); // adds /:id/receipt-token and /:id/receipt/email

// ── Public receipt page (/receipt/:id/:token) ─────────────────
app.get('/receipt/:id/:token', async (req, res) => {
  const { id, token } = req.params;
  if (!verifyToken(id, token)) {
    return res.status(403).send('<h2 style="font-family:sans-serif;padding:40px;">Invalid or expired receipt link.</h2>');
  }
  try {
    const supabase = require('./db');
    const { data: order } = await supabase.from('orders').select('*').eq('id', id).single();
    if (!order) return res.status(404).send('<h2 style="font-family:sans-serif;padding:40px;">Order not found.</h2>');
    order.items = JSON.parse(order.items_json || '[]');
    return res.send(buildReceiptHtml(order));
  } catch (e) {
    return res.status(500).send('<h2 style="font-family:sans-serif;padding:40px;">Error: ' + e.message + '</h2>');
  }
});

// ── PDF receipt download (/receipt/:id/:token/pdf) ──────────
app.get('/receipt/:id/:token/pdf', async (req, res) => {
  const { id, token } = req.params;
  if (!verifyToken(id, token)) {
    return res.status(403).send('Invalid or expired receipt link.');
  }
  try {
    const supabase = require('./db');
    const { data: order } = await supabase.from('orders').select('*').eq('id', id).single();
    if (!order) return res.status(404).send('Order not found.');
    order.items = JSON.parse(order.items_json || '[]');
    return streamReceiptPdf(order, res, req);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// ── Info endpoint ─────────────────────────────────────────────
app.get('/api/info', (req, res) => {
  res.json({
    name: 'Pinnacles Resource Centre Farm',
    email: process.env.FARM_EMAIL,
    wa: process.env.WA_NUMBER,
    version: '1.0.0'
  });
});

// ── Health / diagnostics endpoint ─────────────────────────────
// Visit /api/health to instantly see what's wrong
app.get('/api/health', async (req, res) => {
  const status = {
    ok: true,
    timestamp: new Date().toISOString(),
    supabase_url_set: !!process.env.SUPABASE_URL,
    jwt_secret_set: !!process.env.JWT_SECRET,
    admin_username: process.env.ADMIN_USERNAME || '(not set)',
    db: 'not tested',
    admin_exists: false,
    products_count: 0,
  };
  try {
    const supabase = require('./db');
    const { count } = await supabase.from('products').select('*', { count: 'exact', head: true });
    const { data: admin } = await supabase.from('admins').select('id, username').limit(1).single();
    status.db = 'connected ✅';
    status.products_count = count || 0;
    status.admin_exists = !!admin;
    status.admin_username_in_db = admin?.username || 'none';
  } catch (e) {
    status.ok = false;
    status.db = 'ERROR: ' + e.message;
  }
  res.status(status.ok ? 200 : 500).json(status);
});

// ── SPA Fallback ──────────────────────────────────────────────
app.get('*', (req, res) => {
  if (req.path.startsWith('/admin')) {
    return res.sendFile(path.join(__dirname, '..', 'admin', 'index.html'));
  }
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// ── Start Server (local only) ─────────────────────────────────
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`\n🌿 Pinnacles Farm Server running on http://localhost:${PORT}`);
    console.log(`📊 Admin Dashboard: http://localhost:${PORT}/admin`);
    console.log(`📡 API Base: http://localhost:${PORT}/api\n`);
  });
}

// Export for Vercel serverless
module.exports = app;
