'use strict';

/**
 * Department Head routes — read-only analytics for the head's own department.
 *
 * The scope is derived from the signed-in user's `department` column, never
 * from a query parameter, so a department head cannot widen their view by
 * editing the URL.
 */

const express = require('express');
const { ROLES } = require('../config/roles');
const { requireDashboard, requirePermission } = require('../middleware/auth');
const examData = require('../services/examData');

const router = express.Router();

const deptGuard = requireDashboard(ROLES.DEPARTMENT_HEAD);

const EXTRA_NAV = [
  { label: 'Department Analytics', href: '/department/dashboard', icon: 'chart' },
  { label: 'Performance Report', href: '/department/reports', icon: 'file' },
];

router.get('/department/dashboard', deptGuard, (req, res) => {
  const department = req.user.department || 'Unassigned department';
  const overview = examData.departmentOverview(department);
  const notifications = examData.notificationsFor(ROLES.DEPARTMENT_HEAD, req.user.id);

  res.render('dashboards/department', {
    pageTitle: 'Department Analytics Dashboard',
    pageSubtitle: department,
    bodyClass: 'app-page',
    department,
    overview,
    notifications,
    extraNavLabel: 'Department',
    extraNav: EXTRA_NAV,
    lockedModules: [
      { label: 'Result Publication (Controller only)' },
      { label: 'Moderation Queue' },
      { label: 'System Administration' },
    ],
  });
});

router.get(
  '/department/reports',
  deptGuard,
  requirePermission('department:reports'),
  (req, res) => {
    const department = req.user.department || 'Unassigned department';
    const overview = examData.departmentOverview(department);
    res.render('dashboards/department-reports', {
      pageTitle: 'Departmental Performance Report',
      pageSubtitle: department,
      bodyClass: 'app-page',
      department,
      overview,
      extraNavLabel: 'Department',
      extraNav: EXTRA_NAV,
    });
  }
);

module.exports = router;
