'use strict';

/**
 * ============================================================================
 *  SINGLE SOURCE OF TRUTH FOR ROLES, PERMISSIONS AND DASHBOARDS
 * ============================================================================
 *
 * Every authorization decision in the platform flows through this file.
 * Routes, navigation menus, API guards and templates all derive their
 * behaviour from these definitions — nothing is hard-coded per page.
 *
 * Security model
 * --------------
 * 1. A role owns an explicit, closed list of permissions.
 * 2. Permissions follow a `domain:action` convention.
 * 3. Dashboards declare the permission required to open them. A role may
 *    only open a dashboard if its permission set satisfies that requirement.
 * 4. Privileged roles (staff, admin) are NEVER self-service; only an
 *    administrator can bestow them (see services/accounts.js).
 */

/** Every role that can authenticate against the platform. */
const ROLES = Object.freeze({
  STUDENT: 'student',
  EXAMINER: 'examiner',
  MODERATOR: 'moderator',
  CONTROLLER: 'controller',
  DEPARTMENT_HEAD: 'department_head',
  ADMINISTRATOR: 'administrator',
  EXTERNAL_VERIFIER: 'external_verifier',
});

/**
 * Human-facing role metadata: names, dashboard routes, badge styling and
 * the one-line description shown on the login portal.
 */
const ROLE_DEFINITIONS = Object.freeze({
  [ROLES.STUDENT]: {
    key: ROLES.STUDENT,
    label: 'Student',
    shortLabel: 'Student',
    icon: 'mortarboard',
    badgeClass: 'badge--student',
    dashboardPath: '/student/dashboard',
    loginCategory: 'student',
    description: 'Examination schedules, results, revaluation requests and academic records.',
    portalHint: 'Student ID (e.g. STU2024001)',
  },
  [ROLES.EXAMINER]: {
    key: ROLES.EXAMINER,
    label: 'Examiner',
    shortLabel: 'Examiner',
    icon: 'pencil',
    badgeClass: 'badge--examiner',
    dashboardPath: '/examiner/dashboard',
    loginCategory: 'staff',
    description: 'Schedule examinations, author question papers, manage rubrics and evaluate scripts.',
    portalHint: 'Staff ID (e.g. EXM1001)',
  },
  [ROLES.MODERATOR]: {
    key: ROLES.MODERATOR,
    label: 'Moderator',
    shortLabel: 'Moderator',
    icon: 'shield-check',
    badgeClass: 'badge--moderator',
    dashboardPath: '/moderator/dashboard',
    loginCategory: 'staff',
    description: 'Review evaluations, flag discrepancies and approve moderation decisions.',
    portalHint: 'Staff ID (e.g. MOD2001)',
  },
  [ROLES.CONTROLLER]: {
    key: ROLES.CONTROLLER,
    label: 'Controller of Examinations',
    shortLabel: 'Controller',
    icon: 'stamp',
    badgeClass: 'badge--controller',
    dashboardPath: '/controller/dashboard',
    loginCategory: 'staff',
    description: 'Approve final marks and publish examination results to students.',
    portalHint: 'Staff ID (e.g. CTL3001)',
  },
  [ROLES.DEPARTMENT_HEAD]: {
    key: ROLES.DEPARTMENT_HEAD,
    label: 'Department Head',
    shortLabel: 'Dept. Head',
    icon: 'chart',
    badgeClass: 'badge--depthead',
    dashboardPath: '/department/dashboard',
    loginCategory: 'staff',
    description: 'Monitor departmental examinations, student performance and reports.',
    portalHint: 'Staff ID (e.g. HOD4001)',
  },
  [ROLES.ADMINISTRATOR]: {
    key: ROLES.ADMINISTRATOR,
    label: 'Administrator',
    shortLabel: 'Admin',
    icon: 'settings',
    badgeClass: 'badge--admin',
    dashboardPath: '/admin/dashboard',
    loginCategory: 'administrator',
    description: 'Manage accounts and permissions, examination settings and audit logs.',
    portalHint: 'Username (e.g. admin)',
  },
  [ROLES.EXTERNAL_VERIFIER]: {
    key: ROLES.EXTERNAL_VERIFIER,
    label: 'External Verifier',
    shortLabel: 'Verifier',
    icon: 'globe',
    badgeClass: 'badge--verifier',
    dashboardPath: '/verifier/dashboard',
    loginCategory: 'verifier',
    description: 'Verify issued degree certificates and review credential verification history.',
    portalHint: 'Organisation ID (e.g. VER5001)',
  },
});

