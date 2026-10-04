// backend/routes/setup.js
// ONE-TIME setup endpoint: seeds products and admin into Supabase
// POST /api/setup  (requires SETUP_SECRET header to be safe)
const express  = require('express');
const router   = express.Router();
const supabase = require('../db');
const bcrypt   = require('bcryptjs');

const DEFAULT_PRODUCTS = [
  { name: 'Fresh Tomatoes',    emoji: '\u{1F345}', price: 3500,  unit: '/basket',  category: 'vegetables', tag: 'Farm Fresh',  description: 'Sun-ripened tomatoes harvested fresh from our farm.',           in_stock: 1, active: 1 },
  { name: 'Tatashe (Bell Pepper)', emoji: '\u{1FAD1}', price: 2500, unit: '/basket', category: 'vegetables', tag: 'Popular',   description: 'Sweet bell peppers, perfect for soups and sauces.',            in_stock: 1, active: 1 },
  { name: 'Scotch Bonnet Pepper',  emoji: '\u{1F336}\uFE0F', price: 1500, unit: '/cup',   category: 'vegetables', tag: 'Hot & Fresh', description: 'Fresh hot peppers for that authentic Nigerian flavour.',       in_stock: 1, active: 1 },
  { name: 'Farm Fresh Eggs',   emoji: '\u{1F95A}', price: 2800,  unit: '/crate',   category: 'poultry',    tag: 'Daily Fresh', description: 'Free-range eggs from our healthy, well-fed chickens.',         in_stock: 1, active: 1 },
  { name: 'White Maize',       emoji: '\u{1F33D}', price: 5500,  unit: '/bag',     category: 'grains',     tag: 'Staple',      description: 'Premium white maize, sun-dried and ready for grinding.',       in_stock: 1, active: 1 },
  { name: 'Fresh Carrots',     emoji: '\u{1F955}', price: 1800,  unit: '/bunch',   category: 'vegetables', tag: 'Organic',     description: 'Sweet and crunchy carrots grown without pesticides.',           in_stock: 1, active: 1 },
  { name: 'Strawberries',      emoji: '\u{1F353}', price: 4500,  unit: '/punnet',  category: 'fruits',     tag: 'Limited',     description: 'Fresh strawberries \u2014 seasonal and limited. Order fast!',        in_stock: 1, active: 1 },
  { name: 'Ugu (Pumpkin Leaf)', emoji: '\u{1F96C}', price: 800,  unit: '/bunch',   category: 'vegetables', tag: 'Daily Fresh', description: 'Fresh ugu leaves, harvested daily for maximum nutrition.',     in_stock: 1, active: 1 },
  { name: 'Spinach',           emoji: '\u{1F96C}', price: 900,   unit: '/bunch',   category: 'vegetables', tag: 'Healthy',     description: 'Tender spinach leaves, perfect for soups and salads.',          in_stock: 1, active: 1 },
  { name: 'Cucumber',          emoji: '\u{1F952}', price: 1200,  unit: '/kg',      category: 'vegetables', tag: 'Fresh',       description: 'Crisp fresh cucumbers from our greenhouse.',                    in_stock: 1, active: 1 },
  { name: 'Waterleaf',         emoji: '\u{1F33F}', price: 700,   unit: '/bunch',   category: 'vegetables', tag: 'Daily',       description: 'Fresh waterleaf for soups \u2014 harvested every morning.',          in_stock: 1, active: 1 },
  { name: 'Garden Eggs',       emoji: '\u{1F346}', price: 1500,  unit: '/basket',  category: 'vegetables', tag: 'Local Fave',  description: 'Tender garden eggs, a Nigerian favourite for soups and salads.', in_stock: 1, active: 1 },
];

// POST /api/setup \u2014 seed products and optionally create admin
router.post('/', async (req, res) => {
  // Basic security \u2014 require a secret header or body param
  const secret = req.headers['x-setup-secret'] || req.body?.secret;
  if (secret !== (process.env.SETUP_SECRET || 'pinnacles-setup-2024')) {
    return res.status(403).json({ error: 'Invalid setup secret. Pass x-setup-secret header.' });
  }

  const results = { products: [], admin: null, errors: [] };

  try {
    // 1 \u2014 Check if products already exist
    const { count } = await supabase.from('products').select('*', { count: 'exact', head: true });

    if ((count || 0) === 0) {
      // Seed all default products
      const { data: inserted, error } = await supabase.from('products').insert(DEFAULT_PRODUCTS).select('id, name');
      if (error) results.errors.push('products: ' + error.message);
      else results.products = inserted;
    } else {
      results.products = `SKIPPED \u2014 ${count} products already exist`;
    }

    // 2 \u2014 Check if admin exists
    const { data: existingAdmin } = await supabase.from('admins').select('id, username').limit(1).single().catch(() => ({ data: null }));
    if (!existingAdmin) {
      const adminUser = process.env.ADMIN_USERNAME || 'pinnacles_admin';
      const adminPass = process.env.ADMIN_PASSWORD || 'Pinnacles@2024';
      const hash = bcrypt.hashSync(adminPass, 10);
      const { data: newAdmin, error: adminErr } = await supabase.from('admins')
        .insert({ username: adminUser, password_hash: hash, email: process.env.FARM_EMAIL || 'agribusiness@pinnaclescentre.com', role: 'super_admin' })
        .select('id, username').single();
      if (adminErr) results.errors.push('admin: ' + adminErr.message);
      else results.admin = `Created: ${newAdmin.username}`;
    } else {
      results.admin = `SKIPPED \u2014 admin '${existingAdmin.username}' already exists`;
    }

    res.json({ ok: true, results });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message, results });
  }
});

// GET /api/setup/status \u2014 check DB connection and counts
router.get('/status', async (req, res) => {
  try {
    const [{ count: prodCount, error: p1 }, { count: adminCount, error: p2 }, { count: preorderCount, error: p3 }] = await Promise.all([
      supabase.from('products').select('*', { count: 'exact', head: true }),
      supabase.from('admins').select('*', { count: 'exact', head: true }),
      supabase.from('preorders').select('*', { count: 'exact', head: true }),
    ]);
    res.json({
      supabase_url_set:  !!process.env.SUPABASE_URL,
      supabase_key_set:  !!process.env.SUPABASE_SERVICE_KEY,
      db_connected:      !p1 && !p2,
      products_count:    prodCount  || 0,
      admins_count:      adminCount || 0,
      preorders_count:   preorderCount || 0,
      products_error:    p1?.message  || null,
      admins_error:      p2?.message  || null,
      preorders_error:   p3?.message  || null,
    });
  } catch (e) {
    res.status(500).json({ error: e.message, supabase_url_set: !!process.env.SUPABASE_URL });
  }
});

module.exports = router;
