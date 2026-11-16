'use strict';

/**
 * Authentication behaviour: login, logout, sessions, lockout, account state,
 * password reset and credential handling.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { boot, shutdown, newClient, CREDENTIALS, db } = require('./helpers/env');

test.before(async () => {
  await boot();
});

test.after(async () => {
  await shutdown();
});

/* -------------------------------------------------------------------------- */
test('login portal renders with all four portals and the demo guide', async () => {
  const client = newClient();
  const res = await client.get('/login');
  assert.equal(res.status, 200);
  const html = await res.text();

  assert.match(html, /Student Login/);
  assert.match(html, /Staff Login/);
  assert.match(html, /Administrator Login/);
  assert.match(html, /External Verifier Login/);
  assert.match(html, /Demo@2024/, 'demo password must be disclosed for faculty demos');
  assert.match(html, /Demonstration Accounts/);
  assert.match(html, /Synthetic accounts only/);
  assert.match(html, /Remember me/);
  assert.match(html, /Forgot password\?/);
  assert.match(html, /name="password"/);
  assert.match(html, /data-password-toggle/, 'show/hide control present');
});

test('each demo role signs in and lands on its own dashboard', async () => {
  const expectations = [
    ['student', '/student/dashboard'],
    ['examiner', '/examiner/dashboard'],
    ['moderator', '/moderator/dashboard'],
    ['controller', '/controller/dashboard'],
    ['department', '/department/dashboard'],
    ['administrator', '/admin/dashboard'],
    ['verifier', '/verifier/dashboard'],
  ];

  for (const [roleKey, expectedPath] of expectations) {
    const creds = CREDENTIALS[roleKey];
    const client = newClient();
    const res = await client.login(creds.id, creds.password, creds.category);
    assert.equal(res.status, 302, `${roleKey} should redirect after login`);
    assert.equal(res.location, expectedPath, `${roleKey} should land on ${expectedPath}`);

    const page = await client.get(expectedPath);
    assert.equal(page.status, 200, `${roleKey} dashboard should render`);
    const html = await page.text();
    assert.match(html, /Sign out/, `${roleKey} dashboard has logout control`);
    assert.match(html, /Central Authentication|Examinations/, 'branding present');
  }
});

test('Student ID is accepted in either case and by username', async () => {
  for (const identifier of ['STU2024001', 'stu2024001', 'Stu2024001']) {
    const client = newClient();
    const res = await client.login(identifier, 'Demo@2024', 'student');
    assert.equal(res.status, 302, `should accept ${identifier}`);
    assert.equal(res.location, '/student/dashboard');
  }
});

test('wrong password is rejected with a generic message', async () => {
  const client = newClient();
  const res = await client.login(CREDENTIALS.student.id, 'WrongPassword1', 'student');
  assert.equal(res.status, 401);
  const html = await res.text();
  assert.match(html, /Invalid User ID or password/);
  // Must not reveal whether the account exists.
  assert.doesNotMatch(html, /no such user/i);
});

test('unknown user returns the identical generic message', async () => {
  const client = newClient();
  const res = await client.login('STU9999999', 'Demo@2024', 'student');
  assert.equal(res.status, 401);
  const html = await res.text();
  assert.match(html, /Invalid User ID or password/);
});

test('a role cannot sign in through the wrong portal', async () => {
  const client = newClient();
  const res = await client.login(CREDENTIALS.examiner.id, CREDENTIALS.examiner.password, 'student');
  assert.equal(res.status, 401);
  const html = await res.text();
  assert.match(html, /not a student account/i);
});

test('a student cannot sign in through the administrator portal', async () => {
  const client = newClient();
  const res = await client.login(CREDENTIALS.student.id, CREDENTIALS.student.password, 'administrator');
  assert.equal(res.status, 401);
  const html = await res.text();
  assert.match(html, /not an administrator account/i);
});

test('missing fields are reported per-field', async () => {
  const client = newClient();
  const res = await client.post('/login', { identifier: '', password: '', category: 'student' });
  assert.equal(res.status, 400);
  const html = await res.text();
  assert.match(html, /User ID is required/);
  assert.match(html, /Password is required/);
});

