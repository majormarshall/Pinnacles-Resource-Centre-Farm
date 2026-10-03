// ── Products Routes ───────────────────────────────────────────
const router      = require('express').Router();
const supabase    = require('../db');
const { requireAuth } = require('../middleware/auth');
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
    // Works whether 'active' is BOOLEAN or INTEGER in PostgreSQL
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .neq('active', false)
      .order('id');
    if (error) throw new Error(error.message);
    // Normalise numeric fields so frontend always gets numbers (not strings from PG)
    const normalised = (data || []).map(prod => ({
      ...prod,
      price:              Number(prod.price || 0),
      in_stock:           (prod.in_stock === true || prod.in_stock === 1 || Number(prod.in_stock) > 0) ? 1 : 0,
      active:             1,
      preorder_available: (prod.preorder_available === true || prod.preorder_available === 1) ? 1 : 0,
    }));
    res.json(normalised);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/products/all — admin: all products ────────────────
router.get('/all', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase.from('products').select('*').order('id');
    if (error) throw new Error(error.message);
    res.json(data || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/products — create new product ────────────────────
router.post('/', requireAuth, upload.single('image'), async (req, res) => {
  try {
    const { name, emoji, img, price, unit, description, category, tag, stock } = req.body;
    if (!name || !price) return res.status(400).json({ error: 'Name and price required.' });

    // Uploaded file takes priority, then img URL from form body
    const imageUrl = resolveImageUrl(req) || img || null;

    const { data, error } = await supabase
      .from('products')
      .insert({
        name,
        emoji:       emoji || '🌿',
        img:         imageUrl,
        price:       Number(price),
        unit:        unit || 'per unit',
        description: description || '',
        category:    category || 'vegetables',
        tag:         tag || 'Fresh',
        stock:       Number(stock) || 999,
        in_stock:    1,
      })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    res.status(201).json({ id: data.id, message: 'Product added.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PUT /api/products/:id — update existing product ────────────
router.put('/:id', requireAuth, upload.single('image'), async (req, res) => {
  try {
    const { name, emoji, img, price, unit, description, category, tag, active, stock, in_stock } = req.body;

    // Priority: new upload > explicit img field > keep existing
    let imageUrl = resolveImageUrl(req);
    if (!imageUrl) {
      if (img) {
        imageUrl = img;
      } else {
        const { data: existing } = await supabase
          .from('products')
          .select('img')
          .eq('id', req.params.id)
          .single();
        imageUrl = existing ? existing.img : null;
      }
    }

    const { error } = await supabase
      .from('products')
      .update({
        name,
        emoji,
        img:         imageUrl,
        price:       Number(price),
        unit,
        description,
        category,
        tag,
        active:      active != null ? Number(active) : 1,
        stock:       Number(stock) || 999,
        in_stock:    in_stock != null ? Number(in_stock) : 1,
      })
      .eq('id', req.params.id);
    if (error) throw new Error(error.message);
    res.json({ message: 'Product updated.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── DELETE /api/products/:id ───────────────────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { error } = await supabase.from('products').delete().eq('id', req.params.id);
    if (error) throw new Error(error.message);
    res.json({ message: 'Product deleted.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PATCH /api/products/:id/stock — quick availability toggle ──
router.patch('/:id/stock', requireAuth, async (req, res) => {
  try {
    const { in_stock } = req.body;
    if (in_stock === undefined) return res.status(400).json({ error: 'in_stock value required.' });
    const { error } = await supabase
      .from('products')
      .update({ in_stock: Number(in_stock) })
      .eq('id', req.params.id);
    if (error) throw new Error(error.message);
    const label = Number(in_stock) ? 'In Stock' : 'Out of Stock';
    res.json({ message: `Product marked as ${label}.` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
