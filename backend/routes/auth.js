// ── Auth Routes ─────────────────────────────────────────────
const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const supabase = require('../db');
const { authLimiter } = require('../middleware/rateLimiter');
const { requireAuth } = require('../middleware/auth');

// NOTE: ALTER TABLE skipped — table schema managed in Supabase dashboard

router.post('/login', authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Username and password required.' });

    const { data: admin, error } = await supabase
      .from('admins')
      .select('*')
      .eq('username', username)
      .single();
    if (error && error.code !== 'PGRST116') throw new Error(error.message);

    if (!admin || !bcrypt.compareSync(password, admin.password_hash))
      return res.status(401).json({ error: 'Invalid credentials.' });

    // Block pending worker accounts
    if (admin.status === 'pending')
      return res.status(403).json({ error: 'Your account is awaiting approval by the farm manager. Please wait or contact your supervisor.' });

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

    const { data: admin, error } = await supabase
      .from('admins')
      .select('*')
      .eq('id', req.admin.id)
      .single();
    if (error && error.code !== 'PGRST116') throw new Error(error.message);

    if (!admin || !bcrypt.compareSync(currentPassword, admin.password_hash))
      return res.status(401).json({ error: 'Current password is incorrect.' });

    const hash = bcrypt.hashSync(newPassword, 10);
    const { error: updateError } = await supabase
      .from('admins')
      .update({ password_hash: hash })
      .eq('id', req.admin.id);
    if (updateError) throw new Error(updateError.message);

    res.json({ message: 'Password updated successfully.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});


// GET /api/auth/me -- verify token and return current user
router.get('/me', requireAuth, (req, res) => {
  res.json({ id: req.user.id, name: req.user.name, email: req.user.email, role: req.user.role || 'ecomm_admin' });
});
module.exports = router;
