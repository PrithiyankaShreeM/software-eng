'use strict';

/**
 * Append-only audit trail.
 *
 * Every authentication, authorization and account-management event is
 * recorded here. This is what the administrator sees in the System
 * Administration dashboard and what makes the "system-wide audit logs"
 * requirement real rather than decorative.
 */

const db = require('../db');
const { roleLabel } = require('../config/roles');

function nowIso() {
  return new Date().toISOString();
}

/**
 * Record an audit event.
 *
 * @param {object} event
 * @param {object|null} event.actor      user object ({ id, username, full_name, role })
 * @param {string} event.action          machine-readable action key, e.g. 'auth.login'
 * @param {string} event.category        auth | account | role | settings | access | credential
 * @param {string} [event.severity]      info | warning | critical
 * @param {string} [event.target]        the affected entity (username, credential no, ...)
 * @param {string} [event.detail]        human-readable summary
 * @param {object} [event.req]           express request for ip / user-agent
 * @param {'success'|'failure'} [event.outcome]
 */
function record(event) {
  const {
    actor = null,
    action,
    category,
    severity = 'info',
    target = null,
    detail = null,
    req = null,
    outcome = 'success',
  } = event;

  if (!action || !category) {
    throw new Error('audit.record requires at least an action and a category');
  }

  db.run(
    `INSERT INTO audit_log
       (created_at, actor_id, actor_name, actor_role, action, category, severity,
        target, detail, ip_address, user_agent, outcome)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    nowIso(),
    actor?.id ?? null,
    actor?.full_name ?? actor?.username ?? null,
    actor?.role ? roleLabel(actor.role) : null,
    action,
    category,
    severity,
    target,
    detail,
    req?.clientIp ?? null,
    req?.get?.('user-agent')?.slice(0, 255) ?? null,
    outcome
  );
}

/**
 * Recent entries, optionally filtered. Used by the admin audit view.
 */
function recent({ limit = 100, category = null, severity = null, outcome = null } = {}) {
  const clauses = [];
  const params = [];

  if (category) {
    clauses.push('category = ?');
    params.push(category);
  }
  if (severity) {
    clauses.push('severity = ?');
    params.push(severity);
  }
  if (outcome) {
    clauses.push('outcome = ?');
    params.push(outcome);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return db.all(
    `SELECT * FROM audit_log ${where} ORDER BY id DESC LIMIT ?`,
    ...params,
    Math.min(Math.max(Number(limit) || 100, 1), 500)
  );
}

/** Aggregate counters for the admin dashboard tiles. */
function summary() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  return {
    total: db.get('SELECT COUNT(*) AS c FROM audit_log').c,
    last24h: db.get('SELECT COUNT(*) AS c FROM audit_log WHERE created_at >= ?', since).c,
    failures24h: db.get(
      "SELECT COUNT(*) AS c FROM audit_log WHERE created_at >= ? AND outcome = 'failure'",
      since
    ).c,
    critical24h: db.get(
      "SELECT COUNT(*) AS c FROM audit_log WHERE created_at >= ? AND severity = 'critical'",
      since
    ).c,
  };
}

module.exports = { record, recent, summary, nowIso };
