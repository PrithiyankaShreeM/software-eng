'use strict';

/**
 * Examiner routes.
 *
 * An examiner can schedule examinations, author question papers, manage
 * rubrics and evaluate answer scripts. An examiner deliberately CANNOT
 * publish results — the publish endpoints live on the Controller router
 * and are guarded by `results:publish`, which no examiner role holds.
 */

const express = require('express');
const { ROLES } = require('../config/roles');
const { requireDashboard, requirePermission, deny } = require('../middleware/auth');
const examData = require('../services/examData');
const audit = require('../services/audit');

const router = express.Router();

const examinerGuard = requireDashboard(ROLES.EXAMINER);

const EXTRA_NAV = [
  { label: 'My Workspace', href: '/examiner/dashboard', icon: 'grid' },
  { label: 'Question Papers', href: '/examiner/papers', icon: 'file' },
  { label: 'Evaluation Queue', href: '/examiner/evaluations', icon: 'clipboard' },
];

/* ------------------------------ Dashboard ------------------------------ */
router.get('/examiner/dashboard', examinerGuard, (req, res) => {
  const overview = examData.examinerOverview(req.user.id);
  const notifications = examData.notificationsFor(ROLES.EXAMINER, req.user.id);

  res.render('dashboards/examiner', {
    pageTitle: 'Examiner Dashboard',
    pageSubtitle: req.user.designation || 'Examination authoring and evaluation',
    bodyClass: 'app-page',
    overview,
    notifications,
    extraNavLabel: 'Examiner Workspace',
    extraNav: EXTRA_NAV,
    lockedModules: [
      { label: 'Result Publication (Controller only)' },
      { label: 'Moderation Queue' },
      { label: 'System Administration' },
    ],
  });
});

/* ------------------------------ Scheduling ----------------------------- */
router.get(
  '/examiner/exams',
  examinerGuard,
  requirePermission('exam:schedule'),
  (req, res) => {
    res.render('dashboards/examiner-exams', {
      pageTitle: 'Examination Scheduling',
      pageSubtitle: 'Create and review examination timetables',
      bodyClass: 'app-page',
      exams: examData.listExams(),
      extraNavLabel: 'Examiner Workspace',
      extraNav: EXTRA_NAV,
    });
  }
);

router.post(
  '/examiner/exams',
  examinerGuard,
  requirePermission('exam:schedule'),
  (req, res) => {
    const result = examData.createExam({ input: req.body, actor: req.user, req });
    if (!result.ok) {
      req.flash('error', Object.values(result.errors).join(' '));
      return res.redirect(303, '/examiner/exams');
    }

    audit.record({
      actor: req.user,
      action: 'exam.schedule',
      category: 'account',
      severity: 'info',
      outcome: 'success',
      target: `exam:${result.examId}`,
      detail: `Scheduled examination ${req.body.code} — ${req.body.title}.`,
      req,
    });

    req.flash('success', 'Examination scheduled successfully.');
    return res.redirect(303, '/examiner/exams');
  }
);

/* ---------------------------- Question papers -------------------------- */
router.get(
  '/examiner/papers',
  examinerGuard,
  requirePermission('paper:author'),
  (req, res) => {
    const overview = examData.examinerOverview(req.user.id);
    res.render('dashboards/examiner-papers', {
      pageTitle: 'Question Papers & Rubrics',
      pageSubtitle: 'Author papers, attach rubrics and submit for moderation',
      bodyClass: 'app-page',
      papers: overview.papers,
      exams: examData.listExams().filter((e) => e.status !== 'completed'),
      extraNavLabel: 'Examiner Workspace',
      extraNav: EXTRA_NAV,
    });
  }
);

router.post(
  '/examiner/papers',
  examinerGuard,
  requirePermission('paper:author'),
  (req, res) => {
    const result = examData.createPaper({ input: req.body, actor: req.user, req });
    if (!result.ok) {
      req.flash('error', Object.values(result.errors).join(' '));
      return res.redirect(303, '/examiner/papers');
    }
    audit.record({
      actor: req.user,
      action: 'paper.create',
      category: 'account',
      severity: 'info',
      outcome: 'success',
      target: `paper:${result.paperId}`,
      detail: `Authored question paper "${req.body.title}".`,
      req,
    });
    req.flash('success', 'Question paper saved as a draft with its rubric.');
    return res.redirect(303, '/examiner/papers');
  }
);

router.post(
  '/examiner/papers/:id/submit',
  examinerGuard,
  requirePermission('paper:author'),
  (req, res) => {
    const result = examData.submitPaper({ paperId: Number(req.params.id), actor: req.user, req });
    req.flash(result.ok ? 'success' : 'error', result.ok ? 'Paper submitted to the moderation queue.' : result.error);
    res.redirect(303, '/examiner/papers');
  }
);

/* ------------------------------- Evaluation ---------------------------- */
router.get(
  '/examiner/evaluations',
  examinerGuard,
  requirePermission('script:evaluate'),
  (req, res) => {
    const overview = examData.examinerOverview(req.user.id);
    res.render('dashboards/examiner-evaluations', {
      pageTitle: 'Evaluation Queue',
      pageSubtitle: 'Evaluate answer scripts against the approved rubric',
      bodyClass: 'app-page',
      queue: overview.queue,
      stats: overview.stats,
      extraNavLabel: 'Examiner Workspace',
      extraNav: EXTRA_NAV,
    });
  }
);

router.post(
  '/examiner/evaluations/:id',
  examinerGuard,
  requirePermission('script:evaluate'),
  (req, res) => {
    const result = examData.evaluateScript({
      evaluationId: Number(req.params.id),
      marks: req.body.marks,
      remarks: req.body.remarks,
      actor: req.user,
    });

    if (!result.ok) {
      req.flash('error', result.error);
      return res.redirect(303, '/examiner/evaluations');
    }

    audit.record({
      actor: req.user,
      action: 'script.evaluate',
      category: 'account',
      severity: 'info',
      outcome: 'success',
      target: `evaluation:${req.params.id}`,
      detail: `Awarded ${req.body.marks} marks.`,
      req,
    });

    req.flash('success', 'Evaluation recorded. Marks remain subject to moderation and Controller approval.');
    return res.redirect(303, '/examiner/evaluations');
  }
);

/* ---------------------------------------------------------------------
 * Explicit demonstration of the separation of duties.
 * An examiner who tries to publish results is refused by permission.
 * ------------------------------------------------------------------- */
router.post(
  '/examiner/results/publish',
  examinerGuard,
  requirePermission('results:publish'),
  (req, res) => {
    // Unreachable: no examiner role holds results:publish. Kept as a
    // defence-in-depth guard should the permission matrix ever change.
    deny(req, res, {
      message: 'Publishing examination results is reserved for the Controller of Examinations.',
    });
  }
);

module.exports = router;
