'use strict';

/**
 * Account administration service — used exclusively by the administrator role.
 *
 * Guard rails that support the "no privilege escalation" requirement:
 *  - Role assignment is validated against the central role registry.
 *  - An administrator cannot deactivate or demote their own account.
 *  - The last remaining active administrator cannot be removed.
 *  - Every mutation is audited.
 */

const db = require('../db');
const config = require('../config');
const { hashPassword, validatePasswordStrength } = require('../lib/password');
const { ROLES, isValidRole, roleLabel, permissionsForRole } = require('../config/roles');
const audit = require('./audit');
const sessionService = require('./session');

function nowIso() {
  return new Date().toISOString();
}

const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,31}$/i;

/** Format validation shared by create + edit. */
function validateAccountInput(input, { requirePassword = true } = {}) {
  const errors = {};
  const username = String(input.username || '').trim();
  const fullName = String(input.full_name || '').trim();
  const email = String(input.email || '').trim();
  const role = String(input.role || '').trim();
  const publicId = String(input.public_id || '').trim().toUpperCase();

  if (!username) errors.username = 'Username is required.';
  else if (!USERNAME_RE.test(username)) {
    errors.username = 'Use 3–32 characters: letters, numbers, dot, underscore or hyphen.';
  }

  if (!fullName) errors.full_name = 'Full name is required.';
  else if (fullName.length > 120) errors.full_name = 'Full name is too long.';

  if (!email) errors.email = 'Email address is required.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid email address.';

  if (!role) errors.role = 'A role must be assigned.';
  else if (!isValidRole(role)) errors.role = 'That role is not recognised by the platform.';
  else if (role === ROLES.EXTERNAL_VERIFIER && !publicId.startsWith('VER')) {
    // Not an error — verifiers can use any ID; this branch is intentionally inert.
  }

  if (publicId && !/^[A-Z0-9-]{4,24}$/.test(publicId)) {
    errors.public_id = 'Public ID must be 4–24 characters (letters, numbers, hyphen).';
  }

  if (requirePassword) {
    const strength = validatePasswordStrength(String(input.password || ''), {
      minLength: config.security.passwordMinLength,
    });
    if (!strength.valid) errors.password = strength.errors.join(' ');
    if (input.password !== input.confirm_password) {
      errors.confirm_password = 'The two passwords do not match.';
    }
  }

  return { errors, values: { username, fullName, email, role, publicId } };
}

