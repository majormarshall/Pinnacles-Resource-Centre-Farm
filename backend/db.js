// ============================================================
// Pinnacles Resource Centre Farm — Database Setup (sqlite3)
// ============================================================
const sqlite3 = require('sqlite3').verbose();
const path    = require('path');
const bcrypt  = require('bcryptjs');

// On Vercel serverless, only /tmp is writable. Use it there; use local path otherwise.
const DB_PATH = process.env.VERCEL
  ? '/tmp/pinnacles_farm.db'
  : path.join(__dirname, 'pinnacles_farm.db');
const db = new sqlite3.Database(DB_PATH);

// ── Promisify helpers ─────────────────────────────────────────
const run  = (sql, params=[]) => new Promise((res,rej) => db.run(sql, params, function(e){ if(e) rej(e); else res(this); }));
const get  = (sql, params=[]) => new Promise((res,rej) => db.get(sql, params, (e,r)=>{ if(e) rej(e); else res(r); }));
const all  = (sql, params=[]) => new Promise((res,rej) => db.all(sql, params, (e,r)=>{ if(e) rej(e); else res(r); }));

// Export interface
db.runAsync  = run;
db.getAsync  = get;
db.allAsync  = all;

// ── Schema ─────────────────────────────────────────────────────
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
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

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
    console.log(`✅ Admin user "${adminUser}" created.`);
  }

  // Seed default products
  const count = await get('SELECT COUNT(*) as c FROM products');
  if (count.c === 0) {
    const defaults = [
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
    for (const [name,emoji,img,price,unit,description,category,tag] of defaults) {
      await run(
        'INSERT INTO products (name,emoji,img,price,unit,description,category,tag) VALUES (?,?,?,?,?,?,?,?)',
        [name,emoji,img,price,unit,description,category,tag]
      );
    }
    console.log('✅ Default products seeded.');
  }
}

initDB().catch(console.error);

module.exports = db;
