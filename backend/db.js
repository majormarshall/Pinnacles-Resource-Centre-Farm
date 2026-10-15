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

// ── runAsync / allAsync compatibility helpers ──────────────
supabase.runAsync = async function(sql, params = []) {
  try {
    if (/^\s*CREATE\s+TABLE/i.test(sql)) {
      try { await supabase.rpc('exec_sql', { query: sql }); } catch (_) {}
      return { ok: true, lastID: 1 };
    }
    if (/INSERT\s+INTO\s+product_reviews/i.test(sql)) {
      const [product_id, customer_name, customer_phone, rating, review_text] = params;
      const { data, error } = await supabase
        .from('product_reviews')
        .insert({
          product_id: Number(product_id),
          customer_name,
          customer_phone: customer_phone || null,
          rating: Number(rating),
          review_text: review_text || null,
          approved: false
        })
        .select('id')
        .single();
      if (error) throw error;
      return { lastID: data?.id, rows: [data] };
    }
    if (/UPDATE\s+product_reviews\s+SET\s+approved=\?\s+WHERE\s+id=\?/i.test(sql)) {
      const [approved, id] = params;
      const { error } = await supabase
        .from('product_reviews')
        .update({ approved: approved === true || approved === 1 || approved === 'true' })
        .eq('id', id);
      if (error) throw error;
      return { changes: 1 };
    }
    if (/INSERT\s+INTO\s+farm_expenses/i.test(sql)) {
      const [category, description, amount, expense_date, paid_to, receipt_ref, recorded_by] = params;
      const { data, error } = await supabase
        .from('farm_expenses')
        .insert({
          category: category || 'general',
          description,
          amount: Number(amount),
          expense_date,
          paid_to: paid_to || null,
          receipt_ref: receipt_ref || null,
          recorded_by: recorded_by || null
        })
        .select('id')
        .single();
      if (error) throw error;
      return { lastID: data?.id, rows: [data] };
    }
    if (/DELETE\s+FROM\s+farm_expenses\s+WHERE\s+id=\?/i.test(sql)) {
      const [id] = params;
      const { error } = await supabase.from('farm_expenses').delete().eq('id', id);
      if (error) throw error;
      return { changes: 1 };
    }
    return { ok: true };
  } catch (err) {
    console.warn('[db.runAsync]:', err.message);
    throw err;
  }
};

supabase.allAsync = async function(sql, params = []) {
  try {
    if (/FROM\s+product_reviews\s+WHERE\s+product_id=\?\s+AND\s+approved=true/i.test(sql)) {
      const { data, error } = await supabase
        .from('product_reviews')
        .select('*')
        .eq('product_id', params[0])
        .eq('approved', true)
        .order('created_at', { ascending: false });
      if (error) return [];
      return data || [];
    }
    if (/FROM\s+product_reviews/i.test(sql)) {
      const { data, error } = await supabase
        .from('product_reviews')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) return [];
      return data || [];
    }
    if (/FROM\s+farm_expenses/i.test(sql)) {
      const { data, error } = await supabase
        .from('farm_expenses')
        .select('*')
        .order('expense_date', { ascending: false });
      if (error) return [];
      return data || [];
    }
    return [];
  } catch (err) {
    console.warn('[db.allAsync]:', err.message);
    return [];
  }
};

module.exports = supabase;
module.exports.sbErr = sbErr;