/** The four entry points offered on the centralized login portal. */
const LOGIN_CATEGORIES = Object.freeze([
  {
    key: 'student',
    label: 'Student Login',
    icon: 'mortarboard',
    role: ROLES.STUDENT,
    blurb: 'Access your examination timetable, results and revaluation requests.',
  },
  {
    key: 'staff',
    label: 'Staff Login',
    icon: 'briefcase',
    role: null, // resolved from the staff member's assigned role
    blurb: 'Examiner, Moderator, Controller of Examinations and Department Head access.',
  },
  {
    key: 'administrator',
    label: 'Administrator Login',
    icon: 'settings',
    role: ROLES.ADMINISTRATOR,
    blurb: 'Account, permission, examination-setting and audit-log administration.',
  },
  {
    key: 'verifier',
    label: 'External Verifier Login',
    icon: 'globe',
    role: ROLES.EXTERNAL_VERIFIER,
    blurb: 'Third-party credential verification against the university registry.',
  },
]);

/**
 * Permission catalogue. Grouped for the admin permission matrix UI.
 */
const PERMISSION_GROUPS = Object.freeze([
  {
    key: 'examination',
    label: 'Examination lifecycle',
    permissions: [
      { key: 'exam:read', label: 'View examination schedules' },
      { key: 'exam:schedule', label: 'Schedule examinations' },
      { key: 'paper:author', label: 'Create and manage question papers' },
      { key: 'rubric:manage', label: 'Manage evaluation rubrics' },
      { key: 'script:evaluate', label: 'Evaluate answer scripts' },
      { key: 'evaluation:review', label: 'Review evaluations and raise discrepancies' },
      { key: 'moderation:approve', label: 'Approve moderation corrections' },
      { key: 'marks:approve', label: 'Approve final marks' },
      { key: 'results:publish', label: 'Publish examination results' },
      { key: 'department:monitor', label: 'Monitor departmental examinations' },
      { key: 'department:reports', label: 'Generate departmental reports' },
    ],
  },
  {
    key: 'student',
    label: 'Student services',
    permissions: [
      { key: 'schedule:read', label: 'View personal examination schedule' },
      { key: 'results:read', label: 'View published results' },
      { key: 'revaluation:submit', label: 'Submit revaluation requests' },
      { key: 'revaluation:track', label: 'Track revaluation status' },
      { key: 'records:read', label: 'View own academic records' },
      { key: 'notifications:read', label: 'View notifications' },
    ],
  },
  {
    key: 'verification',
    label: 'Credential verification',
    permissions: [
      { key: 'credential:verify', label: 'Verify issued degree certificates' },
      { key: 'credential:read', label: 'View permitted credential information' },
      { key: 'verification:history', label: 'View own verification history' },
    ],
  },
  {
    key: 'administration',
    label: 'System administration',
    permissions: [
      { key: 'accounts:read', label: 'View student and staff accounts' },
      { key: 'accounts:create', label: 'Create accounts' },
      { key: 'accounts:deactivate', label: 'Activate and deactivate accounts' },
      { key: 'roles:assign', label: 'Assign roles and permissions' },
      { key: 'passwords:reset', label: 'Reset user passwords' },
      { key: 'settings:manage', label: 'Manage examination settings' },
      { key: 'audit:read', label: 'Access system-wide audit logs' },
    ],
  },
]);

/** Flat list of every permission key defined above. */
const ALL_PERMISSIONS = Object.freeze(
  PERMISSION_GROUPS.flatMap((group) => group.permissions.map((p) => p.key))
);

/**
 * Role → permission map. This is the authoritative matrix.
 * Read it left to right: what is each role allowed to do?
 */
const ROLE_PERMISSIONS = Object.freeze({
  [ROLES.STUDENT]: Object.freeze([
    'schedule:read',
    'results:read',
    'revaluation:submit',
    'revaluation:track',
    'records:read',
    'notifications:read',
  ]),

  [ROLES.EXAMINER]: Object.freeze([
    // NOTE: `schedule:read` is the *student* "view my personal timetable"
    // permission and is deliberately withheld from staff roles — examiners
    // read timetables through `exam:read` inside their own workspace.
    'exam:read',
    'exam:schedule',
    'paper:author',
    'rubric:manage',
    'script:evaluate',
    'notifications:read',
  ]),

  [ROLES.MODERATOR]: Object.freeze([
    'exam:read',
    'evaluation:review',
    'moderation:approve',
    'notifications:read',
  ]),

  [ROLES.CONTROLLER]: Object.freeze([
    'exam:read',
    'marks:approve',
    'results:publish',
    'evaluation:review',
    'notifications:read',
  ]),

  [ROLES.DEPARTMENT_HEAD]: Object.freeze([
    'exam:read',
    'department:monitor',
    'department:reports',
    'evaluation:review',
    'notifications:read',
  ]),

  [ROLES.ADMINISTRATOR]: Object.freeze([
    'schedule:read',
    'accounts:read',
    'accounts:create',
    'accounts:deactivate',
    'roles:assign',
    'passwords:reset',
    'settings:manage',
    'audit:read',
    'notifications:read',
  ]),

  [ROLES.EXTERNAL_VERIFIER]: Object.freeze([
    'credential:verify',
    'credential:read',
    'verification:history',
  ]),
});

