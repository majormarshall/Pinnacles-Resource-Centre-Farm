// ── Products Routes ──────────────────────────────────────────
const router     = require('express').Router();
const db         = require('../db');
const requireAuth= require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    const products = await db.allAsync('SELECT * FROM products WHERE active = 1 ORDER BY id ASC');
    res.json(products);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/all', requireAuth, async (req, res) => {
  try { res.json(await db.allAsync('SELECT * FROM products ORDER BY id ASC')); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, emoji, img, price, unit, description, category, tag, stock } = req.body;
    if (!name || !price) return res.status(400).json({ error: 'Name and price required.' });
    const r = await db.runAsync(
      'INSERT INTO products (name,emoji,img,price,unit,description,category,tag,stock) VALUES (?,?,?,?,?,?,?,?,?)',
      [name, emoji||'🌿', img||null, price, unit||'per unit', description||'', category||'vegetables', tag||'Fresh', stock||999]
    );
    res.status(201).json({ id: r.lastID, message: 'Product added.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { name, emoji, img, price, unit, description, category, tag, active, stock } = req.body;
    await db.runAsync(
      'UPDATE products SET name=?,emoji=?,img=?,price=?,unit=?,description=?,category=?,tag=?,active=?,stock=? WHERE id=?',
      [name, emoji, img, price, unit, description, category, tag, active??1, stock??999, req.params.id]
    );
    res.json({ message: 'Product updated.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    await db.runAsync('DELETE FROM products WHERE id = ?', [req.params.id]);
    res.json({ message: 'Product deleted.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
