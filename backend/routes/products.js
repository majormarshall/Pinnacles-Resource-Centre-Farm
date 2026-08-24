// ── Products Routes ──────────────────────────────────────────
const router     = require('express').Router();
const db         = require('../db');
const requireAuth= require('../middleware/auth');
const multer     = require('multer');
const path       = require('path');
const fs         = require('fs');

// ── Multer setup ──────────────────────────────────────────────
// On Vercel the project root is read-only; only /tmp is writable.
// We use memoryStorage on Vercel and store the image as a base64
// data URL in the DB.  Locally we use disk storage under /uploads.

let upload;

if (process.env.VERCEL) {
  // ── Vercel: store file in memory, save as data URL ──
  upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) cb(null, true);
      else cb(new Error('Only image files are allowed'));
    }
  });
} else {
  // ── Local: save files to backend/uploads ──
  const uploadDir = path.join(__dirname, '..', 'uploads');
  try { if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true }); } catch (_) {}

  upload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, uploadDir),
      filename: (req, file, cb) => {
        const ext  = path.extname(file.originalname).toLowerCase() || '.jpg';
        const safe = Date.now() + '-' + Math.round(Math.random() * 1e6);
        cb(null, safe + ext);
      }
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) cb(null, true);
      else cb(new Error('Only image files are allowed'));
    }
  });
}

// Helper: turn an uploaded file into a storable URL/data string
function resolveImageUrl(req) {
  if (!req.file) return null;
  if (process.env.VERCEL) {
    // memoryStorage → convert to base64 data URL
    const b64 = req.file.buffer.toString('base64');
    return `data:${req.file.mimetype};base64,${b64}`;
  }
  // disk storage → public path
  return `/uploads/${req.file.filename}`;
}

// ─────────────────────────────────────────────────────────────

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

// ── POST /products — create ──
router.post('/', requireAuth, upload.single('image'), async (req, res) => {
  try {
    const { name, emoji, img, price, unit, description, category, tag, stock } = req.body;
    if (!name || !price) return res.status(400).json({ error: 'Name and price required.' });

    const imageUrl = resolveImageUrl(req) || img || null;

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

    let imageUrl = resolveImageUrl(req);

    if (!imageUrl) {
      if (img) {
        imageUrl = img;
      } else {
        // keep existing image
        const existing = await db.getAsync('SELECT img FROM products WHERE id = ?', [req.params.id]);
        imageUrl = existing ? existing.img : null;
      }
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
