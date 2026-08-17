// ============================================================
// Pinnacles Resource Centre Farm — Express Server
// ============================================================
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

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
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders',   require('./routes/orders'));
app.use('/api/messages', require('./routes/messages'));

// ── Info endpoint ─────────────────────────────────────────────
app.get('/api/info', (req, res) => {
  res.json({
    name: 'Pinnacles Resource Centre Farm',
    email: process.env.FARM_EMAIL,
    wa: process.env.WA_NUMBER,
    version: '1.0.0'
  });
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
