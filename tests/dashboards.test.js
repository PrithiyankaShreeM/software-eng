'use strict';

/**
 * Dashboard rendering and per-role workflows.
 *
 * Confirms that each dashboard shows what its role is supposed to see, that
 * navigation is permission-filtered, and that the end-to-end examination
 * workflow (evaluate → moderate → approve → publish) actually works.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { boot, shutdown, newClient, signedIn, CREDENTIALS, db } = require('./helpers/env');

test.before(async () => {
  await boot();
});

test.after(async () => {
  await shutdown();
});

/* -------------------------------------------------------------------------- */
test('student dashboard shows schedule, results and revaluation figures', async () => {
  const client = await signedIn(CREDENTIALS.student.id, CREDENTIALS.student.password, 'student');
  const res = await client.get('/student/dashboard');
  assert.equal(res.status, 200);
  const html = await res.text();

  assert.match(html, /Student Dashboard/);
  assert.match(html, /Upcoming Examinations/);
  assert.match(html, /Recent Results/);
  assert.match(html, /Open revaluations/);
  assert.match(html, /Notifications/);
  // Student navigation must not contain staff modules.
  assert.doesNotMatch(html, /href="\/examiner\//);
  assert.doesNotMatch(html, /href="\/admin\//);
  assert.doesNotMatch(html, /href="\/moderator\//);
});

test('student schedule, results, revaluations and records pages render', async () => {
  const client = await signedIn(CREDENTIALS.student.id, CREDENTIALS.student.password, 'student');
  const pages = [
    ['/student/schedule', /Examination Timetable/],
    ['/student/results', /Published Results|Result Statement/],
    ['/student/revaluations', /Revaluation Requests/],
    ['/student/records', /Academic Records/],
  ];
  for (const [path, pattern] of pages) {
    const res = await client.get(path);
    assert.equal(res.status, 200, `${path} should render`);
    assert.match(await res.text(), pattern, `${path} shows its content`);
  }
});

test('a student can submit a revaluation request and see it tracked', async () => {
  const client = await signedIn(CREDENTIALS.student.id, CREDENTIALS.student.password, 'student');
  const exam = db.get(
    `SELECT e.* FROM exams e
      JOIN registrations r ON r.exam_id = e.id
     WHERE r.user_id = (SELECT id FROM users WHERE username = 'stu2024001')
       AND e.status = 'completed'
       AND NOT EXISTS (
         SELECT 1 FROM revaluations rv
          WHERE rv.exam_id = e.id
            AND rv.student_id = (SELECT id FROM users WHERE username = 'stu2024001')
       )
     LIMIT 1`
  );
  assert.ok(exam, 'a completed registered exam is available');

  const submit = await client.post('/student/revaluations', {
    exam_id: exam.id,
    reason: 'I believe question 3(b) of Part C was marked against the wrong rubric item.',
  });
  assert.equal(submit.status, 303);

  const page = await client.get('/student/revaluations');
  const html = await page.text();
  assert.match(html, /question 3\(b\)/);
  assert.match(html, /Submitted|Under review/);
});

test('revaluation reason shorter than 20 characters is rejected', async () => {
  // Use a different student so this test does not collide with the request
  // submitted by the previous test.
  const client = await signedIn('STU2024002', 'Demo@2024', 'student');
  const exam = db.get(
    `SELECT e.* FROM exams e
      JOIN registrations r ON r.exam_id = e.id
     WHERE r.user_id = (SELECT id FROM users WHERE username = 'stu2024002')
       AND e.status = 'completed'
     LIMIT 1`
  );
  assert.ok(exam, 'completed exam available for this student');

  const res = await client.post('/student/revaluations', {
    exam_id: exam.id,
    reason: 'too short',
  });
  assert.equal(res.status, 303);
  // Follow the redirect to see the error flash.
  const page = await client.get('/student/revaluations');
  assert.match(await page.text(), /at least 20 characters/i);
});

test('student cannot submit a revaluation for an exam they are not registered for', async () => {
  const client = await signedIn(CREDENTIALS.student.id, CREDENTIALS.student.password, 'student');
  const other = db.get(
    `SELECT * FROM exams
      WHERE id NOT IN (SELECT exam_id FROM registrations
                        WHERE user_id = (SELECT id FROM users WHERE username = 'stu2024001'))
      LIMIT 1`
  );
  assert.ok(other);
  const res = await client.post('/student/revaluations', {
    exam_id: other.id,
    reason: 'Attempting to request revaluation for a paper I never sat this semester.',
  });
  assert.equal(res.status, 303);
  const page = await client.get('/student/revaluations');
  assert.match(await page.text(), /not registered/i);
});

test('examiner workspace renders scheduling, papers and evaluation queue', async () => {
  const client = await signedIn(CREDENTIALS.examiner.id, CREDENTIALS.examiner.password, 'staff');

  for (const [path, pattern] of [
    ['/examiner/dashboard', /Examiner Workspace/],
    ['/examiner/exams', /Examination Scheduling/],
    ['/examiner/papers', /Question Papers/],
    ['/examiner/evaluations', /Evaluation Queue/],
  ]) {
    const res = await client.get(path);
    assert.equal(res.status, 200, `${path} should render`);
    assert.match(await res.text(), pattern);
  }

  const dash = await (await client.get('/examiner/dashboard')).text();
  assert.doesNotMatch(dash, /href="\/admin\//, 'no admin links in examiner navigation');
  assert.doesNotMatch(dash, /href="\/student\//, 'no student links in examiner navigation');
});

test('an examiner can schedule an examination and it appears on student timetables', async () => {
  const examiner = await signedIn(CREDENTIALS.examiner.id, CREDENTIALS.examiner.password, 'staff');
  const future = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  const res = await examiner.post('/examiner/exams', {
    code: 'CS599',
    title: 'Compiler Design',
    programme: 'B.E. Computer Science',
    semester: '5',
    department: 'Computer Science & Engineering',
    exam_date: future,
    start_time: '14:00',
    duration_mins: '180',
    hall: 'Exam Hall F — Block 6',
  });
  assert.equal(res.status, 303);

  const created = db.get("SELECT * FROM exams WHERE code = 'CS599'");
  assert.ok(created, 'exam row created');
  assert.equal(created.status, 'scheduled');

  const page = await examiner.get('/examiner/exams');
  assert.match(await page.text(), /CS599/);
});

test('an examiner can author a paper, and drafts must include a rubric', async () => {
  const examiner = await signedIn(CREDENTIALS.examiner.id, CREDENTIALS.examiner.password, 'staff');
  const exam = db.get("SELECT * FROM exams WHERE code = 'CS599'");

  // Missing rubric must be refused.
  const noRubric = await examiner.post('/examiner/papers', {
    exam_id: exam.id,
    title: 'Compiler Design — Set A',
    total_marks: '100',
    rubric: '',
  });
  assert.equal(noRubric.status, 303);
  const page = await examiner.get('/examiner/papers');
  assert.match(await page.text(), /rubric is required/i);

  // A complete paper is accepted as a draft.
  const ok = await examiner.post('/examiner/papers', {
    exam_id: exam.id,
    title: 'Compiler Design — Set A',
    total_marks: '100',
    rubric: 'Part A: 10 × 2 · Part B: 5 × 6 · Part C: 2 × 20',
  });
  assert.equal(ok.status, 303);

  const paper = db.get("SELECT * FROM question_papers WHERE title = 'Compiler Design — Set A'");
  assert.ok(paper);
  assert.equal(paper.status, 'draft');
  assert.match(paper.rubric, /Part A/);
});

test('examiner cannot modify a locked (moderated/approved) evaluation', async () => {
  const examiner = await signedIn(CREDENTIALS.examiner.id, CREDENTIALS.examiner.password, 'staff');
  const locked = db.get("SELECT * FROM evaluations WHERE status IN ('moderated','approved') LIMIT 1");
  if (!locked) return; // nothing locked in this dataset

  const before = locked.marks_awarded;
  const res = await examiner.post(`/examiner/evaluations/${locked.id}`, { marks: '99', remarks: 'override' });
  assert.equal(res.status, 303);
  const after = db.get('SELECT marks_awarded FROM evaluations WHERE id = ?', locked.id);
  assert.equal(after.marks_awarded, before, 'locked marks cannot be overwritten');
});

test('moderation dashboard renders flagged scripts and history', async () => {
  const client = await signedIn(CREDENTIALS.moderator.id, CREDENTIALS.moderator.password, 'staff');

  for (const [path, pattern] of [
    ['/moderator/dashboard', /Moderation Dashboard/],
    ['/moderator/review', /Evaluation Review/],
  ]) {
    const res = await client.get(path);
    assert.equal(res.status, 200);
    assert.match(await res.text(), pattern);
  }

  const dash = await (await client.get('/moderator/dashboard')).text();
  assert.doesNotMatch(dash, /href="\/admin\//);
  assert.doesNotMatch(dash, /href="\/examiner\//);
});

test('controller dashboard shows the approval and publication gate', async () => {
  const client = await signedIn(CREDENTIALS.controller.id, CREDENTIALS.controller.password, 'staff');

  const res = await client.get('/controller/dashboard');
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /Examination Approval Dashboard/);
  assert.match(html, /Approve marks|Awaiting approval/);
  assert.match(html, /Two-step gate/);

  const moderation = await client.get('/controller/moderation');
  assert.equal(moderation.status, 200);
  assert.match(await moderation.text(), /Moderation Sign-off/);
});

test('full result lifecycle: approve then publish makes results visible to the student', async () => {
  const controller = await signedIn(CREDENTIALS.controller.id, CREDENTIALS.controller.password, 'staff');

  // Find a completed exam whose results are awaiting approval.
  const exam = db.get(
    `SELECT e.* FROM exams e
      JOIN result_publications p ON p.exam_id = e.id
     WHERE p.status = 'awaiting_approval'
     LIMIT 1`
  );
  assert.ok(exam, 'seed provides an exam awaiting approval');

  // Student cannot see these marks yet.
  const studentUser = db.get(
    "SELECT student_id FROM evaluations WHERE exam_id = ? LIMIT 1",
    exam.id
  );
  const student = db.get('SELECT * FROM users WHERE id = ?', studentUser.student_id);

  const beforeCount = db.get(
    'SELECT COUNT(*) AS c FROM results WHERE exam_id = ?',
    exam.id
  ).c;
  assert.equal(beforeCount, 0, 'no results published before approval');

  // Step 1: approve.
  const approve = await controller.post(`/controller/exams/${exam.id}/approve`, {});
  assert.equal(approve.status, 303);
  const pub = db.get('SELECT * FROM result_publications WHERE exam_id = ?', exam.id);
  assert.equal(pub.status, 'approved');

  // Publishing directly after approval is allowed, but let's assert approval
  // alone did not expose results.
  assert.equal(db.get('SELECT COUNT(*) AS c FROM results WHERE exam_id = ?', exam.id).c, 0);

  // Step 2: publish.
  const publish = await controller.post(`/controller/exams/${exam.id}/publish`, {});
  assert.equal(publish.status, 303);
  const after = db.get('SELECT * FROM result_publications WHERE exam_id = ?', exam.id);
  assert.equal(after.status, 'published');
  assert.ok(after.published_at);

  const published = db.all('SELECT * FROM results WHERE exam_id = ?', exam.id);
  assert.ok(published.length > 0, 'results rows created');
  for (const r of published) {
    assert.match(r.grade, /^(O|A\+|A|B\+|B|C|F)$/);
  }

  // The student can now see the result.
  const studentClient = newClient();
  await studentClient.login(student.username, 'Demo@2024', 'student');
  const resultsPage = await studentClient.get('/student/results');
  assert.match(await resultsPage.text(), new RegExp(exam.code));
});

test('publishing an unapproved result set is refused', async () => {
  const controller = await signedIn(CREDENTIALS.controller.id, CREDENTIALS.controller.password, 'staff');
  const exam = db.get(
    `SELECT e.* FROM exams e
      JOIN result_publications p ON p.exam_id = e.id
     WHERE p.status = 'awaiting_approval'
     LIMIT 1`
  );
  if (!exam) return; // all results already handled by earlier tests

  const res = await controller.post(`/controller/exams/${exam.id}/publish`, {});
  assert.equal(res.status, 303);
  const page = await controller.get('/controller/dashboard');
  assert.match(await page.text(), /must be approved before/i);
  assert.equal(
    db.get('SELECT status FROM result_publications WHERE exam_id = ?', exam.id).status,
    'awaiting_approval'
  );
});

test('department dashboard is scoped to the head\'s own department', async () => {
  const client = await signedIn(CREDENTIALS.department.id, CREDENTIALS.department.password, 'staff');
  const res = await client.get('/department/dashboard');
  assert.equal(res.status, 200);
  const html = await res.text();

  assert.match(html, /Department Analytics/);
  assert.match(html, /Computer Science &amp; Engineering/);
  assert.match(html, /Student Performance/);

  // The department is derived from the session, never from a query parameter.
  const widened = await client.get(
    '/department/dashboard?department=Mechanical%20Engineering'
  );
  const widenedHtml = await widened.text();
  assert.match(widenedHtml, /Computer Science &amp; Engineering/);
  assert.doesNotMatch(widenedHtml, /Head — Mechanical/);

  const reports = await client.get('/department/reports');
  assert.equal(reports.status, 200);
  assert.match(await reports.text(), /Departmental Performance Report/);
});

test('administrator dashboard exposes accounts, sessions and audit summary', async () => {
  const client = await signedIn(CREDENTIALS.administrator.id, CREDENTIALS.administrator.password, 'administrator');

  const res = await client.get('/admin/dashboard');
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /System Administration/);
  assert.match(html, /Accounts by Role/);
  assert.match(html, /Recent Security Events/);
  assert.match(html, /Active Sessions/);

  for (const [path, pattern] of [
    ['/admin/accounts', /Account Management/],
    ['/admin/roles', /Roles &amp; Permissions|Roles & Permissions/],
    ['/admin/settings', /Examination Settings/],
    ['/admin/audit', /System Audit Log/],
  ]) {
    const page = await client.get(path);
    assert.equal(page.status, 200, `${path} should render`);
    assert.match(await page.text(), pattern);
  }
});

test('administrator can update examination settings', async () => {
  const client = await signedIn(CREDENTIALS.administrator.id, CREDENTIALS.administrator.password, 'administrator');
  const res = await client.post('/admin/settings', {
    'setting.examination.passPercentage': '45',
  });
  assert.equal(res.status, 303);
  assert.equal(
    db.get("SELECT value FROM settings WHERE key = 'examination.passPercentage'").value,
    '45'
  );

  // Restore
  await client.post('/admin/settings', { 'setting.examination.passPercentage': '40' });
});

test('administrator account detail page renders', async () => {
  const client = await signedIn(CREDENTIALS.administrator.id, CREDENTIALS.administrator.password, 'administrator');
  const student = db.get("SELECT * FROM users WHERE username = 'stu2024002'");
  const res = await client.get(`/admin/accounts/${student.id}`);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /Diya Krishnan/);
  assert.match(html, /Permissions Granted/);
  assert.match(html, /records:read/);
});

test('verifier dashboard renders the verification portal', async () => {
  const client = await signedIn(CREDENTIALS.verifier.id, CREDENTIALS.verifier.password, 'verifier');
  const res = await client.get('/verifier/dashboard');
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /Credential Verification Portal/);
  assert.match(html, /Verify a credential/);
  assert.match(html, /Access Scope/);
  assert.doesNotMatch(html, /href="\/student\//);
  assert.doesNotMatch(html, /href="\/admin\//);

  const history = await client.get('/verifier/history');
  assert.equal(history.status, 200);
  assert.match(await history.text(), /Verification History/);
});

test('a revoked credential is reported as revoked, not valid', async () => {
  const client = await signedIn(CREDENTIALS.verifier.id, CREDENTIALS.verifier.password, 'verifier');
  const res = await client.post('/verifier/verify', { credential_no: 'MSU-DEG-2022-0455' });
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /Revoked/);
  assert.match(html, /revoked/);
});

test('notifications page renders for every role that holds the permission', async () => {
  // The external verifier role deliberately has no notification feed: it is
  // outside the internal university community.
  for (const key of ['student', 'examiner', 'moderator', 'controller', 'department', 'administrator']) {
    const creds = CREDENTIALS[key];
    const client = await signedIn(creds.id, creds.password, creds.category);
    const res = await client.get('/notifications');
    assert.equal(res.status, 200, `${key} should see notifications`);
  }
});

test('the external verifier has no notification feed', async () => {
  const client = await signedIn(CREDENTIALS.verifier.id, CREDENTIALS.verifier.password, 'verifier');
  const res = await client.get('/notifications');
  assert.equal(res.status, 404, 'verifier role holds no notifications:read permission');
  const { roleHasPermission } = require('../src/config/roles');
  assert.equal(roleHasPermission('external_verifier', 'notifications:read'), false);
});

test('my-account page renders for every role', async () => {
  for (const key of ['student', 'examiner', 'administrator', 'verifier']) {
    const creds = CREDENTIALS[key];
    const client = await signedIn(creds.id, creds.password, creds.category);
    const res = await client.get('/account');
    assert.equal(res.status, 200, `${key} account page`);
    assert.match(await res.text(), /My Account/);
  }
});

test('a user can change their own password and other sessions are revoked', async () => {
  const { hashPassword } = require('../src/lib/password');
  const hash = await hashPassword('Original@2024');
  const now = new Date().toISOString();
  db.run(
    `INSERT INTO users (username, public_id, full_name, email, role, password_hash, status,
                        is_demo, created_at, updated_at)
     VALUES ('pwchange', 'PWC0001', 'Password Change', 'pwchange@example.edu', 'student', ?, 'active', 0, ?, ?)`,
    hash,
    now,
    now
  );

  const sessionA = newClient();
  await sessionA.login('PWC0001', 'Original@2024', 'student');
  const sessionB = newClient();
  await sessionB.login('PWC0001', 'Original@2024', 'student');

  const res = await sessionA.post('/account/password', {
    current_password: 'Original@2024',
    password: 'Updated@2024',
    confirm_password: 'Updated@2024',
  });
  assert.equal(res.status, 303);

  // Session A survived, session B was revoked.
  assert.equal((await sessionA.get('/student/dashboard')).status, 200);
  const staleB = await sessionB.get('/student/dashboard');
  assert.equal(staleB.status, 302);
  assert.match(staleB.location, /^\/login/);

  // The new password works, the old one does not.
  const fresh = await newClient().login('PWC0001', 'Updated@2024', 'student');
  assert.equal(fresh.status, 302);
  const old = await newClient().login('PWC0001', 'Original@2024', 'student');
  assert.equal(old.status, 401);
});

test('password change requires the correct current password', async () => {
  const client = await signedIn(CREDENTIALS.student.id, CREDENTIALS.student.password, 'student');
  const res = await client.post('/account/password', {
    current_password: 'DefinitelyWrong1',
    password: 'Updated@2024',
    confirm_password: 'Updated@2024',
  });
  assert.equal(res.status, 303);
  const page = await client.get('/account');
  assert.match(await page.text(), /current password is incorrect/i);
});

test('unknown routes render the branded 404 page', async () => {
  const res = await newClient().get('/this/does/not/exist');
  assert.equal(res.status, 404);
  const html = await res.text();
  assert.match(html, /Page not found/);
  assert.match(html, /Meridian State University/);
});

test('unknown API routes return JSON 404', async () => {
  const res = await newClient().get('/api/nope', { accept: 'application/json' });
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.equal(body.error, 'not_found');
});

test('every dashboard shares the same shell and branding', async () => {
  const shells = [];
  for (const key of ['student', 'examiner', 'moderator', 'controller', 'department', 'administrator', 'verifier']) {
    const creds = CREDENTIALS[key];
    const client = await signedIn(creds.id, creds.password, creds.category);
    const path = {
      student: '/student/dashboard',
      examiner: '/examiner/dashboard',
      moderator: '/moderator/dashboard',
      controller: '/controller/dashboard',
      department: '/department/dashboard',
      administrator: '/admin/dashboard',
      verifier: '/verifier/dashboard',
    }[key];
    const html = await (await client.get(path)).text();
    shells.push(html);

    // Consistent chrome on every dashboard.
    assert.match(html, /class="sidebar"/, `${key} has the shared sidebar`);
    assert.match(html, /class="topbar"/, `${key} has the shared topbar`);
    assert.match(html, /Meridian State University/, `${key} shows university branding`);
    assert.match(html, /Central Authentication/, `${key} shows the platform identity`);
    assert.match(html, /Sign out/, `${key} offers logout`);
    assert.match(html, /\/static\/css\/app\.css/, `${key} loads the shared stylesheet`);
  }

  // The same stylesheet and brand markup appear on all seven.
  assert.equal(shells.length, 7);
});
