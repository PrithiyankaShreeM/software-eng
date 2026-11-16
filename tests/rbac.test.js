'use strict';

/**
 * Role-Based Access Control.
 *
 * These tests are the executable specification of the requirement:
 *
 *   "Ensure that directly entering another role's dashboard URL does not
 *    bypass authentication or permissions."
 *
 * Every dashboard is probed from every role (7 × 7 = 49 combinations) plus
 * from an anonymous client.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { boot, shutdown, newClient, signedIn, CREDENTIALS } = require('./helpers/env');

const DASHBOARDS = [
  { role: 'student', path: '/student/dashboard', creds: 'student' },
  { role: 'examiner', path: '/examiner/dashboard', creds: 'examiner' },
  { role: 'moderator', path: '/moderator/dashboard', creds: 'moderator' },
  { role: 'controller', path: '/controller/dashboard', creds: 'controller' },
  { role: 'department_head', path: '/department/dashboard', creds: 'department' },
  { role: 'administrator', path: '/admin/dashboard', creds: 'administrator' },
  { role: 'external_verifier', path: '/verifier/dashboard', creds: 'verifier' },
];

test.before(async () => {
  await boot();
});

test.after(async () => {
  await shutdown();
});

/* -------------------------------------------------------------------------- */
test('anonymous users are redirected to login from every dashboard', async () => {
  for (const dash of DASHBOARDS) {
    const res = await newClient().get(dash.path);
    assert.equal(res.status, 302, `${dash.path} must redirect anonymous users`);
    assert.match(res.location, /^\/login\?next=/, `${dash.path} preserves the intended URL`);
  }
});

test('every role can open its own dashboard', async () => {
  for (const dash of DASHBOARDS) {
    const creds = CREDENTIALS[dash.creds];
    const client = await signedIn(creds.id, creds.password, creds.category);
    const res = await client.get(dash.path);
    assert.equal(res.status, 200, `${dash.role} should open ${dash.path}`);
  }
});

test('no role can open any other role\'s dashboard by direct URL', async () => {
  for (const owner of DASHBOARDS) {
    const creds = CREDENTIALS[owner.creds];
    const client = await signedIn(creds.id, creds.password, creds.category);

    for (const target of DASHBOARDS) {
      if (target.role === owner.role) continue;

      const res = await client.get(target.path);
      assert.equal(
        res.status,
        403,
        `${owner.role} must be forbidden from ${target.path} (got ${res.status})`
      );
      const html = await res.text();
      assert.match(html, /access denied|dashboard access denied/i, 'branded 403 page is shown');
      assert.match(html, /audit log/i, 'the 403 page states that the attempt is recorded');
    }
  }
});

test('dashboard guard is permission-based, not only role-name based', async () => {
  const { canAccessDashboard, roleHasPermission, ROLE_PERMISSIONS, DASHBOARDS: registry } =
    require('../src/config/roles');

  // Every dashboard requirement must actually be granted to its own role.
  for (const dash of registry) {
    assert.ok(
      roleHasPermission(dash.role, dash.requiredPermission),
      `${dash.role} must hold ${dash.requiredPermission} to open its own dashboard`
    );
    assert.equal(canAccessDashboard(dash.role, dash.role), true);
  }

  // And no other role accidentally satisfies it.
  for (const dash of registry) {
    for (const role of Object.keys(ROLE_PERMISSIONS)) {
      if (role === dash.role) continue;
      assert.equal(
        canAccessDashboard(role, dash.role),
        false,
        `${role} must not be able to open the ${dash.role} dashboard`
      );
    }
  }
});

test('a student cannot reach examiner, moderator, controller, admin or verifier modules', async () => {
  const client = await signedIn(...Object.values(CREDENTIALS.student).slice(0, 2), 'student');
  const forbidden = [
    '/examiner/exams',
    '/examiner/papers',
    '/examiner/evaluations',
    '/moderator/review',
    '/controller/moderation',
    '/department/reports',
    '/admin/accounts',
    '/admin/roles',
    '/admin/settings',
    '/admin/audit',
    '/verifier/history',
  ];

  for (const path of forbidden) {
    const res = await client.get(path);
    assert.equal(res.status, 403, `student must be denied ${path}`);
  }
});

