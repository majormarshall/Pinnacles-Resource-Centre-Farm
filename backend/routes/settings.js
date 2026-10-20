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

const PIXEL_FILE = path.join(os.tmpdir(), 'pinnacles_pixel_settings.json');

const DEFAULT_PIXELS = {
  meta_pixel_id: process.env.META_PIXEL_ID || '',
  tiktok_pixel_id: process.env.TIKTOK_PIXEL_ID || '',
  google_tag_id: process.env.GOOGLE_TAG_ID || ''
};

let memoryPixels = { ...DEFAULT_PIXELS };

function readPixels() {
  if (memoryPixels && memoryPixels.updated_at) return memoryPixels;
  try {
    if (fs.existsSync(PIXEL_FILE)) {
      const data = JSON.parse(fs.readFileSync(PIXEL_FILE, 'utf8'));
      memoryPixels = data;
      return data;
    }
  } catch (_) {}
  return memoryPixels || DEFAULT_PIXELS;
}

function savePixels(data) {
  memoryPixels = { ...readPixels(), ...data, updated_at: new Date().toISOString() };
  try {
    fs.writeFileSync(PIXEL_FILE, JSON.stringify(memoryPixels), 'utf8');
  } catch (_) {}
  return memoryPixels;
}

// GET /api/settings/pixels - Public
router.get('/pixels', (req, res) => {
  res.json(readPixels());
});

// POST /api/settings/pixels - Admin
router.post('/pixels', requireAuth, (req, res) => {
  const { meta_pixel_id, tiktok_pixel_id, google_tag_id } = req.body || {};
  const updated = savePixels({
    meta_pixel_id: (meta_pixel_id || '').trim(),
    tiktok_pixel_id: (tiktok_pixel_id || '').trim(),
    google_tag_id: (google_tag_id || '').trim()
  });
  res.json({ ok: true, pixels: updated });
});


// GET /api/settings/email-status - Check email configuration status
router.get('/email-status', requireAuth, (req, res) => {
  const emailUser = process.env.EMAIL_USER || process.env.SMTP_USER;
  const emailPass = process.env.EMAIL_PASS || process.env.SMTP_PASS;
  const configured = Boolean(emailUser && emailPass && emailPass !== 'your_gmail_app_password_here');
  res.json({
    configured,
    email_user: configured ? emailUser : null
  });
});

module.exports = router;
