// JWT Authentication Middleware
const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>
  if (!token) return res.status(401).json({ error: 'Access denied. No token.' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = decoded; // legacy compat — some routes use req.admin
    req.user  = decoded; // new standard — farm routes use req.user
    next();
  } catch {
    res.status(403).json({ error: 'Invalid or expired token.' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!roles.includes(req.user.role || 'ecomm_admin'))
      return res.status(403).json({ error: 'Insufficient permissions' });
    next();
  };
}

module.exports = { requireAuth, requireRole };