/** Auto-generate a public ID when the administrator leaves it blank. */
function suggestPublicId(role) {
  const prefixes = {
    [ROLES.STUDENT]: 'STU',
    [ROLES.EXAMINER]: 'EXM',
    [ROLES.MODERATOR]: 'MOD',
    [ROLES.CONTROLLER]: 'CTL',
    [ROLES.DEPARTMENT_HEAD]: 'HOD',
    [ROLES.ADMINISTRATOR]: 'ADM',
    [ROLES.EXTERNAL_VERIFIER]: 'VER',
  };
  const prefix = prefixes[role] || 'USR';
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = `${prefix}${String(Date.now()).slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
    const clash = db.get('SELECT 1 AS x FROM users WHERE public_id = ?', candidate);
    if (!clash) return candidate;
  }
  return `${prefix}${Date.now()}`;
}

/**
 * Create an account.
 * @returns {{ ok: boolean, errors?: object, user?: object }}
 */
async function createAccount({ input, actor, req }) {
  const { errors, values } = validateAccountInput(input, { requirePassword: true });

  if (!errors.username && db.get('SELECT 1 AS x FROM users WHERE username = ? COLLATE NOCASE', values.username)) {
    errors.username = 'That username is already taken.';
  }
  if (!errors.email && db.get('SELECT 1 AS x FROM users WHERE email = ? COLLATE NOCASE', values.email)) {
    errors.email = 'That email address is already registered.';
  }
  const publicId = values.publicId || suggestPublicId(values.role);
  if (db.get('SELECT 1 AS x FROM users WHERE public_id = ?', publicId)) {
    errors.public_id = 'That public ID already exists.';
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const hash = await hashPassword(input.password);
  const now = nowIso();

  const result = db.run(
    `INSERT INTO users
       (username, public_id, full_name, email, role, department, programme, designation,
        password_hash, status, is_demo, must_change_password, password_changed_at,
        created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 0, 1, ?, ?, ?)`,
    values.username,
    publicId,
    values.fullName,
    values.email,
    values.role,
    String(input.department || '').trim() || null,
    String(input.programme || '').trim() || null,
    String(input.designation || '').trim() || null,
    hash,
    now,
    now,
    now
  );

  const user = db.get('SELECT * FROM users WHERE id = ?', Number(result.lastInsertRowid));

  audit.record({
    actor,
    action: 'account.create',
    category: 'account',
    severity: 'info',
    outcome: 'success',
    target: values.username,
    detail: `Created ${roleLabel(values.role)} account "${values.username}" (${publicId}). Temporary password must be changed at first sign-in.`,
    req,
  });

  return { ok: true, user };
}

/** Toggle active / inactive. */
function setStatus({ userId, status, actor, req }) {
  if (!['active', 'inactive'].includes(status)) {
    return { ok: false, error: 'Invalid status.' };
  }

  const user = db.get('SELECT * FROM users WHERE id = ?', userId);
  if (!user) return { ok: false, error: 'Account not found.' };

  if (actor && actor.id === user.id && status === 'inactive') {
    return { ok: false, error: 'You cannot deactivate your own administrator account.' };
  }

  if (status === 'inactive' && user.role === ROLES.ADMINISTRATOR) {
    const activeAdmins = db.get(
      "SELECT COUNT(*) AS c FROM users WHERE role = 'administrator' AND status = 'active'"
    ).c;
    if (activeAdmins <= 1) {
      return { ok: false, error: 'The last active administrator cannot be deactivated.' };
    }
  }

  db.run(
    'UPDATE users SET status = ?, failed_attempts = 0, locked_until = NULL, updated_at = ? WHERE id = ?',
    status,
    nowIso(),
    userId
  );

  let revoked = 0;
  if (status === 'inactive') {
    revoked = sessionService.revokeAllForUser(userId, 'account-deactivated');
  }

  audit.record({
    actor,
    action: status === 'active' ? 'account.activate' : 'account.deactivate',
    category: 'account',
    severity: status === 'inactive' ? 'critical' : 'info',
    outcome: 'success',
    target: user.username,
    detail:
      status === 'active'
        ? 'Account activated.'
        : `Account deactivated; ${revoked} live session(s) revoked immediately.`,
    req,
  });

  return { ok: true, revoked };
}

/** Change a user's role. Privileged roles require an explicit admin action. */
function assignRole({ userId, role, actor, req }) {
  if (!isValidRole(role)) return { ok: false, error: 'Unknown role.' };
  const user = db.get('SELECT * FROM users WHERE id = ?', userId);
  if (!user) return { ok: false, error: 'Account not found.' };

  if (actor && actor.id === user.id && user.role === ROLES.ADMINISTRATOR && role !== ROLES.ADMINISTRATOR) {
    return { ok: false, error: 'You cannot remove your own administrator role.' };
  }

  if (user.role === ROLES.ADMINISTRATOR && role !== ROLES.ADMINISTRATOR) {
    const activeAdmins = db.get(
      "SELECT COUNT(*) AS c FROM users WHERE role = 'administrator' AND status = 'active'"
    ).c;
    if (activeAdmins <= 1) {
      return { ok: false, error: 'The last active administrator cannot be demoted.' };
    }
  }

  if (user.role === role) return { ok: true, unchanged: true };

  db.run('UPDATE users SET role = ?, updated_at = ? WHERE id = ?', role, nowIso(), userId);

  // Force re-authentication so the new permission set is loaded from a fresh login.
  const revoked = sessionService.revokeAllForUser(userId, 'role-changed');

  audit.record({
    actor,
    action: 'role.assign',
    category: 'role',
    severity: 'critical',
    outcome: 'success',
    target: user.username,
    detail: `Role changed from ${roleLabel(user.role)} to ${roleLabel(role)}; ${revoked} session(s) revoked.`,
    req,
  });

  return { ok: true, revoked };
}

/** Update profile fields (not role / status — those have dedicated flows). */
function updateProfile({ userId, input, actor, req }) {
  const user = db.get('SELECT * FROM users WHERE id = ?', userId);
  if (!user) return { ok: false, error: 'Account not found.' };

  const fullName = String(input.full_name || '').trim();
  const email = String(input.email || '').trim();
  const errors = {};
  if (!fullName) errors.full_name = 'Full name is required.';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid email address.';
  if (!errors.email) {
    const clash = db.get('SELECT 1 AS x FROM users WHERE email = ? COLLATE NOCASE AND id <> ?', email, userId);
    if (clash) errors.email = 'That email address is already registered.';
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  db.run(
    `UPDATE users SET full_name = ?, email = ?, department = ?, programme = ?,
            designation = ?, updated_at = ? WHERE id = ?`,
    fullName,
    email,
    String(input.department || '').trim() || null,
    String(input.programme || '').trim() || null,
    String(input.designation || '').trim() || null,
    nowIso(),
    userId
  );

  audit.record({
    actor,
    action: 'account.update',
    category: 'account',
    severity: 'info',
    outcome: 'success',
    target: user.username,
    detail: 'Account profile details updated.',
    req,
  });

  return { ok: true };
}

/** List accounts with optional filters + live session counts. */
function listAccounts({ q = '', role = '', status = '', limit = 200 } = {}) {
  const clauses = [];
  const params = [];

  if (q) {
    clauses.push('(username LIKE ? OR full_name LIKE ? OR email LIKE ? OR public_id LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  if (role && isValidRole(role)) {
    clauses.push('role = ?');
    params.push(role);
  }
  if (status && ['active', 'inactive', 'locked'].includes(status)) {
    clauses.push('status = ?');
    params.push(status);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db.all(
    `SELECT * FROM users ${where}`,
    ...params
  ).slice(0, Math.min(Number(limit) || 200, 500));

  const counts = sessionService.activeCountsByUser();
  return rows.map((row) => ({ ...row, activeSessions: counts[row.id] || 0 }));
}

/** Counters for the administration dashboard. */
function accountStats() {
  const byRole = db.all('SELECT role, COUNT(*) AS c FROM users GROUP BY role');
  const stats = {
    total: db.get('SELECT COUNT(*) AS c FROM users').c,
    active: db.get("SELECT COUNT(*) AS c FROM users WHERE status = 'active'").c,
    inactive: db.get("SELECT COUNT(*) AS c FROM users WHERE status = 'inactive'").c,
    locked: db.get(
      "SELECT COUNT(*) AS c FROM users WHERE locked_until IS NOT NULL AND locked_until > ?",
      nowIso()
    ).c,
    demo: db.get('SELECT COUNT(*) AS c FROM users WHERE is_demo = 1').c,
    byRole: Object.fromEntries(byRole.map((r) => [r.role, r.c])),
  };
  return stats;
}

/** Permission matrix for the admin UI. */
function permissionMatrix(user) {
  const perms = user ? permissionsForRole(user.role) : [];
  return {
    role: user?.role,
    roleLabel: user ? roleLabel(user.role) : null,
    permissions: perms,
  };
}

module.exports = {
  validateAccountInput,
  suggestPublicId,
  createAccount,
  setStatus,
  assignRole,
  updateProfile,
  listAccounts,
  accountStats,
  permissionMatrix,
};
