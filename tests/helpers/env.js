'use strict';

/**
 * Shared test environment: one in-memory-ish database and one running server
 * for the whole suite.
 */

process.env.NODE_ENV = 'test';
process.env.DB_PATH = process.env.TEST_DB_PATH || '/tmp/uniexam-test.db';
process.env.COOKIE_SECRET = 'test-cookie-secret-that-is-long-enough-1234';
process.env.MAX_LOGIN_ATTEMPTS = '5';
process.env.LOCKOUT_MINUTES = '15';

const fs = require('node:fs');

// Fresh database for every test run.
try {
  fs.rmSync(process.env.DB_PATH, { force: true });
  fs.rmSync(`${process.env.DB_PATH}-wal`, { force: true });
  fs.rmSync(`${process.env.DB_PATH}-shm`, { force: true });
} catch {
  /* nothing to remove */
}

const db = require('../../src/db');
const { seed } = require('../../src/db/seed');
const { createApp } = require('../../server');
const { TestClient } = require('./client');

let server = null;
let baseUrl = null;

/** Boot the database + server once per process. */
async function boot() {
  if (server) return { baseUrl, server };

  db.init(process.env.DB_PATH);
  await seed();

  const app = createApp();
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
  return { baseUrl, server };
}

async function shutdown() {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
    server = null;
  }
  db.close();
}

/** A fresh browser-like client. */
function newClient() {
  if (!baseUrl) throw new Error('Call boot() before newClient().');
  return new TestClient(baseUrl);
}

/** Convenience: an already-authenticated client. */
async function signedIn(identifier, password, category) {
  const client = newClient();
  const response = await client.login(identifier, password, category);
  if (![302, 303].includes(response.status)) {
    const body = await response.text();
    throw new Error(`Login failed for ${identifier}: ${response.status}\n${body.slice(0, 800)}`);
  }
  return client;
}

const CREDENTIALS = {
  student: { id: 'STU2024001', password: 'Demo@2024', category: 'student' },
  studentUser: { id: 'stu2024001', password: 'Demo@2024', category: 'student' },
  examiner: { id: 'EXM1001', password: 'Demo@2024', category: 'staff' },
  moderator: { id: 'MOD2001', password: 'Demo@2024', category: 'staff' },
  controller: { id: 'CTL3001', password: 'Demo@2024', category: 'staff' },
  department: { id: 'HOD4001', password: 'Demo@2024', category: 'staff' },
  administrator: { id: 'admin', password: 'Demo@2024', category: 'administrator' },
  verifier: { id: 'VER5001', password: 'Demo@2024', category: 'verifier' },
  deactivated: { id: 'EXM1004', password: 'Demo@2024', category: 'staff' },
};

module.exports = { boot, shutdown, newClient, signedIn, CREDENTIALS, db };
