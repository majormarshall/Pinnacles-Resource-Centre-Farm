// ── PayIsland Payment Routes ──────────────────────────────────
const router   = require('express').Router();
const db       = require('../db');
const nodemailer = require('nodemailer');

const PAYISLAND_SECRET = process.env.PAYISLAND_SECRET_KEY;
const PAYISLAND_BASE   = process.env.PAYISLAND_BASE_URL || 'https://api.payislands.com/v1';

// ── Helper: send admin order email (reused from orders.js pattern) ──
function notifyAdmin({ orderId, customer_name, customer_phone, customer_email, items, total }) {
  const smtpUser   = process.env.SMTP_USER;
  const smtpPass   = process.env.SMTP_PASS;
  const adminEmail = process.env.FARM_EMAIL;
  if (!smtpUser || !smtpPass || smtpPass === 'your_gmail_app_password_here') return;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: true,
    auth: { user: smtpUser, pass: smtpPass },
  });

  transporter.sendMail({
    from: `"Pinnacles Farm Payments" <${smtpUser}>`,
    to: adminEmail,
    subject: `💳 Online Payment Confirmed — Order #${orderId} — ₦${total.toLocaleString()} from ${customer_name || 'Customer'}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#f0faf4;">
      <div style="background:linear-gradient(135deg,#1b4332,#2d6a4f);border-radius:16px 16px 0 0;padding:24px 32px;text-align:center;">
        <h1 style="color:#fff;margin:0;font-size:1.4rem;">💳 Payment Confirmed!</h1>
        <p style="color:rgba(255,255,255,.8);margin:4px 0 0;">Pinnacles Resource Centre Farm</p>
      </div>
      <div style="background:#fff;border-radius:0 0 16px 16px;padding:28px 32px;">
        <p style="color:#374151;margin-bottom:18px;">Order <strong>#${orderId}</strong> has been <strong>paid online</strong> via PayIsland and is now confirmed.</p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
          <tr><td style="padding:6px 0;color:#6b7280;width:120px;">Customer</td><td style="font-weight:600;">${customer_name || '-'}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Phone</td><td style="font-weight:600;">${customer_phone || '-'}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Email</td><td style="font-weight:600;">${customer_email || '-'}</td></tr>
          <tr><td style="padding:6px 0;color:#6b7280;">Total Paid</td><td style="font-weight:700;color:#2d6a4f;">₦${total.toLocaleString()}</td></tr>
        </table>
        ${customer_phone ? `<a href="https://wa.me/${customer_phone.replace(/\D/g,'')}?text=${encodeURIComponent('Hello '+customer_name+'! Your Pinnacles Farm order #'+orderId+' has been paid and confirmed. We\'ll be in touch shortly. Thank you! 🌿')}"
           style="display:inline-block;background:#25D366;color:#fff;padding:12px 24px;border-radius:50px;font-weight:700;text-decoration:none;">💬 Message Customer on WhatsApp</a>` : ''}
        <p style="font-size:.8rem;color:#9ca3af;margin-top:20px;border-top:1px solid #e2e8f0;padding-top:16px;">
          Manage this order from your <a href="${process.env.SITE_URL || ''}/admin">admin dashboard</a>.
        </p>
      </div>
    </div>`,
  }).catch(err => console.error('Payment email notification failed:', err.message));
}

