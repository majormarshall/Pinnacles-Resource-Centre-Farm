// ============================================================
// Pinnacles Resource Centre Farm — Database (Supabase / PostgreSQL)
// ============================================================
const { Pool } = require('pg');
const bcrypt   = require('bcryptjs');

// Default seed products
const DEFAULT_PRODUCTS = [
  ['Fresh Tomatoes','🍅','images/tomatoes.png',1500,'per basket','Sun-ripened juicy tomatoes. Perfect for stews and salads.','vegetables','Bestseller'],
  ['Peppers','🫑','images/pepper.png',1200,'per pack','Fresh bell and chili peppers. Vibrant and full of flavour.','vegetables','Fresh'],
  ['Strawberries','🍓','images/strawberry.png',3500,'per punnet','Sweet juicy strawberries picked at peak ripeness.','fruits','Premium'],
  ['Sweet Maize','🌽','images/maize.png',800,'per 3 cobs','Golden sweet maize cobs freshly harvested.','grains','Fresh'],
  ['Carrots','🥕','images/carrots.png',1000,'per bunch','Crunchy sweet orange carrots. Great for juices and soups.','vegetables','Organic'],
  ['Farm Fresh Eggs','🥚',null,2500,'per crate (30)','Free-range farm eggs — rich and full of protein.','proteins','Popular'],
  ['Green Peas','🫛',null,1800,'per kg','Tender sweet green peas. Perfect for soups and rice dishes.','vegetables','Fresh'],
  ['Fresh Greens','🥬',null,600,'per bunch','Assorted fresh leafy greens including spinach and ugwu.','vegetables','Daily Harvest'],
  ['Garden Cucumber','🥒',null,700,'per pack','Cool crisp cucumbers perfect for salads and juicing.','vegetables','Fresh'],
  ['Spring Onions','🧅',null,500,'per bunch','Fresh spring onions with a mild sweet flavour.','vegetables','Fresh'],
  ['Sweet Pepper','🌶️',null,900,'per pack','Colourful sweet peppers — red, yellow and green.','vegetables','Seasonal'],
  ['Farm Honey','🍯',null,4500,'per jar','Pure raw natural honey from our farm bees.','fruits','Natural'],
];

// ── Connection pool ────────────────────────────────────────────
// Append pgbouncer=true if not already present (disables prepared statements
// which are not supported in Supabase transaction pooler / PgBouncer)
const dbUrl = process.env.DATABASE_URL
  ? (process.env.DATABASE_URL.includes('pgbouncer')
      ? process.env.DATABASE_URL
      : process.env.DATABASE_URL + '?pgbouncer=true')
  : undefined;

const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
  max: 3,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 8000,
});

pool.on('error', err => console.error('PostgreSQL pool error:', err.message));

// ── Convert SQLite ? placeholders → PostgreSQL $1, $2 … ────────
function toPg(sql) {
  let n = 0;
  return sql.replace(/\?/g, () => `$${++n}`);
}

// ── Promisified helpers (same interface as before) ─────────────
const db = {
  runAsync: async (sql, params = []) => {
    const pgSql = toPg(sql);
    const final = /^\s*INSERT/i.test(pgSql) && !/RETURNING/i.test(pgSql)
      ? `${pgSql} RETURNING id`
      : pgSql;
    const r = await pool.query(final, params);
    return { lastID: r.rows[0]?.id ?? null, rowCount: r.rowCount };
  },
  getAsync: async (sql, params = []) => {
    const r = await pool.query(toPg(sql), params);
    return r.rows[0] ?? null;
  },
  allAsync: async (sql, params = []) => {
    const r = await pool.query(toPg(sql), params);
    return r.rows;
  },
};

// ── Schema & seed ──────────────────────────────────────────────
async function initDB() {
  // Products
  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id          SERIAL PRIMARY KEY,
      name        TEXT NOT NULL,
      emoji       TEXT DEFAULT '🌿',
      img         TEXT,
      price       REAL NOT NULL,
      unit        TEXT DEFAULT 'per unit',
      description TEXT DEFAULT '',
      category    TEXT DEFAULT 'vegetables',
      tag         TEXT DEFAULT 'Fresh',
      active      INTEGER DEFAULT 1,
      stock       INTEGER DEFAULT 999,
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

  // Orders
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id             SERIAL PRIMARY KEY,
      customer_name  TEXT,
      customer_phone TEXT,
      items_json     TEXT NOT NULL,
      total          REAL NOT NULL,
      status         TEXT DEFAULT 'pending',
      notes          TEXT DEFAULT '',
      whatsapp_msg   TEXT DEFAULT '',
      created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS whatsapp_msg TEXT DEFAULT ''`).catch(() => {});

  // Messages
  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL,
      phone      TEXT DEFAULT '',
      message    TEXT NOT NULL,
      is_read    INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

  // Gallery
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gallery (
      id          SERIAL PRIMARY KEY,
      img         TEXT NOT NULL,
      alt         TEXT DEFAULT '',
      caption     TEXT DEFAULT '',
      wide        INTEGER DEFAULT 0,
      sort_order  INTEGER DEFAULT 0,
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

  // Admins
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admins (
      id            SERIAL PRIMARY KEY,
      username      TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

  // ── Seed admin ─────────────────────────────────────────────
  const adminUser = process.env.ADMIN_USERNAME || 'admin';
  const adminPass = process.env.ADMIN_PASSWORD || 'Pinnacles2026!';
  const existing  = await db.getAsync('SELECT id FROM admins WHERE username = ?', [adminUser]);
  if (!existing) {
    const hash = bcrypt.hashSync(adminPass, 10);
    await db.runAsync('INSERT INTO admins (username, password_hash) VALUES (?, ?)', [adminUser, hash]);
    console.log(`✅ Admin "${adminUser}" created.`);
  }

  // ── Seed default products ──────────────────────────────────
  const count = await db.getAsync('SELECT COUNT(*)::int AS c FROM products');
  if (Number(count?.c) === 0) {
    for (const [name,emoji,img,price,unit,description,category,tag] of DEFAULT_PRODUCTS) {
      await db.runAsync(
        'INSERT INTO products (name,emoji,img,price,unit,description,category,tag) VALUES (?,?,?,?,?,?,?,?)',
        [name, emoji, img, price, unit, description, category, tag]
      );
    }
    console.log('✅ Default products seeded.');
  }

  // ── Seed default gallery images ────────────────────────────
  const galCount = await db.getAsync('SELECT COUNT(*)::int AS c FROM gallery');
  if (Number(galCount?.c) === 0) {
    const defaultGallery = [
      ['images/farm_hero.png',   'Pinnacles Farm Fields', '', 1, 0],
      ['images/tomatoes.png',    'Fresh Tomatoes',        '', 0, 1],
      ['images/strawberry.png',  'Strawberries',          '', 0, 2],
      ['images/pepper.png',      'Peppers',               '', 0, 3],
      ['images/maize.png',       'Sweet Maize',           '', 0, 4],
      ['images/carrots.png',     'Carrots',               '', 0, 5],
    ];
    for (const [img, alt, caption, wide, sort_order] of defaultGallery) {
      await db.runAsync(
        'INSERT INTO gallery (img, alt, caption, wide, sort_order) VALUES (?,?,?,?,?)',
        [img, alt, caption, wide, sort_order]
      );
    }
    console.log('✅ Default gallery seeded.');
  }

  console.log('✅ Supabase database ready.');
}

initDB().catch(e => console.error('❌ DB init failed:', e.message));

module.exports = db;
