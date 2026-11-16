'use strict';

/**
 * Public authentication routes.
 *
 *   GET  /login                 centralized login portal
 *   POST /login                 authenticate and redirect by role
 *   POST /logout                destroy the session
 *   GET  /forgot-password       request a reset link
 *   POST /forgot-password
 *   GET  /reset-password/:token reset form
 *   POST /reset-password/:token
 */

const express = require('express');
const rateLimit = require('express-rate-limit');

const config = require('../config');
const authService = require('../services/auth');
const resetService = require('../services/passwordReset');
const { demoCredentials } = require('../db/seed');

/**
 * Demo credentials are only ever rendered on the public login screen.
 * Signed-in users see the ordinary dashboard; the guide never follows them
 * into an authenticated area.
 */
function publicDemoAccounts() {
  return demoCredentials();
}
const { requireAuth, redirectIfAuthenticated } = require('../middleware/auth');
const { LOGIN_CATEGORIES } = require('../config/roles');
const { issueAnonymousCsrf } = require('../middleware/csrf');

const router = express.Router();

/* --------------------------------------------------------------------------
 * Rate limiting
 * -------------------------------------------------------------------------- */

/** Login attempts: 10 per 15 minutes per IP (independent of per-account lockout). */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (req, res) => {
    res.status(429).render('auth/login', {
      pageTitle: 'Sign in',
      bodyClass: 'auth-page',
      category: 'student',
      identifier: '',
      errors: {},
      remember: false,
      loginError:
        'Too many sign-in attempts from this network. Please wait 15 minutes before trying again.',
      demoAccounts: publicDemoAccounts(),
      demoPassword: require('../db/seed').DEMO_PASSWORD,
      csrfToken: req.sessionRow?.csrf_token || req.cookies?.['uniexam.csrf'] || '',
      nextUrl: '',
    });
  },
});

/** Password reset requests: 5 per hour per IP. */
const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 8,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).render('auth/forgot-password', {
      pageTitle: 'Reset password',
      bodyClass: 'auth-page',
      submitted: false,
      errors: {},
      resetLink: null,
      csrfToken: req.sessionRow?.csrf_token || req.cookies?.['uniexam.csrf'] || '',
    });
  },
});

/* --------------------------------------------------------------------------
 * GET /login
 * -------------------------------------------------------------------------- */
router.get('/login', redirectIfAuthenticated, issueAnonymousCsrf, (req, res) => {
  const category = LOGIN_CATEGORIES.some((c) => c.key === req.query.portal)
    ? req.query.portal
    : 'student';

  res.render('auth/login', {
    pageTitle: 'Sign in',
    bodyClass: 'auth-page',
    category,
    identifier: '',
    errors: {},
    remember: false,
    loginError: null,
    demoAccounts: publicDemoAccounts(),
    demoPassword: require('../db/seed').DEMO_PASSWORD,
    csrfToken: req.sessionRow?.csrf_token || req.cookies?.['uniexam.csrf'] || '',
    nextUrl: typeof req.query.next === 'string' ? req.query.next : '',
  });
});

/* --------------------------------------------------------------------------
 * POST /login
 * -------------------------------------------------------------------------- */
router.post('/login', loginLimiter, async (req, res, next) => {
  const { identifier = '', password = '', category = '', remember = '', next: nextUrl = '' } = req.body;

  const renderForm = (status, overrides = {}) => {
    const safeCategory = LOGIN_CATEGORIES.some((c) => c.key === category) ? category : 'student';
    return res.status(status).render('auth/login', {
      pageTitle: 'Sign in',
      bodyClass: 'auth-page',
      category: safeCategory,
      identifier,
      errors: {},
      remember: Boolean(remember),
      loginError: null,
      demoAccounts: publicDemoAccounts(),
      demoPassword: require('../db/seed').DEMO_PASSWORD,
      csrfToken: req.cookies?.['uniexam.csrf'] || '',
      nextUrl,
      ...overrides,
    });
  };

  try {
    // Basic shape validation before touching the database.
    if (!String(identifier).trim() || !String(password)) {
      return renderForm(400, {
        loginError: 'Please enter both your User ID and password.',
        errors: {
          identifier: !String(identifier).trim() ? 'User ID is required.' : undefined,
          password: !String(password) ? 'Password is required.' : undefined,
        },
      });
    }

    const result = await authService.login({
      identifier,
      password,
      category,
      remember: Boolean(remember),
      req,
      res,
    });

    if (!result.ok) {
      // Field-specific problems render inline; account-level problems (locked,
      // deactivated, wrong portal) render as a banner above the form.
      const errors = result.field ? { [result.field]: result.message } : {};
      return renderForm(401, {
        loginError: result.field ? null : result.message,
        errors,
      });
    }

    // Only ever redirect within this application (open-redirect protection).
    const safeNext =
      typeof nextUrl === 'string' &&
      nextUrl.startsWith('/') &&
      !nextUrl.startsWith('//') &&
      nextUrl !== '/login'
        ? nextUrl
        : null;

    const destination =
      safeNext && userCanOpen(req, safeNext, result.user.role)
        ? safeNext
        : result.redirectTo;

    req.flash('success', `Welcome back, ${result.user.fullName.split(' ')[0]}. You are signed in as ${result.user.roleLabel}.`);
    return res.redirect(302, destination);
  } catch (err) {
    return next(err);
  }
});