test('deactivated accounts are refused even with the correct password', async () => {
  const client = newClient();
  const res = await client.login(
    CREDENTIALS.deactivated.id,
    CREDENTIALS.deactivated.password,
    'staff'
  );
  assert.equal(res.status, 401);
  const html = await res.text();
  assert.match(html, /deactivated by the system administrator/i);
});

test('repeated failures lock the account, then block even the right password', async () => {
  // Use a throwaway account so lockout does not affect other tests.
  const now = new Date().toISOString();
  const { hashPassword } = require('../src/lib/password');
  const hash = await hashPassword('LockMe@2024');
  db.run(
    `INSERT INTO users (username, public_id, full_name, email, role, password_hash, status,
                        is_demo, created_at, updated_at)
     VALUES ('locktest', 'TST0001', 'Lock Test', 'locktest@example.edu', 'student', ?, 'active', 0, ?, ?)`,
    hash,
    now,
    now
  );

  const client = newClient();
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const res = await client.login('TST0001', 'WrongPassword1', 'student');
    assert.equal(res.status, 401, `attempt ${attempt} should fail`);
  }

  // 6th attempt with the correct password must still be refused.
  const locked = await client.login('TST0001', 'LockMe@2024', 'student');
  assert.equal(locked.status, 401);
  const html = await locked.text();
  assert.match(html, /temporarily locked|locked for/i);

  const row = db.get("SELECT status, locked_until FROM users WHERE username = 'locktest'");
  assert.ok(row.locked_until, 'locked_until must be set');
  db.run("UPDATE users SET locked_until = NULL, failed_attempts = 0 WHERE username = 'locktest'");
});

test('logout destroys the session server-side and blocks re-use', async () => {
  const client = newClient();
  const login = await client.login(CREDENTIALS.student.id, CREDENTIALS.student.password, 'student');
  assert.equal(login.status, 302);

  const cookieBefore = client.cookie('uniexam.sid');
  assert.ok(cookieBefore, 'session cookie set');

  const dash = await client.get('/student/dashboard');
  assert.equal(dash.status, 200);

  const out = await client.post('/logout', {});
  assert.equal(out.status, 303);
  assert.equal(out.location, '/login');

  // Replay the old cookie manually: the session row must be revoked.
  const replay = newClient();
  replay.cookies.set('uniexam.sid', cookieBefore);
  replay.cookies.set('uniexam.csrf', client.cookie('uniexam.csrf') || '');
  const denied = await replay.get('/student/dashboard');
  assert.equal(denied.status, 302);
  assert.match(denied.location, /^\/login/);
});

test('remember me sets a long-lived cookie', async () => {
  const client = newClient();
  const res = await client.login(
    CREDENTIALS.student.id,
    CREDENTIALS.student.password,
    'student',
    true
  );
  assert.equal(res.status, 302);
  const setCookie = res.headers.getSetCookie().join(';');
  assert.match(setCookie, /Max-Age=2592000|Expires=/, 'remember-me cookie has an expiry');

  const row = db.get(
    `SELECT remember FROM sessions ORDER BY id DESC LIMIT 1`
  );
  assert.equal(row.remember, 1, 'session flagged as remember-me');
});

test('session cookie is HttpOnly and SameSite', async () => {
  const client = newClient();
  const res = await client.login(CREDENTIALS.student.id, CREDENTIALS.student.password, 'student');
  const setCookie = res.headers.getSetCookie().join(';');
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Lax/i);
});

test('CSRF: state-changing request without a token is rejected', async () => {
  const client = newClient();
  await client.get('/login'); // seeds the anonymous CSRF cookie
  const res = await client.post(
    '/login',
    { identifier: CREDENTIALS.student.id, password: CREDENTIALS.student.password, category: 'student' },
    { csrf: false }
  );
  assert.equal(res.status, 403);
  const html = await res.text();
  assert.match(html, /security token/i);
});

test('CSRF: a forged token is rejected on an authenticated session', async () => {
  const client = newClient();
  await client.login(CREDENTIALS.student.id, CREDENTIALS.student.password, 'student');
  const res = await client.post('/student/revaluations', {
    _csrf: 'forged-token-value',
    exam_id: '1',
    reason: 'This request should never be processed by the application.',
  });
  assert.equal(res.status, 403);
});

