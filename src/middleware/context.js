'use strict';

/**
 * Per-request context: client IP normalisation and flash messages.
 */

const config = require('../config');

/** Resolve the client IP, honouring a single proxy hop when present. */
function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || req.ip || null;
}

/** Attach `req.clientIp` and a minimal flash-message store. */
function context(req, res, next) {
  req.clientIp = clientIp(req);

  // Flash messages live in a short-lived signed cookie so they survive
  // exactly one redirect without needing an extra session write.
  // The queue is kept on `req` so multiple calls within one request all
  // survive (e.g. a validation summary plus a hint).
  req.flashQueue = [];

  req.flash = (type, message) => {
    if (!message) return;
    req.flashQueue.push({ type, message });

    res.cookie('uniexam.flash', Buffer.from(JSON.stringify(req.flashQueue)).toString('base64'), {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.cookieSecure,
      path: '/',
      maxAge: 60 * 1000,
      signed: true,
    });
  };

  next();
}

/**
 * Read (and clear) flash messages. Runs after cookie parsing; called from
 * the view-rendering middleware so every template can show them.
 */
function consumeFlash(req, res, next) {
  const raw = req.signedCookies?.['uniexam.flash'];
  req.flashMessages = [];
  if (raw) {
    try {
      const parsed = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
      if (Array.isArray(parsed)) {
        req.flashMessages = parsed
          .filter((m) => m && typeof m.message === 'string')
          .slice(0, 5)
          .map((m) => ({ type: String(m.type || 'info'), message: m.message }));
      }
    } catch {
      req.flashMessages = [];
    }
    res.clearCookie('uniexam.flash', { path: '/' });
  }
  next();
}

module.exports = { context, consumeFlash, clientIp };
