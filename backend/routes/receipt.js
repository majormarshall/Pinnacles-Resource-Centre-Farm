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
async function streamReceiptPdf(order, res) {
  const { PDFDocument, rgb, StandardFonts, PageSizes } = require('pdf-lib');
  const nodePath = require('path');
  const nodeFs   = require('fs');

  const items = typeof order.items_json === 'string'
    ? JSON.parse(order.items_json || '[]')
    : (order.items || []);

  const doc  = await PDFDocument.create();
  const PW   = PageSizes.A4[0];  // 595.28
  const PH   = PageSizes.A4[1];  // 841.89
  const page = doc.addPage([PW, PH]);

  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold    = await doc.embedFont(StandardFonts.HelveticaBold);

  // Embed logo JPG
  let logo = null;
  try {
    const logoBytes = nodeFs.readFileSync(nodePath.join(__dirname, '..', '..', 'images', 'receipt-logo.jpg'));
    logo = await doc.embedJpg(logoBytes);
  } catch (_) {}

  // ── Colours ───────────────────────────────────────────────
  const hex = (h) => rgb(parseInt(h.slice(1,3),16)/255, parseInt(h.slice(3,5),16)/255, parseInt(h.slice(5,7),16)/255);
  const GREEN_DARK   = hex('#1b6b3a');
  const GREEN_ACCENT = hex('#52b788');
  const GREEN_LIGHT  = hex('#e8f5e9');
  const TBL_HEADER   = hex('#1b4332');
  const TXT_DARK     = hex('#111827');
  const TXT_MID      = hex('#374151');
  const TXT_MUTED    = hex('#6b7280');
  const GREY_LINE    = hex('#d1d5db');
  const WHITE        = rgb(1,1,1);

  // ── Layout constants ─────────────────────────────────────
  const ML = 55;
  const MR = PW - 55;
  const CW = MR - ML;
  const fl = (pkY, h=0) => PH - pkY - h;

  // ── Helpers ───────────────────────────────────────────────
  const textC = (txt, pkY, size, fnt, color) => {
    const w = fnt.widthOfTextAtSize(txt, size);
    page.drawText(txt, { x:(PW-w)/2, y:fl(pkY, size), size, font:fnt, color });
  };
  const textR = (txt, rightX, pkY, size, fnt, color) => {
    const w = fnt.widthOfTextAtSize(txt, size);
    page.drawText(txt, { x:rightX-w, y:fl(pkY, size), size, font:fnt, color });
  };
  const hline = (pkY, x1=ML, x2=MR, color=GREY_LINE, thick=0.6) => {
    page.drawLine({ start:{x:x1,y:fl(pkY)}, end:{x:x2,y:fl(pkY)}, thickness:thick, color });
  };

  // ══════════════════════════════════════════════════════════
  // PAGE BACKGROUND + THIN OUTER BORDER
  // ══════════════════════════════════════════════════════════
  page.drawRectangle({ x:0, y:0, width:PW, height:PH, color:WHITE });
  page.drawRectangle({ x:16, y:16, width:PW-32, height:PH-32,
    borderColor: hex('#c8e6c9'), borderWidth: 1 });

  // ══════════════════════════════════════════════════════════
  // HEADER — school-receipt style
  // Logo centered at top, name centered below, title below
  // ══════════════════════════════════════════════════════════
  let curY = 32; // pdfkit y cursor from top

  // 1. Logo — centered
  if (logo) {
    const LOGO_H = 72;
    const LOGO_W = LOGO_H * (logo.width / logo.height);
    page.drawImage(logo, {
      x: (PW - LOGO_W) / 2,
      y: fl(curY, LOGO_H),
      width: LOGO_W,
      height: LOGO_H,
    });
    curY += LOGO_H + 10;
  } else {
    curY += 10;
  }

  // 2. Farm name — large, centered, green
  textC('PINNACLES RESOURCE CENTRE FARM', curY, 16, bold, GREEN_DARK);
  curY += 22;

  // 3. Tagline — smaller, centered, muted green
  textC('Fresh  ·  Organic  ·  Farm to Table', curY, 9, regular, GREEN_ACCENT);
  curY += 16;

  // Full-width green double rule (like the school receipt separator)
  page.drawLine({ start:{x:ML,y:fl(curY)}, end:{x:MR,y:fl(curY)}, thickness:2, color:GREEN_DARK });
  curY += 4;
  page.drawLine({ start:{x:ML,y:fl(curY)}, end:{x:MR,y:fl(curY)}, thickness:0.5, color:GREEN_DARK });
  curY += 12;

  // 4. "OFFICIAL RECEIPT" — bold, centered, black
  textC('OFFICIAL RECEIPT', curY, 13, bold, TXT_DARK);
  curY += 18;

  // 5. Date printed — bold, centered
  const now = new Date();
  const printedStr = 'Date Printed: ' +
    now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' +
    String(now.getDate()).padStart(2,'0') + '  ' +
    String(now.getHours()).padStart(2,'0') + ':' +
    String(now.getMinutes()).padStart(2,'0') + ':' +
    String(now.getSeconds()).padStart(2,'0');
  textC(printedStr, curY, 9, bold, TXT_MID);
  curY += 20;

  // Bottom rule of header section
  page.drawLine({ start:{x:ML,y:fl(curY)}, end:{x:MR,y:fl(curY)}, thickness:0.5, color:GREY_LINE });
  curY += 18;

  // ══════════════════════════════════════════════════════════
  // TWO-COLUMN INFO: BILLED TO  |  RECEIPT DETAILS
  // ══════════════════════════════════════════════════════════
  const INFO_Y  = curY;
  const COL2_X  = ML + CW * 0.52;

  // Section labels
  page.drawText('BILLED TO', { x:ML, y:fl(INFO_Y,8), size:8, font:bold, color:GREEN_ACCENT });
  page.drawText(order.customer_name || 'Customer', { x:ML, y:fl(INFO_Y+14,11), size:11, font:bold, color:TXT_DARK });
  page.drawText(order.customer_phone || '—', { x:ML, y:fl(INFO_Y+28,9), size:9, font:regular, color:TXT_MID });
  if (order.customer_email) {
    page.drawText(order.customer_email, { x:ML, y:fl(INFO_Y+40,8.5), size:8.5, font:regular, color:TXT_MID });
  }

  // Vertical divider
  page.drawLine({ start:{x:COL2_X-10,y:fl(INFO_Y-4)}, end:{x:COL2_X-10,y:fl(INFO_Y+56)}, thickness:0.5, color:GREY_LINE });

  // Right col
  page.drawText('RECEIPT DETAILS', { x:COL2_X, y:fl(INFO_Y,8), size:8, font:bold, color:GREEN_ACCENT });

  const statusLabels = {
    pending:'Pending', confirmed:'Confirmed', processing:'Processing',
    delivered:'Delivered', cancelled:'Cancelled', pending_payment:'Awaiting Payment'
  };
  const payMethod = (order.whatsapp_msg||'').startsWith('payisland_ref:')
    ? 'Online Payment' : 'WhatsApp Order';

  const details = [
    ['Receipt No:', '#' + String(order.id).padStart(4,'0')],
    ['Date:',       formatDate(order.created_at)],
    ['Status:',     statusLabels[order.status] || order.status],
    ['Payment:',    payMethod],
  ];
  details.forEach(([lbl, val], i) => {
    page.drawText(lbl, { x:COL2_X,    y:fl(INFO_Y+14+i*14,9), size:9, font:bold, color:TXT_MID });
    page.drawText(val, { x:COL2_X+65, y:fl(INFO_Y+14+i*14,9), size:9, font:regular, color:TXT_DARK });
  });

  if (order.notes) {
    page.drawText('Notes:', { x:COL2_X, y:fl(INFO_Y+70,9), size:9, font:bold, color:TXT_MID });
    page.drawText(order.notes.slice(0,45), { x:COL2_X, y:fl(INFO_Y+82,8), size:8, font:regular, color:TXT_MID });
  }

  curY = INFO_Y + (order.notes ? 100 : 75);
  hline(curY);
  curY += 14;

  // ══════════════════════════════════════════════════════════
  // ITEMS TABLE
  // ══════════════════════════════════════════════════════════
  const COL = { item:ML, qty:ML+CW*0.52, unit:ML+CW*0.68, amt:ML+CW*0.84 };
  const TH_H = 24;

  // Header
  page.drawRectangle({ x:ML, y:fl(curY,TH_H), width:CW, height:TH_H, color:TBL_HEADER });
  page.drawText('ITEM',       { x:COL.item+6, y:fl(curY+7,9), size:9, font:bold, color:WHITE });
  const qtyHdrW = bold.widthOfTextAtSize('QTY',9);
  page.drawText('QTY', { x:COL.qty+(CW*0.14-qtyHdrW)/2, y:fl(curY+7,9), size:9, font:bold, color:WHITE });
  const upHdrW = bold.widthOfTextAtSize('UNIT PRICE',9);
  page.drawText('UNIT PRICE', { x:COL.unit+CW*0.14-upHdrW, y:fl(curY+7,9), size:9, font:bold, color:WHITE });
  const amtHdrW = bold.widthOfTextAtSize('AMOUNT',9);
  page.drawText('AMOUNT', { x:MR-amtHdrW, y:fl(curY+7,9), size:9, font:bold, color:WHITE });
  curY += TH_H;

  // Rows
  const ROW_H = 22;
  items.forEach((item, idx) => {
    if (idx % 2 === 1) page.drawRectangle({ x:ML, y:fl(curY,ROW_H), width:CW, height:ROW_H, color:GREEN_LIGHT });
    const name  = (item.name||'Item').slice(0,38);
    const qty   = String(item.qty);
    const unitP = 'NGN ' + Number(item.price).toLocaleString('en-NG');
    const amt   = 'NGN ' + Number(item.price * item.qty).toLocaleString('en-NG');

    page.drawText(name, { x:COL.item+6, y:fl(curY+7,9), size:9, font:regular, color:TXT_DARK });

    const qW = regular.widthOfTextAtSize(qty,9);
    page.drawText(qty, { x:COL.qty+(CW*0.14-qW)/2, y:fl(curY+7,9), size:9, font:regular, color:TXT_DARK });

    const uW = regular.widthOfTextAtSize(unitP,9);
    page.drawText(unitP, { x:COL.unit+CW*0.14-uW, y:fl(curY+7,9), size:9, font:regular, color:TXT_MID });

    const aW = bold.widthOfTextAtSize(amt,9);
    page.drawText(amt, { x:MR-aW, y:fl(curY+7,9), size:9, font:bold, color:TXT_DARK });
    curY += ROW_H;
  });

  // Divider before total
  hline(curY+4, ML, MR, GREY_LINE, 0.5);
  curY += 10;

  // Total
  page.drawRectangle({ x:ML, y:fl(curY,28), width:CW, height:28, color:TBL_HEADER });
  page.drawText('TOTAL', { x:COL.item+6, y:fl(curY+8,11), size:11, font:bold, color:WHITE });
  const totalStr = 'NGN ' + Number(order.total).toLocaleString('en-NG');
  const totW = bold.widthOfTextAtSize(totalStr,12);
  page.drawText(totalStr, { x:MR-totW-4, y:fl(curY+8,12), size:12, font:bold, color:hex('#a3d9b8') });
  curY += 28;

  // ══════════════════════════════════════════════════════════
  // FOOTER
  // ══════════════════════════════════════════════════════════
  const FTR_Y = PH - 70;

  page.drawLine({ start:{x:ML,y:FTR_Y+2}, end:{x:MR,y:FTR_Y+2}, thickness:1.5, color:GREEN_DARK });
  page.drawLine({ start:{x:ML,y:FTR_Y-1}, end:{x:MR,y:FTR_Y-1}, thickness:0.4, color:GREEN_DARK });

  const ftrLines = [
    ['Thank you for your business!', 10, bold, GREEN_DARK],
    ['Pinnacles Resource Centre Farm', 8, regular, TXT_MUTED],
    ['agribusiness@pinnaclescentre.com  •  +234 903 750 5632  •  +234 707 821 0834', 7.5, regular, TXT_MUTED],
    ['This is an official receipt. Please retain for your records.', 7, regular, hex('#9ca3af')],
  ];
  let fy = FTR_Y - 14;
  ftrLines.forEach(([txt, size, fnt, color]) => {
    const w = fnt.widthOfTextAtSize(txt, size);
    page.drawText(txt, { x:Math.max(ML,(PW-w)/2), y:fy, size, font:fnt, color });
    fy -= size + 5;
  });

  // Bottom double rule
  page.drawLine({ start:{x:ML,y:32}, end:{x:MR,y:32}, thickness:1.5, color:GREEN_DARK });
  page.drawLine({ start:{x:ML,y:29}, end:{x:MR,y:29}, thickness:0.4, color:GREEN_DARK });

  // ── Finalise ──────────────────────────────────────────────
  const pdfBytes = await doc.save();
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="Receipt-' + String(order.id).padStart(4,'0') + '.pdf"');
  res.setHeader('Content-Length', pdfBytes.length);
  res.end(Buffer.from(pdfBytes));
}

module.exports = { router, buildReceiptHtml, generateToken, verifyToken, streamReceiptPdf };

