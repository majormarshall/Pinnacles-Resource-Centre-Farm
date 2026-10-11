const fs = require("fs");
const path = require("path");
const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/auth");

const SETTINGS_FILE = path.join(__dirname, "..", "hero_settings.json");

const DEFAULT_HERO = {
  type: "video",
  video_url: "videos/hero-bg.mp4",
  images: [
    "images/farm_hero.png"
  ]
};

function readHeroSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8"));
    }
  } catch(e) {}
  return DEFAULT_HERO;
}

function writeHeroSettings(data) {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2), "utf8");
    return true;
  } catch(e) {
    console.error("Failed to write hero settings:", e.message);
    return false;
  }
}

// GET /api/settings/hero - Public
router.get("/hero", (req, res) => {
  res.json(readHeroSettings());
});

// POST /api/settings/hero - Admin
router.post("/hero", requireAuth, (req, res) => {
  const { type = "video", video_url = "videos/hero-bg.mp4", images = [] } = req.body;
  const newSettings = {
    type,
    video_url: video_url || "videos/hero-bg.mp4",
    images: Array.isArray(images) && images.length > 0 ? images : ["images/farm_hero.png"],
    updated_at: new Date().toISOString()
  };
  writeHeroSettings(newSettings);
  res.json({ ok: true, settings: newSettings });
});

module.exports = router;
