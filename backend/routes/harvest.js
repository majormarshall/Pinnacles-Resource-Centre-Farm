// backend/routes/harvest.js — Today's Harvest API
const express    = require('express');
const router     = express.Router();
const supabase   = require('../db');
const { requireAuth } = require('../middleware/auth');

// GET /api/harvest/today — public, returns today's harvested products
router.get('/today', async (req, res) => {
  try {
    // Products marked as harvested today (in_stock=1 AND today_harvest=1)
    const { data: products, error } = await supabase
      .from('products')
      .select('id, name, description, price, unit, category, in_stock')
      .eq('in_stock', 1)
      .eq('today_harvest', 1)
      .order('name');
    if (error) throw new Error(error.message);

    if (!products || products.length === 0) {
      return res.json({ items: [] });
    }
    // Emoji map
    const emojiMap = {
      tomato:'🍅', pepper:'🫑', carrot:'🥕', egg:'🥚', maize:'🌽',
      corn:'🌽', strawberry:'🍓', spinach:'🥬', green:'🥬', pea:'🫛',
      pawpaw:'🍈', watermelon:'🍉', yam:'🍠', plantain:'🍌', onion:'🧅',
      potato:'🥔', cucumber:'🥒', cabbage:'🥬', lettuce:'🥬', beans:'🫘',
    };
    const items = products.map(p => {
      const nameLower = p.name.toLowerCase();
      const emoji = Object.entries(emojiMap).find(([k]) => nameLower.includes(k))?.[1] || '🌿';
      return { id: p.id, name: p.name, emoji, limited: false };
    });
    res.json({ items, date: new Date().toISOString().slice(0,10) });
  } catch (err) {
    // If column doesn't exist yet, return empty
    console.log('Harvest today:', err.message);
    res.json({ items: [] });
  }
});

// PATCH /api/harvest/toggle/:id — admin only, toggle today_harvest on a product
router.patch('/toggle/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: product, error: fetchError } = await supabase
      .from('products')
      .select('today_harvest')
      .eq('id', id)
      .single();
    if (fetchError && fetchError.code !== 'PGRST116') throw new Error(fetchError.message);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const newVal = product.today_harvest ? 0 : 1;
    const { error: updateError } = await supabase
      .from('products')
      .update({ today_harvest: newVal })
      .eq('id', id);
    if (updateError) throw new Error(updateError.message);

    res.json({ id: Number(id), today_harvest: newVal });
  } catch (err) {
    console.error('Toggle harvest:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/harvest/clear — admin only, clear all today_harvest flags
router.post('/clear', requireAuth, async (req, res) => {
  try {
    const { error } = await supabase
      .from('products')
      .update({ today_harvest: 0 })
      .neq('id', 0); // apply to all rows (Supabase requires a filter for updates)
    if (error) throw new Error(error.message);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
