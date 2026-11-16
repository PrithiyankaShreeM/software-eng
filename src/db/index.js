'use strict';

/**
 * SQLite persistence layer (Node's built-in `node:sqlite`).
 *
 * Design notes
 * ------------
 * - One connection, synchronous queries. Perfectly adequate for a
 *   demonstration/teaching ERP module and it removes an entire class of
 *   async race conditions from the auth code.
 * - Foreign keys are enforced.
 * - Timestamps are stored as ISO-8601 UTC strings, which keeps SQLite
 *   dumps readable during a project demonstration.
 */

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const config = require('../config');

let db = null;

const SCHEMA = `
PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------
-- Users: one row per human who can authenticate.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  username          TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  public_id         TEXT    NOT NULL UNIQUE,           -- STU2024001, EXM1001, ...
  full_name         TEXT    NOT NULL,
  email             TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  role              TEXT    NOT NULL,
  department        TEXT,
  programme         TEXT,
  designation       TEXT,
  password_hash     TEXT    NOT NULL,
  status            TEXT    NOT NULL DEFAULT 'active', -- active | inactive | locked
  must_change_password INTEGER NOT NULL DEFAULT 0,
  is_demo           INTEGER NOT NULL DEFAULT 0,
  failed_attempts   INTEGER NOT NULL DEFAULT 0,
  locked_until      TEXT,
  last_login_at     TEXT,
  last_login_ip     TEXT,
  password_changed_at TEXT,
  created_at        TEXT    NOT NULL,
  updated_at        TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_role   ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- ---------------------------------------------------------------------
-- Sessions: server-side session records, opaque cookie holds a token
-- whose SHA-256 lives here. Deleting the row logs the user out instantly.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash     TEXT    NOT NULL UNIQUE,
  csrf_token     TEXT    NOT NULL,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ip_address     TEXT,
  user_agent     TEXT,
  remember       INTEGER NOT NULL DEFAULT 0,           -- 1 = remember-me session
  created_at     TEXT    NOT NULL,
  last_seen_at   TEXT    NOT NULL,
  expires_at     TEXT    NOT NULL,
  revoked_at     TEXT,
  revoked_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_user    ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- ---------------------------------------------------------------------
-- Audit log: append-only record of every security-relevant event.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at  TEXT    NOT NULL,
  actor_id    INTEGER,
  actor_name  TEXT,
  actor_role  TEXT,
  action      TEXT    NOT NULL,
  category    TEXT    NOT NULL,   -- auth | account | role | settings | access | credential
  severity    TEXT    NOT NULL,   -- info | warning | critical
  target      TEXT,
  detail      TEXT,
  ip_address  TEXT,
  user_agent  TEXT,
  outcome     TEXT NOT NULL       -- success | failure
);

CREATE INDEX IF NOT EXISTS idx_audit_created  ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_category ON audit_log(category);
CREATE INDEX IF NOT EXISTS idx_audit_actor    ON audit_log(actor_id);

-- ---------------------------------------------------------------------
-- Password reset tokens (hashed at rest, single use, short lived).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS password_resets (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT    NOT NULL UNIQUE,
  requested_ip TEXT,
  created_at  TEXT    NOT NULL,
  expires_at  TEXT    NOT NULL,
  used_at     TEXT
);

CREATE INDEX IF NOT EXISTS idx_resets_user ON password_resets(user_id);

-- ---------------------------------------------------------------------
-- System settings editable by administrators.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  updated_by  TEXT
);

-- ---------------------------------------------------------------------
-- Notification feed addressed to a user or broadcast by role.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  audience_role TEXT,             -- NULL = everybody
  user_id       INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  body          TEXT NOT NULL,
  severity      TEXT NOT NULL DEFAULT 'info',
  created_at    TEXT NOT NULL
);

-- ---------------------------------------------------------------------
-- Demonstration data used by the role dashboards.
-- ---------------------------------------------------------------------

-- Examination schedule entries.
CREATE TABLE IF NOT EXISTS exams (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  code          TEXT NOT NULL,           -- e.g. CS501
  title         TEXT NOT NULL,
  programme     TEXT NOT NULL,
  semester      INTEGER NOT NULL,
  department    TEXT NOT NULL,
  exam_date     TEXT NOT NULL,
  start_time    TEXT NOT NULL,
  duration_mins INTEGER NOT NULL,
  hall          TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'scheduled', -- scheduled | ongoing | completed
  scheduled_by  INTEGER REFERENCES users(id)
);

-- Exam registrations link students to exams.
CREATE TABLE IF NOT EXISTS registrations (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_id   INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(exam_id, user_id)
);

-- Question papers authored by examiners.
CREATE TABLE IF NOT EXISTS question_papers (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_id       INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  total_marks   INTEGER NOT NULL,
  rubric        TEXT,
  status        TEXT NOT NULL DEFAULT 'draft', -- draft | submitted | approved
  author_id     INTEGER REFERENCES users(id),
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

-- Answer-script evaluations.
CREATE TABLE IF NOT EXISTS evaluations (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  paper_id        INTEGER REFERENCES question_papers(id) ON DELETE SET NULL,
  exam_id         INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  examiner_id     INTEGER REFERENCES users(id),
  marks_awarded   REAL,
  max_marks       REAL NOT NULL DEFAULT 100,
  status          TEXT NOT NULL DEFAULT 'pending', -- pending | evaluated | flagged | moderated | approved
  remarks         TEXT,
  evaluated_at    TEXT,
  updated_at      TEXT NOT NULL,
  UNIQUE(exam_id, student_id)
);

-- Moderation actions keep original marks immutable; corrections live here.
CREATE TABLE IF NOT EXISTS moderation_actions (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  evaluation_id    INTEGER NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
  moderator_id     INTEGER REFERENCES users(id),
  original_marks   REAL,
  proposed_marks   REAL,
  reason           TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  controller_notes TEXT,
  created_at       TEXT NOT NULL,
  resolved_at      TEXT,
  resolved_by      INTEGER REFERENCES users(id)
);

-- Revaluation requests raised by students.
CREATE TABLE IF NOT EXISTS revaluations (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exam_id       INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  reason        TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'submitted', -- submitted | under_review | completed | rejected
  decision_note TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

-- Result approval + publication trail, controlled by the Controller.
CREATE TABLE IF NOT EXISTS result_publications (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_id        INTEGER NOT NULL UNIQUE REFERENCES exams(id) ON DELETE CASCADE,
  approved_by    INTEGER REFERENCES users(id),
  approved_at    TEXT,
  published_at   TEXT,
  status         TEXT NOT NULL DEFAULT 'awaiting_approval', -- awaiting_approval | approved | published
  pass_percentage REAL NOT NULL DEFAULT 40
);

-- Published results per student.
CREATE TABLE IF NOT EXISTS results (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_id      INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  marks        REAL NOT NULL,
  max_marks    REAL NOT NULL DEFAULT 100,
  grade        TEXT NOT NULL,
  published_at TEXT NOT NULL,
  UNIQUE(exam_id, student_id)
);

-- Degree certificates held by the credential registry.
CREATE TABLE IF NOT EXISTS credentials (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_no  TEXT NOT NULL UNIQUE,   -- e.g. MSU-DEG-2024-0001
  degree         TEXT NOT NULL,
  programme      TEXT NOT NULL,
  department     TEXT NOT NULL,
  class_awarded  TEXT NOT NULL,
  issued_on      TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'issued' -- issued | revoked
);

-- Verification attempts by external verifiers.
CREATE TABLE IF NOT EXISTS verification_history (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  verifier_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_no     TEXT NOT NULL,
  credential_id     INTEGER REFERENCES credentials(id) ON DELETE SET NULL,
  result            TEXT NOT NULL,   -- valid | invalid | revoked
  purpose           TEXT,
  created_at        TEXT NOT NULL,
  ip_address        TEXT
);
`;

