// ── Products Routes ───────────────────────────────────────────
const router      = require('express').Router();
const db          = require('../db');
const requireAuth = require('../middleware/auth');
const multer      = require('multer');

// ── Multer: memory storage + base64 stored in Supabase ────────
// No filesystem writes needed — images are stored as data URLs
// in the `img` column of the products table.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  }
});

// Convert uploaded file buffer → base64 data URL for DB storage
function resolveImageUrl(req) {
  if (!req.file) return null;
  const b64 = req.file.buffer.toString('base64');
  return `data:${req.file.mimetype};base64,${b64}`;
}

// ── GET /api/products — public product listing ─────────────────
router.get('/', async (req, res) => {
  try {
    const products = await db.allAsync('SELECT * FROM products WHERE active = 1 ORDER BY id ASC');
    res.json(products);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/products/all — admin: all products ────────────────
router.get('/all', requireAuth, async (req, res) => {
  try { res.json(await db.allAsync('SELECT * FROM products ORDER BY id ASC')); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/products — create new product ────────────────────
router.post('/', requireAuth, upload.single('image'), async (req, res) => {
  try {
    const { name, emoji, img, price, unit, description, category, tag, stock } = req.body;
    if (!name || !price) return res.status(400).json({ error: 'Name and price required.' });

    // Uploaded file takes priority, then img URL from form body
    const imageUrl = resolveImageUrl(req) || img || null;

    const r = await db.runAsync(
      'INSERT INTO products (name,emoji,img,price,unit,description,category,tag,stock) VALUES (?,?,?,?,?,?,?,?,?)',
      [name, emoji||'🌿', imageUrl, Number(price), unit||'per unit', description||'', category||'vegetables', tag||'Fresh', Number(stock)||999]
    );
    res.status(201).json({ id: r.lastID, message: 'Product added.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PUT /api/products/:id — update existing product ────────────
router.put('/:id', requireAuth, upload.single('image'), async (req, res) => {
  try {
    const { name, emoji, img, price, unit, description, category, tag, active, stock } = req.body;

    // Priority: new upload > explicit img field > keep existing
    let imageUrl = resolveImageUrl(req);
    if (!imageUrl) {
      if (img) {
        imageUrl = img;
      } else {
        const existing = await db.getAsync('SELECT img FROM products WHERE id = ?', [req.params.id]);
        imageUrl = existing ? existing.img : null;
      }
    }

    await db.runAsync(
      'UPDATE products SET name=?,emoji=?,img=?,price=?,unit=?,description=?,category=?,tag=?,active=?,stock=? WHERE id=?',
      [name, emoji, imageUrl, Number(price), unit, description, category, tag,
       active != null ? Number(active) : 1, Number(stock)||999, req.params.id]
    );
    res.json({ message: 'Product updated.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── DELETE /api/products/:id ───────────────────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    await db.runAsync('DELETE FROM products WHERE id = ?', [req.params.id]);
    res.json({ message: 'Product deleted.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