test('an examiner cannot publish results', async () => {
  const client = await signedIn(CREDENTIALS.examiner.id, CREDENTIALS.examiner.password, 'staff');

  const res = await client.post('/controller/exams/1/publish', {});
  assert.equal(res.status, 403, 'examiner must not reach the publish endpoint');

  // The examiner-specific publish guard is also refused.
  const res2 = await client.post('/examiner/results/publish', {});
  assert.equal(res2.status, 403);

  // The permission itself is absent from the examiner's role.
  const { roleHasPermission } = require('../src/config/roles');
  assert.equal(roleHasPermission('examiner', 'results:publish'), false);
  assert.equal(roleHasPermission('examiner', 'marks:approve'), false);
});

test('a moderator cannot overwrite original examiner marks directly', async () => {
  const moderator = await signedIn(CREDENTIALS.moderator.id, CREDENTIALS.moderator.password, 'staff');

  // There is no route that lets a moderator write marks to an evaluation.
  for (const path of [
    '/examiner/evaluations/1',
    '/moderator/evaluations/1',
    '/moderator/marks',
    '/controller/exams/1/approve',
    '/controller/exams/1/publish',
  ]) {
    const res = await moderator.post(path, { marks: '99' });
    assert.ok([403, 404].includes(res.status), `moderator must not write marks via ${path} (got ${res.status})`);
  }

  const { roleHasPermission } = require('../src/config/roles');
  assert.equal(roleHasPermission('moderator', 'script:evaluate'), false);
  assert.equal(roleHasPermission('moderator', 'marks:approve'), false);
  assert.equal(roleHasPermission('moderator', 'results:publish'), false);
});

test('moderation uses a staged correction that needs Controller sign-off', async () => {
  const { db } = require('./helpers/env');
  const moderator = await signedIn(CREDENTIALS.moderator.id, CREDENTIALS.moderator.password, 'staff');

  // Find an evaluation that is not yet locked.
  const evaluation = db.get(
    "SELECT * FROM evaluations WHERE status = 'evaluated' ORDER BY id DESC LIMIT 1"
  );
  assert.ok(evaluation, 'seed data must include an evaluated script');
  const originalMarks = evaluation.marks_awarded;

  const res = await moderator.post('/moderator/discrepancies', {
    evaluation_id: evaluation.id,
    proposed_marks: originalMarks + 5,
    reason: 'Rubric item 4(b) was omitted from the original evaluation and warrants partial credit.',
  });
  assert.equal(res.status, 303, 'moderator can stage a correction');

  // The original mark is untouched; the correction lives in another table.
  const after = db.get('SELECT * FROM evaluations WHERE id = ?', evaluation.id);
  assert.equal(after.marks_awarded, originalMarks, 'original examiner mark must be unchanged');

  const action = db.get(
    "SELECT * FROM moderation_actions WHERE evaluation_id = ? AND status = 'pending'",
    evaluation.id
  );
  assert.ok(action, 'a pending moderation action exists');
  assert.equal(action.original_marks, originalMarks);
  assert.equal(action.proposed_marks, originalMarks + 5);

  // Controller cannot resolve it before the moderator endorses it.
  const controller = await signedIn(CREDENTIALS.controller.id, CREDENTIALS.controller.password, 'staff');
  const early = await controller.post(`/controller/moderation/${action.id}/approve`, {
    note: 'Attempting to approve before endorsement.',
  });
  assert.equal(early.status, 303);
  const stillPending = db.get('SELECT status FROM moderation_actions WHERE id = ?', action.id);
  assert.equal(stillPending.status, 'pending', 'unendorsed corrections cannot be applied');

  // After endorsement the Controller can apply it.
  const endorse = await moderator.post(`/moderator/actions/${action.id}/approve`, {});
  assert.equal(endorse.status, 303);
  const endorsed = db.get('SELECT status FROM moderation_actions WHERE id = ?', action.id);
  assert.equal(endorsed.status, 'approved');

  const applied = await controller.post(`/controller/moderation/${action.id}/approve`, {
    note: 'Reviewed and accepted.',
  });
  assert.equal(applied.status, 303);

  const finalEval = db.get('SELECT * FROM evaluations WHERE id = ?', evaluation.id);
  assert.equal(finalEval.marks_awarded, originalMarks + 5, 'Controller-authorised correction is applied');
  assert.equal(finalEval.status, 'moderated');

  const resolvedAction = db.get('SELECT * FROM moderation_actions WHERE id = ?', action.id);
  assert.equal(resolvedAction.status, 'approved');
  assert.equal(resolvedAction.original_marks, originalMarks, 'original mark preserved for audit');
});

