// ── Orders Routes ────────────────────────────────────────────
const router      = require('express').Router();
const supabase    = require('../db');
const { requireAuth } = require('../middleware/auth');
const nodemailer  = require('nodemailer');
const { orderLimiter } = require('../middleware/rateLimiter');

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
router.post('/', orderLimiter, async (req, res) => {
  try {
    const { customer_name, customer_phone, customer_id, items, total, notes, whatsapp_msg } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'Order must contain items.' });
    if (!total || total <= 0) return res.status(400).json({ error: 'Invalid order total.' });

    const { data: newOrder, error: insertError } = await supabase
      .from('orders')
      .insert({
        customer_name:  customer_name  || 'Walk-in Customer',
        customer_phone: customer_phone || '',
        customer_id:    customer_id    || null,
        items_json:     JSON.stringify(items),
        total,
        notes:          notes          || '',
        whatsapp_msg:   whatsapp_msg   || '',
      })
      .select('id')
      .single();
    if (insertError) throw new Error(insertError.message);

    const newOrderId = newOrder.id;
    // Fire-and-forget admin email notification
    sendAdminOrderEmail({ orderId: newOrderId, customer_name, customer_phone, items, total, notes });

    // Award loyalty points if customer_id is provided — 1 point per ₦100 spent (rounded down)
    const loyaltyPoints = Math.floor((total || 0) / 100);
    if (customer_id && loyaltyPoints > 0) {
      try {
        // Fetch current customer stats, then update atomically
        const { data: cust } = await supabase
          .from('customers')
          .select('loyalty_points, total_orders, total_spent')
          .eq('id', customer_id)
          .single();
        if (cust) {
          await supabase.from('customers').update({
            loyalty_points: (cust.loyalty_points || 0) + loyaltyPoints,
            total_orders:   (cust.total_orders   || 0) + 1,
            total_spent:    (cust.total_spent     || 0) + (total || 0),
          }).eq('id', customer_id);
        }

        await supabase.from('loyalty_transactions').insert({
          customer_id,
          order_id:    newOrderId,
          points:      loyaltyPoints,
          type:        'earn',
          description: 'Earned from order #' + newOrderId,
        });
      } catch(e) { console.error('Loyalty points error:', e.message); }
    }

    res.status(201).json({ id: newOrderId, message: 'Order received! We will confirm via WhatsApp shortly.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/orders — admin: list orders + stats ──────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    const { status } = req.query;

    // Build query — filter by status if provided, always desc + limit 100
    let query = supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(100);
    if (status) query = query.eq('status', status);

    const { data: orders, error: ordersError } = await query;
    if (ordersError) throw new Error(ordersError.message);

    // Aggregate stats in JS (PostgREST doesn't support CASE WHEN SUM)
    const allOrders = orders || [];
    const stats = {
      total:     allOrders.length,
      pending:   allOrders.filter(o => o.status === 'pending').length,
      confirmed: allOrders.filter(o => o.status === 'confirmed').length,
      delivered: allOrders.filter(o => o.status === 'delivered').length,
      revenue:   allOrders.reduce((s, o) => s + Number(o.total || 0), 0),
    };

    res.json({ orders: allOrders.map(o => ({ ...o, items: JSON.parse(o.items_json || '[]') })), stats });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PATCH /api/orders/:id/status — update order status ────────
router.patch('/:id/status', requireAuth, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending','confirmed','processing','delivered','cancelled'].includes(status))
      return res.status(400).json({ error: 'Invalid status.' });
    const { error } = await supabase.from('orders').update({ status }).eq('id', req.params.id);
    if (error) throw new Error(error.message);
    res.json({ message: `Order marked as ${status}.` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── DELETE /api/orders/:id ─────────────────────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { error } = await supabase.from('orders').delete().eq('id', req.params.id);
    if (error) throw new Error(error.message);
    res.json({ message: 'Order deleted.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});


// ── Monthly Sales Report (Excel) ─────────────────────────────────────────
router.get('/report', requireAuth, async (req, res) => {
  try {
    const XLSX  = require('xlsx');
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const year  = parseInt(req.query.year)  || new Date().getFullYear();

    const start = new Date(year, month - 1, 1).toISOString();
    const end   = new Date(year, month, 1).toISOString();

    const { data: orders, error: reportError } = await supabase
      .from('orders')
      .select('*')
      .gte('created_at', start)
      .lt('created_at', end)
      .order('created_at');
    if (reportError) throw new Error(reportError.message);

    const monthName = new Date(year, month - 1, 1)
      .toLocaleString('en-NG', { month: 'long', year: 'numeric' });

    // ── Farm letterhead rows ────────────────────────────────────────────
    const headerRows = [
      ['PINNACLES RESOURCE CENTRE FARM'],
      ['Fresh · Organic · Farm to Table'],
      ['Email: agribusiness@pinnaclescentre.com  |  WhatsApp: +234 903 750 5632'],
      [],
      ['Monthly Sales Report — ' + monthName],
      ['Generated: ' + new Date().toLocaleString('en-NG', { dateStyle:'full', timeStyle:'short' })],
      [],
    ];

    const rows = (orders || []).map(o => {
      let items = [];
      try { items = JSON.parse(o.items_json || '[]'); } catch (_) {}
      const itemStr = items.map(i => i.name + ' x' + i.qty).join(', ');

      const wm = o.whatsapp_msg || '';
      const payMethod =
        wm.startsWith('payisland_ref:') ? 'Online Payment' :
        wm.startsWith('walkin:cash')    ? 'Cash Payment'   :
        wm.startsWith('walkin:pos')     ? 'POS Payment'    :
        wm.startsWith('walkin:transfer')? 'Bank Transfer'  :
        'WhatsApp Order';

      return {
        'Order ID':       '#' + String(o.id).padStart(4, '0'),
        'Date':           new Date(o.created_at).toLocaleDateString('en-NG', { day:'2-digit', month:'short', year:'numeric' }),
        'Customer Name':  o.customer_name  || '',
        'Phone':          o.customer_phone || '',
        'Items':          itemStr,
        'Total (NGN)':    Number(o.total),
        'Status':         o.status         || '',
        'Payment Method': payMethod,
        'Notes':          o.notes          || '',
      };
    });

    const grandTotal = (orders || []).reduce((s, o) => s + Number(o.total), 0);
    rows.push({});
    rows.push({
      'Order ID':       'SUMMARY',
      'Customer Name':  'Total Orders: ' + (orders || []).length,
      'Total (NGN)':    grandTotal,
      'Status':         'Grand Total: NGN ' + grandTotal.toLocaleString('en-NG'),
    });

    const XLSX2 = require('xlsx');
    const wb = XLSX2.utils.book_new();

    // Build sheet from header + data rows
    const ws = XLSX2.utils.aoa_to_sheet(headerRows);

    // Determine data start row (after letterhead)
    const dataStartRow = headerRows.length + 1; // 1-indexed
    XLSX2.utils.sheet_add_json(ws, rows, { origin: 'A' + dataStartRow, skipHeader: false });

    // Style letterhead (merge title across columns, bold it)
    const totalCols = 9;
    ws['!merges'] = [
      { s:{r:0,c:0}, e:{r:0,c:totalCols-1} },  // Farm name row
      { s:{r:1,c:0}, e:{r:1,c:totalCols-1} },  // Tagline
      { s:{r:2,c:0}, e:{r:2,c:totalCols-1} },  // Contact
      { s:{r:4,c:0}, e:{r:4,c:totalCols-1} },  // Report title
      { s:{r:5,c:0}, e:{r:5,c:totalCols-1} },  // Date
    ];

    // Protect the worksheet (read-only, no editing)
    ws['!protect'] = {
      password:         '',
      sheet:            true,
      formatCells:      false,
      formatColumns:    false,
      formatRows:       false,
      insertColumns:    false,
      insertRows:       false,
      deleteColumns:    false,
      deleteRows:       false,
      sort:             false,
      autoFilter:       false,
    };
    ws['!cols'] = [
      {wch:10},{wch:14},{wch:22},{wch:16},
      {wch:40},{wch:14},{wch:14},{wch:18},{wch:30},
    ];
    XLSX2.utils.book_append_sheet(wb, ws, monthName.slice(0,31));
    const buf = XLSX2.write(wb, { type:'buffer', bookType:'xlsx' });

    const fname = 'Pinnacles-Sales-Report-' + year + '-' + String(month).padStart(2,'0') + '.xlsx';
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="' + fname + '"');
    res.setHeader('Content-Length', buf.length);
    res.end(buf);
  } catch (err) {
    console.error('Report error:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

module.exports = router;
