// backend/routes/invoice.js
// ═════════════════════════════════════════════════════════════════
// Pinnacles Resource Centre Farm — Professional Invoice System
// Generates official customer invoices, printable HTML, and PDF export
// ═════════════════════════════════════════════════════════════════

const express   = require('express');
const router    = express.Router();
const crypto    = require('crypto');
const supabase  = require('../db');
const { requireAuth } = require('../middleware/auth');

function generateInvoiceToken(orderId) {
  const secret = process.env.JWT_SECRET || 'pinnacles_farm_secret_2026_change_me';
  return crypto.createHmac('sha256', secret).update('inv_' + String(orderId)).digest('hex').slice(0, 32);
}

function verifyInvoiceToken(orderId, token) {
  return token === generateInvoiceToken(orderId);
}

function formatNaira(n) {
  return '₦' + Number(n || 0).toLocaleString('en-NG');
}

function formatDate(dt) {
  if (!dt) return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  return new Date(dt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function buildInvoiceHtml(order, options = {}) {
  const items = typeof order.items === 'string'
    ? JSON.parse(order.items_json || order.items || '[]')
    : (order.items || JSON.parse(order.items_json || '[]'));

  const invoiceNo = 'INV-' + (new Date(order.created_at || Date.now()).getFullYear()) + '-' + String(order.id).padStart(4, '0');
  const invoiceDate = formatDate(order.created_at || Date.now());
  const dueDate = options.due_date || formatDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
  const subtotal = Number(order.total || 0);
  const discount = Number(options.discount || 0);
  const deliveryFee = Number(options.delivery_fee || 0);
  const grandTotal = Math.max(0, subtotal - discount + deliveryFee);
  const notes = options.notes || order.notes || 'Thank you for choosing Pinnacles Resource Centre Farm fresh produce!';

  const isPaid = order.status === 'confirmed' || order.status === 'delivered';
  const statusBadge = isPaid
    ? `<span style="display:inline-block;background:#d1fae5;color:#065f46;border:1px solid #34d399;font-weight:800;font-size:.78rem;padding:4px 14px;border-radius:20px;text-transform:uppercase;letter-spacing:.06em;">✓ PAID</span>`
    : `<span style="display:inline-block;background:#fef3c7;color:#92400e;border:1px solid #f59e0b;font-weight:800;font-size:.78rem;padding:4px 14px;border-radius:20px;text-transform:uppercase;letter-spacing:.06em;">⏳ PAYMENT DUE</span>`;

  const itemRows = items.map((i, idx) => {
    const lineTotal = Number(i.price || 0) * Number(i.qty || 1);
    return `
    <tr style="border-bottom:1px solid #e5e7eb;">
      <td style="padding:12px 14px;color:#6b7280;font-size:.86rem;width:40px;text-align:center;">${idx + 1}</td>
      <td style="padding:12px 14px;font-weight:600;color:#111827;font-size:.9rem;">
        ${i.emoji || '🌿'} ${i.name}
      </td>
      <td style="padding:12px 14px;text-align:center;color:#374151;font-size:.9rem;">${i.qty}</td>
      <td style="padding:12px 14px;text-align:right;color:#374151;font-size:.9rem;">${formatNaira(i.price)}</td>
      <td style="padding:12px 14px;text-align:right;font-weight:700;color:#1b4332;font-size:.92rem;">${formatNaira(lineTotal)}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Invoice ${invoiceNo} — Pinnacles Resource Centre Farm</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Outfit', 'Segoe UI', Arial, sans-serif;
      background: #f3f4f6;
      color: #1f2937;
      padding: 30px 16px 50px;
      display: flex;
      flex-direction: column;
      align-items: center;
      min-height: 100vh;
    }
    .action-bar {
      display: flex;
      gap: 12px;
      margin-bottom: 24px;
      flex-wrap: wrap;
      justify-content: center;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      border: none;
      border-radius: 50px;
      padding: 12px 24px;
      font-weight: 700;
      font-size: .92rem;
      font-family: inherit;
      cursor: pointer;
      text-decoration: none;
      transition: all .2s;
    }
    .btn-print {
      background: linear-gradient(135deg, #1b4332, #2d6a4f);
      color: #fff;
      box-shadow: 0 4px 14px rgba(27,67,50,.25);
    }
    .btn-print:hover { opacity: .9; transform: translateY(-1px); }
    .btn-wa {
      background: #25D366;
      color: #fff;
    }
    .invoice-card {
      background: #fff;
      width: 100%;
      max-width: 780px;
      border-radius: 20px;
      box-shadow: 0 10px 40px rgba(0,0,0,.08);
      border: 1px solid #e5e7eb;
      overflow: hidden;
    }
    .inv-header {
      background: linear-gradient(135deg, #1b4332 0%, #2d6a4f 100%);
      color: #fff;
      padding: 36px 40px 30px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      flex-wrap: wrap;
      gap: 20px;
    }
    .brand-title {
      font-size: 1.45rem;
      font-weight: 800;
      letter-spacing: .02em;
    }
    .brand-subtitle {
      font-size: .82rem;
      opacity: .8;
      letter-spacing: .05em;
      text-transform: uppercase;
      margin-top: 3px;
    }
    .inv-title {
      text-align: right;
    }
    .inv-title h1 {
      font-size: 2rem;
      font-weight: 900;
      letter-spacing: .08em;
      line-height: 1;
    }
    .inv-title .inv-number {
      font-size: 1rem;
      opacity: .9;
      font-family: monospace;
      margin-top: 6px;
      font-weight: 700;
    }
    .inv-body {
      padding: 36px 40px;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      margin-bottom: 30px;
      padding-bottom: 24px;
      border-bottom: 1px solid #e5e7eb;
    }
    .meta-col h4 {
      font-size: .75rem;
      text-transform: uppercase;
      letter-spacing: .08em;
      color: #52b788;
      margin-bottom: 8px;
      font-weight: 800;
    }
    .meta-col p {
      font-size: .92rem;
      line-height: 1.5;
      color: #374151;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }
    .items-table th {
      background: #f9fafb;
      padding: 12px 14px;
      font-size: .75rem;
      text-transform: uppercase;
      letter-spacing: .07em;
      color: #4b5563;
      font-weight: 700;
      border-bottom: 2px solid #e5e7eb;
    }
    .summary-grid {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 30px;
    }
    .summary-box {
      width: 280px;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      font-size: .9rem;
      color: #4b5563;
    }
    .summary-row.total {
      border-top: 2px solid #1b4332;
      border-bottom: 2px solid #1b4332;
      padding: 12px 0;
      font-weight: 800;
      font-size: 1.15rem;
      color: #1b4332;
      margin-top: 6px;
    }
    .payment-bank-box {
      background: #f0faf4;
      border: 1px solid #a3d9b8;
      border-radius: 14px;
      padding: 18px 22px;
      margin-bottom: 24px;
    }
    .payment-bank-box h4 {
      color: #1b4332;
      font-size: .88rem;
      margin-bottom: 8px;
      font-weight: 800;
    }
    .payment-bank-box p {
      font-size: .85rem;
      color: #2d6a4f;
      line-height: 1.6;
    }
    .inv-footer {
      text-align: center;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      color: #6b7280;
      font-size: .8rem;
      line-height: 1.6;
    }
    @media print {
      body { background: #fff; padding: 0; }
      .action-bar { display: none !important; }
      .invoice-card { box-shadow: none; border: none; max-width: 100%; border-radius: 0; }
      .inv-header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .payment-bank-box { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    @media (max-width: 600px) {
      .inv-header { padding: 24px 20px; }
      .inv-body { padding: 24px 20px; }
      .meta-grid { grid-template-columns: 1fr; gap: 16px; }
      .inv-title { text-align: left; }
    }
  </style>
</head>
<body>

  <div class="action-bar">
    <button onclick="window.print()" class="btn btn-print">🖨️ Print / Save as PDF</button>
    <a href="https://wa.me/${(order.customer_phone || '').replace(/\D/g,'')}?text=${encodeURIComponent('Hello ' + (order.customer_name || 'Customer') + '! Here is your official invoice from Pinnacles Farm: ' + invoiceNo + ' for ' + formatNaira(grandTotal))}" target="_blank" class="btn btn-wa">💬 Send via WhatsApp</a>
  </div>

  <div class="invoice-card">
    <div class="inv-header">
      <div>
        <div class="brand-title">🌱 Pinnacles Resource Centre Farm</div>
        <div class="brand-subtitle">Offa, Kwara State, Nigeria · Fresh Farm Gate Produce</div>
        <div style="font-size:.82rem;opacity:.85;margin-top:6px;">WhatsApp / Call: +234 903 750 5632 · +234 707 821 0834</div>
      </div>
      <div class="inv-title">
        <h1>INVOICE</h1>
        <div class="inv-number">${invoiceNo}</div>
        <div style="margin-top:8px;">${statusBadge}</div>
      </div>
    </div>

    <div class="inv-body">
      <div class="meta-grid">
        <div class="meta-col">
          <h4>Billed To (Customer)</h4>
          <p><strong>${order.customer_name || 'Walk-in / Online Customer'}</strong></p>
          <p>📱 ${order.customer_phone || 'N/A'}</p>
          ${order.customer_email ? `<p>✉️ ${order.customer_email}</p>` : ''}
          ${order.delivery_address || order.notes ? `<p>📍 ${order.delivery_address || order.notes}</p>` : ''}
        </div>
        <div class="meta-col" style="text-align:right;">
          <h4>Invoice Details</h4>
          <p><strong>Invoice Date:</strong> ${invoiceDate}</p>
          <p><strong>Due Date:</strong> ${dueDate}</p>
          <p><strong>Order Ref:</strong> #${order.id}</p>
          <p><strong>Payment Status:</strong> ${isPaid ? 'Paid' : 'Pending'}</p>
        </div>
      </div>

      <table class="items-table">
        <thead>
          <tr>
            <th style="width:40px;text-align:center">#</th>
            <th style="text-align:left">Produce Item</th>
            <th style="text-align:center">Qty</th>
            <th style="text-align:right">Unit Price</th>
            <th style="text-align:right">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
        </tbody>
      </table>

      <div class="summary-grid">
        <div class="summary-box">
          <div class="summary-row">
            <span>Subtotal:</span>
            <span>${formatNaira(subtotal)}</span>
          </div>
          ${discount > 0 ? `
          <div class="summary-row" style="color:#10b981;">
            <span>Discount:</span>
            <span>-${formatNaira(discount)}</span>
          </div>` : ''}
          ${deliveryFee > 0 ? `
          <div class="summary-row">
            <span>Delivery Fee:</span>
            <span>+${formatNaira(deliveryFee)}</span>
          </div>` : ''}
          <div class="summary-row total">
            <span>Amount Due:</span>
            <span>${formatNaira(grandTotal)}</span>
          </div>
        </div>
      </div>

      <div class="payment-bank-box">
        <h4>🏦 Bank Transfer Payment Details</h4>
        <p><strong>Bank:</strong> Moniepoint / Sterling Bank / First Bank</p>
        <p><strong>Account Name:</strong> Pinnacles Resource Centre Farm</p>
        <p><strong>Account Number:</strong> 0123456789</p>
        <p style="margin-top:6px;font-size:.8rem;color:#1b4332;">* Please include Invoice No <strong>${invoiceNo}</strong> in payment narration, and send receipt via WhatsApp to +234 903 750 5632.</p>
      </div>

      <div class="inv-footer">
        <p><strong>${notes}</strong></p>
        <p>Pinnacles Resource Centre Farm · Offa, Kwara State · agribusiness@pinnaclescentre.com · https://farm.pinnaclescentre.ng</p>
      </div>
    </div>
  </div>

</body>
</html>`;
}

// ── GET /api/orders/:id/invoice-token ─────────────────────────────
router.get('/:id/invoice-token', requireAuth, (req, res) => {
  const token = generateInvoiceToken(req.params.id);
  const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
  res.json({
    token,
    invoiceUrl: `${baseUrl}/invoice/${req.params.id}/${token}`,
    orderId: req.params.id
  });
});

// ── GET /api/invoice/:orderId ─────────────────────────────────────
router.get('/:orderId', requireAuth, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { data: order, error } = await supabase.from('orders').select('*').eq('id', orderId).single();
    if (error || !order) return res.status(404).json({ error: 'Order not found' });
    order.items = typeof order.items === 'string' ? JSON.parse(order.items_json || order.items || '[]') : (order.items || JSON.parse(order.items_json || '[]'));

    const html = buildInvoiceHtml(order, req.query);
    if (req.query.format === 'html' || req.headers.accept?.includes('text/html')) {
      return res.send(html);
    }
    res.json({ ok: true, invoiceHtml: html, order });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/invoice/custom — Generate custom invoice on the fly ──
router.post('/custom', requireAuth, async (req, res) => {
  try {
    const { customer_name, customer_phone, customer_email, items, delivery_fee = 0, discount = 0, notes } = req.body;
    if (!customer_name || !items || !items.length) {
      return res.status(400).json({ error: 'Customer name and at least 1 item required' });
    }

    const calculatedTotal = items.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.qty || 1)), 0);

    // Save as an order in DB with status 'pending'
    const { data: newOrder, error } = await supabase.from('orders').insert({
      customer_name,
      customer_phone: customer_phone || '',
      customer_email: customer_email || '',
      items_json: JSON.stringify(items),
      total: calculatedTotal,
      status: 'pending',
      notes: notes || 'Direct invoice generated by Admin'
    }).select('*').single();

    if (error) throw error;
    newOrder.items = items;

    const token = generateInvoiceToken(newOrder.id);
    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    const invoiceUrl = `${baseUrl}/invoice/${newOrder.id}/${token}`;

    res.json({
      ok: true,
      order: newOrder,
      invoiceUrl,
      invoiceHtml: buildInvoiceHtml(newOrder, { delivery_fee, discount, notes })
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = {
  router,
  generateInvoiceToken,
  verifyInvoiceToken,
  buildInvoiceHtml
};