test('an external verifier cannot reach internal student examination records', async () => {
  const client = await signedIn(CREDENTIALS.verifier.id, CREDENTIALS.verifier.password, 'verifier');

  const forbidden = [
    '/student/dashboard',
    '/student/schedule',
    '/student/results',
    '/student/records',
    '/examiner/dashboard',
    '/admin/accounts',
    '/moderator/dashboard',
    '/controller/dashboard',
    '/department/dashboard',
  ];

  for (const path of forbidden) {
    const res = await client.get(path);
    assert.equal(res.status, 403, `verifier must be denied ${path}`);
  }

  const { ROLE_PERMISSIONS } = require('../src/config/roles');
  const verifierPerms = ROLE_PERMISSIONS.external_verifier;
  assert.ok(!verifierPerms.includes('results:read'));
  assert.ok(!verifierPerms.includes('records:read'));
  assert.ok(!verifierPerms.includes('schedule:read'));
});

test('verification output masks identity and omits examination records', async () => {
  const client = await signedIn(CREDENTIALS.verifier.id, CREDENTIALS.verifier.password, 'verifier');
  const res = await client.post('/verifier/verify', {
    credential_no: 'MSU-DEG-2024-0001',
    purpose: 'Employment check',
  });
  assert.equal(res.status, 200);
  const html = await res.text();

  assert.match(html, /Authentic|valid/i);
  assert.match(html, /MSU-DEG-2024-0001/);
  // The full legal name must never be disclosed — only initials + surname.
  assert.doesNotMatch(html, /Aarav Menon/, 'full name must be masked for external verifiers');
  assert.match(html, /A\. Menon/, 'masked name is shown');
  // No internal examination records may leak: no course codes, no internal
  // column names and no student contact details.
  assert.doesNotMatch(html, /CS401|CS501|CS505/, 'no examination course codes leak');
  assert.doesNotMatch(html, /marks_awarded|revaluation/i, 'no internal examination record fields leak');
  assert.doesNotMatch(html, /@student\.msu\.example\.edu/, 'no student email addresses leak');
});

test('an invalid credential is reported as not found, not as an error', async () => {
  const client = await signedIn(CREDENTIALS.verifier.id, CREDENTIALS.verifier.password, 'verifier');
  const res = await client.post('/verifier/verify', { credential_no: 'MSU-DEG-1999-9999' });
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /No matching credential/);
});

test('an administrator cannot be locked out by deactivating the last admin', async () => {
  const client = await signedIn(CREDENTIALS.administrator.id, CREDENTIALS.administrator.password, 'administrator');

  // Locate the administrator's own row.
  const { db } = require('./helpers/env');
  const admin = db.get("SELECT * FROM users WHERE username = 'admin'");

  // Self-deactivation is refused.
  const self = await client.post(`/admin/accounts/${admin.id}/status`, { status: 'inactive' });
  assert.equal(self.status, 303);
  const stillActive = db.get('SELECT status FROM users WHERE id = ?', admin.id);
  assert.equal(stillActive.status, 'active', 'an administrator cannot deactivate their own account');

  // Self-demotion is refused.
  const demote = await client.post(`/admin/accounts/${admin.id}/role`, { role: 'student' });
  assert.equal(demote.status, 303);
  const stillAdmin = db.get('SELECT role FROM users WHERE id = ?', admin.id);
  assert.equal(stillAdmin.role, 'administrator');
});

