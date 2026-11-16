'use strict';

/**
 * External Verifier routes.
 *
 * Hard scope boundary: a verifier can confirm that a degree certificate was
 * issued (and whether it is valid or revoked) plus a masked identity, and
 * nothing else. No internal examination records, marks, or student contact
 * details are reachable from any handler in this file.
 */

const express = require('express');
const { ROLES } = require('../config/roles');
const { requireDashboard, requirePermission } = require('../middleware/auth');
const examData = require('../services/examData');
const audit = require('../services/audit');

const router = express.Router();

const verifierGuard = requireDashboard(ROLES.EXTERNAL_VERIFIER);

const EXTRA_NAV = [
  { label: 'Credential Verification', href: '/verifier/dashboard', icon: 'scan' },
  { label: 'Verification History', href: '/verifier/history', icon: 'history' },
];

router.get('/verifier/dashboard', verifierGuard, (req, res) => {
  const overview = examData.verifierOverview(req.user.id);
  const notifications = examData.notificationsFor(ROLES.EXTERNAL_VERIFIER, req.user.id);

  res.render('dashboards/verifier', {
    pageTitle: 'Credential Verification Dashboard',
    pageSubtitle: 'Verify degree certificates against the university registry',
    bodyClass: 'app-page',
    overview,
    notifications,
    verification: null,
    extraNavLabel: 'Verification Portal',
    extraNav: EXTRA_NAV,
    lockedModules: [
      { label: 'Student examination records' },
      { label: 'Internal marks & evaluations' },
      { label: 'Staff workspaces' },
    ],
  });
});

router.post(
  '/verifier/verify',
  verifierGuard,
  requirePermission('credential:verify'),
  (req, res) => {
    const result = examData.verifyCredential({
      credentialNo: req.body.credential_no,
      purpose: req.body.purpose,
      verifierId: req.user.id,
      req,
    });

    if (!result.ok) {
      req.flash('error', result.error);
      return res.redirect(303, '/verifier/dashboard');
    }

    audit.record({
      actor: req.user,
      action: 'credential.verify',
      category: 'credential',
      severity: result.result === 'valid' ? 'info' : 'warning',
      outcome: 'success',
      target: result.credentialNo,
      detail: `Verification result: ${result.result}.`,
      req,
    });

    const overview = examData.verifierOverview(req.user.id);
    const notifications = examData.notificationsFor(ROLES.EXTERNAL_VERIFIER, req.user.id);

    return res.render('dashboards/verifier', {
      pageTitle: 'Credential Verification Dashboard',
      pageSubtitle: 'Verify degree certificates against the university registry',
      bodyClass: 'app-page',
      overview,
      notifications,
      verification: result,
      extraNavLabel: 'Verification Portal',
      extraNav: EXTRA_NAV,
    });
  }
);

router.get(
  '/verifier/history',
  verifierGuard,
  requirePermission('verification:history'),
  (req, res) => {
    const overview = examData.verifierOverview(req.user.id);
    res.render('dashboards/verifier-history', {
      pageTitle: 'Verification History',
      pageSubtitle: 'Every credential check performed by your organisation',
      bodyClass: 'app-page',
      overview,
      extraNavLabel: 'Verification Portal',
      extraNav: EXTRA_NAV,
    });
  }
);

module.exports = router;
