// ── Receipt Routes ────────────────────────────────────────────
const router      = require('express').Router();
const crypto      = require('crypto');
const db          = require('../db');
const requireAuth = require('../middleware/auth');
const nodemailer  = require('nodemailer');

// ── Helpers ───────────────────────────────────────────────────
function generateToken(orderId) {
  const secret = process.env.JWT_SECRET || 'pinnacles_farm_secret_2026_change_me';
  return crypto.createHmac('sha256', secret).update(String(orderId)).digest('hex').slice(0, 32);
}

function verifyToken(orderId, token) {
  return token === generateToken(orderId);
}

function formatNaira(n) {
  return '&#8358;' + Number(n).toLocaleString('en-NG');
}

function formatDate(dt) {
  if (!dt) return '';
  return new Date(dt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function statusLabel(s) {
  const map = { pending: '⏳ Pending', confirmed: '✅ Confirmed', processing: '🔄 Processing', delivered: '🚚 Delivered', cancelled: '❌ Cancelled', pending_payment: '💳 Awaiting Payment' };
  return map[s] || s;
}

// ── Build standalone receipt HTML ─────────────────────────────
function buildReceiptHtml(order) {
  const items = typeof order.items === 'string' ? JSON.parse(order.items_json || order.items) : (order.items || JSON.parse(order.items_json || '[]'));
  const rows = items.map(i => `
    <tr>
      <td style="padding:10px 14px;border-bottom:1px solid #e8f5e9;font-size:.9rem;">${i.emoji || '🌿'} ${i.name}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e8f5e9;text-align:center;font-size:.9rem;">${i.qty}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e8f5e9;text-align:right;font-weight:600;color:#1b4332;font-size:.9rem;">&#8358;${(i.price * i.qty).toLocaleString('en-NG')}</td>
    </tr>`).join('');

  const payMethod = (order.whatsapp_msg || '').startsWith('payisland_ref:') ? '💳 Online Payment (PayIsland)' : '📲 WhatsApp Order';
  const receiptNo = String(order.id).padStart(4, '0');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Receipt #${receiptNo} — Pinnacles Resource Centre Farm</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Outfit', 'Segoe UI', Arial, sans-serif;
      background: #f0faf4;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 32px 16px 48px;
      color: #1a1a2e;
    }
    .print-btn {
      background: linear-gradient(135deg, #1b4332, #2d6a4f);
      color: #fff;
      border: none;
      padding: 12px 28px;
      border-radius: 50px;
      font-size: .95rem;
      font-weight: 700;
      cursor: pointer;
      margin-bottom: 24px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-family: 'Outfit', sans-serif;
      transition: opacity .2s;
    }
    .print-btn:hover { opacity: .88; }
    .receipt {
      background: #fff;
      border-radius: 20px;
      width: 100%;
      max-width: 600px;
      box-shadow: 0 8px 40px rgba(27,67,50,.12);
      overflow: hidden;
    }
    /* ── Header ── */
    .receipt-header {
      background: linear-gradient(135deg, #1b4332, #2d6a4f);
      padding: 32px 36px 28px;
      text-align: center;
      color: #fff;
    }
    .logo-wrap {
      width: 72px;
      height: 72px;
      background: rgba(255,255,255,.15);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
      padding: 8px;
      border: 2px solid rgba(255,255,255,.3);
    }
    .logo-wrap img { width: 52px; height: 52px; object-fit: contain; }
    .farm-name {
      font-size: 1.25rem;
      font-weight: 800;
      letter-spacing: .02em;
      margin-bottom: 2px;
    }
    .farm-tagline {
      font-size: .8rem;
      opacity: .75;
      letter-spacing: .05em;
      text-transform: uppercase;
    }
    .receipt-title {
      margin-top: 20px;
      font-size: 1.6rem;
      font-weight: 700;
      letter-spacing: .04em;
    }
    .receipt-no {
      font-size: .82rem;
      opacity: .7;
      margin-top: 4px;
    }
    /* ── Info row ── */
    .info-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0;
      border-bottom: 2px solid #e8f5e9;
    }
    .info-block {
      padding: 20px 24px;
    }
    .info-block:first-child {
      border-right: 1px solid #e8f5e9;
    }
    .info-label {
      font-size: .72rem;
      font-weight: 700;
      color: #52b788;
      text-transform: uppercase;
      letter-spacing: .07em;
      margin-bottom: 6px;
    }
    .info-value {
      font-size: .9rem;
      font-weight: 600;
      color: #1a1a2e;
    }
    .info-value.muted {
      font-weight: 400;
      color: #555;
    }
    /* ── Items table ── */
    .items-section { padding: 0 24px; }
    .items-heading {
      font-size: .72rem;
      font-weight: 700;
      color: #52b788;
      text-transform: uppercase;
      letter-spacing: .07em;
      padding: 18px 0 10px;
    }
    table { width: 100%; border-collapse: collapse; }
    thead th {
      background: #f0faf4;
      padding: 10px 14px;
      font-size: .75rem;
      font-weight: 700;
      color: #4b5563;
      text-align: left;
    }
    thead th:nth-child(2) { text-align: center; }
    thead th:nth-child(3) { text-align: right; }
    .total-row td {
      padding: 14px 14px;
      font-weight: 800;
      font-size: 1.05rem;
      color: #1b4332;
      border-top: 2px solid #1b4332;
    }
    .total-row td:last-child { text-align: right; color: #2d6a4f; font-size: 1.15rem; }
    /* ── Footer ── */
    .receipt-footer {
      background: #f8fbf9;
      border-top: 2px solid #e8f5e9;
      padding: 20px 24px;
      text-align: center;
    }
    .footer-status {
      display: inline-block;
      background: #e8f5e9;
      color: #1b4332;
      padding: 6px 18px;
      border-radius: 50px;
      font-size: .82rem;
      font-weight: 700;
      margin-bottom: 14px;
    }
    .payment-method {
      font-size: .82rem;
      color: #555;
      margin-bottom: 14px;
    }
    .thank-you {
      font-size: 1rem;
      font-weight: 700;
      color: #1b4332;
      margin-bottom: 6px;
    }
    .contact-line {
      font-size: .78rem;
      color: #777;
      line-height: 1.7;
    }
    .divider {
      height: 2px;
      background: linear-gradient(90deg, transparent, #52b788, transparent);
      margin: 16px 0;
    }
    .note {
      font-size: .75rem;
      color: #aaa;
      margin-top: 12px;
    }
    /* ── Print styles ── */
    @media print {
      body { background: #fff; padding: 0; }
      .print-btn { display: none !important; }
      .receipt { box-shadow: none; border-radius: 0; max-width: 100%; }
    }
    @media (max-width: 480px) {
      .info-section { grid-template-columns: 1fr; }
      .info-block:first-child { border-right: none; border-bottom: 1px solid #e8f5e9; }
    }
  </style>
</head>
<body>

  <button class="print-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>

  <div class="receipt">

    <!-- Header with Logo -->
    <div class="receipt-header">
      <div class="logo-wrap">
        <img src="/images/logo.svg" alt="Pinnacles Farm Logo" onerror="this.outerHTML='<span style=font-size:2rem>🌿</span>'" />
      </div>
      <div class="farm-name">Pinnacles Resource Centre Farm</div>
      <div class="farm-tagline">Fresh · Organic · Farm to Table</div>
      <div class="receipt-title">OFFICIAL RECEIPT</div>
      <div class="receipt-no">Receipt #${receiptNo} &nbsp;|&nbsp; ${formatDate(order.created_at)}</div>
    </div>

    <!-- Customer & Order Info -->
    <div class="info-section">
      <div class="info-block">
        <div class="info-label">Billed To</div>
        <div class="info-value">${order.customer_name || 'Customer'}</div>
        <div class="info-value muted" style="margin-top:4px">📱 ${order.customer_phone || '—'}</div>
        ${order.customer_email ? `<div class="info-value muted" style="margin-top:2px">✉️ ${order.customer_email}</div>` : ''}
      </div>
      <div class="info-block">
        <div class="info-label">Order Details</div>
        <div class="info-value">Order #${order.id}</div>
        <div class="info-value muted" style="margin-top:4px">Date: ${formatDate(order.created_at)}</div>
        ${order.notes ? `<div class="info-value muted" style="margin-top:4px;font-size:.8rem">📝 ${order.notes}</div>` : ''}
      </div>
    </div>

    <!-- Items Table -->
    <div class="items-section">
      <div class="items-heading">Items Purchased</div>
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>Qty</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
        <tfoot>
          <tr class="total-row">
            <td colspan="2">TOTAL</td>
            <td>&#8358;${Number(order.total).toLocaleString('en-NG')}</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- Footer -->
    <div class="receipt-footer">
      <div class="divider"></div>
      <div class="footer-status">${statusLabel(order.status)}</div>
      <div class="payment-method">Payment Method: ${payMethod}</div>
      <div class="thank-you">🌿 Thank you for shopping with us!</div>
      <div class="contact-line">
        Pinnacles Resource Centre Farm<br>
        📧 agribusiness@pinnaclescentre.com<br>
        📲 WhatsApp: +234 903 750 5632 &nbsp;|&nbsp; +234 707 821 0834
      </div>
      <div class="note">This is an official receipt. Please retain for your records.</div>
    </div>

  </div>

</body>
</html>`;
}

// ── GET /api/orders/:id/receipt-token (auth required) ─────────
// Returns the secure token and full receipt URL for this order
router.get('/:id/receipt-token', requireAuth, async (req, res) => {
  try {
    const order = await db.getAsync('SELECT id FROM orders WHERE id = ?', [req.params.id]);
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    const token = generateToken(order.id);
    const baseUrl = process.env.SITE_URL || '';
    const receiptUrl = `${baseUrl}/receipt/${order.id}/${token}`;
    res.json({ token, receiptUrl });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/orders/:id/receipt/email (auth required) ────────
// Emails the receipt to a provided email address
router.post('/:id/receipt/email', requireAuth, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email address required.' });

    const smtpUser  = process.env.SMTP_USER;
    const smtpPass  = process.env.SMTP_PASS;
    if (!smtpUser || !smtpPass || smtpPass === 'your_gmail_app_password_here') {
      return res.status(503).json({ error: 'Email not configured on the server. Please use WhatsApp to send the receipt.' });
    }

    const order = await db.getAsync('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    // Parse items
    order.items = JSON.parse(order.items_json || '[]');

    // Save email to order if not already set
    if (!order.customer_email && email) {
      await db.runAsync('UPDATE orders SET customer_email = ? WHERE id = ?', [email, order.id]).catch(() => {});
    }

    const token = generateToken(order.id);
    const baseUrl = process.env.SITE_URL || '';
    const receiptUrl = `${baseUrl}/receipt/${order.id}/${token}`;
    const receiptHtml = buildReceiptHtml(order);
    const receiptNo = String(order.id).padStart(4, '0');

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: true,
      auth: { user: smtpUser, pass: smtpPass },
    });

    await transporter.sendMail({
      from: `"Pinnacles Resource Centre Farm" <${smtpUser}>`,
      to: email,
      subject: `🌿 Your Receipt #${receiptNo} — Pinnacles Resource Centre Farm`,
      html: `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f0faf4;">
          <p style="color:#374151;font-size:.95rem;margin-bottom:16px;">
            Dear ${order.customer_name || 'Customer'},<br><br>
            Thank you for your order! Please find your official receipt below.
          </p>
          ${receiptHtml.replace(/<button class="print-btn"[^>]*>.*?<\/button>/s, '').replace(/<body[^>]*>/, '').replace(/<\/body>.*/, '')}
          <p style="margin-top:20px;font-size:.82rem;color:#9ca3af;">
            You can also <a href="${receiptUrl}" style="color:#2d6a4f;">view your receipt online</a> at any time.
          </p>
        </div>`,
    });

    res.json({ message: `Receipt sent to ${email} successfully!` });
  } catch (e) {
    console.error('Receipt email error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Public receipt page ───────────────────────────────────────
// Served directly from server.js as app.get('/receipt/:id/:token', ...)
// but the builder function is exported here for use there.

// ── A4 PDF Receipt Builder (pdfkit) ──────────────────────────
function streamReceiptPdf(order, res) {
  const PDFDocument = require('pdfkit');
  const items = typeof order.items_json === 'string'
    ? JSON.parse(order.items_json || '[]')
    : (order.items || []);

  // A4 dimensions in points (1pt = 1/72 inch): 595.28 x 841.89
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    info: {
      Title: 'Receipt #' + String(order.id).padStart(4, '0') + ' - Pinnacles Resource Centre Farm',
      Author: 'Pinnacles Resource Centre Farm',
    },
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="Receipt-' + String(order.id).padStart(4, '0') + '.pdf"');
  doc.pipe(res);

  const W  = 595.28;  // A4 width pts
  const LM = 60;      // left margin
  const RM = W - 60;  // right margin
  const CW = RM - LM; // content width

  // ── HEADER BACKGROUND ──────────────────────────────────────
  doc.rect(0, 0, W, 168).fill('#1b4332');

  // ── LOGO (3 triangles, centred at x=W/2, y≈55) ────────────
  const cx = W / 2;
  const cy = 50;
  const s  = 0.22; // scale factor (original viewBox 220x160)

  // Back left yellow triangle  (45,145 95,55 145,145)
  doc.polygon(
    [cx + (45-110)*s,  cy + (145-80)*s],
    [cx + (95-110)*s,  cy + (55-80)*s],
    [cx + (145-110)*s, cy + (145-80)*s]
  ).fillOpacity(0.92).fill('#F5C518');

  // Back right light-green triangle  (85,145 140,60 195,145)
  doc.polygon(
    [cx + (85-110)*s,  cy + (145-80)*s],
    [cx + (140-110)*s, cy + (60-80)*s],
    [cx + (195-110)*s, cy + (145-80)*s]
  ).fillOpacity(0.92).fill('#8CC63F');

  // Front dark-green triangle  (30,145 110,18 190,145)
  doc.polygon(
    [cx + (30-110)*s,  cy + (145-80)*s],
    [cx + (110-110)*s, cy + (18-80)*s],
    [cx + (190-110)*s, cy + (145-80)*s]
  ).fillOpacity(1).fill('#1E6B3A');

  // ── FARM NAME ──────────────────────────────────────────────
  doc.fillOpacity(1)
     .font('Helvetica-Bold').fontSize(14).fillColor('#ffffff')
     .text('PINNACLES RESOURCE CENTRE FARM', 0, 105, { align: 'center', width: W });

  doc.font('Helvetica').fontSize(8).fillColor('rgba(255,255,255,0.7)')
     .text('Fresh  ·  Organic  ·  Farm to Table', 0, 123, { align: 'center', width: W });

  // ── RECEIPT TITLE BAR ──────────────────────────────────────
  doc.rect(0, 140, W, 28).fill('#163d29');
  doc.font('Helvetica-Bold').fontSize(13).fillColor('#52b788')
     .text('OFFICIAL RECEIPT', 0, 148, { align: 'center', width: W });

  // ── RECEIPT META ROW ───────────────────────────────────────
  const metaY = 185;
  doc.font('Helvetica').fontSize(8.5).fillColor('#6b7280')
     .text('RECEIPT NO.', LM, metaY)
     .text('DATE', 0, metaY, { align: 'center', width: W })
     .text('STATUS', RM - 80, metaY, { width: 80, align: 'right' });

  doc.font('Helvetica-Bold').fontSize(10).fillColor('#1a1a2e')
     .text('#' + String(order.id).padStart(4, '0'), LM, metaY + 13)
     .text(formatDate(order.created_at), 0, metaY + 13, { align: 'center', width: W });

  const statusLabel2 = { pending: 'Pending', confirmed: 'Confirmed', processing: 'Processing', delivered: 'Delivered', cancelled: 'Cancelled', pending_payment: 'Awaiting Payment' };
  doc.text(statusLabel2[order.status] || order.status, RM - 80, metaY + 13, { width: 80, align: 'right' });

  // Divider
  doc.moveTo(LM, metaY + 32).lineTo(RM, metaY + 32).strokeColor('#e8f5e9').lineWidth(1).stroke();

  // ── CUSTOMER INFO ──────────────────────────────────────────
  const custY = metaY + 45;
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#52b788')
     .text('BILLED TO', LM, custY);

  doc.font('Helvetica-Bold').fontSize(11).fillColor('#1a1a2e')
     .text(order.customer_name || 'Customer', LM, custY + 13);

  doc.font('Helvetica').fontSize(9).fillColor('#6b7280')
     .text('Phone: ' + (order.customer_phone || '—'), LM, custY + 27);
  if (order.customer_email) {
    doc.text('Email:  ' + order.customer_email, LM, custY + 39);
  }
  if (order.notes) {
    doc.text('Notes:  ' + order.notes, LM, custY + (order.customer_email ? 51 : 39));
  }

  // Divider
  const divY2 = custY + 70;
  doc.moveTo(LM, divY2).lineTo(RM, divY2).strokeColor('#e8f5e9').lineWidth(1).stroke();

  // ── ITEMS TABLE ────────────────────────────────────────────
  let tableY = divY2 + 16;

  // Table header
  doc.rect(LM, tableY, CW, 22).fill('#f0faf4');
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#4b5563');
  doc.text('ITEM', LM + 10, tableY + 7);
  doc.text('QTY', LM + CW * 0.62, tableY + 7, { width: CW * 0.13, align: 'center' });
  doc.text('UNIT PRICE', LM + CW * 0.75, tableY + 7, { width: CW * 0.12, align: 'right' });
  doc.text('AMOUNT', LM + CW * 0.87, tableY + 7, { width: CW * 0.13, align: 'right' });
  tableY += 22;

  // Rows
  doc.font('Helvetica').fontSize(9).fillColor('#1a1a2e');
  items.forEach((item, idx) => {
    const rowH = 24;
    if (idx % 2 === 1) doc.rect(LM, tableY, CW, rowH).fill('#fafdf9');
    doc.fillColor('#1a1a2e')
       .text((item.name || 'Item'), LM + 10, tableY + 7, { width: CW * 0.6 });
    doc.text(String(item.qty), LM + CW * 0.62, tableY + 7, { width: CW * 0.13, align: 'center' });
    doc.text('₦' + Number(item.price).toLocaleString('en-NG'), LM + CW * 0.75, tableY + 7, { width: CW * 0.12, align: 'right' });
    doc.font('Helvetica-Bold').fillColor('#1b4332')
       .text('₦' + Number(item.price * item.qty).toLocaleString('en-NG'), LM + CW * 0.87, tableY + 7, { width: CW * 0.13, align: 'right' });
    doc.font('Helvetica').fillColor('#1a1a2e');
    tableY += rowH;
  });

  // Total row
  doc.rect(LM, tableY, CW, 30).fill('#1b4332');
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#ffffff')
     .text('TOTAL', LM + 10, tableY + 9)
     .text('₦' + Number(order.total).toLocaleString('en-NG'), LM, tableY + 9, { width: CW - 10, align: 'right' });
  tableY += 30;

  // Payment method
  const payMethod2 = (order.whatsapp_msg || '').startsWith('payisland_ref:')
    ? 'Online Payment (PayIsland)' : 'WhatsApp Order';
  doc.font('Helvetica').fontSize(8.5).fillColor('#6b7280')
     .text('Payment Method: ' + payMethod2, LM, tableY + 12);

  // ── FOOTER ─────────────────────────────────────────────────
  const footerY = 760;
  doc.moveTo(LM, footerY).lineTo(RM, footerY).strokeColor('#52b788').lineWidth(1.5).stroke();

  doc.font('Helvetica-Bold').fontSize(10).fillColor('#1b4332')
     .text('Thank you for shopping with us!', 0, footerY + 10, { align: 'center', width: W });

  doc.font('Helvetica').fontSize(8).fillColor('#6b7280')
     .text('Pinnacles Resource Centre Farm', 0, footerY + 25, { align: 'center', width: W })
     .text('agribusiness@pinnaclescentre.com  |  +234 903 750 5632  |  +234 707 821 0834', 0, footerY + 38, { align: 'center', width: W });

  doc.font('Helvetica').fontSize(7).fillColor('#aaaaaa')
     .text('This is an official receipt. Please retain for your records.', 0, footerY + 54, { align: 'center', width: W });

  doc.end();
}

module.exports = { router, buildReceiptHtml, generateToken, verifyToken, streamReceiptPdf };

