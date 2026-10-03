// backend/supabaseClient.js
// Supabase JS client — used alongside the pg Pool in db.js.
// Use this for: Supabase-specific APIs (Storage, Realtime, Auth),
// and for cleaner CRUD queries in new routes.
// The pg-based db.js is still used for raw SQL and migrations.

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL    = process.env.SUPABASE_URL    || '';
const SUPABASE_KEY    = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';

let supabase = null;

if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false },  // Server-side: no session persistence
  });
  console.log('[Supabase] Client initialized');
} else {
  // Fallback — return a stub so routes that import this don't crash
  // when env vars are missing (they'll fall back to db.js pool queries)
  console.warn('[Supabase] SUPABASE_URL / SUPABASE_SERVICE_KEY not set — using pg fallback');
  supabase = {
    from: () => ({ select: async () => ({ data: [], error: null }), insert: async () => ({ data: null, error: 'Supabase not configured' }), update: async () => ({ data: null, error: 'Supabase not configured' }), delete: async () => ({ data: null, error: 'Supabase not configured' }) }),
  };
}

module.exports = supabase;
