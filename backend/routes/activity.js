// backend/routes/activity.js
// ══════════════════════════════════════════════════════════════
// Pinnacles Farm — Admin Activity Log
// ══════════════════════════════════════════════════════════════
/*
CREATE TABLE IF NOT EXISTS admin_activity_log (
  id SERIAL PRIMARY KEY,
  admin_name TEXT,
  admin_email TEXT,
  action TEXT NOT NULL, -- 'login', 'logout', 'order_updated', 'product_updated', etc.
  details TEXT, -- JSON string with extra info
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
*/

const express  = require('express');
const router   = express.Router();
const supabase = require('../db');
const { requireAuth } = require('../middleware/auth');

// In-memory fallback ring buffer (holds up to 500 recent events)
const memoryLogs = [];

/**
 * Core logging helper callable directly by other routes or middleware
 */
async function logActivity({
  admin_name = 'Admin',
  admin_email = '',
  action = 'activity',
  details = '',
  ip_address = '',
  user_agent = ''
}) {
  const safeDetails = typeof details === 'object'
    ? JSON.stringify(details)
    : String(details || '');

  const entry = {
    admin_name: String(admin_name || 'Admin'),
    admin_email: String(admin_email || ''),
    action: String(action || 'action'),
    details: safeDetails,
    ip_address: String(ip_address || ''),
    user_agent: String(user_agent || '').slice(0, 255),
    created_at: new Date().toISOString()
  };

  // Prepend to memory cache
  memoryLogs.unshift({ id: 'mem_' + Date.now() + '_' + Math.floor(Math.random() * 1000), ...entry });
  if (memoryLogs.length > 500) memoryLogs.pop();

  // Persist to Supabase if table is configured
  try {
    const { error } = await supabase.from('admin_activity_log').insert({
      admin_name: entry.admin_name,
      admin_email: entry.admin_email,
      action: entry.action,
      details: entry.details,
      ip_address: entry.ip_address,
      user_agent: entry.user_agent,
      created_at: entry.created_at
    });
    if (error) {
      // Table may not yet be migrated in Supabase; memory fallback is active
      // console.warn('[ActivityLog] Supabase write notice:', error.message);
    }
  } catch (err) {
    // Silent catch to prevent activity logging from interrupting primary operations
  }

  return entry;
}

// ── POST /api/activity/log ────────────────────────────────────
// Internal or authenticated route to record an activity
router.post('/log', async (req, res) => {
  try {
    const body = req.body || {};
    const admin_name = body.admin_name || req.user?.username || req.user?.name || 'Admin';
    const admin_email = body.admin_email || req.user?.email || '';
    const action = body.action || 'system_event';
    const details = body.details || '';
    const ip_address = body.ip_address || req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
    const user_agent = body.user_agent || req.headers['user-agent'] || '';

    const logged = await logActivity({
      admin_name,
      admin_email,
      action,
      details,
      ip_address,
      user_agent
    });

    res.json({ ok: true, log: logged });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/activity/logs ─────────────────────────────────────
// Admin-only: retrieve recent 200 activity logs with filtering
router.get('/logs', requireAuth, async (req, res) => {
  try {
    const { action, admin_name, startDate, endDate, date, search } = req.query;

    let dbLogs = null;
    try {
      let query = supabase
        .from('admin_activity_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (action && action !== 'all') {
        query = query.ilike('action', `%${action}%`);
      }
      if (admin_name) {
        query = query.ilike('admin_name', `%${admin_name}%`);
      }
      if (startDate) {
        query = query.gte('created_at', new Date(startDate).toISOString());
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query = query.lte('created_at', end.toISOString());
      } else if (date) {
        const start = new Date(date);
        start.setHours(0, 0, 0, 0);
        const end = new Date(date);
        end.setHours(23, 59, 59, 999);
        query = query.gte('created_at', start.toISOString()).lte('created_at', end.toISOString());
      }

      const { data, error } = await query;
      if (!error && Array.isArray(data) && data.length > 0) {
        dbLogs = data;
      }
    } catch (_) {}

    // Combine Supabase logs and memory logs (avoid duplicates by id/timestamp)
    let combined = [];
    if (dbLogs) {
      combined = [...dbLogs];
    } else {
      combined = [...memoryLogs];
    }

    // Apply memory filters if DB was unavailable or for extra search query
    if (action && action !== 'all') {
      const actLower = action.toLowerCase();
      combined = combined.filter(l => (l.action || '').toLowerCase().includes(actLower));
    }
    if (admin_name) {
      const nameLower = admin_name.toLowerCase();
      combined = combined.filter(l => (l.admin_name || '').toLowerCase().includes(nameLower));
    }
    if (search) {
      const sLower = search.toLowerCase();
      combined = combined.filter(l =>
        (l.action || '').toLowerCase().includes(sLower) ||
        (l.admin_name || '').toLowerCase().includes(sLower) ||
        (l.details || '').toLowerCase().includes(sLower)
      );
    }
    if (startDate) {
      const startMs = new Date(startDate).getTime();
      combined = combined.filter(l => new Date(l.created_at).getTime() >= startMs);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      const endMs = end.getTime();
      combined = combined.filter(l => new Date(l.created_at).getTime() <= endMs);
    } else if (date) {
      const dStr = new Date(date).toISOString().slice(0, 10);
      combined = combined.filter(l => (l.created_at || '').slice(0, 10) === dStr);
    }

    res.json({ logs: combined.slice(0, 200) });
  } catch (err) {
    res.status(500).json({ error: err.message, logs: memoryLogs.slice(0, 200) });
  }
});

module.exports = router;
module.exports.logActivity = logActivity;
