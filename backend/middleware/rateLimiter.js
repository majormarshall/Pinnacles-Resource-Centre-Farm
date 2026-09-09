// ── Rate Limiters ────────────────────────────────────────────
// Uses express-rate-limit with in-memory store (per Vercel instance).
// For persistent cross-instance limits, swap the store for an
// Upstash / Redis adapter.
const rateLimit = require('express-rate-limit');

/** Friendly JSON handler returned on 429 */
function rateLimitHandler(req, res, next, options) {
  res.status(options.statusCode).json({
    error: options.message,
    retryAfter: Math.ceil(options.windowMs / 1000 / 60), // minutes
  });
}

// ── Global API limiter ────────────────────────────────────────
// Applied to every /api/* route — a generous ceiling to block
// obvious scrapers / DoS without affecting real users.
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,  // Return RateLimit-* headers (RFC 6585)
  legacyHeaders: false,
  message: 'Too many requests. Please wait a few minutes and try again.',
  handler: rateLimitHandler,
});

// ── Auth (login) limiter ──────────────────────────────────────
// Tight limit to prevent brute-force on the admin login.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many login attempts. Please wait 15 minutes before trying again.',
  handler: rateLimitHandler,
  skipSuccessfulRequests: true, // Only count failed/all non-2xx responses
});

// ── Order submission limiter ──────────────────────────────────
// Prevents order spam from a single IP.
const orderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many orders submitted. Please wait a few minutes before placing another order.',
  handler: rateLimitHandler,
});

// ── Contact message limiter ───────────────────────────────────
// Prevents contact form spam.
const messageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many messages sent. Please wait a few minutes before sending another message.',
  handler: rateLimitHandler,
});

module.exports = { globalLimiter, authLimiter, orderLimiter, messageLimiter };
