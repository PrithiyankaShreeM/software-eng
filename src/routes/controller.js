'use strict';

/**
 * Controller of Examinations routes.
 *
 * The Controller holds the only two permissions that can move marks into a
 * student's published record: `marks:approve` and `results:publish`.
 */

const express = require('express');
const { ROLES } = require('../config/roles');
const { requireDashboard, requirePermission } = require('../middleware/auth');
const examData = require('../services/examData');
const audit = require('../services/audit');

const router = express.Router();

const controllerGuard = requireDashboard(ROLES.CONTROLLER);

const EXTRA_NAV = [
  { label: 'Result Approval', href: '/controller/dashboard', icon: 'stamp' },
  { label: 'Moderation Sign-off', href: '/controller/moderation', icon: 'shield-check' },
];

router.get('/controller/dashboard', controllerGuard, (req, res) => {
  const overview = examData.controllerOverview();
  const notifications = examData.notificationsFor(ROLES.CONTROLLER, req.user.id);

  res.render('dashboards/controller', {
    pageTitle: 'Examination Approval Dashboard',
    pageSubtitle: 'Approve final marks and publish examination results',
    bodyClass: 'app-page',
    overview,
    notifications,
    extraNavLabel: 'Result Control',
    extraNav: EXTRA_NAV,
    lockedModules: [
      { label: 'Examiner Workspace' },
      { label: 'System Administration' },
    ],
  });
});

router.get(
  '/controller/moderation',
  controllerGuard,
  requirePermission('evaluation:review'),
  (req, res) => {
    const overview = examData.controllerOverview();
    res.render('dashboards/controller-moderation', {
      pageTitle: 'Moderation Sign-off',
      pageSubtitle: 'Authorise moderator corrections before marks are finalised',
      bodyClass: 'app-page',
      moderation: overview.moderation,
      extraNavLabel: 'Result Control',
      extraNav: EXTRA_NAV,
    });
  }
);

/* ---------------------------- Approve marks ---------------------------- */
router.post(
  '/controller/exams/:id/approve',
  controllerGuard,
  requirePermission('marks:approve'),
  (req, res) => {
    const result = examData.approveResults({ examId: Number(req.params.id), actor: req.user });
    if (!result.ok) {
      req.flash('error', result.error);
      return res.redirect(303, '/controller/dashboard');
    }

    audit.record({
      actor: req.user,
      action: 'results.approve',
      category: 'account',
      severity: 'critical',
      outcome: 'success',
      target: `exam:${req.params.id}`,
      detail: `Approved final marks for ${result.exam.code} — ${result.exam.title}.`,
      req,
    });

    req.flash('success', 'Final marks approved. The result set is now ready for publication.');
    return res.redirect(303, '/controller/dashboard');
  }
);

/* ----------------------------- Publish results ------------------------- */
router.post(
  '/controller/exams/:id/publish',
  controllerGuard,
  requirePermission('results:publish'),
  (req, res) => {
    const result = examData.publishResults({ examId: Number(req.params.id), actor: req.user });
    if (!result.ok) {
      req.flash('error', result.error);
      return res.redirect(303, '/controller/dashboard');
    }

    audit.record({
      actor: req.user,
      action: 'results.publish',
      category: 'account',
      severity: 'critical',
      outcome: 'success',
      target: `exam:${req.params.id}`,
      detail: `Published ${result.count} result(s) for ${result.exam.code} — ${result.exam.title}.`,
      req,
    });

    req.flash('success', `${result.count} result(s) published. Students can now view their marks.`);
    return res.redirect(303, '/controller/dashboard');
  }
);

/* -------------------------- Resolve moderation ------------------------- */
router.post(
  '/controller/moderation/:id/:decision',
  controllerGuard,
  requirePermission('marks:approve'),
  (req, res) => {
    const decision = req.params.decision === 'approve' ? 'approve' : 'reject';
    const result = examData.resolveModeration({
      actionId: Number(req.params.id),
      decision,
      note: req.body.note,
      actor: req.user,
    });

    if (!result.ok) {
      req.flash('error', result.error);
      return res.redirect(303, '/controller/moderation');
    }

    audit.record({
      actor: req.user,
      action: decision === 'approve' ? 'moderation.final_approve' : 'moderation.final_reject',
      category: 'account',
      severity: 'critical',
      outcome: 'success',
      target: `moderation:${req.params.id}`,
      detail:
        decision === 'approve'
          ? 'Controller approved the moderation correction; corrected marks applied.'
          : 'Controller rejected the moderation correction; original marks stand.',
      req,
    });

    req.flash(
      'success',
      decision === 'approve'
        ? 'Moderation correction approved and applied. Original examiner evaluation retained in the audit trail.'
        : 'Moderation correction rejected. The original examiner marks remain in force.'
    );
    return res.redirect(303, '/controller/moderation');
  }
);

module.exports = router;