/**
 * Never honour a `next` URL that points to a dashboard the freshly
 * authenticated role is not allowed to open.
 */
function userCanOpen(req, path, role) {
  const { DASHBOARDS, roleHasPermission } = require('../config/roles');
  const dashboard = DASHBOARDS.find((d) => path.startsWith(d.path));
  if (!dashboard) return true; // non-dashboard paths are guarded by their own middleware
  return dashboard.role === role && roleHasPermission(role, dashboard.requiredPermission);
}

/* --------------------------------------------------------------------------
 * POST /logout
 * -------------------------------------------------------------------------- */
router.post('/logout', requireAuth, (req, res) => {
  authService.logout({ req, res });
  req.flash('info', 'You have been signed out securely.');
  res.redirect(303, '/login');
});

/* --------------------------------------------------------------------------
 * Forgot password
 * -------------------------------------------------------------------------- */
router.get('/forgot-password', issueAnonymousCsrf, (req, res) => {
  const sent = req.query.sent === '1';
  const token = sent && typeof req.query.token === 'string' ? req.query.token : null;
  res.render('auth/forgot-password', {
    pageTitle: 'Reset password',
    bodyClass: 'auth-page',
    submitted: sent,
    errors: {},
    resetLink: token ? `/reset-password/${encodeURIComponent(token)}` : null,
    csrfToken: req.sessionRow?.csrf_token || req.cookies?.['uniexam.csrf'] || '',
  });
});

router.post('/forgot-password', resetLimiter, (req, res) => {
  const identifier = String(req.body.identifier || '').trim();

  if (!identifier) {
    return res.status(400).render('auth/forgot-password', {
      pageTitle: 'Reset password',
      bodyClass: 'auth-page',
      submitted: false,
      errors: { identifier: 'Enter your User ID, Staff ID or email address.' },
      resetLink: null,
      csrfToken: req.sessionRow?.csrf_token || req.cookies?.['uniexam.csrf'] || '',
    });
  }

  const outcome = resetService.requestReset({ identifier, req });

  if (!outcome.created) {
    // Same visible response whether or not the account exists.
    req.flash(
      'info',
      'If an account matches those details, a reset link has been issued. Check the email address registered with the university.'
    );
    return res.redirect(303, '/forgot-password?sent=1');
  }

  return res.redirect(303, `/forgot-password?sent=1&demo=1&token=${encodeURIComponent(outcome.token)}`);
});

/* --------------------------------------------------------------------------
 * Reset password
 * -------------------------------------------------------------------------- */
router.get('/reset-password/:token', issueAnonymousCsrf, (req, res) => {
  const record = resetService.inspectToken(req.params.token);
  res.render('auth/reset-password', {
    pageTitle: 'Choose a new password',
    bodyClass: 'auth-page',
    token: req.params.token,
    resetRecord: record,
    resetError: record ? null : 'This reset link is invalid, has already been used, or has expired.',
    errors: [],
    csrfToken: req.sessionRow?.csrf_token || req.cookies?.['uniexam.csrf'] || '',
  });
});

router.post('/reset-password/:token', async (req, res) => {
  const record = resetService.inspectToken(req.params.token);
  const result = await resetService.completeReset({
    token: req.params.token,
    password: req.body.password,
    confirmPassword: req.body.confirm_password,
    req,
  });

  if (!result.ok) {
    return res.status(400).render('auth/reset-password', {
      pageTitle: 'Choose a new password',
      bodyClass: 'auth-page',
      token: req.params.token,
      resetRecord: record,
      resetError: null,
      errors: result.errors,
      csrfToken: req.sessionRow?.csrf_token || req.cookies?.['uniexam.csrf'] || '',
    });
  }

  req.flash('success', 'Your password has been updated. Please sign in with your new password.');
  return res.redirect(303, '/login');
});

module.exports = router;
