
const express  = require('express');
const router   = express.Router();
const supabase = require('../db');
const { requireAuth } = require('../middleware/auth');

// GET /api/reviews/:productId — public approved reviews
router.get('/:productId', async (req, res) => {
  try {
    const { data, error } = await supabase.from('product_reviews')
      .select('*').eq('product_id', req.params.productId)
      .eq('approved', true).order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/reviews — public submission
router.post('/', async (req, res) => {
  try {
    const { product_id, customer_name, customer_phone, rating, review_text } = req.body;
    if (!product_id || !customer_name || !rating) return res.status(400).json({ error: 'Missing required fields' });
    const { data, error } = await supabase.from('product_reviews')
      .insert({ product_id, customer_name, customer_phone: customer_phone || null, rating: parseInt(rating), review_text: review_text || null, approved: false })
      .select('id').single();
    if (error) throw error;
    res.json({ id: data.id, message: 'Review submitted for approval. Thank you!' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/reviews — admin: all reviews pending approval
router.get('/', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.from('product_reviews').select('*').order('created_at', { ascending: false });
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

// PATCH /api/reviews/:id/approve
router.patch('/:id/approve', requireAuth, async (req, res) => {
  try {
    const { approved } = req.body;
    const { error } = await supabase.from('product_reviews').update({ approved: !!approved }).eq('id', req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/reviews/:id — admin delete
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { error } = await supabase.from('product_reviews').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
