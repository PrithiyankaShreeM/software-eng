'use strict';

/**
 * CSRF protection (synchroniser-token pattern).
 *
 * - A per-session random token is stored in a readable cookie *and* inside
 *   the session row.
 * - Every state-changing request (POST/PUT/PATCH/DELETE) must echo the token
 *   in a form field (`_csrf`) or the `X-CSRF-Token` header.
 * - Comparison is timing-safe against the value stored server-side, so an
 *   attacker who can overwrite the cookie cannot forge a valid pair.
 */

const { timingSafeEqualString } = require('../lib/password');
const { wantsJson } = require('./auth');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function tokenFor(req) {
  return req.sessionRow?.csrf_token || req.cookies?.uniexam?.csrf || null;
}

function csrf(req, res, next) {
  // Expose the token to templates.
  res.locals.csrfToken = req.sessionRow?.csrf_token || '';

  if (SAFE_METHODS.has(req.method)) return next();

  const submitted =
    req.body?._csrf ||
    req.get('x-csrf-token') ||
    req.get('x-xsrf-token') ||
    '';

  const expected = req.sessionRow?.csrf_token;

  // Anonymous state-changing requests (login, forgot-password) have no
  // session yet; they are protected by rate limiting and origin checks.
  if (!expected) {
    if (submitted && req.cookies?.['uniexam.csrf'] &&
        timingSafeEqualString(submitted, req.cookies['uniexam.csrf'])) {
      return next();
    }
    // Login form renders a token bound to a cookie set on GET /login.
    return reject(req, res, 'Your security token expired. Please reload the page and try again.');
  }

  if (!submitted || !timingSafeEqualString(String(submitted), String(expected))) {
    return reject(req, res, 'Your security token is invalid or has expired. Please sign in again.');
  }

  return next();
}

function reject(req, res, message) {
  if (wantsJson(req)) {
    return res.status(403).json({ error: 'csrf_failed', message });
  }
  return res.status(403).render('errors/403', {
    title: 'Request blocked',
    message,
    statusCode: 403,
  });
}

/**
 * Issues an anonymous CSRF cookie for the login page so that the login
 * POST can be validated even before a session exists. This prevents
 * login-CSRF (forcing a victim to authenticate as the attacker).
 */
function issueAnonymousCsrf(req, res, next) {
  if (!req.sessionRow && !req.cookies?.['uniexam.csrf']) {
    const { generateToken } = require('../lib/password');
    const token = generateToken(24);
    res.cookie('uniexam.csrf', token, {
      httpOnly: false,
      sameSite: 'lax',
      secure: require('../config').cookieSecure,
      path: '/',
      maxAge: 60 * 60 * 1000,
    });
    req.cookies['uniexam.csrf'] = token;
  }
  next();
}

module.exports = { csrf, issueAnonymousCsrf, tokenFor };
