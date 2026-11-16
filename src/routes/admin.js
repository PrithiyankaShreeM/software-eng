'use strict';

/**
 * System Administration routes.
 *
 * Every handler requires the administrator dashboard guard plus the specific
 * permission for the action. Account creation, role assignment and password
 * resets are the only paths that can grant privileges — and they are
 * restricted to this role alone.
 */

const express = require('express');
const { ROLES, ROLE_DEFINITIONS, PERMISSION_GROUPS, ROLE_PERMISSIONS, permissionsForRole, isValidRole } = require('../config/roles');
const { requireDashboard, requirePermission } = require('../middleware/auth');
const accounts = require('../services/accounts');
const examData = require('../services/examData');
const audit = require('../services/audit');
const sessionService = require('../services/session');
const passwordReset = require('../services/passwordReset');
const authService = require('../services/auth');

const router = express.Router();

const adminGuard = requireDashboard(ROLES.ADMINISTRATOR);

const EXTRA_NAV = [
  { label: 'System Administration', href: '/admin/dashboard', icon: 'settings' },
  { label: 'Accounts', href: '/admin/accounts', icon: 'users' },
  { label: 'Roles & Permissions', href: '/admin/roles', icon: 'shield-check' },
  { label: 'Examination Settings', href: '/admin/settings', icon: 'cog' },
  { label: 'Audit Log', href: '/admin/audit', icon: 'clipboard' },
];

const COMMON = {
  extraNavLabel: 'Administration',
  extraNav: EXTRA_NAV,
  bodyClass: 'app-page',
};

/* ------------------------------ Dashboard ------------------------------ */
router.get('/admin/dashboard', adminGuard, (req, res) => {
  const overview = examData.adminOverview();
  const stats = accounts.accountStats();
  const auditSummary = audit.summary();
  const notifications = examData.notificationsFor(ROLES.ADMINISTRATOR, req.user.id);

  res.render('dashboards/admin', {
    ...COMMON,
    pageTitle: 'System Administration Dashboard',
    pageSubtitle: 'Platform-wide accounts, roles and security posture',
    overview,
    stats,
    auditSummary,
    notifications,
    recentAudit: audit.recent({ limit: 8 }),
    lockedModules: [
      { label: 'Examiner Workspace' },
      { label: 'Result Publication' },
    ],
  });
});

/* ------------------------------- Accounts ------------------------------ */
router.get(
  '/admin/accounts',
  adminGuard,
  requirePermission('accounts:read'),
  (req, res) => {
    const filters = {
      q: String(req.query.q || '').trim(),
      role: String(req.query.role || '').trim(),
      status: String(req.query.status || '').trim(),
    };
    res.render('dashboards/admin-accounts', {
      ...COMMON,
      pageTitle: 'Account Management',
      pageSubtitle: 'Create, deactivate and manage student, staff and verifier accounts',
      users: accounts.listAccounts(filters),
      filters,
      stats: accounts.accountStats(),
      roleDefinitions: ROLE_DEFINITIONS,
    });
  }
);

router.post(
  '/admin/accounts',
  adminGuard,
  requirePermission('accounts:create'),
  async (req, res, next) => {
    try {
      const result = await accounts.createAccount({ input: req.body, actor: req.user, req });
      if (!result.ok) {
        const messages = Object.values(result.errors).filter(Boolean);
        req.flash('error', `Could not create the account: ${messages.join(' ')}`);
        return res.redirect(303, '/admin/accounts');
      }
      req.flash(
        'success',
        `Account "${result.user.username}" created as ${result.user.role.replace('_', ' ')}. The user must change the temporary password at first sign-in.`
      );
      return res.redirect(303, '/admin/accounts');
    } catch (err) {
      return next(err);
    }
  }
);

router.post(
  '/admin/accounts/:id/status',
  adminGuard,
  requirePermission('accounts:deactivate'),
  (req, res) => {
    const status = req.body.status === 'active' ? 'active' : 'inactive';
    const result = accounts.setStatus({
      userId: Number(req.params.id),
      status,
      actor: req.user,
      req,
    });

    if (!result.ok) {
      req.flash('error', result.error);
    } else {
      req.flash(
        'success',
        status === 'active'
          ? 'Account activated. The user may sign in again.'
          : `Account deactivated.${result.revoked ? ` ${result.revoked} live session(s) were terminated immediately.` : ''}`
      );
    }
    res.redirect(303, '/admin/accounts');
  }
);

router.post(
  '/admin/accounts/:id/role',
  adminGuard,
  requirePermission('roles:assign'),
  (req, res) => {
    const result = accounts.assignRole({
      userId: Number(req.params.id),
      role: String(req.body.role || ''),
      actor: req.user,
      req,
    });

    if (!result.ok) {
      req.flash('error', result.error);
    } else if (result.unchanged) {
      req.flash('info', 'That account already holds the selected role.');
    } else {
      req.flash(
        'success',
        `Role updated.${result.revoked ? ` ${result.revoked} session(s) were revoked — the user must sign in again to load the new permissions.` : ''}`
      );
    }
    res.redirect(303, '/admin/accounts');
  }
);

