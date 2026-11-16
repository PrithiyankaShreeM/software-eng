'use strict';

/**
 * Unit-level security tests for the primitives the whole platform rests on.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
  timingSafeEqualString,
  generateToken,
  sha256,
} = require('../src/lib/password');

/* -------------------------------------------------------------------------- */
test('password hashes are salted, verifiable and never reversible', async () => {
  const password = 'CorrectHorse@2024';
  const a = await hashPassword(password);
  const b = await hashPassword(password);

  assert.notEqual(a, b, 'identical passwords produce different hashes (unique salt)');
  assert.match(a, /^scrypt\$\d+\$\d+\$\d+\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
  assert.ok(!a.includes(password), 'hash never contains the plaintext');

  assert.equal(await verifyPassword(password, a), true);
  assert.equal(await verifyPassword(password, b), true);
  assert.equal(await verifyPassword('correcthorse@2024', a), false, 'case sensitive');
  assert.equal(await verifyPassword('CorrectHorse@2025', a), false);
  assert.equal(await verifyPassword('', a), false);
});

test('verifyPassword rejects malformed or hostile hash input safely', async () => {
  for (const bad of [
    '',
    'not-a-hash',
    'scrypt$only$four$parts',
    'bcrypt$16384$8$1$c2FsdA==$aGFzaA==',
    'scrypt$abc$8$1$c2FsdA==$aGFzaA==',
    null,
    undefined,
    12345,
  ]) {
    assert.equal(await verifyPassword('anything', bad), false, `must reject ${String(bad)}`);
  }
});

test('scrypt cost parameters are at least the Node defaults', async () => {
  const hash = await hashPassword('ParameterCheck@1');
  const [, N, r, p] = hash.split('$');
  assert.ok(Number(N) >= 16384, 'N must be at least 16384');
  assert.ok(Number(r) >= 8, 'r must be at least 8');
  assert.ok(Number(p) >= 1, 'p must be at least 1');
});

test('password policy enforces length, case and digits', () => {
  const cases = [
    ['short1A', false],
    ['alllowercase1', false],
    ['ALLUPPERCASE1', false],
    ['NoDigitsHere!', false],
    ['GoodPass123', true],
    ['AnotherGood1', true],
    [' leading space1A', false],
  ];
  for (const [password, expected] of cases) {
    const result = validatePasswordStrength(password, { minLength: 10 });
    assert.equal(result.valid, expected, `${password} → ${expected}: ${result.errors.join('; ')}`);
  }
});

test('timing-safe comparison is correct for equal and unequal inputs', () => {
  assert.equal(timingSafeEqualString('abc123', 'abc123'), true);
  assert.equal(timingSafeEqualString('abc123', 'abc124'), false);
  assert.equal(timingSafeEqualString('abc', 'abcdef'), false, 'length mismatch returns false');
  assert.equal(timingSafeEqualString('', ''), true);
  assert.equal(timingSafeEqualString(null, 'x'), false);
});

test('tokens are URL-safe, high entropy and unique', () => {
  const tokens = new Set();
  for (let i = 0; i < 200; i += 1) {
    const token = generateToken(32);
    assert.match(token, /^[A-Za-z0-9_-]+$/, 'base64url charset only');
    assert.ok(token.length >= 40, 'at least 40 characters of entropy');
    tokens.add(token);
  }
  assert.equal(tokens.size, 200, 'no collisions across 200 tokens');
});

test('sha256 digests are stable and input sensitive', () => {
  assert.equal(sha256('abc'), sha256('abc'));
  assert.notEqual(sha256('abc'), sha256('abd'));
  assert.match(sha256('abc'), /^[0-9a-f]{64}$/);
});

test('the role registry grants no permission to an unknown role', () => {
  const { roleHasPermission, isValidRole, ALL_PERMISSIONS, ROLE_PERMISSIONS } = require('../src/config/roles');

  assert.equal(isValidRole('superuser'), false);
  assert.equal(isValidRole(''), false);
  assert.equal(isValidRole(null), false);
  assert.equal(roleHasPermission('superuser', 'audit:read'), false, 'deny by default');
  assert.equal(roleHasPermission(undefined, 'audit:read'), false);

  // Every granted permission must exist in the catalogue.
  for (const [role, perms] of Object.entries(ROLE_PERMISSIONS)) {
    for (const permission of perms) {
      assert.ok(
        ALL_PERMISSIONS.includes(permission),
        `${role} references an undefined permission: ${permission}`
      );
    }
  }
});

test('no role shares any administration-domain permission with the administrator', () => {
  const { ROLE_PERMISSIONS, ROLES, PERMISSION_GROUPS } = require('../src/config/roles');

  // Scope the assertion to the "administration" domain. The administrator
  // also holds benign read permissions (schedule:read, notifications:read)
  // that other roles legitimately share — those are not privileges.
  const administrationGroup = PERMISSION_GROUPS.find((g) => g.key === 'administration');
  const adminOnly = new Set(administrationGroup.permissions.map((p) => p.key));

  for (const [role, perms] of Object.entries(ROLE_PERMISSIONS)) {
    if (role === ROLES.ADMINISTRATOR) {
      for (const permission of adminOnly) {
        assert.ok(perms.includes(permission), `administrator must hold ${permission}`);
      }
      continue;
    }
    const overlap = perms.filter((p) => adminOnly.has(p));
    assert.deepEqual(overlap, [], `${role} must not hold any administration permission`);
  }

  // And no other role may hold a permission outside its own declared domain
  // by accident (defence in depth against copy-paste errors).
  assert.ok(!ROLE_PERMISSIONS.student.includes('roles:assign'));
});

test('only the controller can approve marks or publish results', () => {
  const { ROLE_PERMISSIONS } = require('../src/config/roles');
  const approvers = Object.entries(ROLE_PERMISSIONS)
    .filter(([, perms]) => perms.includes('marks:approve'))
    .map(([role]) => role);
  const publishers = Object.entries(ROLE_PERMISSIONS)
    .filter(([, perms]) => perms.includes('results:publish'))
    .map(([role]) => role);

  assert.deepEqual(approvers, ['controller']);
  assert.deepEqual(publishers, ['controller']);
});

test('only the administrator can assign roles or reset passwords', () => {
  const { ROLE_PERMISSIONS } = require('../src/config/roles');
  for (const permission of ['roles:assign', 'passwords:reset', 'accounts:create', 'audit:read']) {
    const holders = Object.entries(ROLE_PERMISSIONS)
      .filter(([, perms]) => perms.includes(permission))
      .map(([role]) => role);
    assert.deepEqual(holders, ['administrator'], `${permission} must be administrator-only`);
  }
});

test('moderators have no mark-writing permission', () => {
  const { ROLE_PERMISSIONS } = require('../src/config/roles');
  const moderator = ROLE_PERMISSIONS.moderator;
  assert.ok(!moderator.includes('script:evaluate'), 'cannot write marks');
  assert.ok(!moderator.includes('marks:approve'), 'cannot approve marks');
  assert.ok(!moderator.includes('results:publish'), 'cannot publish');
  assert.ok(moderator.includes('evaluation:review'));
  assert.ok(moderator.includes('moderation:approve'));
});

test('external verifiers hold credential permissions only', () => {
  const { ROLE_PERMISSIONS } = require('../src/config/roles');
  const verifier = ROLE_PERMISSIONS.external_verifier;
  for (const permission of verifier) {
    assert.match(permission, /^(credential|verification):/, `unexpected permission ${permission}`);
  }
});

test('a temporary password satisfies the same policy as a chosen one', () => {
  const { generateTemporaryPassword } = require('../src/services/passwordReset');
  for (let i = 0; i < 50; i += 1) {
    const temp = generateTemporaryPassword();
    assert.ok(temp.length >= 12, 'at least 12 characters');
    const strength = validatePasswordStrength(temp, { minLength: 10 });
    assert.equal(strength.valid, true, `generated password failed policy: ${temp}`);
  }
});
