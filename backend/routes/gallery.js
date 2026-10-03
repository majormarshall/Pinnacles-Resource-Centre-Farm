// ── Gallery Routes ────────────────────────────────────────────
const router      = require('express').Router();
const supabase    = require('../db');
const { requireAuth } = require('../middleware/auth');
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
    const { data: items, error } = await supabase
      .from('gallery')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true });
    if (error) throw new Error(error.message);
    res.json(items || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/gallery — add image (admin only) ─────────────────
router.post('/', requireAuth, upload.single('image'), async (req, res) => {
  try {
    const { alt, caption, wide } = req.body;
    const imageUrl = resolveImageUrl(req);
    if (!imageUrl) return res.status(400).json({ error: 'Image file is required.' });

    // Compute next sort_order by fetching the current max
    const { data: maxRow, error: maxError } = await supabase
      .from('gallery')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .single();
    if (maxError && maxError.code !== 'PGRST116') throw new Error(maxError.message);
    const sortOrder = ((maxRow?.sort_order) ?? -1) + 1;

    const { data, error } = await supabase
      .from('gallery')
      .insert({ img: imageUrl, alt: alt || '', caption: caption || '', wide: wide === '1' ? 1 : 0, sort_order: sortOrder })
      .select('id')
      .single();
    if (error) throw new Error(error.message);

    res.status(201).json({ id: data.id, message: 'Gallery image added.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PUT /api/gallery/:id — update image (admin only) ──────────
router.put('/:id', requireAuth, upload.single('image'), async (req, res) => {
  try {
    const { alt, caption, wide } = req.body;
    let imageUrl = resolveImageUrl(req);
    if (!imageUrl) {
      const { data: existing, error: fetchError } = await supabase
        .from('gallery')
        .select('img')
        .eq('id', req.params.id)
        .single();
      if (fetchError && fetchError.code !== 'PGRST116') throw new Error(fetchError.message);
      imageUrl = existing ? existing.img : null;
    }
    const { error } = await supabase
      .from('gallery')
      .update({ img: imageUrl, alt: alt || '', caption: caption || '', wide: wide === '1' ? 1 : 0 })
      .eq('id', req.params.id);
    if (error) throw new Error(error.message);
    res.json({ message: 'Gallery image updated.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PATCH /api/gallery/:id/order — update sort order ──────────
router.patch('/:id/order', requireAuth, async (req, res) => {
  try {
    const { sort_order } = req.body;
    const { error } = await supabase
      .from('gallery')
      .update({ sort_order })
      .eq('id', req.params.id);
    if (error) throw new Error(error.message);
    res.json({ message: 'Order updated.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── DELETE /api/gallery/:id — remove image (admin only) ───────
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { error } = await supabase
      .from('gallery')
      .delete()
      .eq('id', req.params.id);
    if (error) throw new Error(error.message);
    res.json({ message: 'Gallery image deleted.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
