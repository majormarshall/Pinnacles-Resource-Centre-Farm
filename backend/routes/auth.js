// ── Auth Routes ─────────────────────────────────────────────
const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('../db');
const { authLimiter } = require('../middleware/rateLimiter');
const { requireAuth } = require('../middleware/auth');

// Ensure role column exists on admins table (safe migration)
db.runAsync('ALTER TABLE admins ADD COLUMN IF NOT EXISTS role TEXT DEFAULT \'ecomm_admin\'', [])
  .catch(() => {});

router.post('/login', authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Username and password required.' });
    const admin = await db.getAsync('SELECT * FROM admins WHERE username = ?', [username]);
    if (!admin || !bcrypt.compareSync(password, admin.password_hash))
      return res.status(401).json({ error: 'Invalid credentials.' });
    const token = jwt.sign(
      {
        id:    admin.id,
        name:  admin.username,
        email: admin.email  || '',
        role:  admin.role   || 'ecomm_admin',
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    res.json({ token, username: admin.username, role: admin.role || 'ecomm_admin' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    const admin = await db.getAsync('SELECT * FROM admins WHERE id = ?', [req.admin.id]);
    if (!bcrypt.compareSync(currentPassword, admin.password_hash))
      return res.status(401).json({ error: 'Current password is incorrect.' });
    const hash = bcrypt.hashSync(newPassword, 10);
    await db.runAsync('UPDATE admins SET password_hash = ? WHERE id = ?', [hash, req.admin.id]);
    res.json({ message: 'Password updated successfully.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});


// GET /api/auth/me -- verify token and return current user
router.get('/me', requireAuth, (req, res) => {
  res.json({ id: req.user.id, name: req.user.name, email: req.user.email, role: req.user.role || 'ecomm_admin' });
});
module.exports = router;
