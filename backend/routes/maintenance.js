// backend/routes/maintenance.js
// Equipment maintenance scheduling & service history
const express = require('express');
const router  = express.Router();
const db      = require('../db');
const { requireAuth } = require('../middleware/auth');

// ── DB Migration ───────────────────────────────────────────────────────────
async function migrate() {
  await db.runAsync(`CREATE TABLE IF NOT EXISTS farm_equipment_maintenance (
    id               SERIAL PRIMARY KEY,
    equipment_id     INTEGER,
    equipment_name   TEXT,
    maintenance_type TEXT DEFAULT 'routine',
    description      TEXT,
    scheduled_date   DATE,
    completed_date   DATE,
    performed_by     TEXT,
    cost             REAL DEFAULT 0,
    status           TEXT DEFAULT 'scheduled',
    notes            TEXT,
    next_service_date DATE,
    created_at       TIMESTAMPTZ DEFAULT NOW()
  )`, []).catch(e => console.error('[Maintenance] migration:', e.message));

  await db.runAsync('ALTER TABLE farm_equipment ADD COLUMN IF NOT EXISTS next_service_date DATE', []).catch(() => {});
  await db.runAsync('ALTER TABLE farm_equipment ADD COLUMN IF NOT EXISTS service_interval_days INTEGER DEFAULT 90', []).catch(() => {});
  await db.runAsync('ALTER TABLE farm_equipment ADD COLUMN IF NOT EXISTS total_maintenance_cost REAL DEFAULT 0', []).catch(() => {});
  console.log('[Maintenance] Migrations done');
}
migrate();

// GET /api/maintenance — list all records (optionally ?equipment_id=&status=)
router.get('/', requireAuth, async (req, res) => {
  const { equipment_id, status } = req.query;
  let sql    = 'SELECT * FROM farm_equipment_maintenance WHERE 1=1';
  const params = [];
  if (equipment_id) { sql += ' AND equipment_id=?'; params.push(equipment_id); }
  if (status)       { sql += ' AND status=?';       params.push(status); }
  sql += ' ORDER BY scheduled_date ASC';
  res.json(await db.allAsync(sql, params).catch(() => []));
});

// GET /api/maintenance/upcoming — scheduled within 30 days OR overdue
router.get('/upcoming', requireAuth, async (req, res) => {
  const rows = await db.allAsync(`
    SELECT m.*, e.name AS equipment_full_name, e.type AS equipment_type
    FROM farm_equipment_maintenance m
    LEFT JOIN farm_equipment e ON m.equipment_id = e.id
    WHERE m.status = 'scheduled'
      AND m.scheduled_date <= CURRENT_DATE + INTERVAL '30 days'
    ORDER BY m.scheduled_date ASC
  `, []).catch(() => []);
  res.json(rows);
});

// POST /api/maintenance — schedule new maintenance
router.post('/', requireAuth, async (req, res) => {
  const { equipment_id, equipment_name, maintenance_type, description,
          scheduled_date, cost, notes, next_service_date } = req.body;
  if (!scheduled_date) return res.status(400).json({ error: 'scheduled_date required' });

  const r = await db.runAsync(
    `INSERT INTO farm_equipment_maintenance
       (equipment_id, equipment_name, maintenance_type, description,
        scheduled_date, cost, notes, next_service_date, status)
     VALUES (?,?,?,?,?,?,?,?,'scheduled') RETURNING id`,
    [equipment_id || null, equipment_name || null, maintenance_type || 'routine',
     description || null, scheduled_date, cost || 0, notes || null, next_service_date || null]
  );
  if (equipment_id && next_service_date) {
    await db.runAsync('UPDATE farm_equipment SET next_service_date=? WHERE id=?',
      [next_service_date, equipment_id]).catch(() => {});
  }
  res.json({ id: r.lastID || r.rows?.[0]?.id });
});

// PATCH /api/maintenance/:id/complete — mark as completed
router.patch('/:id/complete', requireAuth, async (req, res) => {
  const { performed_by, completed_date, cost, notes, next_service_date } = req.body;
  const record = await db.getAsync('SELECT * FROM farm_equipment_maintenance WHERE id=?', [req.params.id]);
  if (!record) return res.status(404).json({ error: 'Not found' });

  const done = completed_date || new Date().toISOString().slice(0, 10);
  await db.runAsync(
    `UPDATE farm_equipment_maintenance
     SET status='completed', performed_by=?, completed_date=?,
         cost=COALESCE(?,cost), notes=COALESCE(?,notes), next_service_date=?
     WHERE id=?`,
    [performed_by || req.user?.name || 'Admin', done, cost, notes, next_service_date || null, req.params.id]
  );
  if (record.equipment_id) {
    await db.runAsync(
      `UPDATE farm_equipment
       SET status='operational', last_maintenance_date=?,
           next_service_date=?, total_maintenance_cost=total_maintenance_cost+?
       WHERE id=?`,
      [done, next_service_date || null, cost || 0, record.equipment_id]
    ).catch(() => {});
  }
  res.json({ ok: true });
});

// DELETE /api/maintenance/:id
router.delete('/:id', requireAuth, async (req, res) => {
  await db.runAsync('DELETE FROM farm_equipment_maintenance WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