test('administrator can create, deactivate and re-role an account', async () => {
  const client = await signedIn(CREDENTIALS.administrator.id, CREDENTIALS.administrator.password, 'administrator');
  const { db } = require('./helpers/env');

  // Create
  const created = await client.post('/admin/accounts', {
    full_name: 'Test Examiner',
    username: 'testexm01',
    email: 'testexm01@msu.example.edu',
    role: 'examiner',
    department: 'Computer Science & Engineering',
    password: 'TempPass@2024',
    confirm_password: 'TempPass@2024',
  });
  assert.equal(created.status, 303);

  const row = db.get("SELECT * FROM users WHERE username = 'testexm01'");
  assert.ok(row, 'account was created');
  assert.equal(row.role, 'examiner');
  assert.equal(row.must_change_password, 1, 'temporary password must be changed');

  // The new account can actually sign in.
  const login = await newClient().login('testexm01', 'TempPass@2024', 'staff');
  assert.equal(login.status, 302);
  assert.equal(login.location, '/examiner/dashboard');

  // Re-role to moderator.
  const rerole = await client.post(`/admin/accounts/${row.id}/role`, { role: 'moderator' });
  assert.equal(rerole.status, 303);
  assert.equal(db.get('SELECT role FROM users WHERE id = ?', row.id).role, 'moderator');

  // Deactivate
  const deactivate = await client.post(`/admin/accounts/${row.id}/status`, { status: 'inactive' });
  assert.equal(deactivate.status, 303);
  assert.equal(db.get('SELECT status FROM users WHERE id = ?', row.id).status, 'inactive');

  // A deactivated account cannot sign in.
  const blocked = await newClient().login('testexm01', 'TempPass@2024', 'staff');
  assert.equal(blocked.status, 401);
  assert.match(await blocked.text(), /deactivated/i);
});

test('deactivating an account kills its live session immediately', async () => {
  const { db } = require('./helpers/env');

  const worker = await signedIn(CREDENTIALS.examiner.id, CREDENTIALS.examiner.password, 'staff');
  assert.equal((await worker.get('/examiner/dashboard')).status, 200);

  const admin = await signedIn(CREDENTIALS.administrator.id, CREDENTIALS.administrator.password, 'administrator');
  const examiner = db.get("SELECT * FROM users WHERE username = 'exm1001'");

  await admin.post(`/admin/accounts/${examiner.id}/status`, { status: 'inactive' });

  // The examiner's very next request is refused.
  const after = await worker.get('/examiner/dashboard');
  assert.equal(after.status, 302);
  assert.match(after.location, /^\/login/);

  // Restore for the rest of the suite.
  await admin.post(`/admin/accounts/${examiner.id}/status`, { status: 'active' });
});

test('role change revokes sessions so new permissions are loaded fresh', async () => {
  const { db } = require('./helpers/env');
  const admin = await signedIn(CREDENTIALS.administrator.id, CREDENTIALS.administrator.password, 'administrator');

  // Create a student account, sign it in, then promote it to examiner.
  await admin.post('/admin/accounts', {
    full_name: 'Promotion Test',
    username: 'promo01',
    email: 'promo01@msu.example.edu',
    role: 'student',
    password: 'TempPass@2024',
    confirm_password: 'TempPass@2024',
  });
  const row = db.get("SELECT * FROM users WHERE username = 'promo01'");

  const studentClient = newClient();
  const studentLogin = await studentClient.login('promo01', 'TempPass@2024', 'student');
  assert.equal(studentLogin.status, 302);
  assert.equal((await studentClient.get('/student/dashboard')).status, 200);

  await admin.post(`/admin/accounts/${row.id}/role`, { role: 'examiner' });

  // The old session is dead — no stale permission set survives.
  const stale = await studentClient.get('/student/dashboard');
  assert.equal(stale.status, 302);
  assert.match(stale.location, /^\/login/);

  // Fresh sign-in through the staff portal gives the examiner dashboard.
  const examinerClient = newClient();
  const examinerLogin = await examinerClient.login('promo01', 'TempPass@2024', 'staff');
  assert.equal(examinerLogin.status, 302);
  assert.equal(examinerLogin.location, '/examiner/dashboard');

  db.run("UPDATE users SET status = 'inactive' WHERE id = ?", row.id);
});

