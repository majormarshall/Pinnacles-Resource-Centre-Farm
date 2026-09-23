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
  const PW   = PageSizes.A4[0];  // 595.28 pt
  const PH   = PageSizes.A4[1];  // 841.89 pt
  const page = doc.addPage([PW, PH]);

  // Standard fonts (no filesystem font reads — works on Vercel)
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold    = await doc.embedFont(StandardFonts.HelveticaBold);

  // Embed logo (JPG). Graceful fallback if file missing.
  let logo = null;
  try {
    const logoPath  = nodePath.join(__dirname, '..', '..', 'images', 'receipt-logo.jpg');
    const logoBytes = nodeFs.readFileSync(logoPath);
    logo = await doc.embedJpg(logoBytes);
  } catch (_) { /* logo missing — continue */ }

  // ── Colour helpers ────────────────────────────────────────
  const hex = (h) => rgb(
    parseInt(h.slice(1,3),16)/255,
    parseInt(h.slice(3,5),16)/255,
    parseInt(h.slice(5,7),16)/255
  );
  const GREEN_DARK   = hex('#1b4332');
  const GREEN_MID    = hex('#2d6a4f');
  const GREEN_ACCENT = hex('#52b788');
  const GREEN_LIGHT  = hex('#e8f5e9');
  const GREY_LIGHT   = hex('#f5f5f5');
  const GREY_LINE    = hex('#d1d5db');
  const TXT_DARK     = hex('#111827');
  const TXT_MID      = hex('#374151');
  const TXT_MUTED    = hex('#6b7280');
  const WHITE        = rgb(1,1,1);

  // ── Coordinate helper: pdfkit-style (top-left) → pdf-lib (bottom-left) ──
  const ML = 55;           // left margin
  const MR = PW - 55;     // right margin
  const CW = MR - ML;     // content width
  const fl = (pkY, h=0) => PH - pkY - h;  // flip y

  // ── Helper: right-aligned text ───────────────────────────
  const textR = (txt, rightEdge, pkY, size, fnt, color) => {
    const w = fnt.widthOfTextAtSize(txt, size);
    page.drawText(txt, { x: rightEdge - w, y: fl(pkY, size), size, font: fnt, color });
  };

  // ── Helper: centered text in a band ──────────────────────
  const textC = (txt, bandX, bandW, pkY, size, fnt, color) => {
    const w = fnt.widthOfTextAtSize(txt, size);
    page.drawText(txt, { x: bandX + (bandW - w)/2, y: fl(pkY, size), size, font: fnt, color });
  };

  // ── Helper: horizontal line ───────────────────────────────
  const hline = (pkY, x1=ML, x2=MR, color=GREY_LINE, thickness=0.6) => {
    page.drawLine({ start:{x:x1, y:fl(pkY)}, end:{x:x2, y:fl(pkY)}, thickness, color });
  };

  // ══════════════════════════════════════════════════════════
  // 1. WHITE PAGE BACKGROUND + OUTER BORDER
  // ══════════════════════════════════════════════════════════
  page.drawRectangle({ x:0, y:0, width:PW, height:PH, color:WHITE });
  page.drawRectangle({ x:20, y:20, width:PW-40, height:PH-40,
    borderColor: GREEN_ACCENT, borderWidth: 1 });

  // ══════════════════════════════════════════════════════════
  // 2. HEADER: LOGO  +  FARM NAME
  // ══════════════════════════════════════════════════════════
  const HDR_TOP  = 32;   // pdfkit y of header top
  const HDR_BOT  = 115;  // pdfkit y of header bottom (thin line here)
  const LOGO_H   = 62;   // logo rendered height (pt)
  const LOGO_W   = logo ? LOGO_H * (logo.width / logo.height) : 0;

  if (logo) {
    page.drawImage(logo, {
      x: ML,
      y: fl(HDR_TOP + (HDR_BOT - HDR_TOP - LOGO_H)/2, LOGO_H),
      width: LOGO_W,
      height: LOGO_H,
    });
  }

  // Farm name & contact — right side of header
  const nameX = logo ? ML + LOGO_W + 18 : ML;
  const nameY  = HDR_TOP + 12;
  page.drawText('PINNACLES RESOURCE CENTRE FARM', {
    x: nameX, y: fl(nameY, 14), size: 14, font: bold, color: GREEN_DARK,
  });
  page.drawText('Fresh  ·  Organic  ·  Farm to Table', {
    x: nameX, y: fl(nameY + 20, 9), size: 9, font: regular, color: TXT_MUTED,
  });
  page.drawText('agribusiness@pinnaclescentre.com  •  +234 903 750 5632', {
    x: nameX, y: fl(nameY + 34, 8), size: 8, font: regular, color: TXT_MUTED,
  });

  // Green accent line under header
  page.drawRectangle({ x:20, y:fl(HDR_BOT, 3), width:PW-40, height:3, color:GREEN_ACCENT });

  // ══════════════════════════════════════════════════════════
  // 3. TITLE BAR: OFFICIAL RECEIPT
  // ══════════════════════════════════════════════════════════
  const TITLE_Y = HDR_BOT + 3;
  page.drawRectangle({ x:20, y:fl(TITLE_Y, 30), width:PW-40, height:30, color:GREEN_DARK });
  textC('OFFICIAL RECEIPT', 20, PW-40, TITLE_Y + 8, 14, bold, WHITE);

  // ══════════════════════════════════════════════════════════
  // 4. RECEIPT META: # and DATE
  // ══════════════════════════════════════════════════════════
  const receiptNo = '#' + String(order.id).padStart(4, '0');
  const dateStr   = formatDate(order.created_at);
  const META_Y    = TITLE_Y + 30 + 14;

  page.drawText('Receipt No:  ' + receiptNo, {
    x: ML, y: fl(META_Y, 9), size: 9, font: regular, color: TXT_MID,
  });
  textR('Date:  ' + dateStr, MR, META_Y, 9, regular, TXT_MID);

  hline(META_Y + 14);

  // ══════════════════════════════════════════════════════════
  // 5. TWO-COLUMN INFO: BILLED TO  |  RECEIPT DETAILS
  // ══════════════════════════════════════════════════════════
  const INFO_Y = META_Y + 24;
  const COL2_X = ML + CW * 0.52;

  // Left col header
  page.drawText('BILLED TO', { x:ML, y:fl(INFO_Y,7.5), size:7.5, font:bold, color:GREEN_ACCENT });
  page.drawText(order.customer_name || 'Customer', {
    x:ML, y:fl(INFO_Y+14, 11), size:11, font:bold, color:TXT_DARK });
  page.drawText(order.customer_phone || '—', {
    x:ML, y:fl(INFO_Y+28, 9), size:9, font:regular, color:TXT_MID });
  if (order.customer_email) {
    page.drawText(order.customer_email, {
      x:ML, y:fl(INFO_Y+40, 8.5), size:8.5, font:regular, color:TXT_MID });
  }

  // Vertical separator
  page.drawLine({
    start:{x:COL2_X-10, y:fl(INFO_Y-4)},
    end:  {x:COL2_X-10, y:fl(INFO_Y + 56)},
    thickness:0.5, color:GREY_LINE,
  });

  // Right col header
  page.drawText('RECEIPT DETAILS', { x:COL2_X, y:fl(INFO_Y,7.5), size:7.5, font:bold, color:GREEN_ACCENT });

  const statusLabels = {
    pending:'Pending', confirmed:'Confirmed', processing:'Processing',
    delivered:'Delivered', cancelled:'Cancelled', pending_payment:'Awaiting Payment'
  };
  const statusStr = statusLabels[order.status] || order.status;
  const payMethod = (order.whatsapp_msg||'').startsWith('payisland_ref:')
    ? 'Online Payment' : 'WhatsApp Order';

  const detailRows = [
    ['Receipt No:', receiptNo],
    ['Date:',       dateStr],
    ['Status:',     statusStr],
    ['Payment:',    payMethod],
  ];
  detailRows.forEach(([label, val], i) => {
    page.drawText(label, { x:COL2_X, y:fl(INFO_Y+14+i*14, 9), size:9, font:bold, color:TXT_MID });
    page.drawText(val,   { x:COL2_X+60, y:fl(INFO_Y+14+i*14, 9), size:9, font:regular, color:TXT_DARK });
  });

  if (order.notes) {
    page.drawText('Notes:',    { x:COL2_X, y:fl(INFO_Y+70, 9), size:9, font:bold, color:TXT_MID });
    page.drawText(order.notes.slice(0,45), { x:COL2_X, y:fl(INFO_Y+82, 8), size:8, font:regular, color:TXT_MID });
  }

  const TABLE_START_Y = INFO_Y + (order.notes ? 100 : 80);
  hline(TABLE_START_Y - 6);

  // ══════════════════════════════════════════════════════════
  // 6. ITEMS TABLE
  // ══════════════════════════════════════════════════════════
  const COL = {
    item:  ML,
    qty:   ML + CW * 0.52,
    unit:  ML + CW * 0.68,
    amt:   ML + CW * 0.84,
  };

  // Table header row
  const TH_H = 24;
  page.drawRectangle({ x:ML, y:fl(TABLE_START_Y, TH_H), width:CW, height:TH_H, color:GREEN_DARK });
  page.drawText('ITEM',       { x:COL.item+6,  y:fl(TABLE_START_Y+7, 9), size:9, font:bold, color:WHITE });
  textC('QTY',  COL.qty,  CW*0.16, TABLE_START_Y+7, 9, bold, WHITE);
  textR('UNIT PRICE', COL.unit + CW*0.14, TABLE_START_Y+7, 9, bold, WHITE);
  textR('AMOUNT',     MR,              TABLE_START_Y+7, 9, bold, WHITE);

  let tY = TABLE_START_Y + TH_H;
  const ROW_H = 22;

  items.forEach((item, idx) => {
    const bg = idx % 2 === 1 ? GREEN_LIGHT : WHITE;
    page.drawRectangle({ x:ML, y:fl(tY, ROW_H), width:CW, height:ROW_H, color:bg });

    const name   = (item.name || 'Item').slice(0, 38);
    const qty    = String(item.qty);
    const unitP  = 'NGN ' + Number(item.price).toLocaleString('en-NG');
    const amount = 'NGN ' + Number(item.price * item.qty).toLocaleString('en-NG');

    page.drawText(name,  { x:COL.item+6, y:fl(tY+7, 9), size:9, font:regular, color:TXT_DARK });
    textC(qty, COL.qty, CW*0.16, tY+7, 9, regular, TXT_DARK);
    textR(unitP,  COL.unit + CW*0.14, tY+7, 9, regular, TXT_MID);
    textR(amount, MR, tY+7, 9, bold, TXT_DARK);

    tY += ROW_H;
  });

  // Subtotal divider
  hline(tY + 4, ML, MR, GREY_LINE, 0.5);
  tY += 12;

  // Total row
  page.drawRectangle({ x:ML, y:fl(tY, 28), width:CW, height:28, color:GREEN_DARK });
  page.drawText('TOTAL', { x:COL.item+6, y:fl(tY+8, 11), size:11, font:bold, color:WHITE });
  const totalStr = 'NGN ' + Number(order.total).toLocaleString('en-NG');
  textR(totalStr, MR-6, tY+8, 12, bold, hex('#a3d9b8'));
  tY += 28;

  // ══════════════════════════════════════════════════════════
  // 7. FOOTER
  // ══════════════════════════════════════════════════════════
  const FTR_LINE_Y = PH - 75;  // pdf-lib y (from bottom)

  page.drawRectangle({ x:20, y:FTR_LINE_Y, width:PW-40, height:2, color:GREEN_ACCENT });
  page.drawRectangle({ x:20, y:20,          width:PW-40, height:2, color:GREEN_ACCENT });

  const ty1 = 'Thank you for your business!';
  const ty1W = bold.widthOfTextAtSize(ty1, 11);
  page.drawText(ty1, { x:(PW-ty1W)/2, y:FTR_LINE_Y - 16, size:11, font:bold, color:GREEN_DARK });

  const ty2 = 'Pinnacles Resource Centre Farm  •  agribusiness@pinnaclescentre.com';
  const ty2W = regular.widthOfTextAtSize(ty2, 8);
  page.drawText(ty2, { x:Math.max(20,(PW-ty2W)/2), y:FTR_LINE_Y-30, size:8, font:regular, color:TXT_MUTED });

  const ty3 = '+234 903 750 5632  •  +234 707 821 0834';
  const ty3W = regular.widthOfTextAtSize(ty3, 8);
  page.drawText(ty3, { x:(PW-ty3W)/2, y:FTR_LINE_Y-42, size:8, font:regular, color:TXT_MUTED });

  const ty4 = 'This is an official receipt. Please retain for your records.';
  const ty4W = regular.widthOfTextAtSize(ty4, 7);
  page.drawText(ty4, { x:(PW-ty4W)/2, y:FTR_LINE_Y-56, size:7, font:regular, color:hex('#9ca3af') });

  // ── Stream PDF ────────────────────────────────────────────
  const pdfBytes = await doc.save();
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="Receipt-' + String(order.id).padStart(4,'0') + '.pdf"');
  res.setHeader('Content-Length', pdfBytes.length);
  res.end(Buffer.from(pdfBytes));
}

module.exports = { router, buildReceiptHtml, generateToken, verifyToken, streamReceiptPdf };

