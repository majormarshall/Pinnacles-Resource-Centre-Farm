// ── Messages Routes ──────────────────────────────────────────
const router     = require('express').Router();
const db         = require('../db');
const requireAuth= require('../middleware/auth');

router.post('/', async (req, res) => {
  try {
    const { name, phone, message } = req.body;
    if (!name || !message) return res.status(400).json({ error: 'Name and message are required.' });
    const r = await db.runAsync('INSERT INTO messages (name,phone,message) VALUES (?,?,?)', [name, phone||'', message]);
    res.status(201).json({ id: r.lastID, message: 'Message received!' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/', requireAuth, async (req, res) => {
  try {
    const messages = await db.allAsync('SELECT * FROM messages ORDER BY created_at DESC LIMIT 100');
    const unread   = await db.getAsync('SELECT COUNT(*) as c FROM messages WHERE is_read = 0');
    res.json({ messages, unread: unread.c });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/:id/read', requireAuth, async (req, res) => {
  try {
    await db.runAsync('UPDATE messages SET is_read = 1 WHERE id = ?', [req.params.id]);
    res.json({ message: 'Marked as read.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    await db.runAsync('DELETE FROM messages WHERE id = ?', [req.params.id]);
    res.json({ message: 'Message deleted.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
