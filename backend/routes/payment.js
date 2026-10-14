// ── PayIsland Payment Routes ──────────────────────────────────
const router   = require('express').Router();
const supabase = require('../db');
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
    const { data: newOrder, error: insertErr } = await supabase.from('orders')
      .insert({ customer_name: customer_name || 'Online Customer', customer_phone: customer_phone || '', items_json: JSON.stringify(items), total, notes: notes || '', status: 'pending_payment' })
      .select('id').single();
    if (insertErr) throw new Error(insertErr.message);
    const orderId = newOrder.id;

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
      await supabase.from('orders').delete().eq('id', orderId);
      return res.status(502).json({ error: payData?.message || 'Payment gateway error. Please try WhatsApp checkout.' });
    }

    // 4 — Store the PayIsland reference on the order
    await supabase.from('orders').update({ whatsapp_msg: `payisland_ref:${reference}` }).eq('id', orderId);

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
    const { data: orders } = await supabase.from('orders').select('*').like('whatsapp_msg', `payisland_ref:${reference}%`).limit(1);
    const order = orders?.[0] || null;

    if (order) {
      // 3 — Mark order as confirmed
      await supabase.from('orders').update({ status: 'confirmed' }).eq('id', order.id);

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

// ── Bank Receipt Verification ──────────────────────────────────
// POST /api/payment/verify-bank — admin inputs bank receipt details
// GET  /api/payment/bank-receipts — list all verified bank receipts
// GET  /api/payment/bank-receipt/:txnId — look up by transaction ID
// PATCH /api/payment/bank-receipt/:id — update status

// DB table needed:
const CREATE_BANK_RECEIPTS_TABLE = `
  CREATE TABLE IF NOT EXISTS bank_receipts (
    id SERIAL PRIMARY KEY,
    order_id INTEGER,
    customer_name TEXT,
    customer_phone TEXT,
    bank_name TEXT NOT NULL,
    account_name TEXT,
    transaction_id TEXT NOT NULL UNIQUE,
    amount REAL NOT NULL,
    payment_date DATE NOT NULL,
    payment_time TEXT,
    verified_by TEXT,
    status TEXT DEFAULT 'verified',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )
`;

// In-memory fallback in case Supabase is unavailable or table not created yet
let _mockBankReceipts = [];
let _mockIdSeq = 1;

// POST /api/payment/verify-bank — saves bank receipt details
router.post('/verify-bank', async (req, res) => {
  try {
    const {
      bank_name,
      transaction_id,
      amount,
      payment_date,
      order_id,
      customer_name,
      customer_phone,
      account_name,
      payment_time,
      notes,
      status = 'verified',
      verified_by,
    } = req.body;

    if (!bank_name || !transaction_id || amount === undefined || amount === null || !payment_date) {
      return res.status(400).json({ error: 'bank_name, transaction_id, amount, and payment_date are required' });
    }

    const txnUpper = String(transaction_id).trim().toUpperCase();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < 0) {
      return res.status(400).json({ error: 'amount must be a valid non-negative number' });
    }

    const adminUser = verified_by || req.admin?.username || req.user?.username || 'admin';

    const insertData = {
      bank_name: String(bank_name).trim(),
      transaction_id: txnUpper,
      amount: numAmount,
      payment_date: String(payment_date).trim(),
      order_id: order_id ? parseInt(order_id) : null,
      customer_name: customer_name ? String(customer_name).trim() : null,
      customer_phone: customer_phone ? String(customer_phone).trim() : null,
      account_name: account_name ? String(account_name).trim() : null,
      payment_time: payment_time ? String(payment_time).trim() : null,
      notes: notes ? String(notes).trim() : null,
      status: status || 'verified',
      verified_by: adminUser,
    };

    let saved = null;
    try {
      const { data, error } = await supabase
        .from('bank_receipts')
        .insert(insertData)
        .select()
        .single();
      if (error) throw error;
      saved = data;
    } catch (dbErr) {
      console.warn('[BankReceipt] Supabase insert warning:', dbErr.message);
      saved = {
        id: _mockIdSeq++,
        ...insertData,
        created_at: new Date().toISOString()
      };
      _mockBankReceipts.unshift(saved);
    }

    // Link to order if order_id provided
    if (insertData.order_id) {
      try {
        await supabase
          .from('orders')
          .update({
            status: 'confirmed',
            whatsapp_msg: `bank_txn:${txnUpper}`
          })
          .eq('id', insertData.order_id);
      } catch (_) {}
    }

    return res.status(201).json({
      id: saved.id,
      transaction_id: saved.transaction_id,
      message: 'Payment verified successfully',
      receipt: saved,
    });
  } catch (e) {
    console.error('Verify bank receipt error:', e.message);
    return res.status(500).json({ error: e.message });
  }
});

// GET /api/payment/bank-receipts — returns all bank receipts (most recent first)
router.get('/bank-receipts', async (req, res) => {
  try {
    let receipts = [];
    try {
      const { data, error } = await supabase
        .from('bank_receipts')
        .select('*')
        .order('id', { ascending: false });
      if (error) throw error;
      receipts = data || [];
    } catch (dbErr) {
      console.warn('[BankReceipt] Supabase select warning:', dbErr.message);
      receipts = _mockBankReceipts;
    }
    return res.json(receipts);
  } catch (e) {
    console.error('Get bank receipts error:', e.message);
    return res.status(500).json({ error: e.message });
  }
});

// GET /api/payment/bank-receipt/:txnId — returns single receipt by transaction ID
router.get('/bank-receipt/:txnId', async (req, res) => {
  try {
    const txnId = String(req.params.txnId).trim().toUpperCase();
    let receipt = null;
    try {
      const { data, error } = await supabase
        .from('bank_receipts')
        .select('*')
        .eq('transaction_id', txnId)
        .maybeSingle();
      if (error) throw error;
      receipt = data;
    } catch (dbErr) {
      console.warn('[BankReceipt] Supabase lookup by txnId warning:', dbErr.message);
      receipt = _mockBankReceipts.find(r => r.transaction_id === txnId) || null;
    }

    if (!receipt) {
      return res.status(404).json({ error: 'Bank receipt not found' });
    }
    return res.json(receipt);
  } catch (e) {
    console.error('Get bank receipt error:', e.message);
    return res.status(500).json({ error: e.message });
  }
});

// PATCH /api/payment/bank-receipt/:id — update status (e.g. 'verified', 'pending', 'rejected')
router.patch('/bank-receipt/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status, notes } = req.body;
    const updatePayload = {};
    if (status) updatePayload.status = status;
    if (notes !== undefined) updatePayload.notes = notes;

    let updated = null;
    try {
      const { data, error } = await supabase
        .from('bank_receipts')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      updated = data;
    } catch (dbErr) {
      console.warn('[BankReceipt] Supabase patch warning:', dbErr.message);
      const found = _mockBankReceipts.find(r => r.id === id);
      if (found) {
        if (status) found.status = status;
        if (notes !== undefined) found.notes = notes;
        updated = found;
      }
    }

    if (!updated) {
      return res.status(404).json({ error: 'Bank receipt not found' });
    }
    return res.json({ message: 'Receipt updated successfully', receipt: updated });
  } catch (e) {
    console.error('Update bank receipt error:', e.message);
    return res.status(500).json({ error: e.message });
  }
});

router.CREATE_BANK_RECEIPTS_TABLE = CREATE_BANK_RECEIPTS_TABLE;

module.exports = router;