test('students cannot create accounts or assign roles', async () => {
  const client = await signedIn(CREDENTIALS.student.id, CREDENTIALS.student.password, 'student');
  const { db } = require('./helpers/env');
  const before = db.get('SELECT COUNT(*) AS c FROM users').c;

  const create = await client.post('/admin/accounts', {
    full_name: 'Escalation Attempt',
    username: 'hacker01',
    email: 'hacker01@example.edu',
    role: 'administrator',
    password: 'TempPass@2024',
    confirm_password: 'TempPass@2024',
  });
  assert.equal(create.status, 403);

  const after = db.get('SELECT COUNT(*) AS c FROM users').c;
  assert.equal(after, before, 'no account was created');
  assert.equal(db.get('SELECT * FROM users WHERE username = ?', 'hacker01'), undefined);
});

test('a failed authorization attempt is written to the audit log', async () => {
  const client = await signedIn(CREDENTIALS.student.id, CREDENTIALS.student.password, 'student');
  await client.get('/admin/audit');

  const { db } = require('./helpers/env');
  const entry = db.get(
    `SELECT * FROM audit_log
      WHERE action = 'access.dashboard_denied' AND actor_role = 'Student'
      ORDER BY id DESC LIMIT 1`
  );
  assert.ok(entry, 'dashboard denial is audited');
  assert.equal(entry.outcome, 'failure');
  assert.equal(entry.severity, 'critical');
  assert.match(entry.detail, /Direct URL attempt/i);
});

test('permission matrix in the admin UI matches the code', async () => {
  const client = await signedIn(CREDENTIALS.administrator.id, CREDENTIALS.administrator.password, 'administrator');
  const res = await client.get('/admin/roles');
  assert.equal(res.status, 200);
  const html = await res.text();

  const { ALL_PERMISSIONS, ROLE_PERMISSIONS } = require('../src/config/roles');
  // Every permission key must be rendered somewhere in the matrix.
  for (const key of ALL_PERMISSIONS) {
    assert.ok(html.includes(key), `permission ${key} is displayed`);
  }
  // Spot-check that a controller-only permission is NOT attributed to students.
  assert.ok(ROLE_PERMISSIONS.student.indexOf('results:publish') === -1);
});

test('API requests receive JSON 403 instead of HTML', async () => {
  const client = await signedIn(CREDENTIALS.student.id, CREDENTIALS.student.password, 'student');
  const res = await client.get('/admin/audit', { accept: 'application/json' });
  assert.equal(res.status, 403);
  const body = await res.json();
  assert.equal(body.error, 'forbidden');
  assert.equal(body.yourRole, 'student');
});

test('unauthenticated API requests receive JSON 401', async () => {
  const res = await newClient().get('/admin/dashboard', { accept: 'application/json' });
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.equal(body.error, 'authentication_required');
  assert.match(body.loginUrl, /^\/login\?next=/);
});

test('open-redirect protection: a crafted next= URL cannot escape the app', async () => {
  const client = newClient();
  await client.get('/login?next=https://evil.example.com/steal');
  const res = await client.post('/login', {
    identifier: CREDENTIALS.student.id,
    password: CREDENTIALS.student.password,
    category: 'student',
    next: 'https://evil.example.com/steal',
  });
  assert.equal(res.status, 302);
  assert.equal(res.location, '/student/dashboard', 'external next= is ignored');
});
