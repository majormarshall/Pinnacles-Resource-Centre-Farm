// backend/routes/admin-users.js - Admin user management (Supabase JS)
const express  = require('express');
const router   = express.Router();
const supabase = require('../db');
const bcrypt   = require('bcryptjs');
const { requireAuth } = require('../middleware/auth');

// GET /api/admin-users - list all admin users
router.get('/', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('admins')
      .select('id, username, role, created_at')
      .order('username');
    if (error) throw new Error(error.message);
    res.json((data || []).map(u => ({ id: u.id, name: u.username, role: u.role, created_at: u.created_at })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/admin-users - create new admin user
router.post('/', requireAuth, async (req, res) => {
  const { name, email, password, role = 'farm_worker' } = req.body;
  if (!name || !password) return res.status(400).json({ error: 'name and password required' });
  try {
    const hash = await bcrypt.hash(password, 10);
    // Ensure we generate a unique username from their name or email
    const baseStr = (name || email || 'user').toLowerCase().replace(/\s+/g, '_');
    const username = baseStr + '_' + Date.now().toString().slice(-4);
    
    const { data, error } = await supabase
      .from('admins')
      .insert({ username, password_hash: hash, role })
      .select('id').single();
    if (error) throw new Error(error.message);
    res.json({ id: data.id, name: username, role });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// PATCH /api/admin-users/:id/role - update role
router.patch('/:id/role', requireAuth, async (req, res) => {
  try {
    const { error } = await supabase
      .from('admins')
      .update({ role: req.body.role })
      .eq('id', req.params.id);
    if (error) throw new Error(error.message);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/admin-users/:id/password - reset password
router.patch('/:id/password', requireAuth, async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  try {
    const hash = await bcrypt.hash(password, 10);
    const { error } = await supabase
      .from('admins')
      .update({ password_hash: hash })
      .eq('id', req.params.id);
    if (error) throw new Error(error.message);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/admin-users/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { error } = await supabase
      .from('admins')
      .delete()
      .eq('id', req.params.id);
    if (error) throw new Error(error.message);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
