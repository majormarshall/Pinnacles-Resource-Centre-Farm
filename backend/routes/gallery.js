// ── Gallery Routes ────────────────────────────────────────────
const router      = require('express').Router();
const db          = require('../db');
const requireAuth = require('../middleware/auth');
const multer      = require('multer');

// ── Multer: memory storage, base64 stored in DB ───────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  }
});

function resolveImageUrl(req) {
  if (!req.file) return null;
  const b64 = req.file.buffer.toString('base64');
  return `data:${req.file.mimetype};base64,${b64}`;
}

// ── GET /api/gallery — public ─────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const items = await db.allAsync(
      'SELECT * FROM gallery ORDER BY sort_order ASC, id ASC'
    );
    res.json(items);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/gallery — add image (admin only) ─────────────────
router.post('/', requireAuth, upload.single('image'), async (req, res) => {
  try {
    const { alt, caption, wide } = req.body;
    const imageUrl = resolveImageUrl(req);
    if (!imageUrl) return res.status(400).json({ error: 'Image file is required.' });

    const maxOrder = await db.getAsync('SELECT MAX(sort_order) AS m FROM gallery');
    const sortOrder = (maxOrder?.m ?? -1) + 1;

    const r = await db.runAsync(
      'INSERT INTO gallery (img, alt, caption, wide, sort_order) VALUES (?,?,?,?,?)',
      [imageUrl, alt || '', caption || '', wide === '1' ? 1 : 0, sortOrder]
    );
    res.status(201).json({ id: r.lastID, message: 'Gallery image added.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PUT /api/gallery/:id — update image (admin only) ──────────
router.put('/:id', requireAuth, upload.single('image'), async (req, res) => {
  try {
    const { alt, caption, wide } = req.body;
    let imageUrl = resolveImageUrl(req);
    if (!imageUrl) {
      const existing = await db.getAsync('SELECT img FROM gallery WHERE id = ?', [req.params.id]);
      imageUrl = existing ? existing.img : null;
    }
    await db.runAsync(
      'UPDATE gallery SET img=?, alt=?, caption=?, wide=? WHERE id=?',
      [imageUrl, alt || '', caption || '', wide === '1' ? 1 : 0, req.params.id]
    );
    res.json({ message: 'Gallery image updated.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PATCH /api/gallery/:id/order — update sort order ──────────
router.patch('/:id/order', requireAuth, async (req, res) => {
  try {
    const { sort_order } = req.body;
    await db.runAsync('UPDATE gallery SET sort_order=? WHERE id=?', [sort_order, req.params.id]);
    res.json({ message: 'Order updated.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── DELETE /api/gallery/:id — remove image (admin only) ───────
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    await db.runAsync('DELETE FROM gallery WHERE id = ?', [req.params.id]);
    res.json({ message: 'Gallery image deleted.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
