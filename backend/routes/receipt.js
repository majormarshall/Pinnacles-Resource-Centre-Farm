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

  const _wmh = (order.whatsapp_msg || '');
  const payMethod = _wmh.startsWith('payisland_ref:')  ? '💳 Online Payment' :
                    _wmh.startsWith('walkin:pos')       ? '💳 POS Payment'    :
                    _wmh.startsWith('walkin:transfer')  ? '🏦 Bank Transfer'  :
                    _wmh.startsWith('walkin:')          ? '💵 Cash Payment'   :
                    '📲 WhatsApp Order';
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

// Farm logo — embedded as base64 so it works on Vercel (no filesystem read needed)
const LOGO_B64 = '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';

async function streamReceiptPdf(order, res, req) {
  const { PDFDocument, rgb, StandardFonts, PageSizes } = require('pdf-lib');

  const items = typeof order.items_json === 'string'
    ? JSON.parse(order.items_json || '[]')
    : (order.items || []);

  const doc  = await PDFDocument.create();
  const PW   = PageSizes.A4[0];   // 595.28 pt
  const PH   = PageSizes.A4[1];   // 841.89 pt
  const page = doc.addPage([PW, PH]);

  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold    = await doc.embedFont(StandardFonts.HelveticaBold);

  // ── Logo loading (3-layer fallback) ─────────────────────────────────
  let logo = null;

  // Layer 1: fetch from own Vercel static URL (most reliable on serverless)
  if (!logo && req) {
    try {
      const proto  = (req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
      const host   = req.headers['x-forwarded-host'] || req.headers.host || '';
      if (host) {
        const logoUrl = proto + '://' + host + '/images/receipt-logo.jpg';
        console.log('[PDF] Fetching logo:', logoUrl);
        const resp = await fetch(logoUrl, { signal: AbortSignal.timeout(5000) });
        if (resp.ok) {
          const buf = Buffer.from(await resp.arrayBuffer());
          logo = await doc.embedJpg(buf);
          console.log('[PDF] Logo via fetch OK:', logo.width, 'x', logo.height);
        } else { console.warn('[PDF] Logo fetch status:', resp.status); }
      }
    } catch (e) { console.warn('[PDF] Logo fetch failed:', e.message); }
  }

  // Layer 2: require('./logoData') module (nft-bundled buffer)
  if (!logo) {
    try {
      const lb = require('./logoData');
      logo = await doc.embedJpg(lb);
      console.log('[PDF] Logo via module OK:', logo.width, 'x', logo.height);
    } catch (e) { console.warn('[PDF] Logo module failed:', e.message); }
  }

  // Layer 3: inline LOGO_B64 constant (always available, last resort)
  if (!logo) {
    try {
      logo = await doc.embedJpg(Buffer.from(LOGO_B64, 'base64'));
      console.log('[PDF] Logo via LOGO_B64 OK:', logo.width, 'x', logo.height);
    } catch (e) { console.error('[PDF] All logo methods failed:', e.message); }
  }

  // ── Colours ───────────────────────────────────────────────
  const hex = (h) => rgb(
    parseInt(h.slice(1,3),16)/255,
    parseInt(h.slice(3,5),16)/255,
    parseInt(h.slice(5,7),16)/255
  );
  const C_GREEN  = hex('#1b6b3a');
  const C_ACCENT = hex('#52b788');
  const C_TBLHDR = hex('#1b4332');
  const C_ROWALT = hex('#e8f5e9');
  const C_TXTDK  = hex('#111827');
  const C_TXTMD  = hex('#374151');
  const C_TXTMT  = hex('#6b7280');
  const C_GRYLN  = hex('#d1d5db');
  const WHITE    = rgb(1, 1, 1);

  // ── Layout ────────────────────────────────────────────────
  const ML = 52;
  const MR = PW - 52;
  const CW = MR - ML;  // 491.28

  // Y helper: pdfkit top-left  →  pdf-lib bottom-left
  const fl = (pkY) => PH - pkY;

  // Draw centred text (pkY = distance from top)
  const textC = (txt, pkY, size, fnt, color) => {
    const w = fnt.widthOfTextAtSize(txt, size);
    page.drawText(txt, { x: (PW - w) / 2, y: fl(pkY) - size, size, font: fnt, color });
  };

  // Horizontal rule
  const hline = (pkY, x1 = ML, x2 = MR, color = C_GRYLN, thick = 0.6) =>
    page.drawLine({ start:{x:x1, y:fl(pkY)}, end:{x:x2, y:fl(pkY)}, thickness: thick, color });

  // ══════════════════════════════════════════════════════════
  // PAGE: white background + thin green outer border
  // ══════════════════════════════════════════════════════════
  page.drawRectangle({ x:0, y:0, width:PW, height:PH, color:WHITE });
  page.drawRectangle({ x:16, y:16, width:PW-32, height:PH-32,
    borderColor: C_ACCENT, borderWidth: 0.8 });

  // ══════════════════════════════════════════════════════════
  // HEADER — fixed zone pkY 28-210
  // ══════════════════════════════════════════════════════════

  // 1. Logo — centred, 84pt height, pkY slot 28-112
  if (logo) {
    const LOGO_H = 84;
    const LOGO_W = LOGO_H * (logo.width / logo.height);
    page.drawImage(logo, {
      x: (PW - LOGO_W) / 2,
      y: fl(28 + LOGO_H),   // bottom of image in pdf-lib coords
      width:  LOGO_W,
      height: LOGO_H,
    });
  }

  // 2. Farm name — pkY 122
  textC('PINNACLES RESOURCE CENTRE FARM', 122, 15, bold, C_GREEN);

  // 3. Tagline — pkY 140
  textC('Fresh  \u00B7  Organic  \u00B7  Farm to Table', 140, 9, regular, C_ACCENT);

  // 4. Green double rule — pkY 153 & 157
  hline(153, ML, MR, C_GREEN, 2.0);
  hline(157, ML, MR, C_GREEN, 0.5);

  // 5. OFFICIAL RECEIPT — pkY 172
  textC('OFFICIAL RECEIPT', 172, 13, bold, C_TXTDK);

  // 6. Date Printed — pkY 190
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  textC(
    'Date Printed: ' +
    now.getFullYear() + '-' + pad(now.getMonth()+1) + '-' + pad(now.getDate()) +
    '  ' + pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds()),
    190, 9, bold, C_TXTMD
  );

  // 7. Thin rule — pkY 206
  hline(206, ML, MR, C_GRYLN, 0.6);

  // ══════════════════════════════════════════════════════════
  // TWO-COLUMN INFO: BILLED TO  |  RECEIPT DETAILS — pkY 218
  // ══════════════════════════════════════════════════════════
  const INFO_TOP = 218;
  const COL2_X   = ML + CW * 0.52;

  // Left: BILLED TO
  page.drawText('BILLED TO', { x:ML, y:fl(INFO_TOP)-8, size:8, font:bold, color:C_ACCENT });
  page.drawText(order.customer_name || 'Customer',
    { x:ML, y:fl(INFO_TOP+14)-11, size:11, font:bold, color:C_TXTDK });
  page.drawText(order.customer_phone || '\u2014',
    { x:ML, y:fl(INFO_TOP+28)-9, size:9, font:regular, color:C_TXTMD });
  if (order.customer_email) {
    page.drawText(order.customer_email,
      { x:ML, y:fl(INFO_TOP+41)-8.5, size:8.5, font:regular, color:C_TXTMD });
  }

  // Vertical divider
  page.drawLine({
    start: { x:COL2_X-8, y:fl(INFO_TOP-4)  },
    end:   { x:COL2_X-8, y:fl(INFO_TOP+62) },
    thickness: 0.5, color: C_GRYLN,
  });

  // Right: RECEIPT DETAILS
  page.drawText('RECEIPT DETAILS', { x:COL2_X, y:fl(INFO_TOP)-8, size:8, font:bold, color:C_ACCENT });

  const statusMap = {
    pending:'Pending', confirmed:'Confirmed', processing:'Processing',
    delivered:'Delivered', cancelled:'Cancelled', pending_payment:'Awaiting Payment',
  };
  const _wm = (order.whatsapp_msg || '');
  const payMethod = _wm.startsWith('payisland_ref:')  ? 'Online Payment' :
                    _wm.startsWith('walkin:pos')       ? 'POS Payment'    :
                    _wm.startsWith('walkin:transfer')  ? 'Bank Transfer'  :
                    _wm.startsWith('walkin:')          ? 'Cash Payment'   :
                    'WhatsApp Order';

  const details = [
    ['Receipt No:', '#' + String(order.id).padStart(4, '0')],
    ['Date:',       formatDate(order.created_at)],
    ['Status:',     statusMap[order.status] || order.status],
    ['Payment:',    payMethod],
  ];
  details.forEach(([lbl, val], i) => {
    const ry = INFO_TOP + 14 + i * 14;
    page.drawText(lbl, { x:COL2_X,    y:fl(ry)-9, size:9, font:bold,    color:C_TXTMD });
    page.drawText(val, { x:COL2_X+68, y:fl(ry)-9, size:9, font:regular, color:C_TXTDK });
  });

  if (order.notes) {
    page.drawText('Notes: ' + order.notes.slice(0, 50),
      { x:ML, y:fl(INFO_TOP+75)-8, size:8, font:regular, color:C_TXTMT });
  }

  const TABLE_TOP = INFO_TOP + (order.notes ? 92 : 78);
  hline(TABLE_TOP - 4, ML, MR, C_GRYLN, 0.5);

  // ══════════════════════════════════════════════════════════
  // ITEMS TABLE
  // Column layout (% of CW from ML):
  //   ITEM:       0  – 52%   left-aligned
  //   QTY:       55% – 64%   centred
  //   UNIT PRICE: 65% – 82%  right-aligned
  //   AMOUNT:    83% – 100%  right-aligned
  // ══════════════════════════════════════════════════════════
  const TH_H  = 28;
  const ROW_H = 24;

  const COL_ITEM_X   = ML + 6;
  const COL_QTY_MID  = ML + CW * 0.595;   // centre of QTY zone
  const COL_UNIT_END = ML + CW * 0.815;   // right edge of UNIT PRICE
  const COL_AMT_END  = MR - 4;            // right edge of AMOUNT

  // ── Table header row (dark green bar) ─────────────────────
  page.drawRectangle({ x:ML, y:fl(TABLE_TOP+TH_H), width:CW, height:TH_H, color:C_TBLHDR });

  const headers = [
    { txt:'ITEM',       x:COL_ITEM_X,   align:'left'   },
    { txt:'QTY',        x:COL_QTY_MID,  align:'center' },
    { txt:'UNIT PRICE', x:COL_UNIT_END, align:'right'  },
    { txt:'AMOUNT',     x:COL_AMT_END,  align:'right'  },
  ];
  const hdrY = fl(TABLE_TOP + TH_H - 9) - 9;
  // Thin separator under header
  hline(TABLE_TOP + TH_H + 0.5, ML, MR, hex('#0f5132'), 0.5);

  headers.forEach(({ txt, x, align }) => {
    const w = bold.widthOfTextAtSize(txt, 9);
    const dx = align === 'center' ? x - w/2 : align === 'right' ? x - w : x;
    page.drawText(txt, { x: dx, y: hdrY, size:9, font:bold, color:WHITE });
  });

  // ── Item rows ──────────────────────────────────────────────
  let tY = TABLE_TOP + TH_H;   // pdfkit top of current row

  items.forEach((item, idx) => {
    if (idx % 2 === 1)
      page.drawRectangle({ x:ML, y:fl(tY + ROW_H), width:CW, height:ROW_H, color:C_ROWALT });

    const name  = (item.name || 'Item').slice(0, 32);
    const qty   = String(item.qty);
    const unitP = 'NGN ' + Number(item.price).toLocaleString('en-NG');
    const amt   = 'NGN ' + Number(item.price * item.qty).toLocaleString('en-NG');
    const rowY  = fl(tY + ROW_H - 8) - 9;

    page.drawText(name, { x: COL_ITEM_X, y: rowY, size:9, font:regular, color:C_TXTDK });

    const qW = regular.widthOfTextAtSize(qty, 9);
    page.drawText(qty,   { x: COL_QTY_MID  - qW/2, y: rowY, size:9, font:regular, color:C_TXTDK });

    const uW = regular.widthOfTextAtSize(unitP, 9);
    page.drawText(unitP, { x: COL_UNIT_END - uW,   y: rowY, size:9, font:regular, color:C_TXTDK });

    const aW = bold.widthOfTextAtSize(amt, 9);
    page.drawText(amt,   { x: COL_AMT_END  - aW,   y: rowY, size:9, font:bold,    color:C_TXTDK });

    tY += ROW_H;
  });

  // ── Divider + TOTAL row ────────────────────────────────────
  hline(tY + 4, ML, MR, C_GRYLN, 0.5);
  tY += 8;

  page.drawRectangle({ x:ML, y:fl(tY + 28), width:CW, height:28, color:C_TBLHDR });

  page.drawText('TOTAL', { x: COL_ITEM_X, y: fl(tY + 28 - 8) - 11, size:11, font:bold, color:WHITE });

  const totalStr = 'NGN ' + Number(order.total).toLocaleString('en-NG');
  const totW     = bold.widthOfTextAtSize(totalStr, 12);
  page.drawText(totalStr, { x: COL_AMT_END - totW, y: fl(tY + 28 - 8) - 12, size:12, font:bold, color:hex('#a3d9b8') });

  // ══════════════════════════════════════════════════════════
  // FOOTER — anchored to bottom of page (pkY 756-820)
  // ══════════════════════════════════════════════════════════
  hline(756, ML, MR, C_GREEN, 2.0);
  hline(760, ML, MR, C_GREEN, 0.5);

  textC('Thank you for your business!',                                                   774, 10,  bold,    C_GREEN);
  textC('Pinnacles Resource Centre Farm',                                                 788, 8,   regular, C_TXTMT);
  textC('agribusiness@pinnaclescentre.com  \u2022  +234 903 750 5632  \u2022  +234 707 821 0834', 800, 7.5, regular, C_TXTMT);
  textC('This is an official receipt. Please retain for your records.',                   812, 7,   regular, hex('#9ca3af'));

  hline(820, ML, MR, C_GREEN, 1.5);

  // ── Stream PDF ────────────────────────────────────────────
  const pdfBytes = await doc.save();
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition',
    'attachment; filename="Receipt-' + String(order.id).padStart(4,'0') + '.pdf"');
  res.setHeader('Content-Length', pdfBytes.length);
  res.end(Buffer.from(pdfBytes));
}

module.exports = { router, buildReceiptHtml, generateToken, verifyToken, streamReceiptPdf };

