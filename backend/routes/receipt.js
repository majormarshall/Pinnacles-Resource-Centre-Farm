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

  const items = typeof order.items_json === 'string'
    ? JSON.parse(order.items_json || '[]')
    : (order.items || []);

  const doc  = await PDFDocument.create();
  const PW   = PageSizes.A4[0];   // 595.28
  const PH   = PageSizes.A4[1];   // 841.89
  const page = doc.addPage([PW, PH]);

  // ── Embed standard fonts (built-in, no filesystem reads) ────
  const font     = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  // ── Colour helpers (rgb 0-1) ────────────────────────────────
  const hex = (h) => {
    const r = parseInt(h.slice(1,3),16)/255;
    const g = parseInt(h.slice(3,5),16)/255;
    const b = parseInt(h.slice(5,7),16)/255;
    return rgb(r, g, b);
  };

  const C_DARK   = hex('#1b4332');
  const C_DARKER = hex('#163d29');
  const C_MID    = hex('#2d6a4f');
  const C_ACCENT = hex('#52b788');
  const C_LIGHT  = hex('#f0faf4');
  const C_LIGHT2 = hex('#f7fbf8');
  const C_BORDER = hex('#d1e8d8');
  const C_TEXT   = hex('#1a1a2e');
  const C_MUTED  = hex('#6b7280');
  const C_WHITE  = rgb(1, 1, 1);
  const C_LOGO_Y = hex('#F5C518');
  const C_LOGO_G = hex('#8CC63F');
  const C_LOGO_D = hex('#1E6B3A');

  // ── pdf-lib: y=0 is BOTTOM. Helper to flip pdfkit-style y ──
  // pk(y, h) converts a pdfkit top-left y + block height to pdf-lib y (bottom of block)
  const pk = (y, h = 0) => PH - y - h;

  const ML = 50;          // left margin
  const MR = PW - 50;     // right edge
  const CW = MR - ML;     // content width

  // ══════════════════════════════════════════════════════════
  // 1. WHITE BACKGROUND
  // ══════════════════════════════════════════════════════════
  page.drawRectangle({ x: 0, y: 0, width: PW, height: PH, color: C_WHITE });

  // Outer green border frame
  page.drawRectangle({
    x: 18, y: 18, width: PW - 36, height: PH - 36,
    borderColor: C_BORDER, borderWidth: 1.2,
  });

  // ══════════════════════════════════════════════════════════
  // 2. DARK GREEN HEADER
  // ══════════════════════════════════════════════════════════
  const HDR_H = 175;
  page.drawRectangle({ x: 18, y: pk(18, HDR_H), width: PW-36, height: HDR_H, color: C_DARK });
  // Darker accent strip (bottom 28pt of header)
  page.drawRectangle({ x: 18, y: pk(18+HDR_H-28, 28), width: PW-36, height: 28, color: C_DARKER });

  // ── Farm logo: 3 triangles ───────────────────────────────
  const cx = PW / 2;
  const cy_pk = 56;   // pdfkit centre y (positions logo top at ~y=28)
  const S  = 0.45;  // scale: logo ~72pt wide, ~57pt tall

  const tri = (pts, color) => page.drawSvgPath(
    'M ' + pts.map(([x,y]) => {
      const fx = cx + (x - 110)*S;
      const fy = pk(cy_pk + (y - 80)*S - 0); // pdf-lib y
      return fx.toFixed(2) + ' ' + fy.toFixed(2);
    }).join(' L ') + ' Z',
    { color, opacity: 0.93 }
  );

  // Yellow back-left
  tri([[45,145],[95,55],[145,145]], C_LOGO_Y);
  // Light-green back-right
  tri([[85,145],[140,60],[195,145]], C_LOGO_G);
  // Dark-green front
  page.drawSvgPath(
    'M ' + [[30,145],[110,18],[190,145]].map(([x,y]) => {
      return (cx+(x-110)*S).toFixed(2) + ' ' + (pk(cy_pk+(y-80)*S)).toFixed(2);
    }).join(' L ') + ' Z',
    { color: C_LOGO_D, opacity: 1 }
  );

  // Farm name
  const farmName = 'Pinnacles Resource Centre Farm';
  const farmNameW = fontBold.widthOfTextAtSize(farmName, 15);
  page.drawText(farmName, {
    x: (PW - farmNameW) / 2, y: pk(105, 15),
    size: 15, font: fontBold, color: C_WHITE,
  });

  const tagline = 'FRESH  ·  ORGANIC  ·  FARM TO TABLE';
  const tagW = font.widthOfTextAtSize(tagline, 8);
  page.drawText(tagline, {
    x: (PW - tagW) / 2, y: pk(123, 8),
    size: 8, font, color: rgb(1,1,1),
    opacity: 0.65,
  });

  // OFFICIAL RECEIPT in accent strip
  const titleStr = 'OFFICIAL RECEIPT';
  const titleW = fontBold.widthOfTextAtSize(titleStr, 14);
  page.drawText(titleStr, {
    x: (PW - titleW) / 2, y: pk(18 + HDR_H - 22, 14),
    size: 14, font: fontBold, color: C_ACCENT,
  });

  // ══════════════════════════════════════════════════════════
  // 3. META ROW
  // ══════════════════════════════════════════════════════════
  const receiptNo = String(order.id).padStart(4, '0');
  const dateStr   = formatDate(order.created_at);
  const META_Y    = 18 + HDR_H + 14;

  page.drawRectangle({ x: ML, y: pk(META_Y, 26), width: CW, height: 26, color: C_LIGHT });

  const metaTxt = 'Receipt #' + receiptNo + '   |   ' + dateStr;
  const metaW = font.widthOfTextAtSize(metaTxt, 9);
  page.drawText(metaTxt, {
    x: ML + (CW - metaW) / 2, y: pk(META_Y + 8, 9),
    size: 9, font, color: C_MUTED,
  });

  // ══════════════════════════════════════════════════════════
  // 4. BILLED TO / ORDER DETAILS
  // ══════════════════════════════════════════════════════════
  const INFO_Y = META_Y + 38;
  const COL_W  = CW / 2 - 10;

  // Left column
  page.drawText('BILLED TO', { x: ML, y: pk(INFO_Y, 7.5), size: 7.5, font: fontBold, color: C_ACCENT });
  page.drawText(order.customer_name || 'Customer', { x: ML, y: pk(INFO_Y+13, 11), size: 11, font: fontBold, color: C_TEXT });
  page.drawText((order.customer_phone || '—'), { x: ML, y: pk(INFO_Y+28, 9), size: 9, font, color: C_MUTED });
  if (order.customer_email) {
    page.drawText(order.customer_email, { x: ML, y: pk(INFO_Y+40, 9), size: 9, font, color: C_MUTED });
  }

  // Right column
  const RC = ML + CW / 2 + 10;
  page.drawText('ORDER DETAILS', { x: RC, y: pk(INFO_Y, 7.5), size: 7.5, font: fontBold, color: C_ACCENT });
  page.drawText('Order #' + order.id, { x: RC, y: pk(INFO_Y+13, 11), size: 11, font: fontBold, color: C_TEXT });
  page.drawText('Date: ' + dateStr, { x: RC, y: pk(INFO_Y+28, 9), size: 9, font, color: C_MUTED });
  if (order.notes) {
    page.drawText('Notes: ' + order.notes.slice(0, 40), { x: RC, y: pk(INFO_Y+40, 9), size: 9, font, color: C_MUTED });
  }

  // Divider
  const DIV1_Y = INFO_Y + (order.customer_email || order.notes ? 60 : 50);
  page.drawLine({ start: { x: ML, y: pk(DIV1_Y) }, end: { x: MR, y: pk(DIV1_Y) }, thickness: 0.8, color: C_BORDER });

  // ══════════════════════════════════════════════════════════
  // 5. ITEMS TABLE
  // ══════════════════════════════════════════════════════════
  let tY = DIV1_Y + 14;

  page.drawText('ITEMS PURCHASED', { x: ML, y: pk(tY, 7.5), size: 7.5, font: fontBold, color: C_ACCENT });
  tY += 14;

  // Table header
  page.drawRectangle({ x: ML, y: pk(tY, 22), width: CW, height: 22, color: C_LIGHT });
  const hdrCols = [
    ['Item',       ML + 8,           9.5, 'left'],
    ['Qty',        ML + CW*0.61,     8.5, 'center'],
    ['Unit Price', ML + CW*0.73,     8.5, 'right'],
    ['Amount',     ML + CW*0.87,     8.5, 'right'],
  ];
  hdrCols.forEach(([t, x, sz]) => {
    page.drawText(t, { x, y: pk(tY + 8, sz), size: sz, font: fontBold, color: C_MUTED });
  });
  tY += 22;

  // Item rows
  const ROW_H = 24;
  items.forEach((item, idx) => {
    if (idx % 2 === 1) {
      page.drawRectangle({ x: ML, y: pk(tY, ROW_H), width: CW, height: ROW_H, color: C_LIGHT2 });
    }
    const name = (item.name || 'Item').slice(0, 35);
    const qty  = String(item.qty);
    const unitP = 'NGN ' + Number(item.price).toLocaleString('en-NG');
    const amt  = 'NGN ' + Number(item.price * item.qty).toLocaleString('en-NG');

    page.drawText(name, { x: ML + 8, y: pk(tY + 8, 9.5), size: 9.5, font, color: C_TEXT });

    const qtyW = font.widthOfTextAtSize(qty, 9);
    const qtyX = ML + CW*0.61 + (CW*0.11 - qtyW) / 2;
    page.drawText(qty, { x: qtyX, y: pk(tY + 8, 9), size: 9, font, color: C_TEXT });

    const unitW = font.widthOfTextAtSize(unitP, 8.5);
    page.drawText(unitP, { x: ML + CW*0.73 + CW*0.12 - unitW - 2, y: pk(tY + 8, 8.5), size: 8.5, font, color: C_MUTED });

    const amtW = fontBold.widthOfTextAtSize(amt, 9.5);
    page.drawText(amt, { x: MR - amtW - 2, y: pk(tY + 8, 9.5), size: 9.5, font: fontBold, color: C_DARK });

    tY += ROW_H;
  });

  // Total row
  page.drawLine({ start: { x: ML, y: pk(tY) }, end: { x: MR, y: pk(tY) }, thickness: 1.5, color: C_DARK });
  page.drawRectangle({ x: ML, y: pk(tY, 32), width: CW, height: 32, color: C_DARK });
  page.drawText('TOTAL', { x: ML + 12, y: pk(tY + 11, 12), size: 12, font: fontBold, color: C_WHITE });
  const totalStr = 'NGN ' + Number(order.total).toLocaleString('en-NG');
  const totalW = fontBold.widthOfTextAtSize(totalStr, 13);
  page.drawText(totalStr, { x: MR - totalW - 8, y: pk(tY + 10, 13), size: 13, font: fontBold, color: hex('#a3d9b8') });
  tY += 32;

  // ══════════════════════════════════════════════════════════
  // 6. STATUS & PAYMENT
  // ══════════════════════════════════════════════════════════
  tY += 14;
  const statusLabels = {
    pending: 'Pending', confirmed: 'Confirmed', processing: 'Processing',
    delivered: 'Delivered', cancelled: 'Cancelled', pending_payment: 'Awaiting Payment'
  };
  const statusStr = statusLabels[order.status] || order.status;
  const payMethod = (order.whatsapp_msg || '').startsWith('payisland_ref:')
    ? 'Online Payment (PayIsland)' : 'WhatsApp Order';

  page.drawRectangle({ x: ML, y: pk(tY, 22), width: 115, height: 22, color: C_LIGHT, borderColor: C_BORDER, borderWidth: 0.8 });
  const sLblW = fontBold.widthOfTextAtSize(statusStr, 9);
  page.drawText(statusStr, { x: ML + (115 - sLblW)/2, y: pk(tY + 6, 9), size: 9, font: fontBold, color: C_DARK });

  page.drawText('Payment: ' + payMethod, { x: ML + 125, y: pk(tY + 6, 9), size: 9, font, color: C_MUTED });

  // ══════════════════════════════════════════════════════════
  // 7. FOOTER
  // ══════════════════════════════════════════════════════════
  const FTR_Y = PH - 88;  // pdf-lib y (from bottom)

  page.drawRectangle({ x: 18, y: FTR_Y, width: PW-36, height: 2, color: C_ACCENT });

  const ty1 = 'Thank you for shopping with us!';
  const ty1W = fontBold.widthOfTextAtSize(ty1, 10.5);
  page.drawText(ty1, { x: (PW-ty1W)/2, y: FTR_Y - 18, size: 10.5, font: fontBold, color: C_DARK });

  const ty2 = 'Pinnacles Resource Centre Farm';
  const ty2W = font.widthOfTextAtSize(ty2, 8.5);
  page.drawText(ty2, { x: (PW-ty2W)/2, y: FTR_Y - 32, size: 8.5, font, color: C_MUTED });

  const ty3 = 'agribusiness@pinnaclescentre.com  •  +234 903 750 5632  •  +234 707 821 0834';
  const ty3W = font.widthOfTextAtSize(ty3, 7.5);
  page.drawText(ty3, { x: Math.max(18, (PW-ty3W)/2), y: FTR_Y - 44, size: 7.5, font, color: C_MUTED });

  const ty4 = 'This is an official receipt. Please retain for your records.';
  const ty4W = font.widthOfTextAtSize(ty4, 7);
  page.drawText(ty4, { x: (PW-ty4W)/2, y: FTR_Y - 58, size: 7, font, color: hex('#aaaaaa') });

  // Bottom accent bar
  page.drawRectangle({ x: 18, y: 20, width: PW-36, height: 2, color: C_ACCENT });

  // ── Stream PDF bytes to response ────────────────────────────
  const pdfBytes = await doc.save();
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="Receipt-' + String(order.id).padStart(4,'0') + '.pdf"');
  res.setHeader('Content-Length', pdfBytes.length);
  res.end(Buffer.from(pdfBytes));
}

module.exports = { router, buildReceiptHtml, generateToken, verifyToken, streamReceiptPdf };

