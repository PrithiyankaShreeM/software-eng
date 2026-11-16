'use strict';

/**
 * Authentication + authorization middleware.
 *
 * The three guards below are the whole access-control surface of the app:
 *
 *   requireAuth        — is there a valid session?
 *   requireRole        — does the signed-in user hold one of these roles?
 *   requirePermission  — does the signed-in user's role grant this ability?
 *   requireDashboard   — can this role open the dashboard for that role?
 *
 * They are composable and deny by default.
 */

const sessionService = require('../services/session');
const authService = require('../services/auth');
const audit = require('../services/audit');
const {
  ROLES,
  roleHasPermission,
  roleHasAllPermissions,
  canAccessDashboard,
  dashboardPathForRole,
} = require('../config/roles');

/**
 * Load the user for the current session, if any.
 * Always calls next() — routes decide whether authentication is required.
 */
function loadUser(req, res, next) {
  req.user = null;
  req.sessionRow = null;

  const token = req.cookies?.[sessionService.cookieName];
  if (!token) return next();

  const row = sessionService.lookup(token);
  if (!row) {
    // Stale or revoked cookie — clear it so the browser stops sending it.
    sessionService.clearCookies(res);
    return next();
  }

  req.sessionRow = row;
  req.sessionToken = token;
  req.user = authService.publicUser({
    ...row,
    id: row.user_id,
    email: row.email,
  });
  // publicUser expects snake_case source fields; reload the full record to
  // guarantee every field (email, must_change_password, ...) is present.
  const full = authService.findById(row.user_id);
  if (!full) {
    sessionService.revokeByToken(token, 'user-missing');
    sessionService.clearCookies(res);
    return next();
  }
  req.user = authService.publicUser(full);
  req.user.sessionMinutesRemaining = sessionService.minutesRemaining(row);
  next();
}

/** Guard: a valid, live session is required. */
function requireAuth(req, res, next) {
  if (req.user) return next();

  audit.record({
    action: 'access.unauthenticated',
    category: 'access',
    severity: 'warning',
    outcome: 'failure',
    target: req.originalUrl,
    detail: `Blocked anonymous request to ${req.originalUrl}.`,
    req,
  });

  if (wantsJson(req)) {
    return res.status(401).json({
      error: 'authentication_required',
      message: 'You must sign in to access this resource.',
      loginUrl: `/login?next=${encodeURIComponent(req.originalUrl)}`,
    });
  }

  const returnTo = encodeURIComponent(req.originalUrl);
  req.flash?.('warning', 'Please sign in to continue.');
  return res.redirect(`/login?next=${returnTo}`);
}

/** Guard factory: require one of the given roles. */
function requireRole(...roles) {
  const allowed = roles.flat();
  return function roleGuard(req, res, next) {
    if (!req.user) return requireAuth(req, res, next);

    if (!allowed.includes(req.user.role)) {
      audit.record({
        actor: req.user,
        action: 'access.role_denied',
        category: 'access',
        severity: 'warning',
        outcome: 'failure',
        target: req.originalUrl,
        detail: `Role "${req.user.role}" attempted to access a resource restricted to: ${allowed.join(', ')}.`,
        req,
      });
      return deny(req, res, {
        message: 'Your assigned role does not permit access to that area of the platform.',
      });
    }
    next();
  };
}

/** Guard factory: require a single permission granted to the user's role. */
function requirePermission(permission) {
  return function permissionGuard(req, res, next) {
    if (!req.user) return requireAuth(req, res, next);

    if (!roleHasPermission(req.user.role, permission)) {
      audit.record({
        actor: req.user,
        action: 'access.permission_denied',
        category: 'access',
        severity: 'warning',
        outcome: 'failure',
        target: req.originalUrl,
        detail: `Missing required permission "${permission}".`,
        req,
      });
      return deny(req, res, {
        message: `This action requires the "${permission}" permission, which your role does not have.`,
      });
    }
    next();
  };
}

/** Guard factory: require every permission in the list. */
function requireAllPermissions(...permissions) {
  return function allPermissionsGuard(req, res, next) {
    if (!req.user) return requireAuth(req, res, next);
    if (!roleHasAllPermissions(req.user.role, permissions)) {
      return deny(req, res, {
        message: 'Your role does not grant every permission required for this action.',
      });
    }
    next();
  };
}

/**
 * Guard factory used by every dashboard route.
 *
 * This is what stops a student who hand-types /examiner/dashboard: the
 * guard resolves the dashboard's required permission from the central
 * registry and checks it against the *session* role — not the URL.
 */
function requireDashboard(dashboardRole) {
  return function dashboardGuard(req, res, next) {
    if (!req.user) return requireAuth(req, res, next);

    if (req.user.role !== dashboardRole) {
      audit.record({
        actor: req.user,
        action: 'access.dashboard_denied',
        category: 'access',
        severity: 'critical',
        outcome: 'failure',
        target: req.originalUrl,
        detail: `Direct URL attempt to the ${dashboardRole} dashboard from a "${req.user.role}" session.`,
        req,
      });
      return deny(req, res, {
        title: 'Dashboard access denied',
        message: `You are signed in as ${req.user.roleLabel}. You do not have permission to open another role's dashboard.`,
        attempted: req.originalUrl,
      });
    }

    if (!canAccessDashboard(req.user.role, dashboardRole)) {
      return deny(req, res, {
        title: 'Dashboard access denied',
        message: "Your role's permission set does not include access to this dashboard.",
      });
    }
    next();
  };
}

/** Deny helper — renders 403 for browsers, JSON for fetch/XHR. */
function deny(req, res, { title = 'Access denied', message, attempted = null } = {}) {
  if (wantsJson(req)) {
    return res.status(403).json({
      error: 'forbidden',
      title,
      message,
      attempted,
      yourRole: req.user?.role || null,
      homeUrl: req.user ? dashboardPathForRole(req.user.role) : '/login',
    });
  }
  return res.status(403).render('errors/403', {
    title,
    message,
    attempted,
    statusCode: 403,
  });
}

function wantsJson(req) {
  if (req.path.startsWith('/api/')) return true;
  const accept = req.get('accept') || '';
  return accept.includes('application/json') && !accept.includes('text/html');
}

/**
 * If a signed-in user visits /login, send them to their own dashboard
 * rather than showing the form again.
 */
function redirectIfAuthenticated(req, res, next) {
  if (req.user) {
    const home = dashboardPathForRole(req.user.role);
    if (home) return res.redirect(home);
  }
  next();
}

module.exports = {
  loadUser,
  requireAuth,
  requireRole,
  requirePermission,
  requireAllPermissions,
  requireDashboard,
  redirectIfAuthenticated,
  deny,
  wantsJson,
};
