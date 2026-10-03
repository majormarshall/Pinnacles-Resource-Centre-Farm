// backend/routes/farm.js — Farm Operations API
const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

// ── DB Migration (run once on startup) ───────────────────────────────────
async function runMigrations() {
  const tables = [
    `CREATE TABLE IF NOT EXISTS farm_fields (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT DEFAULT 'open_field',
      size_sqm REAL,
      location TEXT,
      soil_type TEXT,
      status TEXT DEFAULT 'active',
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS farm_crops (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      variety TEXT,
      category TEXT,
      days_to_harvest INTEGER,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS farm_plantings (
      id SERIAL PRIMARY KEY,
      field_id INTEGER REFERENCES farm_fields(id),
      crop_id INTEGER REFERENCES farm_crops(id),
      planted_by TEXT,
      date_planted DATE NOT NULL,
      quantity REAL,
      unit TEXT DEFAULT 'seedlings',
      status TEXT DEFAULT 'growing',
      expected_harvest_date DATE,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS farm_growth_logs (
      id SERIAL PRIMARY KEY,
      planting_id INTEGER REFERENCES farm_plantings(id),
      logged_by TEXT,
      log_date DATE NOT NULL,
      stage TEXT,
      health_rating INTEGER CHECK(health_rating BETWEEN 1 AND 5),
      observations TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS farm_harvests (
      id SERIAL PRIMARY KEY,
      planting_id INTEGER REFERENCES farm_plantings(id),
      crop_name TEXT,
      harvested_by TEXT,
      harvest_date DATE NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT DEFAULT 'kg',
      quality_grade TEXT DEFAULT 'A',
      sent_to_store INTEGER DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS farm_workers (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT DEFAULT 'general_worker',
      phone TEXT,
      address TEXT,
      hire_date DATE,
      pay_rate REAL DEFAULT 0,
      pay_type TEXT DEFAULT 'daily',
      status TEXT DEFAULT 'active',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS farm_attendance (
      id SERIAL PRIMARY KEY,
      worker_id INTEGER REFERENCES farm_workers(id),
      work_date DATE NOT NULL,
      time_in TEXT,
      time_out TEXT,
      hours_worked REAL,
      task TEXT,
      notes TEXT,
      recorded_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS farm_inputs (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT DEFAULT 'general',
      unit TEXT DEFAULT 'kg',
      current_stock REAL DEFAULT 0,
      reorder_level REAL DEFAULT 5,
      supplier TEXT,
      cost_per_unit REAL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS farm_input_usage (
      id SERIAL PRIMARY KEY,
      input_id INTEGER REFERENCES farm_inputs(id),
      field_id INTEGER,
      used_by TEXT,
      use_date DATE NOT NULL,
      quantity_used REAL NOT NULL,
      purpose TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS farm_sprays (
      id SERIAL PRIMARY KEY,
      field_id INTEGER REFERENCES farm_fields(id),
      chemical_name TEXT NOT NULL,
      sprayed_by TEXT,
      spray_date DATE NOT NULL,
      dosage TEXT,
      area_sprayed TEXT,
      weather_conditions TEXT,
      pre_harvest_interval INTEGER,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS farm_equipment (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT,
      serial_number TEXT,
      purchase_date DATE,
      status TEXT DEFAULT 'operational',
      last_maintenance_date DATE,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS farm_diary (
      id SERIAL PRIMARY KEY,
      entry_date DATE NOT NULL,
      category TEXT DEFAULT 'general',
      title TEXT,
      content TEXT NOT NULL,
      written_by TEXT,
      weather TEXT,
      priority TEXT DEFAULT 'normal',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
  ];
  for (const sql of tables) {
    try { await db.runAsync(sql, []); } catch(e) { console.error('Migration failed:', e.message); }
  }
  console.log('[Farm] DB migrations complete');
}

runMigrations();

// ── FIELDS ─────────────────────────────────────────────────────────────────
router.get('/fields', requireAuth, async (req, res) => {
  const rows = await db.allAsync('SELECT * FROM farm_fields ORDER BY name ASC', []);
  res.json(rows);
});
router.post('/fields', requireAuth, async (req, res) => {
  const { name, type='open_field', size_sqm, location, soil_type, status='active', notes } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const r = await db.runAsync(
    'INSERT INTO farm_fields (name,type,size_sqm,location,soil_type,status,notes) VALUES (?,?,?,?,?,?,?) RETURNING id',
    [name, type, size_sqm||null, location||null, soil_type||null, status, notes||null]
  );
  res.json({ id: r.lastID || r.rows?.[0]?.id, ...req.body });
});
router.patch('/fields/:id', requireAuth, async (req, res) => {
  const { name, type, size_sqm, location, soil_type, status, notes } = req.body;
  await db.runAsync(
    'UPDATE farm_fields SET name=COALESCE(?,name), type=COALESCE(?,type), size_sqm=COALESCE(?,size_sqm), location=COALESCE(?,location), soil_type=COALESCE(?,soil_type), status=COALESCE(?,status), notes=COALESCE(?,notes) WHERE id=?',
    [name, type, size_sqm, location, soil_type, status, notes, req.params.id]
  );
  res.json({ ok: true });
});

// ── CROPS ──────────────────────────────────────────────────────────────────
router.get('/crops', requireAuth, async (req, res) => {
  const rows = await db.allAsync('SELECT * FROM farm_crops ORDER BY name ASC', []);
  res.json(rows);
});
router.post('/crops', requireAuth, async (req, res) => {
  const { name, variety, category, days_to_harvest, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const r = await db.runAsync(
    'INSERT INTO farm_crops (name,variety,category,days_to_harvest,notes) VALUES (?,?,?,?,?) RETURNING id',
    [name, variety||null, category||null, days_to_harvest||null, notes||null]
  );
  res.json({ id: r.lastID || r.rows?.[0]?.id, ...req.body });
});

// ── PLANTINGS ──────────────────────────────────────────────────────────────
router.get('/plantings', requireAuth, async (req, res) => {
  const rows = await db.allAsync(`
    SELECT fp.*, ff.name AS field_name, fc.name AS crop_name
    FROM farm_plantings fp
    LEFT JOIN farm_fields ff ON fp.field_id = ff.id
    LEFT JOIN farm_crops  fc ON fp.crop_id  = fc.id
    ORDER BY fp.date_planted DESC
  `, []);
  res.json(rows);
});
router.post('/plantings', requireAuth, async (req, res) => {
  const { field_id, crop_id, planted_by, date_planted, quantity, unit, status, expected_harvest_date, notes } = req.body;
  if (!date_planted) return res.status(400).json({ error: 'date_planted required' });
  const r = await db.runAsync(
    'INSERT INTO farm_plantings (field_id,crop_id,planted_by,date_planted,quantity,unit,status,expected_harvest_date,notes) VALUES (?,?,?,?,?,?,?,?,?) RETURNING id',
    [field_id||null, crop_id||null, planted_by||req.user?.name||'Admin', date_planted, quantity||null, unit||'seedlings', status||'growing', expected_harvest_date||null, notes||null]
  );
  res.json({ id: r.lastID || r.rows?.[0]?.id, ...req.body });
});
router.patch('/plantings/:id/status', requireAuth, async (req, res) => {
  const { status } = req.body;
  await db.runAsync('UPDATE farm_plantings SET status=? WHERE id=?', [status, req.params.id]);
  res.json({ ok: true });
});

// ── HARVESTS ───────────────────────────────────────────────────────────────
router.get('/harvests', requireAuth, async (req, res) => {
  const rows = await db.allAsync(`
    SELECT fh.*, fp.date_planted, ff.name AS field_name
    FROM farm_harvests fh
    LEFT JOIN farm_plantings fp ON fh.planting_id = fp.id
    LEFT JOIN farm_fields    ff ON fp.field_id = ff.id
    ORDER BY fh.harvest_date DESC
  `, []);
  res.json(rows);
});
router.post('/harvests', requireAuth, async (req, res) => {
  const { planting_id, crop_name, harvested_by, harvest_date, quantity, unit, quality_grade, notes, sent_to_store } = req.body;
  if (!harvest_date || !quantity) return res.status(400).json({ error: 'harvest_date and quantity required' });
  const r = await db.runAsync(
    'INSERT INTO farm_harvests (planting_id,crop_name,harvested_by,harvest_date,quantity,unit,quality_grade,notes,sent_to_store) VALUES (?,?,?,?,?,?,?,?,?) RETURNING id',
    [planting_id||null, crop_name||null, harvested_by||req.user?.name||'Admin', harvest_date, quantity, unit||'kg', quality_grade||'A', notes||null, sent_to_store?1:0]
  );
  res.json({ id: r.lastID || r.rows?.[0]?.id, ...req.body });
});

// ── WORKERS ────────────────────────────────────────────────────────────────
router.get('/workers', requireAuth, async (req, res) => {
  const rows = await db.allAsync('SELECT * FROM farm_workers ORDER BY name ASC', []);
  res.json(rows);
});
router.post('/workers', requireAuth, async (req, res) => {
  const { name, role, phone, address, hire_date, pay_rate, pay_type } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const r = await db.runAsync(
    'INSERT INTO farm_workers (name,role,phone,address,hire_date,pay_rate,pay_type) VALUES (?,?,?,?,?,?,?) RETURNING id',
    [name, role||'general_worker', phone||null, address||null, hire_date||null, pay_rate||0, pay_type||'daily']
  );
  res.json({ id: r.lastID || r.rows?.[0]?.id, ...req.body });
});
router.patch('/workers/:id', requireAuth, async (req, res) => {
  const { name, role, phone, status } = req.body;
  await db.runAsync(
    'UPDATE farm_workers SET name=COALESCE(?,name), role=COALESCE(?,role), phone=COALESCE(?,phone), status=COALESCE(?,status) WHERE id=?',
    [name, role, phone, status, req.params.id]
  );
  res.json({ ok: true });
});

// ── ATTENDANCE ─────────────────────────────────────────────────────────────
router.get('/attendance', requireAuth, async (req, res) => {
  const { date } = req.query;
  const rows = await db.allAsync(`
    SELECT fa.*, fw.name AS worker_name, fw.role AS worker_role, fw.pay_rate, fw.pay_type
    FROM farm_attendance fa
    JOIN farm_workers fw ON fa.worker_id = fw.id
    WHERE ($1::text IS NULL OR fa.work_date::text = $1)
    ORDER BY fw.name ASC
  `, [date||null]).catch(() =>
    db.allAsync('SELECT fa.*, fw.name AS worker_name FROM farm_attendance fa JOIN farm_workers fw ON fa.worker_id = fw.id ORDER BY fa.work_date DESC LIMIT 100', [])
  );
  res.json(rows);
});
router.post('/attendance', requireAuth, async (req, res) => {
  const { worker_id, work_date, time_in, time_out, hours_worked, task, notes } = req.body;
  if (!worker_id || !work_date) return res.status(400).json({ error: 'worker_id and work_date required' });
  const r = await db.runAsync(
    'INSERT INTO farm_attendance (worker_id,work_date,time_in,time_out,hours_worked,task,notes,recorded_by) VALUES (?,?,?,?,?,?,?,?) RETURNING id',
    [worker_id, work_date, time_in||null, time_out||null, hours_worked||8, task||null, notes||null, req.user?.name||'Admin']
  );
  res.json({ id: r.lastID || r.rows?.[0]?.id, ...req.body });
});

// ── INPUTS ─────────────────────────────────────────────────────────────────
router.get('/inputs', requireAuth, async (req, res) => {
  const rows = await db.allAsync('SELECT * FROM farm_inputs ORDER BY name ASC', []);
  res.json(rows);
});
router.post('/inputs', requireAuth, async (req, res) => {
  const { name, type, unit, current_stock, reorder_level, supplier, cost_per_unit } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const r = await db.runAsync(
    'INSERT INTO farm_inputs (name,type,unit,current_stock,reorder_level,supplier,cost_per_unit) VALUES (?,?,?,?,?,?,?) RETURNING id',
    [name, type||'general', unit||'kg', current_stock||0, reorder_level||5, supplier||null, cost_per_unit||0]
  );
  res.json({ id: r.lastID || r.rows?.[0]?.id, ...req.body });
});
router.patch('/inputs/:id/stock', requireAuth, async (req, res) => {
  const { adjustment } = req.body; // positive = restock, negative = usage
  await db.runAsync('UPDATE farm_inputs SET current_stock = current_stock + ? WHERE id=?', [adjustment, req.params.id]);
  res.json({ ok: true });
});

// ── SPRAYS ─────────────────────────────────────────────────────────────────
router.get('/sprays', requireAuth, async (req, res) => {
  const rows = await db.allAsync(`
    SELECT fs.*, ff.name AS field_name
    FROM farm_sprays fs LEFT JOIN farm_fields ff ON fs.field_id = ff.id
    ORDER BY fs.spray_date DESC
  `, []);
  res.json(rows);
});
router.post('/sprays', requireAuth, async (req, res) => {
  const { field_id, chemical_name, sprayed_by, spray_date, dosage, area_sprayed, weather_conditions, pre_harvest_interval, notes } = req.body;
  if (!spray_date || !chemical_name) return res.status(400).json({ error: 'spray_date and chemical_name required' });
  const r = await db.runAsync(
    'INSERT INTO farm_sprays (field_id,chemical_name,sprayed_by,spray_date,dosage,area_sprayed,weather_conditions,pre_harvest_interval,notes) VALUES (?,?,?,?,?,?,?,?,?) RETURNING id',
    [field_id||null, chemical_name, sprayed_by||req.user?.name||'Admin', spray_date, dosage||null, area_sprayed||null, weather_conditions||null, pre_harvest_interval||null, notes||null]
  );
  res.json({ id: r.lastID || r.rows?.[0]?.id, ...req.body });
});

// ── DIARY ──────────────────────────────────────────────────────────────────
router.get('/diary', requireAuth, async (req, res) => {
  const rows = await db.allAsync('SELECT * FROM farm_diary ORDER BY entry_date DESC LIMIT 100', []);
  res.json(rows);
});
router.post('/diary', requireAuth, async (req, res) => {
  const { entry_date, category, title, content, weather, priority } = req.body;
  if (!content) return res.status(400).json({ error: 'Content required' });
  const r = await db.runAsync(
    'INSERT INTO farm_diary (entry_date,category,title,content,written_by,weather,priority) VALUES (?,?,?,?,?,?,?) RETURNING id',
    [entry_date||new Date().toISOString().slice(0,10), category||'general', title||null, content, req.user?.name||'Admin', weather||null, priority||'normal']
  );
  res.json({ id: r.lastID || r.rows?.[0]?.id, ...req.body });
});

// ── EQUIPMENT ──────────────────────────────────────────────────────────────
router.get('/equipment', requireAuth, async (req, res) => {
  const rows = await db.allAsync('SELECT * FROM farm_equipment ORDER BY name ASC', []);
  res.json(rows);
});
router.post('/equipment', requireAuth, async (req, res) => {
  const { name, type, serial_number, purchase_date, status, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const r = await db.runAsync(
    'INSERT INTO farm_equipment (name,type,serial_number,purchase_date,status,notes) VALUES (?,?,?,?,?,?) RETURNING id',
    [name, type||null, serial_number||null, purchase_date||null, status||'operational', notes||null]
  );
  res.json({ id: r.lastID || r.rows?.[0]?.id, ...req.body });
});
router.patch('/equipment/:id/status', requireAuth, async (req, res) => {
  const { status, last_maintenance_date } = req.body;
  await db.runAsync('UPDATE farm_equipment SET status=COALESCE(?,status), last_maintenance_date=COALESCE(?,last_maintenance_date) WHERE id=?', [status, last_maintenance_date, req.params.id]);
  res.json({ ok: true });
});

// ── DASHBOARD SUMMARY ──────────────────────────────────────────────────────
router.get('/dashboard', requireAuth, async (req, res) => {
  try {
    const [fields, workers, plantings, harvests, sprays, diary] = await Promise.all([
      db.allAsync('SELECT COUNT(*) as count FROM farm_fields WHERE status=\'active\'', []),
      db.allAsync('SELECT COUNT(*) as count FROM farm_workers WHERE status=\'active\'', []),
      db.allAsync('SELECT COUNT(*) as count FROM farm_plantings WHERE status=\'growing\'', []),
      db.allAsync('SELECT COUNT(*) as count, COALESCE(SUM(quantity),0) as total_kg FROM farm_harvests WHERE harvest_date >= CURRENT_DATE - INTERVAL \'30 days\'', []),
      db.allAsync('SELECT COUNT(*) as count FROM farm_sprays WHERE spray_date >= CURRENT_DATE - INTERVAL \'7 days\'', []),
      db.allAsync('SELECT * FROM farm_diary ORDER BY entry_date DESC LIMIT 3', []),
    ]);
    res.json({
      fields:    Number(fields[0]?.count || 0),
      workers:   Number(workers[0]?.count || 0),
      plantings: Number(plantings[0]?.count || 0),
      harvests_30d: Number(harvests[0]?.count || 0),
      harvest_kg_30d: Number(harvests[0]?.total_kg || 0),
      sprays_7d: Number(sprays[0]?.count || 0),
      recent_diary: diary,
    });
  } catch (e) { res.json({ error: e.message, fields:0, workers:0, plantings:0, harvests_30d:0, harvest_kg_30d:0, sprays_7d:0, recent_diary:[] }); }
});

module.exports = router;
