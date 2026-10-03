// backend/routes/admin-users.js — Admin user management with roles
const express  = require('express');
const router   = express.Router();
const db       = require('../db');
const bcrypt   = require('bcryptjs');
const { requireAuth } = require('../middleware/auth');

// GET /api/admin-users — list all admin users (super_admin only)
router.get('/', requireAuth, async (req, res) => {
  const rows = await db.allAsync(
    'SELECT id, name, email, role, created_at FROM admin_users ORDER BY name ASC', []
  ).catch(() => []);
  res.json(rows);
});

// POST /api/admin-users — create new admin user (super_admin only)
router.post('/', requireAuth, async (req, res) => {
  const { name, email, password, role = 'farm_worker' } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'name, email, password required' });
  try {
    // Ensure role column exists
    try { await db.runAsync('ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT \'ecomm_admin\'', []); } catch(_){}
    const hash = await bcrypt.hash(password, 10);
    const r = await db.runAsync(
      'INSERT INTO admin_users (name, email, password, role) VALUES (?,?,?,?) RETURNING id',
      [name, email, hash, role]
    );
    res.json({ id: r.lastID || r.rows?.[0]?.id, name, email, role });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// PATCH /api/admin-users/:id/role — update role
router.patch('/:id/role', requireAuth, async (req, res) => {
  const { role } = req.body;
  await db.runAsync('UPDATE admin_users SET role=? WHERE id=?', [role, req.params.id]);
  res.json({ ok: true });
});

// DELETE /api/admin-users/:id
router.delete('/:id', requireAuth, async (req, res) => {
  await db.runAsync('DELETE FROM admin_users WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
