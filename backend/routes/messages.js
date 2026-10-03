// ── Messages Routes ──────────────────────────────────────────
const router     = require('express').Router();
const supabase   = require('../db');
const { requireAuth } = require('../middleware/auth');
const { messageLimiter } = require('../middleware/rateLimiter');

router.post('/', messageLimiter, async (req, res) => {
  try {
    const { name, phone, message } = req.body;
    if (!name || !message) return res.status(400).json({ error: 'Name and message are required.' });

    const { data, error } = await supabase
      .from('messages')
      .insert({ name, phone: phone || '', message })
      .select('id')
      .single();
    if (error) throw new Error(error.message);

    res.status(201).json({ id: data.id, message: 'Message received!' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/', requireAuth, async (req, res) => {
  try {
    const { data: messages, error: listError } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (listError) throw new Error(listError.message);

    const { count, error: countError } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('is_read', 0);
    if (countError) throw new Error(countError.message);

    res.json({ messages, unread: count || 0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/:id/read', requireAuth, async (req, res) => {
  try {
    const { error } = await supabase
      .from('messages')
      .update({ is_read: 1 })
      .eq('id', req.params.id);
    if (error) throw new Error(error.message);
    res.json({ message: 'Marked as read.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('id', req.params.id);
    if (error) throw new Error(error.message);
    res.json({ message: 'Message deleted.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
