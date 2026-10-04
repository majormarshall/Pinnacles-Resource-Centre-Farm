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
    const { data: payroll } = await supabase.from('farm_payroll').select('gross_pay').gte('period_start', start).lte('period_start', end);
    const labourCost = (payroll || []).reduce((s, r) => s + (Number(r.gross_pay) || 0), 0);

    // Inputs cost
    const { data: usage } = await supabase.from('farm_input_usage').select('quantity_used, farm_inputs(cost_per_unit)').gte('use_date', start).lte('use_date', end);
    const inputsCost = (usage || []).reduce((s, r) => s + (Number(r.quantity_used) || 0) * (Number(r.farm_inputs?.cost_per_unit) || 0), 0);

    // Revenue from orders
    const { data: orders } = await supabase.from('orders').select('total').gte('created_at', start).lte('created_at', end + 'T23:59:59').neq('status', 'cancelled').catch(() => ({ data: [] }));
    const revenue = (orders || []).reduce((s, r) => s + (Number(r.total) || 0), 0);

    res.json({ month, year, labour_cost: labourCost, inputs_cost: inputsCost, total_costs: labourCost + inputsCost, revenue, order_count: (orders || []).length, profit: revenue - labourCost - inputsCost });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/reports/harvest-summary', requireAuth, async (req, res) => {
  try {
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const year  = parseInt(req.query.year)  || new Date().getFullYear();
    const start = new Date(year, month - 1, 1).toISOString().slice(0, 10);
    const end   = new Date(year, month, 0).toISOString().slice(0, 10);

    const { data: harvests } = await supabase.from('farm_harvests').select('crop_name, quality_grade, quantity, unit').gte('harvest_date', start).lte('harvest_date', end);

    // Group by crop_name + quality_grade in JS
    const groups = {};
    for (const h of (harvests || [])) {
      const key = (h.crop_name || 'Unknown') + '|' + h.quality_grade;
      if (!groups[key]) groups[key] = { crop_name: h.crop_name, quality_grade: h.quality_grade, unit: h.unit, total_qty: 0, harvest_count: 0 };
      groups[key].total_qty     += Number(h.quantity) || 0;
      groups[key].harvest_count += 1;
    }
    res.json({ month, year, rows: Object.values(groups) });
  } catch (e) { res.status(500).json({ error: e.message }); }
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
    const { data, error } = await supabase.from('admin_users').select('id, name, email, role, created_at').order('name');
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

module.exports = router;
