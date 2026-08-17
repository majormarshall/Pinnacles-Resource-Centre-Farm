// ── Orders Routes ────────────────────────────────────────────
const router     = require('express').Router();
const db         = require('../db');
const requireAuth= require('../middleware/auth');

router.post('/', async (req, res) => {
  try {
    const { customer_name, customer_phone, items, total, notes } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'Order must contain items.' });
    if (!total || total <= 0) return res.status(400).json({ error: 'Invalid order total.' });
    const r = await db.runAsync(
      'INSERT INTO orders (customer_name, customer_phone, items_json, total, notes) VALUES (?,?,?,?,?)',
      [customer_name||'Walk-in Customer', customer_phone||'', JSON.stringify(items), total, notes||'']
    );
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
