// ── Orders Routes ────────────────────────────────────────────
const router      = require('express').Router();
const db          = require('../db');
const requireAuth = require('../middleware/auth');
const nodemailer  = require('nodemailer');

// ── Email helper ──────────────────────────────────────────────
function sendAdminOrderEmail({ orderId, customer_name, customer_phone, items, total, notes }) {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const adminEmail = process.env.FARM_EMAIL;
  if (!smtpUser || !smtpPass || smtpPass === 'your_gmail_app_password_here') return; // SMTP not configured

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: true,
    auth: { user: smtpUser, pass: smtpPass },
  });

  const itemLines = items.map(i =>
    `<tr><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${i.emoji || '🌿'} ${i.name}</td><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center;">${i.qty}</td><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700;color:#2d6a4f;">₦${(i.price * i.qty).toLocaleString()}</td></tr>`
  ).join('');

  const html = `
  <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#f0faf4;padding:24px;">
    <div style="background:linear-gradient(135deg,#1b4332,#2d6a4f);border-radius:16px 16px 0 0;padding:28px 32px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:1.5rem;">🛒 New Order Received!</h1>
      <p style="color:rgba(255,255,255,.8);margin:6px 0 0;">Pinnacles Resource Centre Farm</p>
    </div>
    <div style="background:#fff;border-radius:0 0 16px 16px;padding:32px;">
      <p style="color:#374151;font-size:1rem;margin-bottom:24px;">A new customer order has been placed and is waiting for your confirmation.</p>

      <h3 style="color:#1b4332;margin:0 0 12px;font-size:1rem;">📋 Order #${orderId}</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <thead>
          <tr style="background:#f0faf4;">
            <th style="padding:10px 12px;text-align:left;font-size:.85rem;color:#4b5563;">Item</th>
            <th style="padding:10px 12px;text-align:center;font-size:.85rem;color:#4b5563;">Qty</th>
            <th style="padding:10px 12px;text-align:right;font-size:.85rem;color:#4b5563;">Amount</th>
          </tr>
        </thead>
        <tbody>${itemLines}</tbody>
        <tfoot>
          <tr style="background:#f0faf4;">
            <td colspan="2" style="padding:12px;font-weight:700;color:#1b4332;">TOTAL</td>
            <td style="padding:12px;font-weight:800;color:#2d6a4f;text-align:right;font-size:1.1rem;">₦${total.toLocaleString()}</td>
          </tr>
        </tfoot>
      </table>

      <h3 style="color:#1b4332;margin:0 0 12px;font-size:1rem;">👤 Customer Details</h3>
      <table style="width:100%;margin-bottom:24px;">
        <tr><td style="padding:6px 0;color:#6b7280;width:120px;">Name</td><td style="font-weight:600;color:#111;">${customer_name || 'Not provided'}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;">Phone</td><td style="font-weight:600;color:#111;">${customer_phone || 'Not provided'}</td></tr>
        ${notes ? `<tr><td style="padding:6px 0;color:#6b7280;">Notes</td><td style="font-weight:600;color:#111;">${notes}</td></tr>` : ''}
      </table>

      ${customer_phone ? `
      <a href="https://wa.me/${customer_phone.replace(/\D/g,'')}?text=${encodeURIComponent('Hello ' + customer_name + '! This is Pinnacles Resource Centre Farm. We have received your order and will confirm shortly. Thank you! 🌿')}"
         style="display:inline-block;background:#25D366;color:#fff;padding:14px 28px;border-radius:50px;font-weight:700;text-decoration:none;margin-bottom:16px;">
        💬 Reply on WhatsApp
      </a>` : ''}

      <p style="font-size:.8rem;color:#9ca3af;margin-top:24px;border-top:1px solid #e2e8f0;padding-top:16px;">
        This is an automated notification from Pinnacles Resource Centre Farm. Log in to your admin dashboard to manage this order.
      </p>
    </div>
  </div>`;

  transporter.sendMail({
    from: `"Pinnacles Farm Orders" <${smtpUser}>`,
    to: adminEmail,
    subject: `🛒 New Order #${orderId} — ₦${total.toLocaleString()} from ${customer_name || 'Customer'}`,
    html,
  }).catch(err => console.error('Email notification failed:', err.message));
}

// ── POST /api/orders — place a new order ──────────────────────
router.post('/', async (req, res) => {
  try {
    const { customer_name, customer_phone, items, total, notes, whatsapp_msg } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'Order must contain items.' });
    if (!total || total <= 0) return res.status(400).json({ error: 'Invalid order total.' });
    const r = await db.runAsync(
      'INSERT INTO orders (customer_name, customer_phone, items_json, total, notes, whatsapp_msg) VALUES (?,?,?,?,?,?)',
      [customer_name||'Walk-in Customer', customer_phone||'', JSON.stringify(items), total, notes||'', whatsapp_msg||'']
    );
    // Fire-and-forget admin email notification
    sendAdminOrderEmail({ orderId: r.lastID, customer_name, customer_phone, items, total, notes });
    res.status(201).json({ id: r.lastID, message: 'Order received! We will confirm via WhatsApp shortly.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/', requireAuth, async (req, res) => {
  try {
    const { status } = req.query;
    const orders = await db.allAsync(
      status ? 'SELECT * FROM orders WHERE status=? ORDER BY created_at DESC LIMIT 100' : 'SELECT * FROM orders ORDER BY created_at DESC LIMIT 100',
      status ? [status] : []
    );
    const stats = await db.getAsync(`SELECT COUNT(*) as total,
      SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status='confirmed' THEN 1 ELSE 0 END) as confirmed,
      SUM(CASE WHEN status='delivered' THEN 1 ELSE 0 END) as delivered,
      SUM(total) as revenue FROM orders`);
    res.json({ orders: orders.map(o => ({ ...o, items: JSON.parse(o.items_json) })), stats });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/:id/status', requireAuth, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending','confirmed','processing','delivered','cancelled'].includes(status))
      return res.status(400).json({ error: 'Invalid status.' });
    await db.runAsync('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ message: `Order marked as ${status}.` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    await db.runAsync('DELETE FROM orders WHERE id = ?', [req.params.id]);
    res.json({ message: 'Order deleted.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
