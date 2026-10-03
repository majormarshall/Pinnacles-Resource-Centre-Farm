// backend/routes/admin-users.js — Admin user management (Supabase JS)
const express  = require('express');
const router   = express.Router();
const supabase = require('../db');
const bcrypt   = require('bcryptjs');
const { requireAuth } = require('../middleware/auth');

// GET /api/admin-users — list all admin users
router.get('/', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('admin_users')
      .select('id, name, email, role, created_at')
      .order('name');
    if (error) throw new Error(error.message);
    res.json(data || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/admin-users — create new admin user
router.post('/', requireAuth, async (req, res) => {
  const { name, email, password, role = 'farm_worker' } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'name, email, password required' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const { data, error } = await supabase
      .from('admin_users')
      .insert({ name, email, password: hash, role })
      .select('id').single();
    if (error) throw new Error(error.message);
    res.json({ id: data.id, name, email, role });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// PATCH /api/admin-users/:id/role — update role
router.patch('/:id/role', requireAuth, async (req, res) => {
  try {
    const { error } = await supabase
      .from('admin_users')
      .update({ role: req.body.role })
      .eq('id', req.params.id);
    if (error) throw new Error(error.message);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/admin-users/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { error } = await supabase
      .from('admin_users')
      .delete()
      .eq('id', req.params.id);
    if (error) throw new Error(error.message);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
