// ── Products Routes ──────────────────────────────────────────
const router     = require('express').Router();
const db         = require('../db');
const requireAuth= require('../middleware/auth');
const multer     = require('multer');
const path       = require('path');
const fs         = require('fs');

// ── Multer setup: save uploaded product images to backend/uploads ──
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase() || '.jpg';
    const safe = Date.now() + '-' + Math.round(Math.random() * 1e6);
    cb(null, safe + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  }
});

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

// ── POST /products — create (accepts multipart OR json) ──
router.post('/', requireAuth, upload.single('image'), async (req, res) => {
  try {
    const { name, emoji, img, price, unit, description, category, tag, stock } = req.body;
    if (!name || !price) return res.status(400).json({ error: 'Name and price required.' });

    // If a file was uploaded use /uploads/<filename>, else use the img URL from body
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : (img || null);

    const r = await db.runAsync(
      'INSERT INTO products (name,emoji,img,price,unit,description,category,tag,stock) VALUES (?,?,?,?,?,?,?,?,?)',
      [name, emoji||'🌿', imageUrl, Number(price), unit||'per unit', description||'', category||'vegetables', tag||'Fresh', Number(stock)||999]
    );
    res.status(201).json({ id: r.lastID, message: 'Product added.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PUT /products/:id — update ──
router.put('/:id', requireAuth, upload.single('image'), async (req, res) => {
  try {
    const { name, emoji, img, price, unit, description, category, tag, active, stock } = req.body;

    // Determine new image: uploaded file > explicit img field > keep existing
    let imageUrl = img || null;
    if (req.file) imageUrl = `/uploads/${req.file.filename}`;

    // If no new image provided, keep the existing one
    if (!req.file && !img) {
      const existing = await db.getAsync('SELECT img FROM products WHERE id = ?', [req.params.id]);
      imageUrl = existing ? existing.img : null;
    }

    await db.runAsync(
      'UPDATE products SET name=?,emoji=?,img=?,price=?,unit=?,description=?,category=?,tag=?,active=?,stock=? WHERE id=?',
      [name, emoji, imageUrl, Number(price), unit, description, category, tag, active!=null?Number(active):1, Number(stock)||999, req.params.id]
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
