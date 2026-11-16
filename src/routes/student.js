'use strict';

/**
 * Student routes — every handler sits behind requireDashboard(STUDENT),
 * which enforces both identity and the role's permission set.
 */

const express = require('express');
const { ROLES } = require('../config/roles');
const { requireDashboard, requirePermission } = require('../middleware/auth');
const examData = require('../services/examData');
const audit = require('../services/audit');

const router = express.Router();

const studentGuard = requireDashboard(ROLES.STUDENT);

/* ------------------------------ Dashboard ------------------------------ */
router.get('/student/dashboard', studentGuard, (req, res) => {
  const overview = examData.studentOverview(req.user.id);
  const notifications = examData.notificationsFor(ROLES.STUDENT, req.user.id);

  res.render('dashboards/student', {
    pageTitle: 'Student Dashboard',
    pageSubtitle: `${req.user.programme || 'Undergraduate'} · ${req.user.department || ''}`,
    bodyClass: 'app-page',
    overview,
    notifications,
    lockedModules: [
      { label: 'Examiner Workspace' },
      { label: 'Moderation Queue' },
      { label: 'System Administration' },
    ],
    extraNavLabel: 'Student Services',
    extraNav: [
      { label: 'Examination Schedule', href: '/student/schedule', icon: 'calendar' },
      { label: 'Results', href: '/student/results', icon: 'award' },
      { label: 'Revaluation', href: '/student/revaluations', icon: 'refresh' },
      { label: 'Academic Records', href: '/student/records', icon: 'folder' },
    ],
  });
});

/* ------------------------------ Schedule ------------------------------- */
router.get(
  '/student/schedule',
  studentGuard,
  requirePermission('schedule:read'),
  (req, res) => {
    const schedule = examData.studentSchedule(req.user.id);
    res.render('dashboards/student-schedule', {
      pageTitle: 'Examination Schedule',
      pageSubtitle: 'Personal timetable for the current semester',
      bodyClass: 'app-page',
      schedule,
      extraNavLabel: 'Student Services',
      extraNav: [
        { label: 'Examination Schedule', href: '/student/schedule', icon: 'calendar' },
        { label: 'Results', href: '/student/results', icon: 'award' },
        { label: 'Revaluation', href: '/student/revaluations', icon: 'refresh' },
        { label: 'Academic Records', href: '/student/records', icon: 'folder' },
      ],
    });
  }
);

/* ------------------------------- Results ------------------------------- */
router.get(
  '/student/results',
  studentGuard,
  requirePermission('results:read'),
  (req, res) => {
    const results = examData.studentResults(req.user.id);
    res.render('dashboards/student-results', {
      pageTitle: 'Published Results',
      pageSubtitle: 'Results released by the Controller of Examinations',
      bodyClass: 'app-page',
      results,
      extraNavLabel: 'Student Services',
      extraNav: [
        { label: 'Examination Schedule', href: '/student/schedule', icon: 'calendar' },
        { label: 'Results', href: '/student/results', icon: 'award' },
        { label: 'Revaluation', href: '/student/revaluations', icon: 'refresh' },
        { label: 'Academic Records', href: '/student/records', icon: 'folder' },
      ],
    });
  }
);

/* ----------------------------- Revaluation ----------------------------- */
router.get(
  '/student/revaluations',
  studentGuard,
  requirePermission('revaluation:track'),
  (req, res) => {
    const requests = examData.studentRevaluations(req.user.id);
    const candidates = examData.revaluationCandidates(req.user.id);
    res.render('dashboards/student-revaluations', {
      pageTitle: 'Revaluation Requests',
      pageSubtitle: 'Submit and track revaluation of evaluated answer scripts',
      bodyClass: 'app-page',
      requests,
      candidates,
      extraNavLabel: 'Student Services',
      extraNav: [
        { label: 'Examination Schedule', href: '/student/schedule', icon: 'calendar' },
        { label: 'Results', href: '/student/results', icon: 'award' },
        { label: 'Revaluation', href: '/student/revaluations', icon: 'refresh' },
        { label: 'Academic Records', href: '/student/records', icon: 'folder' },
      ],
    });
  }
);

router.post(
  '/student/revaluations',
  studentGuard,
  requirePermission('revaluation:submit'),
  (req, res) => {
    const result = examData.submitRevaluation({
      userId: req.user.id,
      examId: Number(req.body.exam_id),
      reason: req.body.reason,
      req,
    });

    if (!result.ok) {
      req.flash('error', result.error);
      return res.redirect(303, '/student/revaluations');
    }

    audit.record({
      actor: req.user,
      action: 'revaluation.submit',
      category: 'account',
      severity: 'info',
      outcome: 'success',
      target: `exam:${req.body.exam_id}`,
      detail: 'Student submitted a revaluation request.',
      req,
    });

    req.flash('success', 'Your revaluation request has been submitted and is now under review.');
    return res.redirect(303, '/student/revaluations');
  }
);

/* ---------------------------- Academic records ------------------------- */
router.get(
  '/student/records',
  studentGuard,
  requirePermission('records:read'),
  (req, res) => {
    const records = examData.studentRecords(req.user.id);
    res.render('dashboards/student-records', {
      pageTitle: 'Academic Records',
      pageSubtitle: 'Consolidated marks, grades and issued credentials',
      bodyClass: 'app-page',
      records,
      extraNavLabel: 'Student Services',
      extraNav: [
        { label: 'Examination Schedule', href: '/student/schedule', icon: 'calendar' },
        { label: 'Results', href: '/student/results', icon: 'award' },
        { label: 'Revaluation', href: '/student/revaluations', icon: 'refresh' },
        { label: 'Academic Records', href: '/student/records', icon: 'folder' },
      ],
    });
  }
);

module.exports = router;
