// ============================================================
// Pinnacles Resource Centre Farm â€” Express Server
// ============================================================
require('dotenv').config();

// Warn loudly if critical env vars are missing
if (!process.env.SUPABASE_URL) {
  console.error('âŒ FATAL: SUPABASE_URL is not set! Set it in Vercel â†’ Settings â†’ Environment Variables');
}
if (!process.env.JWT_SECRET) {
  console.warn('âš ï¸  JWT_SECRET not set â€” using insecure default');
}
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const { globalLimiter } = require('./middleware/rateLimiter');

const app = express();
app.set('trust proxy', 1);

// â”€â”€ Middleware â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// â”€â”€ Static Files â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Force UTF-8 charset on all text files (fixes emoji garbling in dashboards)
const staticOpts = {
  setHeaders(res, fp) {
    if (/\.html?$/i.test(fp)) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Expires", "0");
    }
    else if (/\.js$/i.test(fp)) res.setHeader("Content-Type", "application/javascript; charset=utf-8");
    else if (/\.css$/i.test(fp)) res.setHeader("Content-Type", "text/css; charset=utf-8");
  }
};
app.use(express.static(path.join(__dirname, '..'), staticOpts));
app.use('/admin',   express.static(path.join(__dirname, '..', 'admin'),  staticOpts));
app.use('/farm',    express.static(path.join(__dirname, '..', 'farm'),   staticOpts));
app.use('/worker',  express.static(path.join(__dirname, '..', 'worker'), staticOpts));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// â”€â”€ API Routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
app.use('/api/worker-register', require('./routes/worker-register'));
app.use('/api/setup',       require('./routes/setup'));
app.use('/api/settings',    require('./routes/settings'));
app.use('/api/activity',    require('./routes/activity'));
app.use('/api/backup',      require('./routes/backup'));
app.use('/api/reviews',     require('./routes/reviews'));
app.use('/api/expenses',    require('./routes/expenses'));
app.use('/api/promotions',  require('./routes/promotions'));

// Serve worker portal
app.use('/worker', express.static(path.join(__dirname, '..', 'worker')));


// ── Receipt Routes ────────────────────────────────────────────
const { router: receiptRouter, buildReceiptHtml, verifyToken, streamReceiptPdf } = require('./routes/receipt');
app.use('/api/orders', receiptRouter); // adds /:id/receipt-token and /:id/receipt/email

// ── Invoice Routes ────────────────────────────────────────────
const { router: invoiceRouter, buildInvoiceHtml, verifyInvoiceToken } = require('./routes/invoice');
app.use('/api/orders', invoiceRouter); // adds /:id/invoice-token
app.use('/api/invoice', invoiceRouter); // adds /custom and /:orderId

// ── Public invoice page (/invoice/:id/:token) ────────────────
app.get('/invoice/:id/:token', async (req, res) => {
  const { id, token } = req.params;
  if (!verifyInvoiceToken(id, token)) {
    return res.status(403).send('<h2 style="font-family:sans-serif;padding:40px;">Invalid or expired invoice link.</h2>');
  }
  try {
    const supabase = require('./db');
    const { data: order } = await supabase.from('orders').select('*').eq('id', id).single();
    if (!order) return res.status(404).send('<h2 style="font-family:sans-serif;padding:40px;">Order not found.</h2>');
    order.items = JSON.parse(order.items_json || '[]');
    return res.send(buildInvoiceHtml(order, req.query));
  } catch (e) {
    return res.status(500).send('<h2 style="font-family:sans-serif;padding:40px;">Error: ' + e.message + '</h2>');
  }
});

// â”€â”€ Public receipt page (/receipt/:id/:token) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

    let bankReceipt = null;
    try {
      const { data: br } = await supabase
        .from('bank_receipts')
        .select('transaction_id, bank_name, amount')
        .eq('order_id', id)
        .limit(1)
        .maybeSingle();
      if (br) bankReceipt = br;
    } catch (_) {}

    return res.send(buildReceiptHtml(order, bankReceipt));
  } catch (e) {
    return res.status(500).send('<h2 style="font-family:sans-serif;padding:40px;">Error: ' + e.message + '</h2>');
  }
});

// ── PDF receipt download (/receipt/:id/:token/pdf) ───────────
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

    let bankReceipt = null;
    try {
      const { data: br } = await supabase
        .from('bank_receipts')
        .select('transaction_id, bank_name, amount')
        .eq('order_id', id)
        .limit(1)
        .maybeSingle();
      if (br) bankReceipt = br;
    } catch (_) {}

    return streamReceiptPdf(order, res, req, bankReceipt);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// ── GET /api/receipt/:orderId endpoint ─────────────────────────
app.get('/api/receipt/:orderId', async (req, res) => {
  const { orderId } = req.params;
  try {
    const supabase = require('./db');
    const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single();
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    order.items = JSON.parse(order.items_json || '[]');

    let bankReceipt = null;
    try {
      const { data: br } = await supabase
        .from('bank_receipts')
        .select('transaction_id, bank_name, amount')
        .eq('order_id', orderId)
        .limit(1)
        .maybeSingle();
      if (br) bankReceipt = br;
    } catch (_) {}

    const receiptHtml = buildReceiptHtml(order, bankReceipt);

    if (req.query.format === 'html' || req.headers.accept?.includes('text/html')) {
      return res.send(receiptHtml);
    }
    return res.json({
      order,
      bank_receipt: bankReceipt,
      bank_transaction_id: bankReceipt?.transaction_id || null,
      bank_name: bankReceipt?.bank_name || null,
      receipt_html: receiptHtml
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// â”€â”€ Info endpoint â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/api/info', (req, res) => {
  res.json({
    name: 'Pinnacles Resource Centre Farm',
    email: process.env.FARM_EMAIL,
    wa: process.env.WA_NUMBER,
    version: '1.0.0'
  });
});

// â”€â”€ Health / diagnostics endpoint â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    status.db = 'connected âœ…';
    status.products_count = count || 0;
    status.admin_exists = !!admin;
    status.admin_username_in_db = admin?.username || 'none';
  } catch (e) {
    status.ok = false;
    status.db = 'ERROR: ' + e.message;
  }
  res.status(status.ok ? 200 : 500).json(status);
});

// â”€â”€ SPA Fallback â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('*', (req, res) => {
  if (req.path.startsWith('/admin')) {
    return res.sendFile(path.join(__dirname, '..', 'admin', 'index.html'));
  }
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// â”€â”€ Start Server (local only) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`\nðŸŒ¿ Pinnacles Farm Server running on http://localhost:${PORT}`);
    console.log(`ðŸ“Š Admin Dashboard: http://localhost:${PORT}/admin`);
    console.log(`ðŸ“¡ API Base: http://localhost:${PORT}/api\n`);
  });
}

// Export for Vercel serverless
module.exports = app;

