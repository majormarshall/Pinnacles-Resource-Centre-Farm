// backend/routes/harvest.js — Today's Harvest API
const express    = require('express');
const router     = express.Router();
const db         = require('../db');
const { requireAuth } = require('../middleware/auth');

// GET /api/harvest/today — public, returns today's harvested products
router.get('/today', async (req, res) => {
  try {
    // Products marked as harvested today (in_stock=1 AND harvested_today=1)
    // We repurpose a products query — products with today_harvest flag
    const products = await db.allAsync(
      'SELECT id, name, description, price, unit, category, in_stock FROM products WHERE in_stock = 1 AND today_harvest = 1 ORDER BY name ASC',
      []
    );
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
    const product = await db.getAsync('SELECT today_harvest FROM products WHERE id = ?', [id]);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    const newVal = product.today_harvest ? 0 : 1;
    await db.runAsync('UPDATE products SET today_harvest = ? WHERE id = ?', [newVal, id]);
    res.json({ id: Number(id), today_harvest: newVal });
  } catch (err) {
    console.error('Toggle harvest:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/harvest/clear — admin only, clear all today_harvest flags
router.post('/clear', requireAuth, async (req, res) => {
  try {
    await db.runAsync('UPDATE products SET today_harvest = 0', []);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