// ── POST /api/payment/initialize ──────────────────────────────
// Called by the frontend checkout form. Creates an order record
// (status = 'pending_payment'), calls PayIsland to get a checkout URL,
// then returns { checkoutUrl } for the frontend to redirect to.
router.post('/initialize', async (req, res) => {
  try {
    const { customer_name, customer_phone, customer_email, items, total, notes } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0)
      return res.status(400).json({ error: 'Order must contain items.' });
    if (!total || total <= 0)
      return res.status(400).json({ error: 'Invalid order total.' });

    if (!PAYISLAND_SECRET) {
      return res.status(503).json({ error: 'Payment gateway not configured. Please contact the farm directly on WhatsApp.' });
    }

    // 1 — Save order in DB (pending_payment status)
    const r = await db.runAsync(
      'INSERT INTO orders (customer_name, customer_phone, items_json, total, notes, status) VALUES (?,?,?,?,?,?)',
      [customer_name || 'Online Customer', customer_phone || '', JSON.stringify(items), total, notes || '', 'pending_payment']
    );
    const orderId = r.lastID;

    // 2 — Generate a unique reference
    const reference = `PINN-${orderId}-${Date.now()}`;

    // 3 — Call PayIsland initialize API
    const payRes = await fetch(`${PAYISLAND_BASE}/transaction/initialize`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAYISLAND_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: String(Math.round(total * 100)), // PayIsland expects amount in kobo (smallest unit)
        email:  customer_email || 'customer@pinnaclesfarm.ng',
        reference,
        callback_url: `${process.env.SITE_URL || ''}/api/payment/callback`,
        metadata: {
          order_id:      orderId,
          customer_name,
          customer_phone,
        },
      }),
    });

    const payData = await payRes.json();

    if (!payRes.ok || !payData?.data?.checkout_url) {
      console.error('PayIsland init error:', payData);
      // Roll back the pending order
      await db.runAsync('DELETE FROM orders WHERE id = ?', [orderId]).catch(() => {});
      return res.status(502).json({ error: payData?.message || 'Payment gateway error. Please try WhatsApp checkout.' });
    }

    // 4 — Store the PayIsland reference on the order
    await db.runAsync('UPDATE orders SET whatsapp_msg = ? WHERE id = ?', [`payisland_ref:${reference}`, orderId]);

    res.json({ checkoutUrl: payData.data.checkout_url, orderId, reference });
  } catch (e) {
    console.error('Payment initialize error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/payment/callback ─────────────────────────────────
// PayIsland redirects the customer here after checkout.
// We verify the transaction, update the order, then redirect to
// a success or failure page on the frontend.
router.get('/callback', async (req, res) => {
  const { reference, status } = req.query;

  if (!reference) return res.redirect('/?payment=failed&reason=missing_reference');

  try {
    if (!PAYISLAND_SECRET) return res.redirect('/?payment=failed&reason=not_configured');

    // 1 — Verify transaction with PayIsland
    const verifyRes = await fetch(`${PAYISLAND_BASE}/transaction/verify/${reference}`, {
      headers: { 'Authorization': `Bearer ${PAYISLAND_SECRET}` },
    });
    const verifyData = await verifyRes.json();

    // PayIsland returns data.status === 'success' for a successful payment
    const paymentOk = verifyRes.ok && verifyData?.data?.status === 'success';

    if (!paymentOk) {
      console.warn('PayIsland verification failed:', reference, verifyData?.data?.status);
      return res.redirect(`/?payment=failed&ref=${encodeURIComponent(reference)}`);
    }

    // 2 — Find order by reference stored in whatsapp_msg field
    const order = await db.getAsync(
      `SELECT * FROM orders WHERE whatsapp_msg LIKE ?`, [`payisland_ref:${reference}%`]
    );

    if (order) {
      // 3 — Mark order as confirmed
      await db.runAsync('UPDATE orders SET status = ? WHERE id = ?', ['confirmed', order.id]);

      // 4 — Fire admin notification
      const items = JSON.parse(order.items_json || '[]');
      const metadata = verifyData?.data?.metadata || {};
      notifyAdmin({
        orderId:        order.id,
        customer_name:  order.customer_name,
        customer_phone: order.customer_phone,
        customer_email: verifyData?.data?.customer?.email || '',
        items,
        total:          order.total,
      });

      return res.redirect(`/?payment=success&order=${order.id}&name=${encodeURIComponent(order.customer_name || 'Customer')}`);
    }

    res.redirect('/?payment=success');
  } catch (e) {
    console.error('Payment callback error:', e.message);
    res.redirect('/?payment=failed&reason=server_error');
  }
});

module.exports = router;
