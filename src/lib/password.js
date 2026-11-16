'use strict';

/**
 * Password hashing using Node's built-in scrypt KDF.
 *
 * Stored format (single string, self-describing so parameters can evolve):
 *
 *   scrypt$<N>$<r>$<p>$<saltBase64>$<hashBase64>
 *
 * Why scrypt: memory-hard, available in the Node standard library with no
 * native build step, and resistant to GPU/ASIC batch cracking. Parameters
 * below are the Node defaults (N=16384, r=8, p=1) which map to ~16 MB of
 * memory per hash — deliberately expensive for an attacker, fast enough
 * (~50-100 ms) for a login.
 */

const crypto = require('node:crypto');

const N = 16384; // CPU/memory cost
const r = 8; // block size
const p = 1; // parallelisation
const KEY_LENGTH = 64;
const SALT_BYTES = 16;
const PREFIX = 'scrypt';

function scryptAsync(password, salt, keylen, options) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, keylen, options, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

/**
 * Hash a plaintext password.
 * @param {string} password
 * @returns {Promise<string>} encoded hash string
 */
async function hashPassword(password) {
  if (typeof password !== 'string' || password.length === 0) {
    throw new TypeError('Password must be a non-empty string');
  }
  const salt = crypto.randomBytes(SALT_BYTES);
  const derived = await scryptAsync(password.normalize('NFKC'), salt, KEY_LENGTH, {
    N,
    r,
    p,
    maxmem: 128 * N * r * 2,
  });
  return [
    PREFIX,
    N,
    r,
    p,
    salt.toString('base64'),
    derived.toString('base64'),
  ].join('$');
}

/**
 * Verify a plaintext password against a stored hash.
 * Always performs a full scrypt derivation and uses timingSafeEqual so the
 * comparison does not leak information through timing.
 *
 * @param {string} password
 * @param {string} stored encoded hash produced by hashPassword()
 * @returns {Promise<boolean>}
 */
async function verifyPassword(password, stored) {
  if (typeof password !== 'string' || typeof stored !== 'string') return false;

  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== PREFIX) return false;

  const n = Number.parseInt(parts[1], 10);
  const rr = Number.parseInt(parts[2], 10);
  const pp = Number.parseInt(parts[3], 10);
  if (!Number.isFinite(n) || !Number.isFinite(rr) || !Number.isFinite(pp)) return false;

  let salt;
  let expected;
  try {
    salt = Buffer.from(parts[4], 'base64');
    expected = Buffer.from(parts[5], 'base64');
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;

  let actual;
  try {
    actual = await scryptAsync(password.normalize('NFKC'), salt, expected.length, {
      N: n,
      r: rr,
      p: pp,
      maxmem: 256 * n * rr,
    });
  } catch {
    return false;
  }

  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

/**
 * Constant-time string comparison for tokens, used for CSRF and reset tokens.
 */
function timingSafeEqualString(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) {
    // Still consume time proportional to the input to avoid a trivial oracle.
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Generate a cryptographically strong URL-safe token.
 */
function generateToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

/** SHA-256 hex digest — used to store reset/activation tokens at rest. */
function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

/**
 * Password policy shared by reset + admin account creation.
 * Returns { valid, errors[] }.
 */
function validatePasswordStrength(password, { minLength = 10 } = {}) {
  const errors = [];
  if (typeof password !== 'string' || password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters long.`);
  }
  if (typeof password === 'string') {
    if (!/[a-z]/.test(password)) errors.push('Password must contain a lowercase letter.');
    if (!/[A-Z]/.test(password)) errors.push('Password must contain an uppercase letter.');
    if (!/[0-9]/.test(password)) errors.push('Password must contain a number.');
    if (/^\s|\s$/.test(password)) errors.push('Password must not start or end with a space.');
  }
  return { valid: errors.length === 0, errors };
}

module.exports = {
  hashPassword,
  verifyPassword,
  timingSafeEqualString,
  generateToken,
  sha256,
  validatePasswordStrength,
};
