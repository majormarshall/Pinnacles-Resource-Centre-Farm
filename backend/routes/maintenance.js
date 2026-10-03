// backend/routes/maintenance.js — Equipment maintenance scheduling (Supabase JS)
const express  = require('express');
const router   = express.Router();
const supabase = require('../db');
const { requireAuth } = require('../middleware/auth');

// GET /api/maintenance — list all records
router.get('/', requireAuth, async (req, res) => {
  try {
    const { equipment_id, status } = req.query;
    let query = supabase.from('farm_equipment_maintenance').select('*').order('scheduled_date');
    if (equipment_id) query = query.eq('equipment_id', equipment_id);
    if (status)       query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    res.json(data || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/maintenance/upcoming — scheduled within 30 days
router.get('/upcoming', requireAuth, async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const in30  = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const { data, error } = await supabase.from('farm_equipment_maintenance')
      .select('*, farm_equipment(name, type)')
      .eq('status', 'scheduled')
      .lte('scheduled_date', in30)
      .order('scheduled_date');
    if (error) throw new Error(error.message);
    const rows = (data || []).map(r => ({
      ...r,
      equipment_full_name: r.farm_equipment?.name || r.equipment_name,
      equipment_type:      r.farm_equipment?.type || null,
    }));
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/maintenance — schedule new maintenance
router.post('/', requireAuth, async (req, res) => {
  try {
    const { equipment_id, equipment_name, maintenance_type, description, scheduled_date, cost, notes, next_service_date } = req.body;
    if (!scheduled_date) return res.status(400).json({ error: 'scheduled_date required' });
    const { data, error } = await supabase.from('farm_equipment_maintenance')
      .insert({ equipment_id: equipment_id || null, equipment_name: equipment_name || null, maintenance_type: maintenance_type || 'routine', description: description || null, scheduled_date, cost: cost || 0, notes: notes || null, next_service_date: next_service_date || null, status: 'scheduled' })
      .select('id').single();
    if (error) throw new Error(error.message);
    if (equipment_id && next_service_date) {
      await supabase.from('farm_equipment').update({ next_service_date }).eq('id', equipment_id);
    }
    res.json({ id: data.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/maintenance/:id/complete
router.patch('/:id/complete', requireAuth, async (req, res) => {
  try {
    const { performed_by, completed_date, cost, notes, next_service_date } = req.body;
    const { data: record } = await supabase.from('farm_equipment_maintenance').select('*').eq('id', req.params.id).single();
    if (!record) return res.status(404).json({ error: 'Not found' });
    const done = completed_date || new Date().toISOString().slice(0, 10);
    await supabase.from('farm_equipment_maintenance').update({
      status: 'completed', performed_by: performed_by || req.user?.name || 'Admin',
      completed_date: done, cost: cost || record.cost, notes: notes || record.notes,
      next_service_date: next_service_date || null,
    }).eq('id', req.params.id);
    if (record.equipment_id) {
      const { data: eq } = await supabase.from('farm_equipment').select('total_maintenance_cost').eq('id', record.equipment_id).single();
      await supabase.from('farm_equipment').update({
        status: 'operational',
        last_maintenance_date: done,
        next_service_date: next_service_date || null,
        total_maintenance_cost: (Number(eq?.total_maintenance_cost) || 0) + (Number(cost) || 0),
      }).eq('id', record.equipment_id);
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/maintenance/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { error } = await supabase.from('farm_equipment_maintenance').delete().eq('id', req.params.id);
    if (error) throw new Error(error.message);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
