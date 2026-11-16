'use strict';

/**
 * Session management.
 *
 * Security properties
 * -------------------
 * - The browser cookie carries a random 32-byte token; the database stores
 *   only its SHA-256 digest. A leaked database dump cannot be replayed as
 *   a session cookie.
 * - Sessions are server-side and revocable: deactivating an account or
 *   forcing a logout deletes/revokes rows, and the very next request fails.
 * - Idle timeout is enforced against `expires_at`, refreshed at most once
 *   per minute to avoid a write on every request.
 * - A CSRF token is bound to the session and compared on every state
 *   changing request.
 */

const crypto = require('node:crypto');
const db = require('../db');
const config = require('../config');
const { sha256, generateToken } = require('../lib/password');

const { cookieName, csrfCookieName, idleMinutes, rememberDays, touchIntervalMs } = config.session;

function nowIso() {
  return new Date().toISOString();
}

function expiryFor(remember) {
  const ms = remember
    ? rememberDays * 24 * 60 * 60 * 1000
    : idleMinutes * 60 * 1000;
  return new Date(Date.now() + ms).toISOString();
}

function cookieOptions(maxAgeMs) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    path: '/',
    maxAge: maxAgeMs,
  };
}

/**
 * Create a session for a user and attach cookies to the response.
 * @returns {{ token: string, csrfToken: string, session: object }}
 */
function create(req, res, user, { remember = false } = {}) {
  const token = generateToken(32);
  const csrfToken = generateToken(24);
  const expiresAt = expiryFor(remember);
  const now = nowIso();

  db.run(
    `INSERT INTO sessions
       (token_hash, csrf_token, user_id, ip_address, user_agent, remember,
        created_at, last_seen_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    sha256(token),
    csrfToken,
    user.id,
    req.clientIp || null,
    req.get('user-agent')?.slice(0, 255) || null,
    remember ? 1 : 0,
    now,
    now,
    expiresAt
  );

  const maxAge = new Date(expiresAt).getTime() - Date.now();
  res.cookie(cookieName, token, cookieOptions(maxAge));
  // The CSRF cookie is readable by JS so forms in the browser can echo it.
  res.cookie(csrfCookieName, csrfToken, {
    ...cookieOptions(maxAge),
    httpOnly: false,
  });

  return {
    token,
    csrfToken,
    session: { expiresAt, remember },
  };
}

/**
 * Look up a session from a raw cookie token.
 * Returns null when missing, revoked or expired.
 */
function lookup(token) {
  if (!token || typeof token !== 'string') return null;

  const hash = sha256(token);
  const row = db.get(
    `SELECT s.*, u.username, u.full_name, u.role, u.status AS user_status,
            u.is_demo, u.public_id, u.department
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ?`,
    hash
  );

  if (!row) return null;
  if (row.revoked_at) return null;

  const now = Date.now();
  if (new Date(row.expires_at).getTime() <= now) {
    revokeByToken(token, 'expired');
    return null;
  }

  // An account deactivated mid-session loses access immediately.
  if (row.user_status !== 'active') {
    revokeByToken(token, 'account-not-active');
    return null;
  }

  // Sliding idle window (throttled write).
  const lastSeen = new Date(row.last_seen_at).getTime();
  if (now - lastSeen > touchIntervalMs) {
    const nextExpiry = expiryFor(Boolean(row.remember));
    db.run(
      'UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE id = ?',
      nowIso(),
      nextExpiry,
      row.id
    );
    row.expires_at = nextExpiry;
  }
  row.last_seen_at = nowIso();

  return row;
}

/** Idle window remaining, in minutes — surfaced in the UI session badge. */
function minutesRemaining(sessionRow) {
  if (!sessionRow) return 0;
  return Math.max(0, Math.round((new Date(sessionRow.expires_at).getTime() - Date.now()) / 60000));
}

function revokeByToken(token, reason = 'logout') {
  if (!token) return 0;
  const res = db.run(
    `UPDATE sessions SET revoked_at = ?, revoked_reason = ?
      WHERE token_hash = ? AND revoked_at IS NULL`,
    nowIso(),
    reason,
    sha256(token)
  );
  return Number(res.changes || 0);
}

/** Revoke every live session for a user (used on deactivate / password reset). */
function revokeAllForUser(userId, reason = 'admin-action', { exceptSessionToken = null } = {}) {
  const exceptHash = exceptSessionToken ? sha256(exceptSessionToken) : null;
  const res = exceptHash
    ? db.run(
        `UPDATE sessions SET revoked_at = ?, revoked_reason = ?
          WHERE user_id = ? AND revoked_at IS NULL AND token_hash <> ?`,
        nowIso(),
        reason,
        userId,
        exceptHash
      )
    : db.run(
        `UPDATE sessions SET revoked_at = ?, revoked_reason = ?
          WHERE user_id = ? AND revoked_at IS NULL`,
        nowIso(),
        reason,
        userId
      );
  return Number(res.changes || 0);
}

function clearCookies(res) {
  res.clearCookie(cookieName, { path: '/' });
  res.clearCookie(csrfCookieName, { path: '/' });
}

/** Live session count per user, for the admin account table. */
function activeCountsByUser() {
  const rows = db.all(
    `SELECT user_id, COUNT(*) AS c FROM sessions
      WHERE revoked_at IS NULL AND expires_at > ?
      GROUP BY user_id`,
    nowIso()
  );
  return Object.fromEntries(rows.map((r) => [r.user_id, r.c]));
}

function listActiveForUser(userId) {
  return db.all(
    `SELECT * FROM sessions
      WHERE user_id = ? AND revoked_at IS NULL AND expires_at > ?
      ORDER BY last_seen_at DESC`,
    userId,
    nowIso()
  );
}

/** Housekeeping: delete expired rows so the table does not grow forever. */
function pruneExpired() {
  const res = db.run(
    'DELETE FROM sessions WHERE expires_at <= ? OR revoked_at IS NOT NULL',
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  );
  return Number(res.changes || 0);
}

/** Parse the session cookie from a raw `Cookie` header (used in tests). */
function tokenFromCookieHeader(header = '') {
  const match = header.match(new RegExp(`(?:^|;\\s*)${cookieName.replace(/\./g, '\\.')}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

module.exports = {
  create,
  lookup,
  revokeByToken,
  revokeAllForUser,
  clearCookies,
  activeCountsByUser,
  listActiveForUser,
  pruneExpired,
  minutesRemaining,
  tokenFromCookieHeader,
  cookieName,
  csrfCookieName,
  // exposed for tests
  _crypto: crypto,
};