/**
 * Dashboard registry.
 *
 * `requiredPermission` is the gate. A user can only load a dashboard when
 * their role grants that permission — which is exactly how "students cannot
 * open the examiner dashboard" is enforced at the route layer.
 */
const DASHBOARDS = Object.freeze([
  {
    role: ROLES.STUDENT,
    path: '/student/dashboard',
    title: 'Student Dashboard',
    // `records:read` is granted only to the student role, which keeps this
    // requirement exclusive — the dashboard guard is therefore satisfied by
    // permission alone, never by a role-name coincidence.
    requiredPermission: 'records:read',
    navLabel: 'My Dashboard',
  },
  {
    role: ROLES.EXAMINER,
    path: '/examiner/dashboard',
    title: 'Examiner Dashboard',
    requiredPermission: 'exam:schedule',
    navLabel: 'Examiner Workspace',
  },
  {
    role: ROLES.MODERATOR,
    path: '/moderator/dashboard',
    title: 'Moderation Dashboard',
    requiredPermission: 'moderation:approve',
    navLabel: 'Moderation Queue',
  },
  {
    role: ROLES.CONTROLLER,
    path: '/controller/dashboard',
    title: 'Examination Approval Dashboard',
    requiredPermission: 'results:publish',
    navLabel: 'Result Approval',
  },
  {
    role: ROLES.DEPARTMENT_HEAD,
    path: '/department/dashboard',
    title: 'Department Analytics Dashboard',
    requiredPermission: 'department:monitor',
    navLabel: 'Department Analytics',
  },
  {
    role: ROLES.ADMINISTRATOR,
    path: '/admin/dashboard',
    title: 'System Administration Dashboard',
    requiredPermission: 'audit:read',
    navLabel: 'System Administration',
  },
  {
    role: ROLES.EXTERNAL_VERIFIER,
    path: '/verifier/dashboard',
    title: 'Credential Verification Dashboard',
    requiredPermission: 'credential:verify',
    navLabel: 'Credential Verification',
  },
]);

/** Map of role → dashboard definition. */
const DASHBOARD_BY_ROLE = Object.freeze(
  DASHBOARDS.reduce((acc, dashboard) => {
    acc[dashboard.role] = dashboard;
    return acc;
  }, {})
);

/** Map of role → permission array (as a Set for O(1) checks). */
const PERMISSION_SETS = Object.freeze(
  Object.fromEntries(
    Object.entries(ROLE_PERMISSIONS).map(([role, perms]) => [role, new Set(perms)])
  )
);

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

function isValidRole(role) {
  return Object.prototype.hasOwnProperty.call(ROLE_DEFINITIONS, role);
}

function roleLabel(role) {
  return ROLE_DEFINITIONS[role]?.label || 'Unknown role';
}

function roleBadgeClass(role) {
  return ROLE_DEFINITIONS[role]?.badgeClass || 'badge--muted';
}

function permissionsForRole(role) {
  return ROLE_PERMISSIONS[role] ? [...ROLE_PERMISSIONS[role]] : [];
}

/**
 * Does a role grant a permission?
 * Returns false for unknown roles — deny by default.
 */
function roleHasPermission(role, permission) {
  const set = PERMISSION_SETS[role];
  return Boolean(set && set.has(permission));
}

/**
 * Does this role grant *every* permission in the list?
 */
function roleHasAllPermissions(role, permissions) {
  return permissions.every((permission) => roleHasPermission(role, permission));
}

/**
 * Where should this role land after login?
 * Falls back to the 403 handler if a dashboard is not registered.
 */
function dashboardPathForRole(role) {
  return DASHBOARD_BY_ROLE[role]?.path || null;
}

/**
 * Can this role open the dashboard defined for `dashboardRole`?
 * Used by the "direct URL entry" guard so a student typing
 * /examiner/dashboard is rejected by permission, not merely by identity.
 */
function canAccessDashboard(role, dashboardRole) {
  const dashboard = DASHBOARD_BY_ROLE[dashboardRole];
  if (!dashboard) return false;
  return roleHasPermission(role, dashboard.requiredPermission);
}

module.exports = {
  ROLES,
  ROLE_DEFINITIONS,
  LOGIN_CATEGORIES,
  PERMISSION_GROUPS,
  ALL_PERMISSIONS,
  ROLE_PERMISSIONS,
  DASHBOARDS,
  DASHBOARD_BY_ROLE,
  isValidRole,
  roleLabel,
  roleBadgeClass,
  permissionsForRole,
  roleHasPermission,
  roleHasAllPermissions,
  dashboardPathForRole,
  canAccessDashboard,
};
