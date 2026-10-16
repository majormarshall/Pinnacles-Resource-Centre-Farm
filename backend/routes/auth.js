// backend/routes/auth.js
// ══════════════════════════════════════════════════════════════
// Pinnacles Farm — Authentication & Admin Management
// ══════════════════════════════════════════════════════════════
/*
CREATE TABLE IF NOT EXISTS admin_otp (
  admin_id INTEGER,
  otp_code TEXT,
  expires_at TIMESTAMPTZ,
  used BOOLEAN DEFAULT false
);
*/

const router   = require('express').Router();
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const supabase = require('../db');
const { requireAuth } = require('../middleware/auth');
const { logActivity } = require('./activity');

const JWT_SECRET = process.env.JWT_SECRET || 'pinnacles_farm_secret_2026_jwt';

// In-memory fallback for 2FA OTP codes
const memoryOtps = new Map();

/**
 * Normalizes role to one of: 'owner', 'manager', 'accountant', 'ecomm_admin', 'farm_admin'
 */
function cleanRole(role) {
  if (!role) return 'ecomm_admin';
  const r = String(role).toLowerCase().trim();
  if (r === 'super_admin' || r === 'owner') return 'owner';
  if (['manager', 'accountant', 'ecomm_admin', 'farm_admin'].includes(r)) return r;
  if (r === 'farm_worker') return 'farm_admin';
  return 'ecomm_admin';
}

/**
 * Middleware ensuring current user is an Owner
 */
function requireOwner(req, res, next) {
  const currentRole = cleanRole(req.user?.role || req.admin?.role);
  if (currentRole !== 'owner') {
    return res.status(403).json({ error: 'Forbidden: Owner role required.' });
  }
  next();
}

