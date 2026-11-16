'use strict';

/**
 * Routes shared by every authenticated role, plus the root redirect.
 */

const express = require('express');
const db = require('../db');
const config = require('../config');
const authService = require('../services/auth');
const examData = require('../services/examData');
const audit = require('../services/audit');
const sessionService = require('../services/session');
const { hashPassword, verifyPassword, validatePasswordStrength } = require('../lib/password');
const { requireAuth, requirePermission } = require('../middleware/auth');
const { ROLES, dashboardPathForRole, roleHasPermission } = require('../config/roles');

const router = express.Router();

/* ------------------------------ Root ----------------------------------- */
router.get('/', (req, res) => {
  if (req.user) {
    const home = dashboardPathForRole(req.user.role);
    if (home) return res.redirect(302, home);
  }
  return res.redirect(302, '/login');
});

/* --------------------------- Notifications ----------------------------- */
router.get('/notifications', requireAuth, (req, res, next) => {
  if (!roleHasPermission(req.user.role, 'notifications:read')) return next();
  const notifications = examData.notificationsFor(req.user.role, req.user.id);
  res.render('dashboards/notifications', {
    pageTitle: 'Notifications',
    pageSubtitle: 'Announcements for your role',
    bodyClass: 'app-page',
    notifications,
    extraNavLabel: 'Platform',
    extraNav: [
      { label: 'Notifications', href: '/notifications', icon: 'bell' },
      { label: 'My Account', href: '/account', icon: 'user' },
    ],
  });
});

/* ----------------------------- My account ------------------------------ */
router.get('/account', requireAuth, (req, res) => {
  res.render('dashboards/account', {
    pageTitle: 'My Account',
    pageSubtitle: 'Profile, session and security details',
    bodyClass: 'app-page',
    sessions: sessionService.listActiveForUser(req.user.id),
    currentToken: req.sessionToken,
    extraNavLabel: 'Platform',
    extraNav: [
      { label: 'Notifications', href: '/notifications', icon: 'bell' },
      { label: 'My Account', href: '/account', icon: 'user' },
    ],
  });
});

router.post('/account/password', requireAuth, async (req, res, next) => {
  try {
    const { current_password: currentPassword, password, confirm_password: confirmPassword } = req.body;

    const record = authService.findById(req.user.id);
    if (!record) {
      req.flash('error', 'Your account could not be loaded. Please sign in again.');
      return res.redirect(303, '/account');
    }

    if (!(await verifyPassword(String(currentPassword || ''), record.password_hash))) {
      audit.record({
        actor: req.user,
        action: 'account.password_change',
        category: 'account',
        severity: 'warning',
        outcome: 'failure',
        target: req.user.username,
        detail: 'Password change rejected — current password incorrect.',
        req,
      });
      req.flash('error', 'Your current password is incorrect.');
      return res.redirect(303, '/account');
    }

    if (password !== confirmPassword) {
      req.flash('error', 'The new passwords do not match.');
      return res.redirect(303, '/account');
    }

    const strength = validatePasswordStrength(String(password || ''), {
      minLength: config.security.passwordMinLength,
    });
    if (!strength.valid) {
      req.flash('error', strength.errors.join(' '));
      return res.redirect(303, '/account');
    }

    if (password === currentPassword) {
      req.flash('error', 'Choose a password that differs from your current password.');
      return res.redirect(303, '/account');
    }

    const hash = await hashPassword(password);
    db.run(
      `UPDATE users SET password_hash = ?, must_change_password = 0,
              password_changed_at = ?, updated_at = ? WHERE id = ?`,
      hash,
      new Date().toISOString(),
      new Date().toISOString(),
      req.user.id
    );

    // Keep the current session, revoke every other one.
    const revoked = sessionService.revokeAllForUser(req.user.id, 'password-changed', {
      exceptSessionToken: req.sessionToken,
    });

    audit.record({
      actor: req.user,
      action: 'account.password_change',
      category: 'account',
      severity: 'critical',
      outcome: 'success',
      target: req.user.username,
      detail: `Password changed by the account holder; ${revoked} other session(s) revoked.`,
      req,
    });

    req.flash('success', 'Your password has been updated successfully.');
    return res.redirect(303, '/account');
  } catch (err) {
    return next(err);
  }
});

/** Sign out every other device. */
router.post('/account/sessions/revoke', requireAuth, (req, res) => {
  const revoked = sessionService.revokeAllForUser(req.user.id, 'user-revoked', {
    exceptSessionToken: req.sessionToken,
  });
  audit.record({
    actor: req.user,
    action: 'session.revoke_others',
    category: 'account',
    severity: 'warning',
    outcome: 'success',
    target: req.user.username,
    detail: `User signed out ${revoked} other session(s).`,
    req,
  });
  req.flash('success', revoked ? `${revoked} other session(s) signed out.` : 'No other active sessions were found.');
  res.redirect(303, '/account');
});

module.exports = router;
