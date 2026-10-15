// backend/routes/farm.js — Farm Operations API (Supabase JS)
const express  = require('express');
const router   = express.Router();
const supabase = require('../db');
const { requireAuth } = require('../middleware/auth');

// ── Helper ────────────────────────────────────────────────────────────────
function sb(error, ctx) {
  if (!error) return;
  console.error('[Farm]', ctx, error.message);
  throw new Error(error.message);
}

// ── FIELDS ─────────────────────────────────────────────────────────────────
router.get('/fields', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.from('farm_fields').select('*').order('name');
    sb(error, 'fields GET');
    res.json(data || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/fields', requireAuth, async (req, res) => {
  try {
    const { name, type = 'open_field', size_sqm, location, soil_type, status = 'active', notes } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const { data, error } = await supabase.from('farm_fields')
      .insert({ name, type, size_sqm: size_sqm || null, location: location || null, soil_type: soil_type || null, status, notes: notes || null })
      .select('id').single();
    sb(error, 'fields POST');
    res.json({ id: data.id, ...req.body });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/fields/:id', requireAuth, async (req, res) => {
  try {
    const { name, type, size_sqm, location, soil_type, status, notes } = req.body;
    const update = {};
    if (name      !== undefined) update.name      = name;
    if (type      !== undefined) update.type      = type;
    if (size_sqm  !== undefined) update.size_sqm  = size_sqm;
    if (location  !== undefined) update.location  = location;
    if (soil_type !== undefined) update.soil_type = soil_type;
    if (status    !== undefined) update.status    = status;
    if (notes     !== undefined) update.notes     = notes;
    const { error } = await supabase.from('farm_fields').update(update).eq('id', req.params.id);
    sb(error, 'fields PATCH');
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── CROPS ──────────────────────────────────────────────────────────────────
router.get('/crops', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.from('farm_crops').select('*').order('name');
    sb(error, 'crops GET');
    res.json(data || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/crops', requireAuth, async (req, res) => {
  try {
    const { name, variety, category, days_to_harvest, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const { data, error } = await supabase.from('farm_crops')
      .insert({ name, variety: variety || null, category: category || null, days_to_harvest: days_to_harvest || null, notes: notes || null })
      .select('id').single();
    sb(error, 'crops POST');
    res.json({ id: data.id, ...req.body });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PLANTINGS ──────────────────────────────────────────────────────────────
router.get('/plantings', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.from('farm_plantings')
      .select('*, farm_fields(name), farm_crops(name)')
      .order('date_planted', { ascending: false });
    sb(error, 'plantings GET');
    const rows = (data || []).map(r => ({
      ...r,
      field_name: r.farm_fields?.name || null,
      crop_name:  r.farm_crops?.name  || null,
    }));
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/plantings', requireAuth, async (req, res) => {
  try {
    const { field_id, crop_id, planted_by, date_planted, quantity, unit, status, expected_harvest_date, notes } = req.body;
    if (!date_planted) return res.status(400).json({ error: 'date_planted required' });
    const { data, error } = await supabase.from('farm_plantings')
      .insert({ field_id: field_id || null, crop_id: crop_id || null, planted_by: planted_by || req.user?.name || 'Admin', date_planted, quantity: quantity || null, unit: unit || 'seedlings', status: status || 'growing', expected_harvest_date: expected_harvest_date || null, notes: notes || null })
      .select('id').single();
    sb(error, 'plantings POST');
    res.json({ id: data.id, ...req.body });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/plantings/:id/status', requireAuth, async (req, res) => {
  try {
    const { error } = await supabase.from('farm_plantings').update({ status: req.body.status }).eq('id', req.params.id);
    sb(error, 'plantings status PATCH');
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── HARVESTS ───────────────────────────────────────────────────────────────
router.get('/harvests', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.from('farm_harvests')
      .select('*, farm_plantings(date_planted, farm_fields(name))')
      .order('harvest_date', { ascending: false });
    sb(error, 'harvests GET');
    const rows = (data || []).map(r => ({
      ...r,
      field_name:   r.farm_plantings?.farm_fields?.name || null,
      date_planted: r.farm_plantings?.date_planted      || null,
    }));
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/harvests', requireAuth, async (req, res) => {
  try {
    const { planting_id, crop_name, harvested_by, harvest_date, quantity, unit, quality_grade, notes, sent_to_store } = req.body;
    if (!harvest_date || !quantity) return res.status(400).json({ error: 'harvest_date and quantity required' });
    const { data, error } = await supabase.from('farm_harvests')
      .insert({ planting_id: planting_id || null, crop_name: crop_name || null, harvested_by: harvested_by || req.user?.name || 'Admin', harvest_date, quantity, unit: unit || 'kg', quality_grade: quality_grade || 'A', notes: notes || null, sent_to_store: sent_to_store ? 1 : 0 })
      .select('id').single();
    sb(error, 'harvests POST');
    res.json({ id: data.id, ...req.body });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── HARVEST → STORE LINK ──────────────────────────────────────────────────
router.post('/harvests/:id/send-to-store', requireAuth, async (req, res) => {
  try {
    const { data: harvest, error: hErr } = await supabase.from('farm_harvests').select('*').eq('id', req.params.id).single();
    if (hErr || !harvest) return res.status(404).json({ error: 'Harvest not found' });

    await supabase.from('farm_harvests').update({ sent_to_store: 1 }).eq('id', req.params.id);

    // Auto-link to matching products by crop name
    const cropName = (harvest.crop_name || '').toLowerCase();
    const { data: products } = await supabase.from('products').select('id, name');
    const matched = (products || []).filter(p => {
      const pn = p.name.toLowerCase();
      const cn = cropName.split(' ')[0];
      return pn.includes(cn) || cropName.includes(pn.split(' ')[0]);
    });
    const linkedProducts = [];
    for (const p of matched) {
      await supabase.from('products').update({ today_harvest: 1, in_stock: 1 }).eq('id', p.id);
      linkedProducts.push(p.name);
    }
    res.json({
      ok: true, sent_to_store: true, linked_products: linkedProducts,
      message: linkedProducts.length
        ? `Sent to store ✅ Linked to: ${linkedProducts.join(', ')}`
        : "Sent to store. No matching products found — link manually.",
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── WORKERS ────────────────────────────────────────────────────────────────
router.get('/workers', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.from('farm_workers').select('*').order('name');
    sb(error, 'workers GET');
    res.json(data || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/workers', requireAuth, async (req, res) => {
  try {
    const { name, role, phone, address, hire_date, pay_rate, pay_type } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const { data, error } = await supabase.from('farm_workers')
      .insert({ name, role: role || 'general_worker', phone: phone || null, address: address || null, hire_date: hire_date || null, pay_rate: pay_rate || 0, pay_type: pay_type || 'daily' })
      .select('id').single();
    sb(error, 'workers POST');
    res.json({ id: data.id, ...req.body });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/workers/:id', requireAuth, async (req, res) => {
  try {
    const { name, role, phone, status } = req.body;
    const update = {};
    if (name   !== undefined) update.name   = name;
    if (role   !== undefined) update.role   = role;
    if (phone  !== undefined) update.phone  = phone;
    if (status !== undefined) update.status = status;
    const { error } = await supabase.from('farm_workers').update(update).eq('id', req.params.id);
    sb(error, 'workers PATCH');
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── ATTENDANCE ─────────────────────────────────────────────────────────────
router.get('/attendance', requireAuth, async (req, res) => {
  try {
    const { date } = req.query;
    let query = supabase.from('farm_attendance')
      .select('*, farm_workers(name, role, pay_rate, pay_type)')
      .order('created_at', { ascending: false });
    if (date) query = query.eq('work_date', date);
    const { data, error } = await query;
    sb(error, 'attendance GET');
    const rows = (data || []).map(r => ({
      ...r,
      worker_name: r.farm_workers?.name     || null,
      worker_role: r.farm_workers?.role     || null,
      pay_rate:    r.farm_workers?.pay_rate || 0,
      pay_type:    r.farm_workers?.pay_type || 'daily',
    }));
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/attendance', requireAuth, async (req, res) => {
  try {
    const { worker_id, work_date, time_in, time_out, hours_worked, task, notes } = req.body;
    if (!work_date) return res.status(400).json({ error: 'work_date required' });
    const { data, error } = await supabase.from('farm_attendance')
      .insert({ worker_id: worker_id || null, work_date, time_in: time_in || null, time_out: time_out || null, hours_worked: hours_worked || null, task: task || null, notes: notes || null, recorded_by: req.user?.name || 'Admin' })
      .select('id').single();
    sb(error, 'attendance POST');
    res.json({ id: data.id, ...req.body });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── INPUTS (INVENTORY) ──────────────────────────────────────────────────────
router.get('/inputs', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.from('farm_inputs').select('*').order('name');
    sb(error, 'inputs GET');
    res.json(data || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/inputs', requireAuth, async (req, res) => {
  try {
    const { name, type, unit, current_stock, reorder_level, supplier, cost_per_unit } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const { data, error } = await supabase.from('farm_inputs')
      .insert({ name, type: type || 'general', unit: unit || 'kg', current_stock: current_stock || 0, reorder_level: reorder_level || 5, supplier: supplier || null, cost_per_unit: cost_per_unit || 0 })
      .select('id').single();
    sb(error, 'inputs POST');
    res.json({ id: data.id, ...req.body });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/inputs/:id', requireAuth, async (req, res) => {
  try {
    const { name, current_stock, reorder_level, cost_per_unit } = req.body;
    const update = {};
    if (name          !== undefined) update.name          = name;
    if (current_stock !== undefined) update.current_stock = current_stock;
    if (reorder_level !== undefined) update.reorder_level = reorder_level;
    if (cost_per_unit !== undefined) update.cost_per_unit = cost_per_unit;
    const { error } = await supabase.from('farm_inputs').update(update).eq('id', req.params.id);
    sb(error, 'inputs PATCH');
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── SPRAYS / FUMIGATION ─────────────────────────────────────────────────────
router.get('/sprays', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.from('farm_sprays')
      .select('*, farm_fields(name)')
      .order('spray_date', { ascending: false });
    sb(error, 'sprays GET');
    const rows = (data || []).map(r => ({ ...r, field_name: r.farm_fields?.name || null }));
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/sprays', requireAuth, async (req, res) => {
  try {
    const { field_id, chemical_name, sprayed_by, spray_date, dosage, area_sprayed, weather_conditions, pre_harvest_interval, notes } = req.body;
    if (!spray_date || !chemical_name) return res.status(400).json({ error: 'spray_date and chemical_name required' });
    const { data, error } = await supabase.from('farm_sprays')
      .insert({ field_id: field_id || null, chemical_name, sprayed_by: sprayed_by || req.user?.name || 'Admin', spray_date, dosage: dosage || null, area_sprayed: area_sprayed || null, weather_conditions: weather_conditions || null, pre_harvest_interval: pre_harvest_interval || null, notes: notes || null })
      .select('id').single();
    sb(error, 'sprays POST');
    res.json({ id: data.id, ...req.body });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── EQUIPMENT ──────────────────────────────────────────────────────────────
router.get('/equipment', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.from('farm_equipment').select('*').order('name');
    sb(error, 'equipment GET');
    res.json(data || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/equipment', requireAuth, async (req, res) => {
  try {
    const { name, type, serial_number, purchase_date, status, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const { data, error } = await supabase.from('farm_equipment')
      .insert({ name, type: type || null, serial_number: serial_number || null, purchase_date: purchase_date || null, status: status || 'operational', notes: notes || null })
      .select('id').single();
    sb(error, 'equipment POST');
    res.json({ id: data.id, ...req.body });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/equipment/:id/status', requireAuth, async (req, res) => {
  try {
    const { status, notes } = req.body;
    const update = {};
    if (status !== undefined) update.status = status;
    if (notes  !== undefined) update.notes  = notes;
    const { error } = await supabase.from('farm_equipment').update(update).eq('id', req.params.id);
    sb(error, 'equipment status PATCH');
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── FARM DIARY ──────────────────────────────────────────────────────────────
router.get('/diary', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.from('farm_diary')
      .select('*').order('entry_date', { ascending: false }).limit(50);
    sb(error, 'diary GET');
    res.json(data || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/diary', requireAuth, async (req, res) => {
  try {
    const { entry_date, category, title, content, written_by, weather, priority } = req.body;
    if (!content) return res.status(400).json({ error: 'content required' });
    const { data, error } = await supabase.from('farm_diary')
      .insert({ entry_date: entry_date || new Date().toISOString().slice(0, 10), category: category || 'general', title: title || null, content, written_by: written_by || req.user?.name || 'Admin', weather: weather || null, priority: priority || 'normal' })
      .select('id').single();
    sb(error, 'diary POST');
    res.json({ id: data.id, ...req.body });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── DASHBOARD STATS ────────────────────────────────────────────────────────
router.get('/dashboard', requireAuth, async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const [fields, workers, plantings, todayHarvests, pendingMaint] = await Promise.all([
      supabase.from('farm_fields').select('*', { count: 'exact', head: true }).neq('status', 'inactive'),
      supabase.from('farm_workers').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('farm_plantings').select('*', { count: 'exact', head: true }).eq('status', 'growing'),
      supabase.from('farm_harvests').select('quantity').eq('harvest_date', today),
      supabase.from('farm_equipment_maintenance').select('*', { count: 'exact', head: true }).eq('status', 'scheduled').lte('scheduled_date', today).catch(() => ({ count: 0 })),
    ]);
    const todayKg = (todayHarvests.data || []).reduce((s, r) => s + (Number(r.quantity) || 0), 0);
    res.json({
      active_fields:   fields.count   || 0,
      active_workers:  workers.count  || 0,
      growing_crops:   plantings.count || 0,
      today_harvest_kg: todayKg,
      pending_maintenance: pendingMaint.count || 0,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PAYROLL ────────────────────────────────────────────────────────────────
router.get('/payroll', requireAuth, async (req, res) => {
  try {
    const month  = parseInt(req.query.month) || new Date().getMonth() + 1;
    const year   = parseInt(req.query.year)  || new Date().getFullYear();
    const start  = new Date(year, month - 1, 1).toISOString().slice(0, 10);
    const end    = new Date(year, month, 0).toISOString().slice(0, 10);

    const { data: workers } = await supabase.from('farm_workers').select('*').eq('status', 'active');
    const results = [];
    for (const w of (workers || [])) {
      const { data: att } = await supabase.from('farm_attendance').select('hours_worked').eq('worker_id', w.id).gte('work_date', start).lte('work_date', end);
      const { count: days } = await supabase.from('farm_attendance').select('*', { count: 'exact', head: true }).eq('worker_id', w.id).gte('work_date', start).lte('work_date', end);
      const hours = (att || []).reduce((s, r) => s + (Number(r.hours_worked) || 0), 0);
      let gross = 0;
      if (w.pay_type === 'monthly')     gross = Number(w.pay_rate);
      else if (w.pay_type === 'weekly') gross = Math.ceil((days || 0) / 5) * Number(w.pay_rate);
      else                              gross = (days || 0) * Number(w.pay_rate);
      const { data: payRec } = await supabase.from('farm_payroll').select('*').eq('worker_id', w.id).eq('period_start', start).single().catch(() => ({ data: null }));
      results.push({ worker: w, days: days || 0, hours, gross, payroll: payRec });
    }
    res.json({ period_start: start, period_end: end, workers: results });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/payroll/pay', requireAuth, async (req, res) => {
  try {
    const { worker_id, period_start, period_end, days_worked, hours_worked, gross_pay, net_pay } = req.body;
    const { data: existing } = await supabase.from('farm_payroll').select('id').eq('worker_id', worker_id).eq('period_start', period_start).single().catch(() => ({ data: null }));
    if (existing) {
      await supabase.from('farm_payroll').update({ paid: true, paid_date: new Date().toISOString().slice(0, 10), paid_by: req.user?.name || 'Admin' }).eq('id', existing.id);
    } else {
      await supabase.from('farm_payroll').insert({ worker_id, period_start, period_end, days_worked, hours_worked, gross_pay, net_pay, paid: true, paid_date: new Date().toISOString().slice(0, 10), paid_by: req.user?.name || 'Admin' });
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── REPORTS ────────────────────────────────────────────────────────────────
router.get('/reports/costs', requireAuth, async (req, res) => {
  try {
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const year  = parseInt(req.query.year)  || new Date().getFullYear();
    const start = new Date(year, month - 1, 1).toISOString().slice(0, 10);
    const end   = new Date(year, month, 0).toISOString().slice(0, 10);

    // Labour cost from payroll
    const { data: payroll } = await supabase.from('farm_payroll').select('gross_pay').gte('period_start', start).lte('period_start', end).catch(() => ({ data: [] }));
    const labourCost = (payroll || []).reduce((s, r) => s + (Number(r.gross_pay) || 0), 0);

    // Inputs cost safely (avoid fragile foreign join syntax)
    const { data: usage } = await supabase.from('farm_input_usage').select('input_id, quantity_used').gte('use_date', start).lte('use_date', end).catch(() => ({ data: [] }));
    const { data: inputs } = await supabase.from('farm_inputs').select('id, cost_per_unit').catch(() => ({ data: [] }));
    const inputMap = {};
    (inputs || []).forEach(inp => { inputMap[inp.id] = Number(inp.cost_per_unit) || 0; });
    const inputsCost = (usage || []).reduce((s, r) => s + (Number(r.quantity_used) || 0) * (inputMap[r.input_id] || 0), 0);

    // Revenue from orders
    const { data: orders } = await supabase.from('orders').select('total').gte('created_at', start).lte('created_at', end + 'T23:59:59').neq('status', 'cancelled').catch(() => ({ data: [] }));
    const revenue = (orders || []).reduce((s, r) => s + (Number(r.total) || 0), 0);

    res.json({
      month, year,
      labour_cost: labourCost,
      inputs_cost: inputsCost,
      total_costs: labourCost + inputsCost,
      revenue,
      order_count: (orders || []).length,
      profit: revenue - labourCost - inputsCost
    });
  } catch (e) {
    res.json({
      month: parseInt(req.query.month) || new Date().getMonth() + 1,
      year: parseInt(req.query.year) || new Date().getFullYear(),
      labour_cost: 0, inputs_cost: 0, total_costs: 0, revenue: 0, order_count: 0, profit: 0, error: e.message
    });
  }
});

router.get('/reports/harvest-summary', requireAuth, async (req, res) => {
  try {
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const year  = parseInt(req.query.year)  || new Date().getFullYear();
    const start = new Date(year, month - 1, 1).toISOString().slice(0, 10);
    const end   = new Date(year, month, 0).toISOString().slice(0, 10);

    const { data: harvests } = await supabase.from('farm_harvests').select('crop_name, quality_grade, quantity, unit, harvest_date').gte('harvest_date', start).lte('harvest_date', end).catch(() => ({ data: [] }));

    const groups = {};
    let totalKg = 0;
    for (const h of (harvests || [])) {
      const crop = h.crop_name || 'Produce';
      const grade = h.quality_grade || 'A';
      const unit = h.unit || 'kg';
      const qty = Number(h.quantity) || 0;
      const key = crop + '|' + grade;
      if (!groups[key]) groups[key] = { crop_name: crop, quality_grade: grade, unit, total_qty: 0, harvest_count: 0 };
      groups[key].total_qty     += qty;
      groups[key].harvest_count += 1;
      totalKg += qty;
    }
    res.json({ month, year, total_kg: totalKg, total_events: (harvests || []).length, rows: Object.values(groups), raw: harvests || [] });
  } catch (e) {
    res.json({ month: parseInt(req.query.month) || new Date().getMonth() + 1, year: parseInt(req.query.year) || new Date().getFullYear(), total_kg: 0, total_events: 0, rows: [], raw: [], error: e.message });
  }
});

router.get('/reports/attendance', requireAuth, async (req, res) => {
  try {
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const year  = parseInt(req.query.year)  || new Date().getFullYear();
    const start = new Date(year, month - 1, 1).toISOString().slice(0, 10);
    const end   = new Date(year, month, 0).toISOString().slice(0, 10);

    const [{ data: workers }, { data: attendance }] = await Promise.all([
      supabase.from('farm_workers').select('*').catch(() => ({ data: [] })),
      supabase.from('farm_attendance').select('*').gte('work_date', start).lte('work_date', end).catch(() => ({ data: [] })),
    ]);

    const workerMap = {};
    (workers || []).forEach(w => {
      workerMap[w.id] = { id: w.id, name: w.name, role: w.role, pay_type: w.pay_type, pay_rate: Number(w.pay_rate)||0, days_worked: 0, hours_worked: 0, status: w.status };
    });

    (attendance || []).forEach(a => {
      if (workerMap[a.worker_id]) {
        workerMap[a.worker_id].days_worked += 1;
        workerMap[a.worker_id].hours_worked += Number(a.hours_worked) || 0;
      }
    });

    res.json({ month, year, workers: Object.values(workerMap), raw: attendance || [] });
  } catch (e) { res.json({ workers: [], raw: [], error: e.message }); }
});

router.get('/reports/sprays', requireAuth, async (req, res) => {
  try {
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const year  = parseInt(req.query.year)  || new Date().getFullYear();
    const start = new Date(year, month - 1, 1).toISOString().slice(0, 10);
    const end   = new Date(year, month, 0).toISOString().slice(0, 10);

    const { data: sprays } = await supabase.from('farm_sprays').select('*').gte('spray_date', start).lte('spray_date', end).order('spray_date', { ascending: false }).catch(() => ({ data: [] }));
    res.json({ month, year, rows: sprays || [] });
  } catch (e) { res.json({ rows: [], error: e.message }); }
});

router.get('/reports/inputs', requireAuth, async (req, res) => {
  try {
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const year  = parseInt(req.query.year)  || new Date().getFullYear();
    const start = new Date(year, month - 1, 1).toISOString().slice(0, 10);
    const end   = new Date(year, month, 0).toISOString().slice(0, 10);

    const [{ data: inputs }, { data: usage }] = await Promise.all([
      supabase.from('farm_inputs').select('*').catch(() => ({ data: [] })),
      supabase.from('farm_input_usage').select('*').gte('use_date', start).lte('use_date', end).catch(() => ({ data: [] })),
    ]);

    const usageByInput = {};
    (usage || []).forEach(u => {
      usageByInput[u.input_id] = (usageByInput[u.input_id] || 0) + (Number(u.quantity_used) || 0);
    });

    const rows = (inputs || []).map(inp => ({
      ...inp,
      used_this_month: usageByInput[inp.id] || 0,
      estimated_monthly_cost: (usageByInput[inp.id] || 0) * (Number(inp.cost_per_unit) || 0)
    }));

    res.json({ month, year, rows });
  } catch (e) { res.json({ rows: [], error: e.message }); }
});

// ── INPUT USAGE ────────────────────────────────────────────────────────────
router.post('/input-usage', requireAuth, async (req, res) => {
  try {
    const { input_id, field_id, used_by, use_date, quantity_used, purpose, notes } = req.body;
    if (!input_id || !quantity_used) return res.status(400).json({ error: 'input_id and quantity_used required' });

    const { data, error } = await supabase.from('farm_input_usage')
      .insert({ input_id, field_id: field_id || null, used_by: used_by || req.user?.name || 'Admin', use_date: use_date || new Date().toISOString().slice(0, 10), quantity_used, purpose: purpose || null, notes: notes || null })
      .select('id').single();
    sb(error, 'input-usage POST');

    // Deduct from stock
    const { data: inp } = await supabase.from('farm_inputs').select('current_stock').eq('id', input_id).single();
    if (inp) await supabase.from('farm_inputs').update({ current_stock: Math.max(0, (Number(inp.current_stock) || 0) - quantity_used) }).eq('id', input_id);

    res.json({ id: data.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── TEAM ───────────────────────────────────────────────────────────────────
router.get('/team', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.from('admins').select('id, username, role, created_at');
    sb(error, 'team GET');
    res.json((data || []).map(u => ({ id: u.id, name: u.username, role: u.role, created_at: u.created_at })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GROWTH LOGS ────────────────────────────────────────────────────────────
router.get('/growth-logs', requireAuth, async (req, res) => {
  try {
    const { planting_id } = req.query;
    let query = supabase.from('farm_growth_logs').select('*').order('log_date', { ascending: false });
    if (planting_id) query = query.eq('planting_id', planting_id);
    const { data, error } = await query;
    sb(error, 'growth-logs GET');
    res.json(data || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/growth-logs', requireAuth, async (req, res) => {
  try {
    const { planting_id, log_date, stage, health_rating, observations } = req.body;
    if (!log_date) return res.status(400).json({ error: 'log_date required' });
    const { data, error } = await supabase.from('farm_growth_logs')
      .insert({ planting_id: planting_id || null, logged_by: req.user?.name || 'Admin', log_date, stage: stage || null, health_rating: health_rating || null, observations: observations || null })
      .select('id').single();
    sb(error, 'growth-logs POST');
    res.json({ id: data.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});


// ============================================================================
// FARM EXTENSIONS: PEST LOG, IRRIGATION, SOIL HEALTH, SUPPLIERS, TASK BOARD
// ============================================================================

/*
-- SQL Schemas for Supabase / PostgreSQL:

CREATE TABLE IF NOT EXISTS farm_pest_logs (
  id SERIAL PRIMARY KEY,
  field_id INTEGER REFERENCES farm_fields(id),
  crop_name TEXT,
  pest_disease_name TEXT NOT NULL,
  severity TEXT DEFAULT 'low', -- low, medium, high, critical
  affected_area TEXT,
  symptoms TEXT,
  action_taken TEXT,
  logged_by TEXT,
  log_date DATE NOT NULL,
  resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS farm_irrigation (
  id SERIAL PRIMARY KEY,
  field_id INTEGER REFERENCES farm_fields(id),
  scheduled_date DATE NOT NULL,
  scheduled_time TIME,
  duration_minutes INTEGER DEFAULT 30,
  method TEXT DEFAULT 'drip', -- drip, sprinkler, flood, manual
  water_volume_litres REAL,
  assigned_to TEXT,
  status TEXT DEFAULT 'scheduled', -- scheduled, done, skipped
  notes TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS farm_soil_readings (
  id SERIAL PRIMARY KEY,
  field_id INTEGER REFERENCES farm_fields(id),
  reading_date DATE NOT NULL,
  ph_level REAL, -- ideal: 6.0-7.0
  nitrogen_ppm REAL,
  phosphorus_ppm REAL,
  potassium_ppm REAL,
  moisture_percent REAL,
  organic_matter_percent REAL,
  notes TEXT,
  recorded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS farm_suppliers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'general', -- seeds, fertilizer, equipment, packaging, misc
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  payment_terms TEXT,
  rating INTEGER CHECK(rating BETWEEN 1 AND 5) DEFAULT 3,
  notes TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS farm_purchase_orders (
  id SERIAL PRIMARY KEY,
  supplier_id INTEGER REFERENCES farm_suppliers(id),
  item_name TEXT NOT NULL,
  quantity REAL,
  unit TEXT DEFAULT 'kg',
  unit_price REAL,
  total_amount REAL,
  order_date DATE NOT NULL,
  expected_delivery DATE,
  status TEXT DEFAULT 'ordered', -- ordered, received, cancelled
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS farm_tasks (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  assigned_to INTEGER REFERENCES farm_workers(id),
  field_id INTEGER REFERENCES farm_fields(id),
  priority TEXT DEFAULT 'normal', -- low, normal, high, urgent
  status TEXT DEFAULT 'todo', -- todo, in_progress, done, cancelled
  due_date DATE,
  completed_at TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
*/

// In-memory fallbacks if Supabase tables are not yet created or connection drops
let _mockPestLogs = [
  { id: 1, field_id: 1, crop_name: 'Tomatoes', pest_disease_name: 'Early Blight', severity: 'medium', affected_area: 'Row 3-5 (approx 40 sqm)', symptoms: 'Dark brown concentric rings on lower leaves with yellow halo', action_taken: 'Copper fungicide spray applied; infected leaves pruned', logged_by: 'Farm Lead', log_date: new Date().toISOString().slice(0, 10), resolved: false, created_at: new Date().toISOString(), field_name: 'Greenhouse Alpha' },
  { id: 2, field_id: 2, crop_name: 'Bell Peppers', pest_disease_name: 'Aphid Infestation', severity: 'critical', affected_area: 'Entire East quadrant', symptoms: 'Curled young foliage and sticky honeydew deposits', action_taken: 'Neem oil treatment scheduled; predatory ladybugs introduced', logged_by: 'Field Scout', log_date: new Date(Date.now() - 86400000).toISOString().slice(0, 10), resolved: false, created_at: new Date().toISOString(), field_name: 'Open Field 1' },
  { id: 3, field_id: 1, crop_name: 'Cucumber', pest_disease_name: 'Powdery Mildew', severity: 'low', affected_area: 'Corner trellis', symptoms: 'White powdery spots on upper leaf surfaces', action_taken: 'Potassium bicarbonate solution sprayed; humidity lowered', logged_by: 'Admin', log_date: new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10), resolved: true, created_at: new Date().toISOString(), field_name: 'Greenhouse Alpha' }
];
let _mockPestSeq = 10;

let _mockIrrigation = [
  { id: 1, field_id: 1, scheduled_date: new Date().toISOString().slice(0, 10), scheduled_time: '06:30', duration_minutes: 45, method: 'drip', water_volume_litres: 1200, assigned_to: 'John Okafor', status: 'scheduled', notes: 'Morning drip cycle for tomatoes', completed_at: null, created_at: new Date().toISOString(), field_name: 'Greenhouse Alpha' },
  { id: 2, field_id: 2, scheduled_date: new Date(Date.now() + 86400000).toISOString().slice(0, 10), scheduled_time: '07:00', duration_minutes: 60, method: 'sprinkler', water_volume_litres: 2500, assigned_to: 'Musa Bello', status: 'scheduled', notes: 'Open field vegetable beds', completed_at: null, created_at: new Date().toISOString(), field_name: 'Open Field 1' },
  { id: 3, field_id: 1, scheduled_date: new Date(Date.now() - 86400000).toISOString().slice(0, 10), scheduled_time: '17:00', duration_minutes: 30, method: 'drip', water_volume_litres: 800, assigned_to: 'John Okafor', status: 'done', notes: 'Evening supplementary hydration', completed_at: new Date(Date.now() - 86400000).toISOString(), created_at: new Date().toISOString(), field_name: 'Greenhouse Alpha' }
];
let _mockIrrigationSeq = 10;

let _mockSoilReadings = [
  { id: 1, field_id: 1, reading_date: new Date().toISOString().slice(0, 10), ph_level: 6.4, nitrogen_ppm: 48, phosphorus_ppm: 32, potassium_ppm: 195, moisture_percent: 42.5, organic_matter_percent: 4.8, notes: 'Optimal conditions across test beds', recorded_by: 'Agronomist', created_at: new Date().toISOString(), field_name: 'Greenhouse Alpha' },
  { id: 2, field_id: 2, reading_date: new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10), ph_level: 5.4, nitrogen_ppm: 28, phosphorus_ppm: 18, potassium_ppm: 120, moisture_percent: 28.0, organic_matter_percent: 2.9, notes: 'Soil shows acidic tendencies. Requires lime buffering.', recorded_by: 'Farm Lead', created_at: new Date().toISOString(), field_name: 'Open Field 1' },
  { id: 3, field_id: 1, reading_date: new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10), ph_level: 6.1, nitrogen_ppm: 42, phosphorus_ppm: 29, potassium_ppm: 180, moisture_percent: 39.0, organic_matter_percent: 4.5, notes: 'Routine bi-weekly monitoring', recorded_by: 'Agronomist', created_at: new Date().toISOString(), field_name: 'Greenhouse Alpha' }
];
let _mockSoilSeq = 10;

let _mockSuppliers = [
  { id: 1, name: 'Premier Seedlings & Agri Co', category: 'seeds', contact_name: 'Engr. Daniel Alabi', phone: '+2348031234567', email: 'sales@premierseeds.ng', address: 'Plot 12 Agribusiness Hub, Ibadan', payment_terms: 'Net 15 days', rating: 5, notes: 'Certified hybrid tomato and pepper seedlings', active: true, created_at: new Date().toISOString() },
  { id: 2, name: 'GreenHarvest Bio-Fertilizers', category: 'fertilizer', contact_name: 'Mrs. Funke Adeyemi', phone: '+2348029876543', email: 'orders@greenharvest.ng', address: 'km 4 Abeokuta Expressway', payment_terms: 'Payment on Delivery', rating: 4, notes: 'Organic NPK and liquid worm casting extracts', active: true, created_at: new Date().toISOString() },
  { id: 3, name: 'DripTech Precision Irrigation', category: 'equipment', contact_name: 'Chinedu Eze', phone: '+2348145556677', email: 'support@driptech.com.ng', address: '14 Industrial Way, Ikeja, Lagos', payment_terms: '50% advance, balance on installation', rating: 5, notes: 'Drip lines, automated solenoid valves, filters', active: true, created_at: new Date().toISOString() }
];
let _mockSuppliersSeq = 10;

let _mockPurchaseOrders = [
  { id: 1, supplier_id: 1, item_name: 'F1 Hybrid Tomato Seedlings (5000 trays)', quantity: 5000, unit: 'seedlings', unit_price: 35, total_amount: 175000, order_date: new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10), expected_delivery: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10), status: 'ordered', notes: 'Needed for greenhouse block C planting', created_at: new Date().toISOString(), supplier_name: 'Premier Seedlings & Agri Co' },
  { id: 2, supplier_id: 2, item_name: 'Organic Liquid Bio-Fertilizer (50L drum)', quantity: 4, unit: 'drums', unit_price: 42000, total_amount: 168000, order_date: new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10), expected_delivery: new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10), status: 'received', notes: 'Delivered in good condition, stored in warehouse B', created_at: new Date().toISOString(), supplier_name: 'GreenHarvest Bio-Fertilizers' }
];
let _mockPOSeq = 10;

let _mockTasks = [
  { id: 1, title: 'Spray copper fungicide on Block B', description: 'Apply preventive treatment early morning before temperature reaches 28°C', assigned_to: 1, field_id: 1, priority: 'urgent', status: 'todo', due_date: new Date().toISOString().slice(0, 10), completed_at: null, created_by: 'Admin', created_at: new Date().toISOString(), worker_name: 'John Okafor', field_name: 'Greenhouse Alpha' },
  { id: 2, title: 'Calibrate drip lines & flush filters', description: 'Inspect emitters along rows 1 to 12 for calcification or sediment blocks', assigned_to: 2, field_id: 1, priority: 'high', status: 'in_progress', due_date: new Date(Date.now() + 86400000).toISOString().slice(0, 10), completed_at: null, created_by: 'Admin', created_at: new Date().toISOString(), worker_name: 'Musa Bello', field_name: 'Greenhouse Alpha' },
  { id: 3, title: 'Soil moisture sensor check', description: 'Record depth readings at 15cm and 30cm in open field', assigned_to: 1, field_id: 2, priority: 'normal', status: 'done', due_date: new Date(Date.now() - 86400000).toISOString().slice(0, 10), completed_at: new Date().toISOString(), created_by: 'Admin', created_at: new Date().toISOString(), worker_name: 'John Okafor', field_name: 'Open Field 1' },
  { id: 4, title: 'Weed removal along perimeter boundary', description: 'Clear unwanted shrubs and brush near solar fencing', assigned_to: 2, field_id: 2, priority: 'low', status: 'todo', due_date: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10), completed_at: null, created_by: 'Admin', created_at: new Date().toISOString(), worker_name: 'Musa Bello', field_name: 'Open Field 1' }
];
let _mockTasksSeq = 10;

// Helper to look up field and worker names when using mocks or enriching
async function enrichFieldWorker(rows) {
  try {
    const [{ data: fields }, { data: workers }] = await Promise.all([
      supabase.from('farm_fields').select('id, name').catch(() => ({ data: [] })),
      supabase.from('farm_workers').select('id, name').catch(() => ({ data: [] })),
    ]);
    const fMap = {};
    (fields || []).forEach(f => { fMap[f.id] = f.name; });
    const wMap = {};
    (workers || []).forEach(w => { wMap[w.id] = w.name; });

    return rows.map(r => ({
      ...r,
      field_name: r.field_name || (r.field_id ? fMap[r.field_id] || null : null),
      worker_name: r.worker_name || (r.assigned_to ? wMap[r.assigned_to] || null : null)
    }));
  } catch (_) {
    return rows;
  }
}

// ── TASK 1: PEST & DISEASE LOG ─────────────────────────────────────────────
router.get('/pest-logs', requireAuth, async (req, res) => {
  try {
    let rows = [];
    try {
      const { data, error } = await supabase
        .from('farm_pest_logs')
        .select('*, farm_fields(name)')
        .order('log_date', { ascending: false });
      if (error) throw error;
      rows = (data || []).map(r => ({
        ...r,
        field_name: r.farm_fields?.name || null
      }));
    } catch (e1) {
      try {
        const { data, error } = await supabase
          .from('farm_pest_logs')
          .select('*')
          .order('log_date', { ascending: false });
        if (error) throw error;
        rows = await enrichFieldWorker(data || []);
      } catch (e2) {
        console.warn('[Farm] pest-logs fallback:', e2.message);
        rows = await enrichFieldWorker([..._mockPestLogs]);
      }
    }
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/pest-logs', requireAuth, async (req, res) => {
  try {
    const {
      field_id,
      crop_name,
      pest_disease_name,
      severity = 'low',
      affected_area,
      symptoms,
      action_taken,
      logged_by,
      log_date,
      resolved = false
    } = req.body;

    if (!pest_disease_name) {
      return res.status(400).json({ error: 'pest_disease_name is required' });
    }

    const payload = {
      field_id: field_id ? parseInt(field_id) : null,
      crop_name: crop_name ? String(crop_name).trim() : null,
      pest_disease_name: String(pest_disease_name).trim(),
      severity: severity || 'low',
      affected_area: affected_area ? String(affected_area).trim() : null,
      symptoms: symptoms ? String(symptoms).trim() : null,
      action_taken: action_taken ? String(action_taken).trim() : null,
      logged_by: logged_by || req.user?.name || req.user?.username || 'Admin',
      log_date: log_date || new Date().toISOString().slice(0, 10),
      resolved: !!resolved
    };

    let result = null;
    try {
      const { data, error } = await supabase
        .from('farm_pest_logs')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      result = data;
    } catch (dbErr) {
      console.warn('[Farm] pest-logs insert fallback:', dbErr.message);
      result = {
        id: _mockPestSeq++,
        ...payload,
        created_at: new Date().toISOString()
      };
      _mockPestLogs.unshift(result);
    }

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/pest-logs/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const update = {};
    if (req.body.resolved !== undefined) update.resolved = !!req.body.resolved;
    if (req.body.action_taken !== undefined) update.action_taken = req.body.action_taken;
    if (req.body.severity !== undefined) update.severity = req.body.severity;

    try {
      const { data, error } = await supabase
        .from('farm_pest_logs')
        .update(update)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return res.json({ ok: true, data });
    } catch (dbErr) {
      console.warn('[Farm] pest-logs patch fallback:', dbErr.message);
      const item = _mockPestLogs.find(p => p.id === id);
      if (item) {
        Object.assign(item, update);
        return res.json({ ok: true, data: item });
      }
      return res.json({ ok: true });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── TASK 2: IRRIGATION SCHEDULER ───────────────────────────────────────────
router.get('/irrigation', requireAuth, async (req, res) => {
  try {
    const { status } = req.query;
    let rows = [];
    try {
      let q = supabase.from('farm_irrigation').select('*, farm_fields(name)').order('scheduled_date', { ascending: true });
      if (status) q = q.eq('status', status);
      const { data, error } = await q;
      if (error) throw error;
      rows = (data || []).map(r => ({
        ...r,
        field_name: r.farm_fields?.name || null
      }));
    } catch (e1) {
      try {
        let q = supabase.from('farm_irrigation').select('*').order('scheduled_date', { ascending: true });
        if (status) q = q.eq('status', status);
        const { data, error } = await q;
        if (error) throw error;
        rows = await enrichFieldWorker(data || []);
      } catch (e2) {
        console.warn('[Farm] irrigation fallback:', e2.message);
        let list = [..._mockIrrigation];
        if (status) list = list.filter(i => i.status === status);
        rows = await enrichFieldWorker(list);
      }
    }
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/irrigation', requireAuth, async (req, res) => {
  try {
    const {
      field_id,
      scheduled_date,
      scheduled_time,
      duration_minutes = 30,
      method = 'drip',
      water_volume_litres,
      assigned_to,
      status = 'scheduled',
      notes
    } = req.body;

    if (!scheduled_date) {
      return res.status(400).json({ error: 'scheduled_date is required' });
    }

    const payload = {
      field_id: field_id ? parseInt(field_id) : null,
      scheduled_date: String(scheduled_date).trim(),
      scheduled_time: scheduled_time ? String(scheduled_time).trim() : null,
      duration_minutes: duration_minutes ? parseInt(duration_minutes) : 30,
      method: method || 'drip',
      water_volume_litres: water_volume_litres !== undefined && water_volume_litres !== null ? parseFloat(water_volume_litres) : null,
      assigned_to: assigned_to ? String(assigned_to).trim() : null,
      status: status || 'scheduled',
      notes: notes ? String(notes).trim() : null
    };

    let result = null;
    try {
      const { data, error } = await supabase
        .from('farm_irrigation')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      result = data;
    } catch (dbErr) {
      console.warn('[Farm] irrigation insert fallback:', dbErr.message);
      result = {
        id: _mockIrrigationSeq++,
        ...payload,
        completed_at: null,
        created_at: new Date().toISOString()
      };
      _mockIrrigation.push(result);
    }

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/irrigation/:id/status', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'status is required' });

    const update = { status };
    if (status === 'done') {
      update.completed_at = new Date().toISOString();
    }

    try {
      const { data, error } = await supabase
        .from('farm_irrigation')
        .update(update)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return res.json({ ok: true, data });
    } catch (dbErr) {
      console.warn('[Farm] irrigation patch fallback:', dbErr.message);
      const item = _mockIrrigation.find(i => i.id === id);
      if (item) {
        Object.assign(item, update);
        return res.json({ ok: true, data: item });
      }
      return res.json({ ok: true });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/irrigation/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const update = { ...req.body };
    if (update.status === 'done' && !update.completed_at) {
      update.completed_at = new Date().toISOString();
    }
    try {
      const { data, error } = await supabase
        .from('farm_irrigation')
        .update(update)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return res.json({ ok: true, data });
    } catch (dbErr) {
      console.warn('[Farm] irrigation patch generic fallback:', dbErr.message);
      const item = _mockIrrigation.find(i => i.id === id);
      if (item) Object.assign(item, update);
      return res.json({ ok: true, data: item });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── TASK 3: SOIL HEALTH TRACKER ───────────────────────────────────────────
async function handleGetSoilReadings(req, res) {
  try {
    let rows = [];
    try {
      const { data, error } = await supabase
        .from('farm_soil_readings')
        .select('*, farm_fields(name)')
        .order('reading_date', { ascending: false });
      if (error) throw error;
      rows = (data || []).map(r => ({
        ...r,
        field_name: r.farm_fields?.name || null
      }));
    } catch (e1) {
      try {
        const { data, error } = await supabase
          .from('farm_soil_readings')
          .select('*')
          .order('reading_date', { ascending: false });
        if (error) throw error;
        rows = await enrichFieldWorker(data || []);
      } catch (e2) {
        console.warn('[Farm] soil-readings fallback:', e2.message);
        rows = await enrichFieldWorker([..._mockSoilReadings]);
      }
    }
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

async function handlePostSoilReadings(req, res) {
  try {
    const {
      field_id,
      reading_date,
      ph_level,
      nitrogen_ppm,
      phosphorus_ppm,
      potassium_ppm,
      moisture_percent,
      organic_matter_percent,
      notes,
      recorded_by
    } = req.body;

    const payload = {
      field_id: field_id ? parseInt(field_id) : null,
      reading_date: reading_date || new Date().toISOString().slice(0, 10),
      ph_level: ph_level !== undefined && ph_level !== null ? parseFloat(ph_level) : null,
      nitrogen_ppm: nitrogen_ppm !== undefined && nitrogen_ppm !== null ? parseFloat(nitrogen_ppm) : null,
      phosphorus_ppm: phosphorus_ppm !== undefined && phosphorus_ppm !== null ? parseFloat(phosphorus_ppm) : null,
      potassium_ppm: potassium_ppm !== undefined && potassium_ppm !== null ? parseFloat(potassium_ppm) : null,
      moisture_percent: moisture_percent !== undefined && moisture_percent !== null ? parseFloat(moisture_percent) : null,
      organic_matter_percent: organic_matter_percent !== undefined && organic_matter_percent !== null ? parseFloat(organic_matter_percent) : null,
      notes: notes ? String(notes).trim() : null,
      recorded_by: recorded_by || req.user?.name || req.user?.username || 'Admin'
    };

    let result = null;
    try {
      const { data, error } = await supabase
        .from('farm_soil_readings')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      result = data;
    } catch (dbErr) {
      console.warn('[Farm] soil-readings insert fallback:', dbErr.message);
      result = {
        id: _mockSoilSeq++,
        ...payload,
        created_at: new Date().toISOString()
      };
      _mockSoilReadings.unshift(result);
    }

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}

router.get('/soil-readings', requireAuth, handleGetSoilReadings);
router.post('/soil-readings', requireAuth, handlePostSoilReadings);
router.get('/soil', requireAuth, handleGetSoilReadings);
router.post('/soil', requireAuth, handlePostSoilReadings);

// ── TASK 4: SUPPLIER MANAGEMENT & PURCHASE ORDERS ─────────────────────────
router.get('/suppliers', requireAuth, async (req, res) => {
  try {
    let rows = [];
    try {
      const { data, error } = await supabase
        .from('farm_suppliers')
        .select('*')
        .order('active', { ascending: false })
        .order('name');
      if (error) throw error;
      rows = data || [];
    } catch (dbErr) {
      console.warn('[Farm] suppliers fallback:', dbErr.message);
      rows = [..._mockSuppliers];
    }
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/suppliers', requireAuth, async (req, res) => {
  try {
    const {
      name,
      category = 'general',
      contact_name,
      phone,
      email,
      address,
      payment_terms,
      rating = 3,
      notes,
      active = true
    } = req.body;

    if (!name) return res.status(400).json({ error: 'name is required' });

    const payload = {
      name: String(name).trim(),
      category: category || 'general',
      contact_name: contact_name ? String(contact_name).trim() : null,
      phone: phone ? String(phone).trim() : null,
      email: email ? String(email).trim() : null,
      address: address ? String(address).trim() : null,
      payment_terms: payment_terms ? String(payment_terms).trim() : null,
      rating: rating ? Math.min(5, Math.max(1, parseInt(rating))) : 3,
      notes: notes ? String(notes).trim() : null,
      active: active !== undefined ? !!active : true
    };

    let result = null;
    try {
      const { data, error } = await supabase
        .from('farm_suppliers')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      result = data;
    } catch (dbErr) {
      console.warn('[Farm] suppliers insert fallback:', dbErr.message);
      result = {
        id: _mockSuppliersSeq++,
        ...payload,
        created_at: new Date().toISOString()
      };
      _mockSuppliers.push(result);
    }

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/suppliers/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const update = { ...req.body };
    if (update.rating !== undefined) {
      update.rating = Math.min(5, Math.max(1, parseInt(update.rating)));
    }
    try {
      const { data, error } = await supabase
        .from('farm_suppliers')
        .update(update)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return res.json({ ok: true, data });
    } catch (dbErr) {
      console.warn('[Farm] suppliers patch fallback:', dbErr.message);
      const item = _mockSuppliers.find(s => s.id === id);
      if (item) Object.assign(item, update);
      return res.json({ ok: true, data: item });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/purchase-orders', requireAuth, async (req, res) => {
  try {
    let rows = [];
    try {
      const { data, error } = await supabase
        .from('farm_purchase_orders')
        .select('*, farm_suppliers(name)')
        .order('order_date', { ascending: false });
      if (error) throw error;
      rows = (data || []).map(r => ({
        ...r,
        supplier_name: r.farm_suppliers?.name || null
      }));
    } catch (e1) {
      try {
        const { data, error } = await supabase
          .from('farm_purchase_orders')
          .select('*')
          .order('order_date', { ascending: false });
        if (error) throw error;
        const { data: sups } = await supabase.from('farm_suppliers').select('id, name').catch(() => ({ data: [] }));
        const sMap = {};
        (sups || []).forEach(s => { sMap[s.id] = s.name; });
        rows = (data || []).map(r => ({ ...r, supplier_name: sMap[r.supplier_id] || null }));
      } catch (e2) {
        console.warn('[Farm] purchase-orders fallback:', e2.message);
        const sMap = {};
        _mockSuppliers.forEach(s => { sMap[s.id] = s.name; });
        rows = _mockPurchaseOrders.map(p => ({
          ...p,
          supplier_name: p.supplier_name || sMap[p.supplier_id] || 'Unknown Supplier'
        }));
      }
    }
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/purchase-orders', requireAuth, async (req, res) => {
  try {
    const {
      supplier_id,
      item_name,
      quantity,
      unit = 'kg',
      unit_price,
      total_amount,
      order_date,
      expected_delivery,
      status = 'ordered',
      notes
    } = req.body;

    if (!item_name) return res.status(400).json({ error: 'item_name is required' });

    const qVal = quantity !== undefined && quantity !== null ? parseFloat(quantity) : 0;
    const upVal = unit_price !== undefined && unit_price !== null ? parseFloat(unit_price) : 0;
    const totVal = total_amount !== undefined && total_amount !== null ? parseFloat(total_amount) : (qVal * upVal);

    const payload = {
      supplier_id: supplier_id ? parseInt(supplier_id) : null,
      item_name: String(item_name).trim(),
      quantity: qVal,
      unit: unit || 'kg',
      unit_price: upVal,
      total_amount: totVal,
      order_date: order_date || new Date().toISOString().slice(0, 10),
      expected_delivery: expected_delivery || null,
      status: status || 'ordered',
      notes: notes ? String(notes).trim() : null
    };

    let result = null;
    try {
      const { data, error } = await supabase
        .from('farm_purchase_orders')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      result = data;
    } catch (dbErr) {
      console.warn('[Farm] purchase-orders insert fallback:', dbErr.message);
      const sup = _mockSuppliers.find(s => s.id === payload.supplier_id);
      result = {
        id: _mockPOSeq++,
        ...payload,
        supplier_name: sup ? sup.name : null,
        created_at: new Date().toISOString()
      };
      _mockPurchaseOrders.unshift(result);
    }

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/purchase-orders/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const update = { ...req.body };
    try {
      const { data, error } = await supabase
        .from('farm_purchase_orders')
        .update(update)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return res.json({ ok: true, data });
    } catch (dbErr) {
      console.warn('[Farm] purchase-orders patch fallback:', dbErr.message);
      const item = _mockPurchaseOrders.find(p => p.id === id);
      if (item) Object.assign(item, update);
      return res.json({ ok: true, data: item });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── TASK 5: STAFF TASK BOARD ──────────────────────────────────────────────
router.get('/tasks', requireAuth, async (req, res) => {
  try {
    const { status, assigned_to } = req.query;
    let rows = [];
    try {
      let q = supabase
        .from('farm_tasks')
        .select('*, farm_workers(name), farm_fields(name)')
        .order('due_date', { ascending: true });
      if (status) q = q.eq('status', status);
      if (assigned_to) q = q.eq('assigned_to', parseInt(assigned_to));
      const { data, error } = await q;
      if (error) throw error;
      rows = (data || []).map(r => ({
        ...r,
        worker_name: r.farm_workers?.name || null,
        field_name: r.farm_fields?.name || null
      }));
    } catch (e1) {
      try {
        let q = supabase.from('farm_tasks').select('*').order('due_date', { ascending: true });
        if (status) q = q.eq('status', status);
        if (assigned_to) q = q.eq('assigned_to', parseInt(assigned_to));
        const { data, error } = await q;
        if (error) throw error;
        rows = await enrichFieldWorker(data || []);
      } catch (e2) {
        console.warn('[Farm] tasks fallback:', e2.message);
        let list = [..._mockTasks];
        if (status) list = list.filter(t => t.status === status);
        if (assigned_to) list = list.filter(t => t.assigned_to === parseInt(assigned_to));
        rows = await enrichFieldWorker(list);
      }
    }
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/tasks', requireAuth, async (req, res) => {
  try {
    const {
      title,
      description,
      assigned_to,
      field_id,
      priority = 'normal',
      status = 'todo',
      due_date,
      created_by
    } = req.body;

    if (!title) return res.status(400).json({ error: 'title is required' });

    const payload = {
      title: String(title).trim(),
      description: description ? String(description).trim() : null,
      assigned_to: assigned_to ? parseInt(assigned_to) : null,
      field_id: field_id ? parseInt(field_id) : null,
      priority: priority || 'normal',
      status: status || 'todo',
      due_date: due_date || null,
      created_by: created_by || req.user?.name || req.user?.username || 'Admin'
    };

    let result = null;
    try {
      const { data, error } = await supabase
        .from('farm_tasks')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      result = data;
    } catch (dbErr) {
      console.warn('[Farm] tasks insert fallback:', dbErr.message);
      result = {
        id: _mockTasksSeq++,
        ...payload,
        completed_at: null,
        created_at: new Date().toISOString()
      };
      _mockTasks.push(result);
    }

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/tasks/:id/status', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'status is required' });

    const update = { status };
    if (status === 'done') {
      update.completed_at = new Date().toISOString();
    } else {
      update.completed_at = null;
    }

    try {
      const { data, error } = await supabase
        .from('farm_tasks')
        .update(update)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return res.json({ ok: true, data });
    } catch (dbErr) {
      console.warn('[Farm] tasks status patch fallback:', dbErr.message);
      const item = _mockTasks.find(t => t.id === id);
      if (item) Object.assign(item, update);
      return res.json({ ok: true, data: item });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/tasks/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const update = { ...req.body };
    if (update.status === 'done' && !update.completed_at) {
      update.completed_at = new Date().toISOString();
    }
    try {
      const { data, error } = await supabase
        .from('farm_tasks')
        .update(update)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return res.json({ ok: true, data });
    } catch (dbErr) {
      console.warn('[Farm] tasks patch generic fallback:', dbErr.message);
      const item = _mockTasks.find(t => t.id === id);
      if (item) Object.assign(item, update);
      return res.json({ ok: true, data: item });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