router.post(
  '/admin/accounts/:id/reset-password',
  adminGuard,
  requirePermission('passwords:reset'),
  async (req, res, next) => {
    try {
      const result = await passwordReset.adminResetPassword({
        userId: Number(req.params.id),
        actor: req.user,
        req,
      });
      if (!result.ok) {
        req.flash('error', result.error);
      } else {
        req.flash(
          'success',
          `Temporary password issued: ${result.temporaryPassword} — share it securely; the user must change it at first sign-in.`
        );
      }
      return res.redirect(303, '/admin/accounts');
    } catch (err) {
      return next(err);
    }
  }
);

router.post(
  '/admin/accounts/:id/revoke-sessions',
  adminGuard,
  requirePermission('accounts:deactivate'),
  (req, res) => {
    const userId = Number(req.params.id);
    const target = authService.findById(userId);
    if (!target) {
      req.flash('error', 'Account not found.');
      return res.redirect(303, '/admin/accounts');
    }
    const revoked = sessionService.revokeAllForUser(userId, 'admin-revoked');
    audit.record({
      actor: req.user,
      action: 'session.revoke',
      category: 'account',
      severity: 'warning',
      outcome: 'success',
      target: target.username,
      detail: `Administrator revoked ${revoked} live session(s).`,
      req,
    });
    req.flash('success', `${revoked} session(s) revoked for "${target.username}".`);
    res.redirect(303, '/admin/accounts');
  }
);

/* --------------------------- Roles & permissions ----------------------- */
router.get(
  '/admin/roles',
  adminGuard,
  requirePermission('roles:assign'),
  (req, res) => {
    res.render('dashboards/admin-roles', {
      ...COMMON,
      pageTitle: 'Roles & Permissions',
      pageSubtitle: 'The permission matrix that governs every module in the platform',
      permissionGroups: PERMISSION_GROUPS,
      rolePermissions: ROLE_PERMISSIONS,
      roleDefinitions: ROLE_DEFINITIONS,
    });
  }
);

/* ------------------------------ Settings ------------------------------- */
router.get(
  '/admin/settings',
  adminGuard,
  requirePermission('settings:manage'),
  (req, res) => {
    res.render('dashboards/admin-settings', {
      ...COMMON,
      pageTitle: 'Examination Settings',
      pageSubtitle: 'Platform-wide examination and security configuration',
      settings: examData.getSettings(),
    });
  }
);

router.post(
  '/admin/settings',
  adminGuard,
  requirePermission('settings:manage'),
  (req, res) => {
    const updates = Object.entries(req.body).filter(
      ([key]) => key !== '_csrf' && key.startsWith('setting.')
    );
    let changed = 0;
    for (const [rawKey, value] of updates) {
      const key = rawKey.replace(/^setting\./, '');
      const result = examData.updateSetting({ key, value, actor: req.user });
      if (result.ok) changed += 1;
    }

    audit.record({
      actor: req.user,
      action: 'settings.update',
      category: 'settings',
      severity: 'critical',
      outcome: 'success',
      target: 'examination-settings',
      detail: `Updated ${changed} examination setting(s).`,
      req,
    });

    req.flash('success', `${changed} setting(s) saved.`);
    res.redirect(303, '/admin/settings');
  }
);

/* ------------------------------- Audit log ----------------------------- */
router.get(
  '/admin/audit',
  adminGuard,
  requirePermission('audit:read'),
  (req, res) => {
    const category = ['auth', 'account', 'role', 'settings', 'access', 'credential'].includes(
      req.query.category
    )
      ? req.query.category
      : null;
    res.render('dashboards/admin-audit', {
      ...COMMON,
      pageTitle: 'System Audit Log',
      pageSubtitle: 'Append-only record of every security-relevant event',
      entries: audit.recent({ limit: 200, category }),
      summary: audit.summary(),
      activeCategory: category,
    });
  }
);

/* --------------------------- Account detail ---------------------------- */
router.get(
  '/admin/accounts/:id',
  adminGuard,
  requirePermission('accounts:read'),
  (req, res, next) => {
    const user = authService.findById(Number(req.params.id));
    if (!user) return next();

    res.render('dashboards/admin-account-detail', {
      ...COMMON,
      pageTitle: 'Account Detail',
      pageSubtitle: `${user.full_name} · ${user.username}`,
      account: user,
      permissions: permissionsForRole(user.role),
      permissionGroups: PERMISSION_GROUPS,
      roleDefinitions: ROLE_DEFINITIONS,
      isValidRole,
      sessions: sessionService.listActiveForUser(user.id),
      auditEntries: audit.recent({ limit: 50 }).filter((e) => e.target === user.username || e.actor_id === user.id),
    });
  }
);

module.exports = router;