/** Open (or create) the database and ensure the schema exists. */
function init(databasePath = config.dbPath) {
  if (db) return db;

  if (databasePath !== ':memory:') {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  }

  db = new DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  return db;
}

/** The live connection. Throws if init() has not been called. */
function getDb() {
  if (!db) throw new Error('Database not initialised — call db.init() first.');
  return db;
}

function close() {
  if (db) {
    db.close();
    db = null;
  }
}

// Thin convenience wrappers ------------------------------------------------

function get(sql, ...params) {
  return getDb().prepare(sql).get(...params);
}

function all(sql, ...params) {
  return getDb().prepare(sql).all(...params);
}

function run(sql, ...params) {
  return getDb().prepare(sql).run(...params);
}

/** Run fn inside a transaction, rolling back on any throw. */
function transaction(fn) {
  const database = getDb();
  database.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    database.exec('COMMIT');
    return result;
  } catch (err) {
    try {
      database.exec('ROLLBACK');
    } catch {
      /* rollback failure is secondary to the original error */
    }
    throw err;
  }
}

/** Test helper: wipe every table in dependency-safe order. */
function resetAllTables() {
  const tables = all(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
  ).map((row) => row.name);
  const database = getDb();
  database.exec('PRAGMA foreign_keys = OFF;');
  for (const table of tables) {
    database.exec(`DELETE FROM "${table}";`);
  }
  database.exec("DELETE FROM sqlite_sequence;");
  database.exec('PRAGMA foreign_keys = ON;');
}

module.exports = {
  init,
  getDb,
  close,
  get,
  all,
  run,
  transaction,
  resetAllTables,
};
