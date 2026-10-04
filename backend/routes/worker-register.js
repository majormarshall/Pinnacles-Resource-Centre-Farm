// backend/routes/worker-register.js
const express  = require('express');
const router   = express.Router();
const supabase = require('../db');
const bcrypt   = require('bcryptjs');

// POST /api/worker-register — worker submits registration request
router.post('/', async (req, res) => {
  const { name, email, phone, role, password } = req.body;
  if (!name || !password)
    return res.status(400).json({ error: 'Name and password are required.' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });

  try {
    // Check if already registered (use maybeSingle to avoid PGRST116 error)
    if (email) {
      const { data: existing } = await supabase
        .from('worker_registrations')
        .select('id')
        .eq('email', email)
        .maybeSingle();
      if (existing)
        return res.status(409).json({ error: 'A registration with this email already exists.' });
    }

    const hash = bcrypt.hashSync(password, 10);
    const { error } = await supabase
      .from('worker_registrations')
      .insert({
        full_name:     name,
        email:         email || null,
        phone:         phone || null,
        job_title:     role  || 'Farm Worker',
        password_hash: hash,
        status:        'pending',
      });
    if (error) throw new Error(error.message);
    res.json({ ok: true, message: 'Registration submitted! Your account is pending approval by the farm manager.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/worker-register/pending — farm manager sees pending workers
router.get('/pending', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('worker_registrations')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    res.json(data || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/worker-register/:id/approve — create admin account + mark approved
router.patch('/:id/approve', async (req, res) => {
  try {
    const { data: reg, error: fetchErr } = await supabase
      .from('worker_registrations')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (fetchErr || !reg) return res.status(404).json({ error: 'Registration not found' });

    // Generate a clean username
    const username = (reg.full_name || 'worker')
      .toLowerCase().replace(/\s+/g, '_') + '_' + Date.now().toString().slice(-4);

// Insert minimal record into admins (only guaranteed columns)
    const { error: insertErr } = await supabase
      .from('admins')
      .insert({ username, password_hash: reg.password_hash, role: 'farm_worker' });
    if (insertErr) throw new Error(insertErr.message);

    // ALSO add to farm_workers so they appear in Farm Ops attendance & payroll
    await supabase.from('farm_workers').insert({
      name: reg.full_name || username,
      role: reg.job_title || 'farm_worker',
      phone: reg.phone || null,
      hire_date: new Date().toISOString().split('T')[0]
    });

    // Mark registration as approved
    await supabase.from('worker_registrations')
      .update({ status: 'approved' }).eq('id', req.params.id);

    res.json({ ok: true, username, message: 'Worker approved. They can now log in with username: ' + username });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/worker-register/:id/reject — delete pending registration
router.patch('/:id/reject', async (req, res) => {
  try {
    const { error } = await supabase
      .from('worker_registrations')
      .delete()
      .eq('id', req.params.id);
    if (error) throw new Error(error.message);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