test('password reset issues a single-use link that actually works', async () => {
  const { generateToken } = require('../src/lib/password');

  // Create a dedicated account so we do not disturb the demo users.
  const { hashPassword } = require('../src/lib/password');
  const hash = await hashPassword('Original@2024');
  const now = new Date().toISOString();
  db.run(
    `INSERT INTO users (username, public_id, full_name, email, role, password_hash, status,
                        is_demo, created_at, updated_at)
     VALUES ('resettest', 'RST0001', 'Reset Test', 'resettest@example.edu', 'student', ?, 'active', 0, ?, ?)`,
    hash,
    now,
    now
  );

  const client = newClient();
  const request = await client.post('/forgot-password', { identifier: 'RST0001' });
  assert.equal(request.status, 303);
  assert.match(request.location, /^\/forgot-password\?sent=1/);
  assert.match(request.location, /token=/, 'demonstration link is surfaced');

  const token = new URL(request.location, 'http://x').searchParams.get('token');
  assert.ok(token);

  // The reset form should render for a valid token...
  const form = await client.get(`/reset-password/${token}`);
  assert.equal(form.status, 200);
  assert.match(await form.text(), /Choose a new password/);

  // ...and accept a strong new password.
  const submitted = await client.post(`/reset-password/${token}`, {
    password: 'BrandNew@2024',
    confirm_password: 'BrandNew@2024',
  });
  assert.equal(submitted.status, 303);
  assert.equal(submitted.location, '/login');

  // The new password works.
  const ok = await newClient().login('RST0001', 'BrandNew@2024', 'student');
  assert.equal(ok.status, 302);

  // The token cannot be replayed.
  const replay = await newClient().get(`/reset-password/${token}`);
  assert.equal(replay.status, 200);
  assert.match(await replay.text(), /invalid|expired/i);
});

test('password reset rejects a weak password', async () => {
  const now = new Date().toISOString();
  const { hashPassword } = require('../src/lib/password');
  const hash = await hashPassword('Original@2024');
  db.run(
    `INSERT INTO users (username, public_id, full_name, email, role, password_hash, status,
                        is_demo, created_at, updated_at)
     VALUES ('weaktest', 'WKT0001', 'Weak Test', 'weaktest@example.edu', 'student', ?, 'active', 0, ?, ?)`,
    hash,
    now,
    now
  );

  const client = newClient();
  const request = await client.post('/forgot-password', { identifier: 'WKT0001' });
  const token = new URL(request.location, 'http://x').searchParams.get('token');

  const res = await client.post(`/reset-password/${token}`, {
    password: 'short',
    confirm_password: 'short',
  });
  assert.equal(res.status, 400);
  const html = await res.text();
  assert.match(html, /at least 10 characters/i);
});

test('forgot password does not disclose whether an account exists', async () => {
  const known = await newClient().post('/forgot-password', { identifier: 'STU2024001' });
  const unknown = await newClient().post('/forgot-password', { identifier: 'NOT-A-REAL-ID' });

  // The redirect shape is identical; the token differs but is not an oracle
  // for the UI. Both land on the same confirmation screen.
  assert.equal(known.status, unknown.status);
  assert.match(known.location, /^\/forgot-password\?sent=1/);
  assert.match(unknown.location, /^\/forgot-password\?sent=1/);

  const page = await newClient().get('/forgot-password?sent=1');
  assert.equal(page.status, 200);
  assert.match(await page.text(), /same response whether or not the account exists/i);
});

test('audit log captured the authentication events', async () => {
  const { all } = require('../src/db');
  const logins = all("SELECT * FROM audit_log WHERE action = 'auth.login' AND outcome = 'success'");
  assert.ok(logins.length > 0, 'successful logins are audited');

  const failures = all("SELECT * FROM audit_log WHERE action = 'auth.login' AND outcome = 'failure'");
  assert.ok(failures.length > 0, 'failed logins are audited');

  const lockout = all("SELECT * FROM audit_log WHERE action = 'auth.login.lockout'");
  assert.ok(lockout.length > 0, 'lockouts are audited as critical events');
});

test('registering a privileged role is impossible — there is no self-service route', async () => {
  const client = newClient();
  for (const path of ['/register', '/signup', '/auth/register', '/api/register']) {
    const res = await client.get(path);
    assert.equal(res.status, 404, `${path} must not exist`);
  }
});

test('health check is public', async () => {
  const res = await newClient().get('/healthz', { accept: 'application/json' });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, 'ok');
});
