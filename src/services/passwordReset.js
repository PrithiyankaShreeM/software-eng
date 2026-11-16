'use strict';

/**
 * Password reset workflow.
 *
 * - Only a SHA-256 digest of the reset token is stored, so a database leak
 *   cannot be used to reset accounts.
 * - Tokens are single-use and expire after 30 minutes.
 * - Requesting a reset never reveals whether an account exists.
 * - Completing a reset revokes every existing session and clears lockouts.
 *
 * In a real deployment the link would be emailed. For the demonstration the
 * link is surfaced directly in the UI (clearly labelled as demonstration
 * behaviour) because there is no outbound mail server in the sandbox.
 */

const db = require('../db');
const config = require('../config');
const { generateToken, sha256, hashPassword, validatePasswordStrength } = require('../lib/password');
const audit = require('./audit');
const sessionService = require('./session');

const TOKEN_TTL_MINUTES = 30;

function nowIso() {
  return new Date().toISOString();
}

/**
 * Create a reset request for an identifier.
 * Always returns { ok: true } to the caller — the route decides what to show.
 *
 * @returns {{ created: boolean, token?: string, user?: object }}
 */
function requestReset({ identifier, req }) {
  const clean = String(identifier || '').trim();
  if (!clean) return { created: false };

  const user = db.get(
    `SELECT * FROM users
      WHERE username = ? COLLATE NOCASE OR public_id = ? COLLATE NOCASE OR email = ? COLLATE NOCASE
      LIMIT 1`,
    clean,
    clean,
    clean
  );

  if (!user) {
    audit.record({
      action: 'auth.password_reset.request',
      category: 'auth',
      severity: 'warning',
      outcome: 'failure',
      target: clean,
      detail: 'Password reset requested for an identifier with no matching account.',
      req,
    });
    return { created: false };
  }

  if (user.status === 'inactive') {
    audit.record({
      actor: user,
      action: 'auth.password_reset.request',
      category: 'auth',
      severity: 'warning',
      outcome: 'failure',
      target: user.username,
      detail: 'Password reset blocked — account is deactivated.',
      req,
    });
    return { created: false, deactivated: true };
  }

  const token = generateToken(32);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000).toISOString();

  // Invalidate any outstanding tokens for this user first.
  db.run('UPDATE password_resets SET used_at = ? WHERE user_id = ? AND used_at IS NULL', nowIso(), user.id);
  db.run(
    `INSERT INTO password_resets (user_id, token_hash, requested_ip, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
    user.id,
    sha256(token),
    req?.clientIp || null,
    nowIso(),
    expiresAt
  );

  // Surface the token through the audit trail for the demo (not the value
  // itself — only that a request was made).
  audit.record({
    actor: user,
    action: 'auth.password_reset.request',
    category: 'auth',
    severity: 'info',
    outcome: 'success',
    target: user.username,
    detail: `Password reset token issued, valid for ${TOKEN_TTL_MINUTES} minutes.`,
    req,
  });

  return { created: true, token, user };
}

/** Validate a reset token without consuming it. */
function inspectToken(token) {
  if (!token || typeof token !== 'string') return null;
  const row = db.get(
    `SELECT r.*, u.username, u.full_name, u.role, u.status
       FROM password_resets r
       JOIN users u ON u.id = r.user_id
      WHERE r.token_hash = ?`,
    sha256(token)
  );
  if (!row) return null;
  if (row.used_at) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) return null;
  if (row.status !== 'active') return null;
  return row;
}

/**
 * Complete a password reset.
 * @returns {{ ok: boolean, errors?: string[], userId?: number }}
 */
async function completeReset({ token, password, confirmPassword, req }) {
  const record = inspectToken(token);
  if (!record) {
    return { ok: false, errors: ['This reset link is invalid or has expired. Please request a new one.'] };
  }

  if (password !== confirmPassword) {
    return { ok: false, errors: ['The two passwords do not match.'] };
  }

  const strength = validatePasswordStrength(password, {
    minLength: config.security.passwordMinLength,
  });
  if (!strength.valid) {
    return { ok: false, errors: strength.errors };
  }

  const newHash = await hashPassword(password);

  db.transaction(() => {
    db.run(
      `UPDATE users
          SET password_hash = ?, must_change_password = 0, failed_attempts = 0,
              locked_until = NULL, password_changed_at = ?, updated_at = ?
        WHERE id = ?`,
      newHash,
      nowIso(),
      nowIso(),
      record.user_id
    );
    db.run('UPDATE password_resets SET used_at = ? WHERE id = ?', nowIso(), record.id);
  });

  // A password reset must invalidate every existing session.
  const revoked = sessionService.revokeAllForUser(record.user_id, 'password-reset');

  audit.record({
    actor: { id: record.user_id, username: record.username, full_name: record.full_name, role: record.role },
    action: 'auth.password_reset.complete',
    category: 'auth',
    severity: 'critical',
    outcome: 'success',
    target: record.username,
    detail: `Password reset completed; ${revoked} existing session(s) revoked.`,
    req,
  });

  return { ok: true, userId: record.user_id, revoked };
}

/** Admin-initiated reset: generate a one-time temporary password. */
async function adminResetPassword({ userId, actor, req }) {
  const user = db.get('SELECT * FROM users WHERE id = ?', userId);
  if (!user) return { ok: false, error: 'Account not found.' };

  const temporary = generateTemporaryPassword();
  const hash = await hashPassword(temporary);

  db.run(
    `UPDATE users
        SET password_hash = ?, must_change_password = 1, failed_attempts = 0,
            locked_until = NULL, password_changed_at = ?, updated_at = ?
      WHERE id = ?`,
    hash,
    nowIso(),
    nowIso(),
    userId
  );

  const revoked = sessionService.revokeAllForUser(userId, 'admin-password-reset');

  audit.record({
    actor,
    action: 'account.password_reset',
    category: 'account',
    severity: 'critical',
    outcome: 'success',
    target: user.username,
    detail: `Administrator issued a temporary password; ${revoked} session(s) revoked.`,
    req,
  });

  return { ok: true, temporaryPassword: temporary, revoked };
}

/** Human-readable temporary password (demo-friendly, still high entropy). */
function generateTemporaryPassword() {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%&*';
  const all = upper + lower + digits + symbols;
  const crypto = require('node:crypto');

  const pick = (set) => set[crypto.randomInt(0, set.length)];
  const required = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  const rest = Array.from({ length: 8 }, () => pick(all));
  const chars = [...required, ...rest];

  // Fisher-Yates with cryptographic randomness.
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

module.exports = {
  requestReset,
  inspectToken,
  completeReset,
  adminResetPassword,
  generateTemporaryPassword,
  TOKEN_TTL_MINUTES,
};
