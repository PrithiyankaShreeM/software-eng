'use strict';

/**
 * Authentication service.
 *
 * Responsibilities
 * ----------------
 * - Resolve a User ID against the selected portal category.
 * - Verify passwords with scrypt in constant-ish time.
 * - Enforce account state (active / inactive / locked).
 * - Brute-force lockout after N failed attempts.
 * - Issue + revoke sessions.
 * - Write audit entries for every outcome.
 *
 * Deliberate design decision: the *same* generic message is returned for
 * "no such user" and "wrong password" so the login form cannot be used to
 * enumerate valid Student IDs. Account-state problems (deactivated, locked)
 * are revealed only after the correct password is supplied.
 */

const db = require('../db');
const config = require('../config');
const { ROLES, ROLE_DEFINITIONS, roleLabel } = require('../config/roles');
const { verifyPassword } = require('../lib/password');
const audit = require('./audit');
const sessionService = require('./session');

const GENERIC_FAILURE = 'Invalid User ID or password. Please check your credentials and try again.';

/** Portal category → the roles permitted to sign in through it. */
const CATEGORY_ROLES = {
  student: [ROLES.STUDENT],
  staff: [ROLES.EXAMINER, ROLES.MODERATOR, ROLES.CONTROLLER, ROLES.DEPARTMENT_HEAD],
  administrator: [ROLES.ADMINISTRATOR],
  verifier: [ROLES.EXTERNAL_VERIFIER],
};

function nowIso() {
  return new Date().toISOString();
}

/** Friendly portal names used in user-facing messages. */
const PORTAL_NAMES = {
  student: 'student',
  staff: 'staff',
  administrator: 'administrator',
  verifier: 'external verifier',
};

function portalName(portal) {
  return PORTAL_NAMES[portal] || portal;
}

function findByIdentifier(identifier) {
  if (!identifier) return null;
  return db.get(
    `SELECT * FROM users
      WHERE username = ? COLLATE NOCASE OR public_id = ? COLLATE NOCASE
      LIMIT 1`,
    identifier,
    identifier
  );
}

function findById(id) {
  return db.get('SELECT * FROM users WHERE id = ?', id);
}

/** Safe subset of user fields placed on the request / rendered in views. */
function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    publicId: user.public_id,
    fullName: user.full_name,
    email: user.email,
    role: user.role,
    roleLabel: roleLabel(user.role),
    department: user.department,
    programme: user.programme,
    designation: user.designation,
    isDemo: Boolean(user.is_demo),
    mustChangePassword: Boolean(user.must_change_password),
    lastLoginAt: user.last_login_at,
  };
}

/**
 * Attempt a login.
 *
 * @param {object} params
 * @param {string} params.identifier  Student ID / Staff ID / username
 * @param {string} params.password
 * @param {string} params.category    portal key: student|staff|administrator|verifier
 * @param {boolean} params.remember
 * @param {object} params.req         express request (for ip/ua/audit)
 * @param {object} params.res         express response (to set cookies)
 * @returns {Promise<{ok: boolean, message?: string, field?: string, user?: object, redirectTo?: string}>}
 */
