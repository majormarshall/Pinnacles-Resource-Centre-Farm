// backend/db.js
// ══════════════════════════════════════════════════════════════
// Pinnacles Farm — Supabase JS database client
// Uses @supabase/supabase-js — NO pg / PostgreSQL driver
// ══════════════════════════════════════════════════════════════
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ FATAL: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set.');
  console.error('   Add them in Vercel → Settings → Environment Variables.');
  console.error('   Get them from: Supabase Dashboard → Your Project → Settings → API');
}

const supabase = createClient(
  SUPABASE_URL  || 'https://placeholder.supabase.co',
  SUPABASE_KEY  || 'placeholder',
  {
    auth:    { persistSession: false },
    global:  { headers: { 'x-application-name': 'pinnacles-farm' } },
  }
);

console.log('[DB] Supabase JS client ready — using @supabase/supabase-js');

// ── Convenience helper: throw a clean error from a Supabase response ──────
function sbErr(error, context) {
  if (!error) return;
  const msg = error.message || error.details || JSON.stringify(error);
  console.error(`[Supabase] ${context || ''}: ${msg}`);
  throw new Error(msg);
}

module.exports = supabase;
module.exports.sbErr = sbErr;