// ── POST /api/auth/login ──────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required.' });
    }

    const cleanUser = String(username).trim();

    // 1. Try username match
    let admin = null;
    const { data: userMatches } = await supabase
      .from('admins')
      .select('*')
      .ilike('username', cleanUser)
      .limit(1);

    if (userMatches && userMatches.length > 0) {
      admin = userMatches[0];
    } else {
      // 2. Try email match
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

    // 3. Fallback auto-seed default admin if table is empty
    if (!admin && (cleanUser.toLowerCase() === 'admin' || cleanUser.toLowerCase() === 'pinnacles_admin')) {
      const { count } = await supabase.from('admins').select('*', { count: 'exact', head: true }).catch(() => ({ count: 0 }));
      if ((count || 0) === 0) {
        const defaultPass = process.env.ADMIN_PASSWORD || 'Pinnacles2026!';
        const hash = bcrypt.hashSync(defaultPass, 10);
        const { data: created } = await supabase.from('admins').insert({
          username: cleanUser.toLowerCase(),
          email: 'agribusiness@pinnaclescentre.com',
          password_hash: hash,
          role: 'owner',
          two_factor_enabled: true
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

    // Block pending accounts
    if (admin.status === 'pending') {
      return res.status(403).json({
        error: 'Your account is awaiting approval by the farm manager. Please wait or contact your supervisor.'
      });
    }

    const assignedRole = cleanRole(admin.role);

    // ── 2FA Check ──
    const is2FAEnabled = admin.two_factor_enabled === true;
    if (is2FAEnabled) {
      // Generate 6-digit numeric OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      // Attempt save to DB
      try {
        await supabase.from('admin_otp').insert({
          admin_id: admin.id,
          otp_code: otp,
          expires_at: expiresAt,
          used: false
        });
      } catch (_) {}

      // In-memory fallback
      memoryOtps.set(String(admin.id), {
        otp,
        expires_at: Date.now() + 10 * 60 * 1000,
        used: false
      });

      console.log(`[2FA OTP] Code for ${admin.username} (ID: ${admin.id}): ${otp} (expires in 10m)`);

      const tempToken = jwt.sign(
        {
          id: admin.id,
          username: admin.username,
          name: admin.username,
          email: admin.email || '',
          role: assignedRole,
          purpose: '2fa'
        },
        JWT_SECRET,
        { expiresIn: '10m' }
      );

      return res.json({
        requires2FA: true,
        tempToken,
        debug_otp: otp, // For development and instant testing
        message: 'Enter the 6-digit code sent to your registered phone/email'
      });
    }

    // Direct Login (when 2FA is toggled off)
    const tokenPayload = {
      id:       admin.id,
      name:     admin.username,
      username: admin.username,
      email:    admin.email || '',
      role:     assignedRole
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });

    logActivity({
      admin_name: admin.username,
      admin_email: admin.email || '',
      action: 'login',
      details: `Direct sign-in for ${admin.username} (${assignedRole})`,
      ip_address: req.ip || req.headers['x-forwarded-for'] || '',
      user_agent: req.headers['user-agent'] || ''
    }).catch(() => {});

    res.json({
      token,
      username: admin.username,
      role: assignedRole,
      user: tokenPayload
    });
  } catch (e) {
    console.error('Login error:', e.message);
    res.status(500).json({ error: 'Login error: ' + e.message });
  }
});

// ── POST /api/auth/verify-otp ──────────────────────────────────
router.post('/verify-otp', async (req, res) => {
  try {
    const { tempToken, otp } = req.body || {};
    if (!tempToken || !otp) {
      return res.status(400).json({ error: 'tempToken and 6-digit OTP code required.' });
    }

    let decoded;
    try {
      decoded = jwt.verify(tempToken, JWT_SECRET);
    } catch {
      return res.status(401).json({ error: '2FA session expired. Please sign in again.' });
    }

    if (decoded.purpose !== '2fa') {
      return res.status(400).json({ error: 'Invalid token purpose.' });
    }

    const adminId = decoded.id;
    const cleanCode = String(otp).trim();

    let verified = false;

    // Check DB
    try {
      const { data: records, error } = await supabase
        .from('admin_otp')
        .select('*')
        .eq('admin_id', adminId)
        .eq('otp_code', cleanCode)
        .eq('used', false)
        .order('id', { ascending: false })
        .limit(1);

      if (!error && records && records.length > 0) {
        const rec = records[0];
        if (new Date(rec.expires_at).getTime() > Date.now()) {
          verified = true;
          await supabase.from('admin_otp').update({ used: true }).eq('id', rec.id);
        }
      }
    } catch (_) {}

    // Check memory fallback
    if (!verified) {
      const mem = memoryOtps.get(String(adminId));
      if (mem && !mem.used && mem.otp === cleanCode && mem.expires_at > Date.now()) {
        verified = true;
        mem.used = true;
      }
    }

    if (!verified) {
      return res.status(400).json({ error: 'Invalid or expired 6-digit code. Please try again.' });
    }

    // Fetch freshest admin profile
    let admin = null;
    try {
      const { data } = await supabase.from('admins').select('*').eq('id', adminId).single();
      if (data) admin = data;
    } catch (_) {}

    const role = cleanRole(admin?.role || decoded.role);
    const tokenPayload = {
      id:       adminId,
      name:     admin?.username || decoded.username,
      username: admin?.username || decoded.username,
      email:    admin?.email || decoded.email || '',
      role
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });

    logActivity({
      admin_name: tokenPayload.name,
      admin_email: tokenPayload.email,
      action: 'login',
      details: `2FA OTP verified sign-in for ${tokenPayload.name} (${role})`,
      ip_address: req.ip || req.headers['x-forwarded-for'] || '',
      user_agent: req.headers['user-agent'] || ''
    }).catch(() => {});

    res.json({
      token,
      username: tokenPayload.username,
      role,
      user: tokenPayload
    });
  } catch (err) {
    res.status(500).json({ error: 'OTP verification error: ' + err.message });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────
router.get('/me', requireAuth, (req, res) => {
  const role = cleanRole(req.user.role);
  res.json({
    id: req.user.id,
    name: req.user.name || req.user.username,
    username: req.user.username || req.user.name,
    email: req.user.email || '',
    role
  });
});

// ── POST /api/auth/change-password ────────────────────────────
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

    if (!admin || !bcrypt.compareSync(currentPassword, admin.password_hash)) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    const hash = bcrypt.hashSync(newPassword, 10);
    const { error: updateError } = await supabase
      .from('admins')
      .update({ password_hash: hash })
      .eq('id', adminId);
    if (updateError) throw new Error(updateError.message);

    logActivity({
      admin_name: admin.username,
      admin_email: admin.email || '',
      action: 'password_changed',
      details: 'Password was updated by user'
    }).catch(() => {});

    res.json({ message: 'Password updated successfully.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════
// ADMIN USER MANAGEMENT (Owner Only)
// ══════════════════════════════════════════════════════════════

// ── GET /api/auth/admins — list all admin users ───────────────
router.get('/admins', requireAuth, requireOwner, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('admins')
      .select('id, username, email, role, two_factor_enabled, created_at')
      .order('id');
    if (error) throw new Error(error.message);

    const list = (data || []).map(u => ({
      id: u.id,
      name: u.username,
      username: u.username,
      email: u.email || '',
      role: cleanRole(u.role),
      two_factor_enabled: u.two_factor_enabled !== false,
      created_at: u.created_at
    }));

    res.json({ admins: list });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/auth/admins — create new admin ──────────────────
router.post('/admins', requireAuth, requireOwner, async (req, res) => {
  try {
    const { name, email, password, role = 'ecomm_admin', two_factor_enabled = true } = req.body || {};
    if (!name || !password) {
      return res.status(400).json({ error: 'Name and password required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const cleanUsername = String(name).trim().toLowerCase().replace(/\s+/g, '_');
    const hash = await bcrypt.hash(password, 10);
    const assignedRole = cleanRole(role);

    const { data, error } = await supabase
      .from('admins')
      .insert({
        username: cleanUsername,
        email: email ? String(email).trim() : '',
        password_hash: hash,
        role: assignedRole,
        two_factor_enabled: Boolean(two_factor_enabled)
      })
      .select('id, username, email, role, two_factor_enabled, created_at')
      .single();

    if (error) throw new Error(error.message);

    logActivity({
      admin_name: req.user?.username || 'Owner',
      admin_email: req.user?.email || '',
      action: 'admin_created',
      details: `Created new admin '${data.username}' with role '${assignedRole}'`
    }).catch(() => {});

    res.status(201).json({
      ok: true,
      admin: {
        id: data.id,
        name: data.username,
        username: data.username,
        email: data.email || '',
        role: cleanRole(data.role),
        two_factor_enabled: data.two_factor_enabled !== false,
        created_at: data.created_at
      }
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ── PATCH /api/auth/admins/:id/role — change role ─────────────
router.patch('/admins/:id/role', requireAuth, requireOwner, async (req, res) => {
  try {
    const newRole = cleanRole(req.body.role);
    const targetId = req.params.id;

    const { error } = await supabase
      .from('admins')
      .update({ role: newRole })
      .eq('id', targetId);

    if (error) throw new Error(error.message);

    logActivity({
      admin_name: req.user?.username || 'Owner',
      admin_email: req.user?.email || '',
      action: 'admin_role_updated',
      details: `Changed role of admin ID ${targetId} to '${newRole}'`
    }).catch(() => {});

    res.json({ ok: true, role: newRole });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── PATCH /api/auth/admins/:id/2fa — toggle 2FA ───────────────
router.patch('/admins/:id/2fa', requireAuth, requireOwner, async (req, res) => {
  try {
    const enabled = Boolean(req.body.two_factor_enabled);
    const targetId = req.params.id;

    const { error } = await supabase
      .from('admins')
      .update({ two_factor_enabled: enabled })
      .eq('id', targetId);

    if (error) throw new Error(error.message);

    logActivity({
      admin_name: req.user?.username || 'Owner',
      admin_email: req.user?.email || '',
      action: 'admin_2fa_toggled',
      details: `Set 2FA to ${enabled} for admin ID ${targetId}`
    }).catch(() => {});

    res.json({ ok: true, two_factor_enabled: enabled });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── DELETE /api/auth/admins/:id — remove admin ────────────────
router.delete('/admins/:id', requireAuth, requireOwner, async (req, res) => {
  try {
    const targetId = req.params.id;
    if (String(req.user?.id) === String(targetId)) {
      return res.status(400).json({ error: 'You cannot remove your own admin account.' });
    }

    const { error } = await supabase
      .from('admins')
      .delete()
      .eq('id', targetId);

    if (error) throw new Error(error.message);

    logActivity({
      admin_name: req.user?.username || 'Owner',
      admin_email: req.user?.email || '',
      action: 'admin_deleted',
      details: `Removed admin ID ${targetId}`
    }).catch(() => {});

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


// ──────────────────────────────────────────────────────────────
// FORGOT PASSWORD — POST /api/auth/forgot-password
// Generates a 6-digit OTP, stores it, sends via email if configured
// Also returns a reset token in the response (for WhatsApp delivery)
// ──────────────────────────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Username or email required' });

    // Find admin
    const { data: admins } = await supabase.from('admins').select('id,username,email,role')
      .or(`username.ilike.${username},email.ilike.${username}`).limit(1);
    
    if (!admins || admins.length === 0) {
      // Security: don't reveal if account exists — still return ok
      return res.json({ ok: true, message: 'If that account exists, a reset code has been sent.' });
    }

    const admin = admins[0];

    // Generate 6-digit OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min

    // Store OTP in memory (and try Supabase if table exists)
    memoryOtps.set(`reset_${admin.id}`, { otp, expiresAt, adminId: admin.id });
    await supabase.from('admin_otp').upsert({
      admin_id: admin.id, otp_code: otp, expires_at: expiresAt, used: false
    }, { onConflict: 'admin_id' }).catch(() => {});

    // Try send email if SMTP configured
    const emailUser = process.env.EMAIL_USER || process.env.SMTP_USER;
    const emailPass = process.env.EMAIL_PASS || process.env.SMTP_PASS;
    let emailSent = false;
    if (emailUser && emailPass && emailPass !== 'your_gmail_app_password_here' && admin.email) {
      try {
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: emailUser, pass: emailPass } });
        await transporter.sendMail({
          from: `"Pinnacles Farm" <${emailUser}>`,
          to: admin.email,
          subject: '🔐 Your Pinnacles Admin Reset Code',
          html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px">
            <h2 style="color:#1b4332">🌾 Pinnacles Farm — Password Reset</h2>
            <p>Hello <strong>${admin.username}</strong>,</p>
            <p>Your one-time reset code is:</p>
            <div style="background:#f0faf4;border:2px solid #52b788;border-radius:12px;padding:20px;text-align:center;margin:20px 0">
              <span style="font-size:2.5rem;font-weight:800;letter-spacing:.2em;color:#1b4332">${otp}</span>
            </div>
            <p style="color:#6b7280;font-size:.85rem">This code expires in <strong>15 minutes</strong>. Do not share it with anyone.</p>
            <p style="color:#6b7280;font-size:.8rem">— Pinnacles Resource Centre Farm Admin System</p>
          </div>`
        });
        emailSent = true;
      } catch (emailErr) {
        console.error('Reset email failed:', emailErr.message);
      }
    }

    res.json({
      ok: true,
      reset_token: otp, // Show token so it can be delivered via WhatsApp if email fails
      email_sent: emailSent,
      email_to: admin.email ? admin.email.replace(/(.{2})(.*)(@.*)/, '$1***$3') : null,
      message: emailSent
        ? `Reset code sent to ${admin.email.replace(/(.{2})(.*)(@.*)/, '$1***$3')}. Expires in 15 minutes.`
        : `Your reset code is: ${otp}. Use it within 15 minutes.`,
      expires_in_minutes: 15
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ──────────────────────────────────────────────────────────────
// RESET PASSWORD — POST /api/auth/reset-password
// Verifies OTP then sets new password
// ──────────────────────────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  try {
    const { username, otp, new_password } = req.body;
    if (!username || !otp || !new_password) {
      return res.status(400).json({ error: 'username, otp, and new_password are required' });
    }
    if (new_password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Find admin
    const { data: admins } = await supabase.from('admins').select('id,username,email,role')
      .or(`username.ilike.${username},email.ilike.${username}`).limit(1);
    if (!admins || admins.length === 0) return res.status(404).json({ error: 'Account not found' });
    const admin = admins[0];

    // Check OTP — memory first, then Supabase
    let otpValid = false;
    const memOtp = memoryOtps.get(`reset_${admin.id}`);
    if (memOtp && memOtp.otp === String(otp).trim() && new Date(memOtp.expiresAt) > new Date()) {
      otpValid = true;
      memoryOtps.delete(`reset_${admin.id}`);
    } else {
      // Try Supabase
      const { data: dbOtp } = await supabase.from('admin_otp')
        .select('*').eq('admin_id', admin.id).eq('otp_code', String(otp).trim())
        .eq('used', false).gte('expires_at', new Date().toISOString()).maybeSingle();
      if (dbOtp) {
        otpValid = true;
        await supabase.from('admin_otp').update({ used: true }).eq('admin_id', admin.id).catch(() => {});
      }
    }

    if (!otpValid) return res.status(400).json({ error: 'Invalid or expired reset code. Request a new one.' });

    // Set new password
    const hash = bcrypt.hashSync(new_password, 10);
    const { error: updateErr } = await supabase.from('admins')
      .update({ password_hash: hash, status: 'active' }).eq('id', admin.id);
    if (updateErr) throw new Error(updateErr.message);

    logActivity({ admin_name: admin.username, admin_email: admin.email || '', action: 'password_reset', details: 'Password reset via forgot-password flow' }).catch(() => {});

    res.json({ ok: true, message: '✅ Password updated successfully! You can now log in.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ──────────────────────────────────────────────────────────────
// CHANGE PASSWORD — POST /api/auth/change-password  (requires login)
// ──────────────────────────────────────────────────────────────
router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'current_password and new_password required' });
    }
    if (new_password.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    const { data: admin } = await supabase.from('admins')
      .select('id,username,email,password_hash').eq('id', req.user.id).single();
    if (!admin) return res.status(404).json({ error: 'Account not found' });

    if (!bcrypt.compareSync(String(current_password), admin.password_hash)) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    if (current_password === new_password) {
      return res.status(400).json({ error: 'New password must be different from current password' });
    }

    const hash = bcrypt.hashSync(new_password, 10);
    const { error } = await supabase.from('admins').update({ password_hash: hash }).eq('id', admin.id);
    if (error) throw new Error(error.message);

    logActivity({ admin_name: admin.username, admin_email: admin.email || '', action: 'password_changed', details: 'Admin changed their own password' }).catch(() => {});

    res.json({ ok: true, message: '✅ Password changed successfully!' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


module.exports = router;
