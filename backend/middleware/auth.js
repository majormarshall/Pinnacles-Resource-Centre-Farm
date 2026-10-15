// backend/middleware/auth.js
// ══════════════════════════════════════════════════════════════
// JWT Authentication & Activity Logging Middleware
// ══════════════════════════════════════════════════════════════
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'pinnacles_farm_secret_2026_jwt';

let logActivityFn = null;
function getLogger() {
  if (!logActivityFn) {
    try {
      logActivityFn = require('../routes/activity').logActivity;
    } catch (_) {}
  }
  return logActivityFn;
}

function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = (authHeader && authHeader.split(' ')[1]) || req.query.token;
  if (!token) return res.status(401).json({ error: 'Access denied. No token.' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded; // legacy compat — some routes use req.admin
    req.user  = decoded; // new standard — farm routes use req.user

    // ── Log Write Operations (POST, PATCH, DELETE, PUT) ────────
    const writeMethods = ['POST', 'PATCH', 'DELETE', 'PUT'];
    if (writeMethods.includes(req.method)) {
      const url = req.originalUrl || req.url || '';
      // Don't log the activity logger itself to prevent infinite loops
      if (!url.includes('/api/activity/log')) {
        res.on('finish', () => {
          // Only log successful operations
          if (res.statusCode >= 200 && res.statusCode < 400) {
            const logger = getLogger();
            if (logger) {
              const adminName = decoded.username || decoded.name || 'Admin';
              const adminEmail = decoded.email || '';

              let actionSuffix = 'updated';
              if (req.method === 'DELETE') actionSuffix = 'deleted';
              else if (req.method === 'POST') actionSuffix = 'created';
              else if (req.method === 'PATCH' || req.method === 'PUT') actionSuffix = 'updated';

              const pathSegments = url.split('?')[0].split('/').filter(Boolean);
              // E.g. /api/products/12 -> 'product_updated'
              let resource = pathSegments[1] || 'item';
              if (resource.endsWith('s') && resource.length > 2) {
                resource = resource.slice(0, -1);
              }
              const actionName = `${resource}_${actionSuffix}`;

              // Sanitize body (strip passwords)
              let safeBody = undefined;
              if (req.body && typeof req.body === 'object') {
                safeBody = { ...req.body };
                delete safeBody.password;
                delete safeBody.newPassword;
                delete safeBody.currentPassword;
                delete safeBody.password_hash;
              }

              logger({
                admin_name: adminName,
                admin_email: adminEmail,
                action: actionName,
                details: JSON.stringify({
                  method: req.method,
                  path: url,
                  status: res.statusCode,
                  body: safeBody
                }),
                ip_address: req.ip || req.headers['x-forwarded-for'] || '',
                user_agent: req.headers['user-agent'] || ''
              }).catch(() => {});
            }
          }
        });
      }
    }

    next();
  } catch (err) {
    res.status(403).json({ error: 'Invalid or expired token.' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    const userRole = req.user.role || 'ecomm_admin';
    // Owner and legacy super_admin have access to all routes
    if (userRole === 'owner' || userRole === 'super_admin') return next();
    if (!roles.includes(userRole)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
