// ── Hero Background Settings API ─────────────────────────────
const express = require('express');
const router  = express.Router();
const path    = require('path');
const fs      = require('fs');
const os      = require('os');
const { requireAuth } = require('../middleware/auth');

const TMP_FILE = path.join(os.tmpdir(), 'pinnacles_hero_settings.json');

const DEFAULT_HERO = {
  type: 'slideshow',
  video_url: 'videos/hero-bg.mp4',
  images: [
    'images/farm_hero.png',
    'images/tomatoes.png',
    'images/pepper.png',
    'images/strawberry.png',
    'images/maize.png'
  ]
};

let memorySettings = { ...DEFAULT_HERO };

function readSettings() {
  if (memorySettings && memorySettings.updated_at) return memorySettings;
  try {
    if (fs.existsSync(TMP_FILE)) {
      const data = JSON.parse(fs.readFileSync(TMP_FILE, 'utf8'));
      memorySettings = data;
      return data;
    }
  } catch (_) {}
  return memorySettings || DEFAULT_HERO;
}

function saveSettings(data) {
  memorySettings = { ...data, updated_at: new Date().toISOString() };
  try {
    fs.writeFileSync(TMP_FILE, JSON.stringify(memorySettings), 'utf8');
  } catch (_) {}
  return memorySettings;
}

// GET /api/settings/hero - Public
router.get('/hero', (req, res) => {
  res.json(readSettings());
});

// POST /api/settings/hero - Admin
router.post('/hero', requireAuth, (req, res) => {
  const { type = 'slideshow', video_url = 'videos/hero-bg.mp4', images = [] } = req.body || {};
  const updated = saveSettings({
    type,
    video_url: video_url || 'videos/hero-bg.mp4',
    images: Array.isArray(images) && images.length > 0 ? images : DEFAULT_HERO.images
  });
  res.json({ ok: true, settings: updated });
});

module.exports = router;
