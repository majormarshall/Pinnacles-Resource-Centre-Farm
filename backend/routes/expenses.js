
const express  = require('express');
const router   = express.Router();
const supabase = require('../db');
const { requireAuth } = require('../middleware/auth');

// GET /api/expenses
router.get('/', requireAuth, async (req, res) => {
  try {
    const { month, category } = req.query;
    let q = supabase.from('farm_expenses').select('*').order('expense_date', { ascending: false });
    if (category) q = q.eq('category', category);
    const { data, error } = await q.limit(200);
    if (error) throw error;
    res.json(data || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/expenses/summary
router.get('/summary', requireAuth, async (req, res) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const yearStart  = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
    const { data, error } = await supabase.from('farm_expenses').select('*');
    if (error) throw error;
    const all = data || [];
    const thisMonth = all.filter(e => e.expense_date >= monthStart);
    const thisYear  = all.filter(e => e.expense_date >= yearStart);
    const byCategory = {};
    all.forEach(e => { byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount); });
    res.json({
      total_month: thisMonth.reduce((s, e) => s + Number(e.amount), 0),
      total_year:  thisYear.reduce((s, e) => s + Number(e.amount), 0),
      total_all:   all.reduce((s, e) => s + Number(e.amount), 0),
      by_category: byCategory,
      count: all.length,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/expenses
router.post('/', requireAuth, async (req, res) => {
  try {
    const { category = 'general', description, amount, expense_date, paid_to, receipt_ref, notes } = req.body;
    if (!description || !amount || !expense_date) return res.status(400).json({ error: 'description, amount, expense_date required' });
    const { data, error } = await supabase.from('farm_expenses')
      .insert({ category, description, amount: parseFloat(amount), expense_date, paid_to: paid_to || null, receipt_ref: receipt_ref || null, notes: notes || null, recorded_by: req.user?.name || 'Admin' })
      .select('id').single();
    if (error) throw error;
    res.json({ id: data.id, ...req.body });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/expenses/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { error } = await supabase.from('farm_expenses').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
