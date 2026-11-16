'use strict';

/**
 * Moderator routes.
 *
 * Moderators review evaluations, identify discrepancies and approve
 * moderation — but they never overwrite the original examiner mark
 * directly. Corrections are staged in `moderation_actions` and only take
 * effect after the Controller of Examinations signs them off.
 */

const express = require('express');
const { ROLES } = require('../config/roles');
const { requireDashboard, requirePermission } = require('../middleware/auth');
const examData = require('../services/examData');
const audit = require('../services/audit');

const router = express.Router();

const moderatorGuard = requireDashboard(ROLES.MODERATOR);

const EXTRA_NAV = [
  { label: 'Moderation Queue', href: '/moderator/dashboard', icon: 'shield-check' },
  { label: 'Evaluation Review', href: '/moderator/review', icon: 'search' },
];

router.get('/moderator/dashboard', moderatorGuard, (req, res) => {
  const overview = examData.moderatorOverview();
  const notifications = examData.notificationsFor(ROLES.MODERATOR, req.user.id);

  res.render('dashboards/moderator', {
    pageTitle: 'Moderation Dashboard',
    pageSubtitle: 'Review evaluations and approve corrections',
    bodyClass: 'app-page',
    overview,
    notifications,
    extraNavLabel: 'Moderation',
    extraNav: EXTRA_NAV,
    lockedModules: [
      { label: 'Result Publication (Controller only)' },
      { label: 'Examiner Workspace' },
      { label: 'System Administration' },
    ],
  });
});

router.get(
  '/moderator/review',
  moderatorGuard,
  requirePermission('evaluation:review'),
  (req, res) => {
    const overview = examData.moderatorOverview();
    res.render('dashboards/moderator-review', {
      pageTitle: 'Evaluation Review',
      pageSubtitle: 'Compare examiner marks against the approved rubric',
      bodyClass: 'app-page',
      overview,
      extraNavLabel: 'Moderation',
      extraNav: EXTRA_NAV,
    });
  }
);

/** Raise a discrepancy — stages a proposed correction, never edits marks. */
router.post(
  '/moderator/discrepancies',
  moderatorGuard,
  requirePermission('evaluation:review'),
  (req, res) => {
    const result = examData.raiseModeration({
      evaluationId: Number(req.body.evaluation_id),
      proposedMarks: req.body.proposed_marks,
      reason: req.body.reason,
      actor: req.user,
    });

    if (!result.ok) {
      req.flash('error', result.error);
      return res.redirect(303, '/moderator/review');
    }

    audit.record({
      actor: req.user,
      action: 'moderation.discrepancy',
      category: 'account',
      severity: 'warning',
      outcome: 'success',
      target: `evaluation:${req.body.evaluation_id}`,
      detail: `Raised a moderation discrepancy proposing ${req.body.proposed_marks} marks. Original evaluation preserved.`,
      req,
    });

    req.flash(
      'success',
      'Discrepancy recorded. The original evaluation is unchanged — the proposed correction now awaits your approval and Controller sign-off.'
    );
    return res.redirect(303, '/moderator/dashboard');
  }
);

/** Endorse a staged correction (first half of the two-step workflow). */
router.post(
  '/moderator/actions/:id/approve',
  moderatorGuard,
  requirePermission('moderation:approve'),
  (req, res) => {
    const result = examData.endorseModeration({ actionId: Number(req.params.id), actor: req.user });

    if (!result.ok) {
      req.flash('error', result.error);
      return res.redirect(303, '/moderator/dashboard');
    }

    audit.record({
      actor: req.user,
      action: 'moderation.approve',
      category: 'account',
      severity: 'critical',
      outcome: 'success',
      target: `moderation:${req.params.id}`,
      detail: 'Moderator endorsed a correction; forwarded to the Controller of Examinations.',
      req,
    });

    req.flash(
      'success',
      'Correction endorsed and forwarded to the Controller of Examinations for final approval.'
    );
    return res.redirect(303, '/moderator/dashboard');
  }
);

module.exports = router;
