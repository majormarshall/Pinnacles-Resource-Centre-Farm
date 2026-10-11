// ── Auth Routes ──────────────────────────────────────────────
const router   = require('express').Router();
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const supabase = require('../db');
const { requireAuth } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'pinnacles_farm_secret_2026_jwt';

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required.' });
    }

    const cleanUser = String(username).trim();

    // 1. Try case-insensitive username match
    let admin = null;
    const { data: userMatches, error: userErr } = await supabase
      .from('admins')
      .select('*')
      .ilike('username', cleanUser)
      .limit(1);

    if (userMatches && userMatches.length > 0) {
      admin = userMatches[0];
    } else {
      // 2. Try email match if available
      try {
        const { data: emailMatches } = await supabase
          .from('admins')
          .select('*')
          .ilike('email', cleanUser)
          .limit(1);
        if (emailMatches && emailMatches.length > 0) {
          admin = emailMatches[0];
        }
      } catch (_) {}
    }

    // 3. Fallback check for default admin if table is empty or first setup
    if (!admin && (cleanUser.toLowerCase() === 'admin' || cleanUser.toLowerCase() === 'pinnacles_admin')) {
      const { count } = await supabase.from('admins').select('*', { count: 'exact', head: true }).catch(() => ({ count: 0 }));
      if ((count || 0) === 0) {
        // Auto-seed default admin
        const defaultPass = process.env.ADMIN_PASSWORD || 'Pinnacles2026!';
        const hash = bcrypt.hashSync(defaultPass, 10);
        const { data: created } = await supabase.from('admins').insert({
          username: cleanUser.toLowerCase(),
          password_hash: hash,
          role: 'super_admin'
        }).select('*').single().catch(() => ({ data: null }));
        if (created) admin = created;
      }
    }

    if (!admin) {
      return res.status(401).json({ error: 'Account not found. Please check your username.' });
    }

    // Verify password
    const passwordMatch = bcrypt.compareSync(String(password).trim(), admin.password_hash)
      || (bcrypt.compareSync(String(password), admin.password_hash));

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Incorrect password. Please try again.' });
    }

    // Block pending worker accounts
    if (admin.status === 'pending') {
      return res.status(403).json({
        error: 'Your account is awaiting approval by the farm manager. Please wait or contact your supervisor.'
      });
    }

    const tokenPayload = {
      id:       admin.id,
      name:     admin.username,
      username: admin.username,
      email:    admin.email || '',
      role:     admin.role  || 'ecomm_admin',
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      username: admin.username,
      role: admin.role || 'ecomm_admin',
      user: tokenPayload
    });
  } catch (e) {
    console.error('Login error:', e.message);
    res.status(500).json({ error: 'Login error: ' + e.message });
  }
});

router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    const adminId = req.user?.id || req.admin?.id;

    const { data: admin, error } = await supabase
      .from('admins')
      .select('*')
      .eq('id', adminId)
      .single();
    if (error && error.code !== 'PGRST116') throw new Error(error.message);

    if (!admin || !bcrypt.compareSync(currentPassword, admin.password_hash))
      return res.status(401).json({ error: 'Current password is incorrect.' });

    const hash = bcrypt.hashSync(newPassword, 10);
    const { error: updateError } = await supabase
      .from('admins')
      .update({ password_hash: hash })
      .eq('id', adminId);
    if (updateError) throw new Error(updateError.message);

    res.json({ message: 'Password updated successfully.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/auth/me -- verify token and return current user
router.get('/me', requireAuth, (req, res) => {
  res.json({
    id: req.user.id,
    name: req.user.name,
    username: req.user.username || req.user.name,
    email: req.user.email,
    role: req.user.role || 'ecomm_admin'
  });
});

module.exports = router;
