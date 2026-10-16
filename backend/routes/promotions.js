
const express  = require('express');
const router   = express.Router();
const supabase = require('../db');
const { requireAuth } = require('../middleware/auth');

// GET /api/promotions/active-flash-sale — public
router.get('/active-flash-sale', async (req, res) => {
  try {
    const now = new Date().toISOString();
    const { data, error } = await supabase.from('flash_sales')
      .select('*').eq('active', true)
      .lte('starts_at', now).gte('ends_at', now)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    res.json(data || null);
  } catch (e) { res.json(null); }
});

// GET /api/promotions/flash-sales — admin list
router.get('/flash-sales', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.from('flash_sales').select('*').order('created_at', { ascending: false });
    if (error) {
      if (error.code === '42P01' || error.message?.includes('schema cache')) return res.json([]);
      throw error;
    }
    res.json(data || []);
  } catch (e) {
    if (e.message?.includes('schema cache') || e.message?.includes('does not exist')) return res.json([]);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/promotions/flash-sale — admin create
router.post('/flash-sale', requireAuth, async (req, res) => {
  try {
    const { title, discount_percent, applies_to = 'all', starts_at, ends_at } = req.body;
    if (!title || !discount_percent || !ends_at) return res.status(400).json({ error: 'title, discount_percent, ends_at required' });
    const { data, error } = await supabase.from('flash_sales')
      .insert({ title, discount_percent: parseInt(discount_percent), applies_to, starts_at: starts_at || new Date().toISOString(), ends_at, active: true, created_by: req.user?.name || 'Admin' })
      .select('id').single();
    if (error) throw error;
    res.json({ id: data.id, ...req.body });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/promotions/flash-sale/:id/end — admin end sale
router.patch('/flash-sale/:id/end', requireAuth, async (req, res) => {
  try {
    const { error } = await supabase.from('flash_sales').update({ active: false }).eq('id', req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/promotions/validate-code — public: validate a discount code
router.post('/validate-code', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Code required' });
    const { data, error } = await supabase.from('discount_codes')
      .select('*').eq('code', code.toUpperCase()).eq('active', true).maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Invalid or expired code' });
    if (data.expires_at && new Date(data.expires_at) < new Date()) return res.status(400).json({ error: 'This code has expired' });
    if (data.uses_count >= data.max_uses) return res.status(400).json({ error: 'This code has reached its usage limit' });
    res.json({ valid: true, type: data.type, value: data.value, min_order: data.min_order, code: data.code });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/promotions/codes — admin list
router.get('/codes', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.from('discount_codes').select('*').order('created_at', { ascending: false });
    if (error) {
      if (error.code === '42P01' || error.message?.includes('schema cache')) return res.json([]);
      throw error;
    }
    res.json(data || []);
  } catch (e) {
    if (e.message?.includes('schema cache') || e.message?.includes('does not exist')) return res.json([]);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/promotions/codes — admin create
router.post('/codes', requireAuth, async (req, res) => {
  try {
    const { code, type = 'percent', value = 10, min_order = 0, max_uses = 100, expires_at } = req.body;
    if (!code) return res.status(400).json({ error: 'Code required' });
    const { data, error } = await supabase.from('discount_codes')
      .insert({ code: code.toUpperCase(), type, value: parseFloat(value), min_order: parseFloat(min_order), max_uses: parseInt(max_uses), expires_at: expires_at || null, active: true })
      .select('id').single();
    if (error) throw error;
    res.json({ id: data.id, ...req.body });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/promotions/codes/:id — toggle active
router.patch('/codes/:id', requireAuth, async (req, res) => {
  try {
    const { active } = req.body;
    const { error } = await supabase.from('discount_codes').update({ active: !!active }).eq('id', req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/promotions/tracking — order tracking (public)
router.get('/track', async (req, res) => { res.json({ ok: true }); }); // placeholder

module.exports = router;
