'use strict';

/**
 * Central runtime configuration.
 * Values come from environment variables with safe development defaults.
 */

const path = require('node:path');

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';

function bool(value, fallback) {
  if (value === undefined || value === '') return fallback;
  return value === '1' || String(value).toLowerCase() === 'true';
}

function int(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

const DEFAULT_SECRET = 'uniexam-development-only-cookie-secret-do-not-use-in-production';

const COOKIE_SECRET = process.env.COOKIE_SECRET || DEFAULT_SECRET;

if (isProduction && COOKIE_SECRET === DEFAULT_SECRET) {
  throw new Error(
    'Refusing to start in production without COOKIE_SECRET. Set COOKIE_SECRET to a random 32+ byte value.'
  );
}

module.exports = {
  env: NODE_ENV,
  isProduction,
  port: int(process.env.PORT, 3000),
  host: '0.0.0.0',

  cookieSecret: COOKIE_SECRET,
  cookieSecure: bool(process.env.COOKIE_SECURE, isProduction),

  dbPath: process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'uniexam.db'),

  session: {
    // Absolute idle timeout for a normal session.
    idleMinutes: int(process.env.SESSION_IDLE_MINUTES, 120),
    // Longer timeout granted when the user ticks "Remember me".
    rememberDays: int(process.env.SESSION_REMEMBER_DAYS, 30),
    // Touch the idle timer at most this often (ms) to avoid a DB write per request.
    touchIntervalMs: 60 * 1000,
    cookieName: 'uniexam.sid',
    csrfCookieName: 'uniexam.csrf',
  },

  security: {
    maxLoginAttempts: int(process.env.MAX_LOGIN_ATTEMPTS, 5),
    lockoutMinutes: int(process.env.LOCKOUT_MINUTES, 15),
    // scrypt cost parameters (see src/lib/password.js)
    passwordMinLength: 10,
  },

  university: {
    name: 'Meridian State University',
    shortName: 'MSU',
    tagline: 'Examinations & Credential Management',
    examControl: 'Office of the Controller of Examinations',
    supportEmail: 'exams.support@msu.example.edu',
    helpline: '+91 44 4000 1234',
  },
};