async function login({ identifier, password, category, remember = false, req, res }) {
  const cleanIdentifier = String(identifier || '').trim();
  const portal = CATEGORY_ROLES[category] ? category : null;

  if (!cleanIdentifier || !password) {
    return {
      ok: false,
      field: !cleanIdentifier ? 'identifier' : 'password',
      message: 'Both the User ID and password are required.',
    };
  }

  if (!portal) {
    return { ok: false, message: 'Please choose a valid login portal.' };
  }

  const user = findByIdentifier(cleanIdentifier);

  // ---- Unknown user ------------------------------------------------------
  if (!user) {
    audit.record({
      action: 'auth.login',
      category: 'auth',
      severity: 'warning',
      outcome: 'failure',
      target: cleanIdentifier,
      detail: `No account matches "${cleanIdentifier}" (portal: ${portal}).`,
      req,
    });
    return { ok: false, field: 'identifier', message: GENERIC_FAILURE };
  }

  // ---- Wrong portal for this role ---------------------------------------
  const allowedRoles = CATEGORY_ROLES[portal];
  if (!allowedRoles.includes(user.role)) {
    audit.record({
      actor: user,
      action: 'auth.login.portal_mismatch',
      category: 'access',
      severity: 'warning',
      outcome: 'failure',
      target: user.username,
      detail: `${roleLabel(user.role)} attempted to sign in through the "${category}" portal.`,
      req,
    });
    return {
      ok: false,
      field: 'identifier',
      message: `This account is not ${portal === 'external' ? 'an' : portal === 'administrator' ? 'an' : 'a'} ${portalName(portal)} account. Please use the portal that matches your assigned role.`,
    };
  }

  // ---- Locked account ----------------------------------------------------
  if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
    const mins = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 60000);
    audit.record({
      actor: user,
      action: 'auth.login.locked',
      category: 'auth',
      severity: 'warning',
      outcome: 'failure',
      target: user.username,
      detail: `Login rejected — account locked for another ${mins} minute(s).`,
      req,
    });
    return {
      ok: false,
      message: `This account is temporarily locked due to repeated failed sign-in attempts. Try again in ${mins} minute(s) or contact the examination office.`,
    };
  }

  // ---- Password check ----------------------------------------------------
  const passwordOk = await verifyPassword(password, user.password_hash);

  if (!passwordOk) {
    const attempts = Number(user.failed_attempts || 0) + 1;
    const max = config.security.maxLoginAttempts;

    if (attempts >= max) {
      const lockedUntil = new Date(
        Date.now() + config.security.lockoutMinutes * 60 * 1000
      ).toISOString();
      db.run(
        'UPDATE users SET failed_attempts = 0, locked_until = ?, updated_at = ? WHERE id = ?',
        lockedUntil,
        nowIso(),
        user.id
      );
      audit.record({
        actor: user,
        action: 'auth.login.lockout',
        category: 'auth',
        severity: 'critical',
        outcome: 'failure',
        target: user.username,
        detail: `Account locked for ${config.security.lockoutMinutes} minutes after ${max} failed attempts.`,
        req,
      });
      return {
        ok: false,
        message: `Too many failed attempts. This account is locked for ${config.security.lockoutMinutes} minutes.`,
      };
    }

    db.run('UPDATE users SET failed_attempts = ?, updated_at = ? WHERE id = ?', attempts, nowIso(), user.id);
    audit.record({
      actor: user,
      action: 'auth.login',
      category: 'auth',
      severity: 'warning',
      outcome: 'failure',
      target: user.username,
      detail: `Incorrect password (attempt ${attempts} of ${max}).`,
      req,
    });

    const remaining = max - attempts;
    return {
      ok: false,
      field: 'password',
      message:
        remaining <= 2
          ? `${GENERIC_FAILURE} ${remaining} attempt(s) remaining before the account is locked.`
          : GENERIC_FAILURE,
    };
  }

  // Password is correct — now it is safe to disclose account state.
  if (user.status === 'inactive') {
    audit.record({
      actor: user,
      action: 'auth.login.deactivated',
      category: 'auth',
      severity: 'warning',
      outcome: 'failure',
      target: user.username,
      detail: `Sign-in blocked — account is ${user.status}.`,
      req,
    });
    return {
      ok: false,
      message:
        'This account has been deactivated by the system administrator. Please contact the examination office for assistance.',
    };
  }

  if (user.status !== 'active') {
    return { ok: false, message: 'This account is not available for sign-in. Please contact the administrator.' };
  }

  // ---- Success -----------------------------------------------------------
  db.run(
    `UPDATE users
        SET failed_attempts = 0, locked_until = NULL, last_login_at = ?, last_login_ip = ?,
            updated_at = ?
      WHERE id = ?`,
    nowIso(),
    req?.clientIp || null,
    nowIso(),
    user.id
  );

  sessionService.create(req, res, user, { remember });

  audit.record({
    actor: user,
    action: 'auth.login',
    category: 'auth',
    severity: 'info',
    outcome: 'success',
    target: user.username,
    detail: `${roleLabel(user.role)} signed in via the ${category} portal${remember ? ' (remember me)' : ''}.`,
    req,
  });

  return {
    ok: true,
    user: publicUser({ ...user, last_login_at: nowIso() }),
    redirectTo: ROLE_DEFINITIONS[user.role]?.dashboardPath || '/',
  };
}

/** Log out the current session. */
function logout({ req, res, reason = 'logout' }) {
  const raw = req.cookies?.[sessionService.cookieName];
  if (raw) sessionService.revokeByToken(raw, reason);
  sessionService.clearCookies(res);

  if (req.user) {
    audit.record({
      actor: req.user,
      action: 'auth.logout',
      category: 'auth',
      severity: 'info',
      outcome: 'success',
      target: req.user.username,
      detail: 'Signed out of the platform.',
      req,
    });
  }
}

module.exports = {
  CATEGORY_ROLES,
  findByIdentifier,
  findById,
  publicUser,
  login,
  logout,
  GENERIC_FAILURE,
};
