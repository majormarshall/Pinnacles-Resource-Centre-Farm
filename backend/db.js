// ============================================================
// Pinnacles Resource Centre Farm — Database
// PostgreSQL (Supabase) when DATABASE_URL is set → persistent
// SQLite otherwise (local dev / Vercel fallback)
// ============================================================
const bcrypt = require('bcryptjs');

const DATABASE_URL = process.env.DATABASE_URL;
const IS_VERCEL    = !!process.env.VERCEL;

// ── Shared seed data ──────────────────────────────────────────
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

// ── Helper: convert SQLite ? → PostgreSQL $1 $2 … ─────────────
function toPg(sql) {
  let n = 0;
  return sql.replace(/\?/g, () => `$${++n}`);
}

// =============================================================
// ── A) PostgreSQL (Supabase) — persistent, used on Vercel ────
// =============================================================
if (DATABASE_URL) {
  let pool;
  try {
    const { Pool } = require('pg');
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 3,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 8000,
    });
  } catch (e) {
    console.error('pg module error:', e.message);
  }

  const db = {
    runAsync: async (sql, params = []) => {
      if (!pool) throw new Error('PostgreSQL pool not initialised');
      const pgSql = toPg(sql);
      const final = /^\s*INSERT/i.test(pgSql) && !/RETURNING/i.test(pgSql)
        ? `${pgSql} RETURNING id` : pgSql;
      const r = await pool.query(final, params);
      return { lastID: r.rows[0]?.id ?? null, rowCount: r.rowCount };
    },
    getAsync: async (sql, params = []) => {
      if (!pool) throw new Error('PostgreSQL pool not initialised');
      const r = await pool.query(toPg(sql), params);
      return r.rows[0] ?? null;
    },
    allAsync: async (sql, params = []) => {
      if (!pool) throw new Error('PostgreSQL pool not initialised');
      const r = await pool.query(toPg(sql), params);
      return r.rows;
    },
  };

  async function initDB() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id          SERIAL PRIMARY KEY,
        name        TEXT NOT NULL,
        emoji       TEXT DEFAULT '🌿',
        img         TEXT,
        price       REAL NOT NULL,
        unit        TEXT DEFAULT 'per unit',
        description TEXT,
        category    TEXT DEFAULT 'vegetables',
        tag         TEXT DEFAULT 'Fresh',
        active      INTEGER DEFAULT 1,
        stock       INTEGER DEFAULT 999,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id             SERIAL PRIMARY KEY,
        customer_name  TEXT,
        customer_phone TEXT,
        items_json     TEXT NOT NULL,
        total          REAL NOT NULL,
        status         TEXT DEFAULT 'pending',
        notes          TEXT,
        whatsapp_msg   TEXT,
        created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
    await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS whatsapp_msg TEXT`).catch(() => {});

    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id         SERIAL PRIMARY KEY,
        name       TEXT NOT NULL,
        phone      TEXT,
        message    TEXT NOT NULL,
        is_read    INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id            SERIAL PRIMARY KEY,
        username      TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);

    // Seed admin
    const adminUser = process.env.ADMIN_USERNAME || 'admin';
    const adminPass = process.env.ADMIN_PASSWORD || 'Pinnacles2026!';
    const existing  = await db.getAsync('SELECT id FROM admins WHERE username = ?', [adminUser]);
    if (!existing) {
      const hash = bcrypt.hashSync(adminPass, 10);
      await db.runAsync('INSERT INTO admins (username, password_hash) VALUES (?, ?)', [adminUser, hash]);
      console.log(`✅ [PG] Admin "${adminUser}" created.`);
    }

    // Seed default products
    const count = await db.getAsync('SELECT COUNT(*)::int AS c FROM products');
    if (Number(count?.c) === 0) {
      for (const [name,emoji,img,price,unit,description,category,tag] of DEFAULT_PRODUCTS) {
        await db.runAsync(
          'INSERT INTO products (name,emoji,img,price,unit,description,category,tag) VALUES (?,?,?,?,?,?,?,?)',
          [name, emoji, img, price, unit, description, category, tag]
        );
      }
      console.log('✅ [PG] Default products seeded.');
    }
    console.log('✅ [PG] Database ready (Supabase).');
  }

  initDB().catch(e => console.error('❌ DB init error:', e.message));
  module.exports = db;

// =============================================================
// ── B) SQLite — local dev or Vercel without DATABASE_URL ──────
// =============================================================
} else {
  const sqlite3 = require('sqlite3').verbose();
  const path    = require('path');

  // On Vercel /tmp is the only writable path. Locally use the backend folder.
  const DB_PATH = IS_VERCEL
    ? '/tmp/pinnacles_farm.db'
    : path.join(__dirname, 'pinnacles_farm.db');

  const sqliteDb = new sqlite3.Database(DB_PATH);
  const run = (sql, p=[]) => new Promise((res,rej) => sqliteDb.run(sql, p, function(e){ if(e) rej(e); else res(this); }));
  const get = (sql, p=[]) => new Promise((res,rej) => sqliteDb.get(sql, p, (e,r)=>{ if(e) rej(e); else res(r); }));
  const all = (sql, p=[]) => new Promise((res,rej) => sqliteDb.all(sql, p, (e,r)=>{ if(e) rej(e); else res(r); }));

  const db = { runAsync: run, getAsync: get, allAsync: all };

  async function initDB() {
    await run('PRAGMA journal_mode=WAL');
    await run('PRAGMA foreign_keys=ON');

    await run(`CREATE TABLE IF NOT EXISTS products (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      emoji       TEXT DEFAULT '🌿',
      img         TEXT,
      price       REAL NOT NULL,
      unit        TEXT DEFAULT 'per unit',
      description TEXT,
      category    TEXT DEFAULT 'vegetables',
      tag         TEXT DEFAULT 'Fresh',
      active      INTEGER DEFAULT 1,
      stock       INTEGER DEFAULT 999,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    await run(`CREATE TABLE IF NOT EXISTS orders (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name  TEXT,
      customer_phone TEXT,
      items_json     TEXT NOT NULL,
      total          REAL NOT NULL,
      status         TEXT DEFAULT 'pending',
      notes          TEXT,
      whatsapp_msg   TEXT,
      created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    try { await run(`ALTER TABLE orders ADD COLUMN whatsapp_msg TEXT`); } catch (_) {}

    await run(`CREATE TABLE IF NOT EXISTS messages (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      phone      TEXT,
      message    TEXT NOT NULL,
      is_read    INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    await run(`CREATE TABLE IF NOT EXISTS admins (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Seed admin
    const adminUser = process.env.ADMIN_USERNAME || 'admin';
    const adminPass = process.env.ADMIN_PASSWORD || 'Pinnacles2026!';
    const existing  = await get('SELECT id FROM admins WHERE username = ?', [adminUser]);
    if (!existing) {
      const hash = bcrypt.hashSync(adminPass, 10);
      await run('INSERT INTO admins (username, password_hash) VALUES (?, ?)', [adminUser, hash]);
      console.log(`✅ [SQLite] Admin "${adminUser}" created.`);
    }

    // Seed default products
    const count = await get('SELECT COUNT(*) as c FROM products');
    if (Number(count?.c) === 0) {
      for (const [name,emoji,img,price,unit,description,category,tag] of DEFAULT_PRODUCTS) {
        await run(
          'INSERT INTO products (name,emoji,img,price,unit,description,category,tag) VALUES (?,?,?,?,?,?,?,?)',
          [name, emoji, img, price, unit, description, category, tag]
        );
      }
      console.log('✅ [SQLite] Default products seeded.');
    }
    if (IS_VERCEL) console.warn('⚠️  Running with temporary SQLite — add DATABASE_URL to Vercel for persistence!');
  }

  initDB().catch(console.error);
  module.exports = db;
}
