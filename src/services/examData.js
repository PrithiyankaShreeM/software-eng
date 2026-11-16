'use strict';

/**
 * Read-model helpers that feed the role dashboards.
 * Keeping the SQL here means route handlers stay thin and every dashboard
 * shows the same underlying data through a permission-appropriate lens.
 */

const db = require('../db');

function nowIso() {
  return new Date().toISOString();
}

const GRADE = (marks) => {
  if (marks >= 90) return 'O';
  if (marks >= 80) return 'A+';
  if (marks >= 70) return 'A';
  if (marks >= 60) return 'B+';
  if (marks >= 50) return 'B';
  if (marks >= 40) return 'C';
  return 'F';
};

// ---------------------------------------------------------------------------
// Student
// ---------------------------------------------------------------------------

function studentOverview(userId) {
  const upcoming = db.all(
    `SELECT e.*, r.user_id AS registered
       FROM exams e
       JOIN registrations r ON r.exam_id = e.id AND r.user_id = ?
      WHERE e.exam_date >= date('now')
      ORDER BY e.exam_date ASC, e.start_time ASC
      LIMIT 6`,
    userId
  );

  const results = db.all(
    `SELECT res.*, e.code, e.title, e.semester
       FROM results res
       JOIN exams e ON e.id = res.exam_id
      WHERE res.student_id = ?
      ORDER BY res.published_at DESC`,
    userId
  );

  const published = db.get(
    `SELECT COUNT(DISTINCT exam_id) AS c FROM results WHERE student_id = ?`,
    userId
  ).c;

  const pendingReval = db.get(
    `SELECT COUNT(*) AS c FROM revaluations
      WHERE student_id = ? AND status IN ('submitted','under_review')`,
    userId
  ).c;

  const avg = results.length
    ? Math.round(results.reduce((sum, r) => sum + r.marks, 0) / results.length)
    : null;

  const nextExam = upcoming[0] || null;
  let daysToNext = null;
  if (nextExam) {
    daysToNext = Math.max(
      0,
      Math.ceil((new Date(`${nextExam.exam_date}T00:00:00`).getTime() - Date.now()) / 86400000)
    );
  }

  return {
    upcoming,
    results,
    stats: {
      upcomingExams: db.get(
        `SELECT COUNT(*) AS c FROM exams e
           JOIN registrations r ON r.exam_id = e.id AND r.user_id = ?
          WHERE e.exam_date >= date('now')`,
        userId
      ).c,
      publishedResults: published,
      pendingRevaluations: pendingReval,
      averageMarks: avg,
      daysToNext,
      nextExam,
    },
  };
}

function studentSchedule(userId) {
  return db.all(
    `SELECT e.*, ep.title AS paper_title, ep.status AS paper_status
       FROM exams e
       JOIN registrations r ON r.exam_id = e.id AND r.user_id = ?
       LEFT JOIN question_papers ep ON ep.exam_id = e.id
      ORDER BY e.exam_date ASC, e.start_time ASC`,
    userId
  );
}

function studentResults(userId) {
  return db.all(
    `SELECT res.*, e.code, e.title, e.semester, e.programme,
            p.published_at AS result_published_at
       FROM results res
       JOIN exams e ON e.id = res.exam_id
       LEFT JOIN result_publications p ON p.exam_id = e.id
      WHERE res.student_id = ?
      ORDER BY res.published_at DESC, e.code ASC`,
    userId
  );
}

function studentRevaluations(userId) {
  return db.all(
    `SELECT rv.*, e.code, e.title, e.exam_date, e.semester
       FROM revaluations rv
       JOIN exams e ON e.id = rv.exam_id
      WHERE rv.student_id = ?
      ORDER BY rv.created_at DESC`,
    userId
  );
}

/** Exams the student is registered for and can request revaluation on. */
function revaluationCandidates(userId) {
  return db.all(
    `SELECT e.*, res.marks, res.grade
       FROM exams e
       JOIN registrations reg ON reg.exam_id = e.id AND reg.user_id = ?
       LEFT JOIN results res ON res.exam_id = e.id AND res.student_id = ?
      WHERE e.status = 'completed'
        AND NOT EXISTS (
          SELECT 1 FROM revaluations rv
           WHERE rv.exam_id = e.id AND rv.student_id = ?
             AND rv.status IN ('submitted','under_review')
        )
      ORDER BY e.exam_date DESC`,
    userId,
    userId,
    userId
  );
}

function studentRecords(userId) {
  const results = studentResults(userId);
  const credentials = db.all(
    'SELECT * FROM credentials WHERE student_id = ? ORDER BY issued_on DESC',
    userId
  );
  const bySemester = {};
  for (const r of results) {
    const key = r.semester || 0;
    bySemester[key] = bySemester[key] || [];
    bySemester[key].push(r);
  }
  const gpa =
    results.length > 0
      ? Math.round(
          (results.reduce((sum, r) => sum + r.marks, 0) / results.length / 10) * 100
        ) / 100
      : null;
  return { results, credentials, bySemester, gpa: gpa !== null ? (gpa / 10).toFixed(2) : null };
}

function submitRevaluation({ userId, examId, reason, req }) {
  const registration = db.get(
    'SELECT 1 AS x FROM registrations WHERE exam_id = ? AND user_id = ?',
    examId,
    userId
  );
  if (!registration) return { ok: false, error: 'You are not registered for that examination.' };

  const existing = db.get(
    `SELECT 1 AS x FROM revaluations
      WHERE exam_id = ? AND student_id = ? AND status IN ('submitted','under_review')`,
    examId,
    userId
  );
  if (existing) return { ok: false, error: 'A revaluation request for this paper is already open.' };

  const cleanReason = String(reason || '').trim();
  if (cleanReason.length < 20) {
    return { ok: false, error: 'Please describe the reason in at least 20 characters.' };
  }

  const now = nowIso();
  db.run(
    `INSERT INTO revaluations (student_id, exam_id, reason, status, created_at, updated_at)
     VALUES (?, ?, ?, 'submitted', ?, ?)`,
    userId,
    examId,
    cleanReason.slice(0, 1000),
    now,
    now
  );

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Examiner
// ---------------------------------------------------------------------------

function examinerOverview(userId) {
  const upcoming = db.all(
    `SELECT * FROM exams
      WHERE status IN ('scheduled','ongoing')
      ORDER BY exam_date ASC, start_time ASC
      LIMIT 8`
  );
  const papers = db.all(
    `SELECT ep.*, e.code, e.title AS exam_title, e.exam_date
       FROM question_papers ep
       JOIN exams e ON e.id = ep.exam_id
      ORDER BY ep.updated_at DESC`
  );
  const queue = db.all(
    `SELECT ev.*, u.full_name AS student_name, u.public_id AS student_public_id,
            e.code, e.title AS exam_title
       FROM evaluations ev
       JOIN users u ON u.id = ev.student_id
       JOIN exams e ON e.id = ev.exam_id
      WHERE ev.status IN ('pending','evaluated','flagged')
      ORDER BY ev.updated_at DESC
      LIMIT 12`
  );
  return {
    upcoming,
    papers,
    queue,
    stats: {
      scheduledExams: db.get("SELECT COUNT(*) AS c FROM exams WHERE status = 'scheduled'").c,
      drafts: db.get("SELECT COUNT(*) AS c FROM question_papers WHERE status = 'draft'").c,
      awaitingEvaluation: db.get("SELECT COUNT(*) AS c FROM evaluations WHERE status = 'pending'").c,
      evaluated: db.get("SELECT COUNT(*) AS c FROM evaluations WHERE status = 'evaluated'").c,
    },
  };
}

function listExams() {
  return db.all('SELECT * FROM exams ORDER BY exam_date DESC, start_time DESC');
}

function createExam({ input, actor, req }) {
  const errors = {};
  const code = String(input.code || '').trim().toUpperCase();
  const title = String(input.title || '').trim();
  const examDate = String(input.exam_date || '').trim();
  const startTime = String(input.start_time || '').trim();
  const hall = String(input.hall || '').trim();

  if (!code) errors.code = 'Exam code is required.';
  if (!title) errors.title = 'Exam title is required.';
  if (!examDate) errors.exam_date = 'Exam date is required.';
  if (!startTime) errors.start_time = 'Start time is required.';
  if (!hall) errors.hall = 'Examination hall is required.';
  if (Object.keys(errors).length) return { ok: false, errors };

  const result = db.run(
    `INSERT INTO exams
       (code, title, programme, semester, department, exam_date, start_time,
        duration_mins, hall, status, scheduled_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?)`,
    code,
    title,
    String(input.programme || '').trim() || 'B.E. Computer Science',
    Number(input.semester) || 5,
    String(input.department || '').trim() || actor.department || 'Computer Science & Engineering',
    examDate,
    startTime,
    Number(input.duration_mins) || 180,
    hall,
    actor.id
  );

  return { ok: true, examId: Number(result.lastInsertRowid) };
}

function createPaper({ input, actor, req }) {
  const errors = {};
  const examId = Number(input.exam_id);
  const title = String(input.title || '').trim();
  const rubric = String(input.rubric || '').trim();
  const totalMarks = Number(input.total_marks) || 100;

  if (!examId) errors.exam_id = 'Choose an examination.';
  if (!title) errors.title = 'Paper title is required.';
  if (!rubric) errors.rubric = 'A rubric is required so evaluations can be moderated.';
  if (Object.keys(errors).length) return { ok: false, errors };

  const exam = db.get('SELECT * FROM exams WHERE id = ?', examId);
  if (!exam) return { ok: false, errors: { exam_id: 'That examination does not exist.' } };

  const now = nowIso();
  const result = db.run(
    `INSERT INTO question_papers
       (exam_id, title, total_marks, rubric, status, author_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'draft', ?, ?, ?)`,
    examId,
    title,
    totalMarks,
    rubric,
    actor.id,
    now,
    now
  );

  return { ok: true, paperId: Number(result.lastInsertRowid) };
}

function submitPaper({ paperId, actor, req }) {
  const paper = db.get('SELECT * FROM question_papers WHERE id = ?', paperId);
  if (!paper) return { ok: false, error: 'Question paper not found.' };
  if (paper.status !== 'draft') return { ok: false, error: 'Only draft papers can be submitted.' };
  db.run(
    "UPDATE question_papers SET status = 'submitted', updated_at = ? WHERE id = ?",
    nowIso(),
    paperId
  );
  return { ok: true, paper };
}

function evaluateScript({ evaluationId, marks, remarks, actor }) {
  const evaluation = db.get('SELECT * FROM evaluations WHERE id = ?', evaluationId);
  if (!evaluation) return { ok: false, error: 'Evaluation record not found.' };

  // Immutability rule: an examiner cannot overwrite marks that have already
  // passed moderation or been approved by the Controller.
  if (['moderated', 'approved'].includes(evaluation.status)) {
    return { ok: false, error: 'These marks are locked by the moderation/approval workflow.' };
  }

  const numeric = Number(marks);
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > evaluation.max_marks) {
    return { ok: false, error: `Marks must be between 0 and ${evaluation.max_marks}.` };
  }

  db.run(
    `UPDATE evaluations
        SET marks_awarded = ?, remarks = ?, status = 'evaluated',
            examiner_id = ?, evaluated_at = ?, updated_at = ?
      WHERE id = ?`,
    numeric,
    String(remarks || '').trim() || null,
    actor.id,
    nowIso(),
    nowIso(),
    evaluationId
  );
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Moderator
// ---------------------------------------------------------------------------

function moderatorOverview() {
  const flagged = db.all(
    `SELECT ev.*, u.full_name AS student_name, u.public_id AS student_public_id,
            e.code, e.title AS exam_title,
            m.id AS action_id, m.proposed_marks, m.reason AS moderation_reason,
            m.status AS moderation_status, m.created_at AS moderation_created
       FROM evaluations ev
       JOIN users u ON u.id = ev.student_id
       JOIN exams e ON e.id = ev.exam_id
       LEFT JOIN moderation_actions m ON m.evaluation_id = ev.id AND m.status = 'pending'
      WHERE ev.status IN ('flagged','evaluated')
      ORDER BY ev.updated_at DESC`,
  );

  const awaitingReview = flagged.filter((row) => row.status === 'evaluated' && !row.action_id);
  const pendingModeration = flagged.filter((row) => row.action_id);
  const history = db.all(
    `SELECT m.*, ev.marks_awarded, u.full_name AS student_name, e.code
       FROM moderation_actions m
       JOIN evaluations ev ON ev.id = m.evaluation_id
       JOIN users u ON u.id = ev.student_id
       JOIN exams e ON e.id = ev.exam_id
      WHERE m.status <> 'pending'
      ORDER BY m.resolved_at DESC
      LIMIT 10`
  );

  return {
    flagged,
    awaitingReview,
    pendingModeration,
    history,
    stats: {
      flagged: db.get("SELECT COUNT(*) AS c FROM evaluations WHERE status = 'flagged'").c,
      awaitingReview: awaitingReview.length,
      pendingCorrections: db.get(
        "SELECT COUNT(*) AS c FROM moderation_actions WHERE status = 'pending'"
      ).c,
      approvedCorrections: db.get(
        "SELECT COUNT(*) AS c FROM moderation_actions WHERE status = 'approved'"
      ).c,
    },
  };
}

/**
 * Raise a moderation discrepancy. The original examiner mark is preserved in
 * `evaluations`; the proposed correction is staged in `moderation_actions` and
 * only applied after Controller approval. This satisfies the requirement that
 * "moderators cannot modify original evaluations without an authorised
 * correction workflow".
 */
function raiseModeration({ evaluationId, proposedMarks, reason, actor }) {
  const evaluation = db.get('SELECT * FROM evaluations WHERE id = ?', evaluationId);
  if (!evaluation) return { ok: false, error: 'Evaluation not found.' };
  if (['moderated', 'approved'].includes(evaluation.status)) {
    return { ok: false, error: 'This evaluation has already completed moderation.' };
  }
  const numeric = Number(proposedMarks);
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > evaluation.max_marks) {
    return { ok: false, error: `Proposed marks must be between 0 and ${evaluation.max_marks}.` };
  }
  const cleanReason = String(reason || '').trim();
  if (cleanReason.length < 15) {
    return { ok: false, error: 'Please record the moderation rationale (at least 15 characters).' };
  }

  const open = db.get(
    "SELECT 1 AS x FROM moderation_actions WHERE evaluation_id = ? AND status = 'pending'",
    evaluationId
  );
  if (open) return { ok: false, error: 'A moderation action is already open for this evaluation.' };

  db.run(
    `INSERT INTO moderation_actions
       (evaluation_id, moderator_id, original_marks, proposed_marks, reason, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
    evaluationId,
    actor.id,
    evaluation.marks_awarded,
    numeric,
    cleanReason.slice(0, 1000),
    nowIso()
  );
  db.run("UPDATE evaluations SET status = 'flagged', updated_at = ? WHERE id = ?", nowIso(), evaluationId);

  return { ok: true };
}

/** Moderator approves their own staged correction (still needs Controller sign-off). */
function endorseModeration({ actionId, actor }) {
  const action = db.get('SELECT * FROM moderation_actions WHERE id = ?', actionId);
  if (!action) return { ok: false, error: 'Moderation action not found.' };
  if (action.status !== 'pending') return { ok: false, error: 'This action is no longer pending.' };

  db.run(
    `UPDATE moderation_actions SET status = 'approved', resolved_at = ?, resolved_by = ? WHERE id = ?`,
    nowIso(),
    actor.id,
    actionId
  );
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

function controllerOverview() {
  const pending = db.all(
    `SELECT e.*, rp.status AS publication_status, rp.id AS publication_id,
            (SELECT COUNT(*) FROM evaluations ev WHERE ev.exam_id = e.id) AS evaluation_count,
            (SELECT ROUND(AVG(ev.marks_awarded), 1) FROM evaluations ev WHERE ev.exam_id = e.id) AS avg_marks,
            (SELECT COUNT(*) FROM evaluations ev WHERE ev.exam_id = e.id AND ev.marks_awarded < 40) AS fail_count
       FROM exams e
       LEFT JOIN result_publications rp ON rp.exam_id = e.id
      WHERE e.status = 'completed'
      ORDER BY e.exam_date DESC`
  );

  const awaiting = pending.filter(
    (row) => !row.publication_status || row.publication_status === 'awaiting_approval' || row.publication_status === 'approved'
  );
  const published = pending.filter((row) => row.publication_status === 'published');

  const moderation = db.all(
    `SELECT m.*, ev.marks_awarded, ev.exam_id, u.full_name AS student_name, e.code
       FROM moderation_actions m
       JOIN evaluations ev ON ev.id = m.evaluation_id
       JOIN users u ON u.id = ev.student_id
       JOIN exams e ON e.id = ev.exam_id
      WHERE m.status = 'approved'
      ORDER BY m.resolved_at DESC`
  );

  return {
    pending,
    awaiting,
    published,
    moderation,
    stats: {
      awaitingApproval: awaiting.filter((r) => r.publication_status !== 'published').length,
      published: published.length,
      pendingModeration: moderation.length,
      totalScripts: db.get('SELECT COUNT(*) AS c FROM evaluations').c,
    },
  };
}

function approveResults({ examId, actor }) {
  const exam = db.get('SELECT * FROM exams WHERE id = ?', examId);
  if (!exam) return { ok: false, error: 'Examination not found.' };

  const existing = db.get('SELECT * FROM result_publications WHERE exam_id = ?', examId);
  if (existing && existing.status === 'published') {
    return { ok: false, error: 'These results are already published.' };
  }
  if (existing && existing.status === 'approved') {
    return { ok: false, error: 'These results are already approved and awaiting publication.' };
  }

  if (existing) {
    db.run(
      `UPDATE result_publications SET approved_by = ?, approved_at = ?, status = 'approved' WHERE exam_id = ?`,
      actor.id,
      nowIso(),
      examId
    );
  } else {
    db.run(
      `INSERT INTO result_publications (exam_id, approved_by, approved_at, status)
       VALUES (?, ?, ?, 'approved')`,
      examId,
      actor.id,
      nowIso()
    );
  }
  return { ok: true, exam };
}

function publishResults({ examId, actor }) {
  const exam = db.get('SELECT * FROM exams WHERE id = ?', examId);
  if (!exam) return { ok: false, error: 'Examination not found.' };

  const publication = db.get('SELECT * FROM result_publications WHERE exam_id = ?', examId);
  if (!publication) {
    return { ok: false, error: 'Results must be approved before they can be published.' };
  }
  if (publication.status === 'awaiting_approval') {
    return { ok: false, error: 'Results must be approved before they can be published.' };
  }
  if (publication.status === 'published') {
    return { ok: false, error: 'These results are already published.' };
  }

  const evaluations = db.all(
    "SELECT * FROM evaluations WHERE exam_id = ? AND status IN ('evaluated','flagged','moderated')",
    examId
  );
  if (evaluations.length === 0) {
    return { ok: false, error: 'There are no evaluations to publish for this examination.' };
  }

  const now = nowIso();
  db.transaction(() => {
    for (const ev of evaluations) {
      db.run(
        `INSERT INTO results (exam_id, student_id, marks, max_marks, grade, published_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(exam_id, student_id) DO UPDATE SET
           marks = excluded.marks, grade = excluded.grade, published_at = excluded.published_at`,
        examId,
        ev.student_id,
        ev.marks_awarded,
        ev.max_marks,
        GRADE(ev.marks_awarded),
        now
      );
      db.run("UPDATE evaluations SET status = 'approved', updated_at = ? WHERE id = ?", now, ev.id);
    }
    db.run(
      `UPDATE result_publications SET status = 'published', published_at = ? WHERE exam_id = ?`,
      now,
      examId
    );
  });

  return { ok: true, exam, count: evaluations.length };
}

function resolveModeration({ actionId, decision, note, actor }) {
  const action = db.get('SELECT * FROM moderation_actions WHERE id = ?', actionId);
  if (!action) return { ok: false, error: 'Moderation action not found.' };
  if (action.status !== 'approved') {
    return {
      ok: false,
      error: 'Only moderator-endorsed corrections can be resolved by the Controller.',
    };
  }

  if (decision === 'approve') {
    db.transaction(() => {
      db.run(
        `UPDATE moderation_actions SET status = 'approved', controller_notes = ?,
                resolved_at = ?, resolved_by = ? WHERE id = ?`,
        String(note || '').trim() || null,
        nowIso(),
        actor.id,
        actionId
      );
      db.run(
        `UPDATE evaluations SET marks_awarded = ?, status = 'moderated', updated_at = ?
          WHERE id = ?`,
        action.proposed_marks,
        nowIso(),
        action.evaluation_id
      );
    });
    return { ok: true, applied: true };
  }

  if (decision === 'reject') {
    db.run(
      `UPDATE moderation_actions SET status = 'rejected', controller_notes = ?,
              resolved_at = ?, resolved_by = ? WHERE id = ?`,
      String(note || '').trim() || null,
      nowIso(),
      actor.id,
      actionId
    );
    return { ok: true, applied: false };
  }

  return { ok: false, error: 'Unknown decision.' };
}

// ---------------------------------------------------------------------------
// Department Head
// ---------------------------------------------------------------------------

function departmentOverview(department) {
  const exams = db.all(
    `SELECT e.*,
            (SELECT COUNT(*) FROM evaluations ev WHERE ev.exam_id = e.id) AS evaluated,
            (SELECT ROUND(AVG(ev.marks_awarded),1) FROM evaluations ev WHERE ev.exam_id = e.id) AS avg_marks
       FROM exams e
      WHERE e.department = ?
      ORDER BY e.exam_date DESC`,
    department
  );

  const students = db.all(
    `SELECT u.id, u.full_name, u.public_id, u.programme,
            (SELECT ROUND(AVG(r.marks),1) FROM results r WHERE r.student_id = u.id) AS avg_marks,
            (SELECT COUNT(*) FROM results r WHERE r.student_id = u.id) AS results_count
       FROM users u
      WHERE u.role = 'student' AND u.department = ?
      ORDER BY u.full_name`,
    department
  );

  const publishedResults = db.all(
    `SELECT r.*, e.code, e.title, u.full_name AS student_name
       FROM results r
       JOIN exams e ON e.id = r.exam_id
       JOIN users u ON u.id = r.student_id
      WHERE e.department = ?
      ORDER BY r.published_at DESC
      LIMIT 25`,
    department
  );

  const passCount = publishedResults.filter((r) => r.marks >= 40).length;
  const avg = publishedResults.length
    ? publishedResults.reduce((s, r) => s + r.marks, 0) / publishedResults.length
    : null;

  return {
    exams,
    students,
    publishedResults,
    stats: {
      examsConducted: exams.filter((e) => e.status === 'completed').length,
      examsScheduled: exams.filter((e) => e.status === 'scheduled').length,
      students: students.length,
      averageMarks: avg !== null ? Math.round(avg * 10) / 10 : null,
      passRate: publishedResults.length
        ? Math.round((passCount / publishedResults.length) * 100)
        : null,
      resultsPublished: publishedResults.length,
    },
  };
}

// ---------------------------------------------------------------------------
// Administrator
// ---------------------------------------------------------------------------

function adminOverview() {
  const settings = db.all('SELECT * FROM settings ORDER BY key');
  const liveSessions = db.all(
    `SELECT s.*, u.full_name, u.username, u.role
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.revoked_at IS NULL AND s.expires_at > ?
      ORDER BY s.last_seen_at DESC LIMIT 20`,
    nowIso()
  );
  return { settings, liveSessions };
}

function getSettings() {
  const rows = db.all('SELECT * FROM settings ORDER BY key');
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

function updateSetting({ key, value, actor }) {
  const cleanKey = String(key || '').trim();
  if (!cleanKey) return { ok: false, error: 'Setting key is required.' };
  const exists = db.get('SELECT 1 AS x FROM settings WHERE key = ?', cleanKey);
  db.run(
    `INSERT INTO settings (key, value, updated_at, updated_by)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value,
       updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
    cleanKey,
    String(value ?? '').slice(0, 500),
    nowIso(),
    actor?.username || 'admin'
  );
  return { ok: true, created: !exists };
}

// ---------------------------------------------------------------------------
// External Verifier
// ---------------------------------------------------------------------------

function verifierOverview(verifierId) {
  const history = db.all(
    `SELECT * FROM verification_history WHERE verifier_id = ? ORDER BY created_at DESC LIMIT 25`,
    verifierId
  );
  return {
    history,
    stats: {
      totalChecks: history.length,
      valid: history.filter((h) => h.result === 'valid').length,
      invalid: history.filter((h) => h.result === 'invalid').length,
      revoked: history.filter((h) => h.result === 'revoked').length,
    },
  };
}

/**
 * Verify a credential number.
 * Only the fields an external verifier may see are returned — never internal
 * examination records, marks or personal contact details.
 */
function verifyCredential({ credentialNo, purpose, verifierId, req }) {
  const clean = String(credentialNo || '').trim().toUpperCase();
  if (!clean) return { ok: false, error: 'Enter a credential number to verify.' };

  const credential = db.get(
    `SELECT c.*, u.full_name, u.public_id, u.programme AS student_programme
       FROM credentials c
       JOIN users u ON u.id = c.student_id
      WHERE c.credential_no = ? COLLATE NOCASE`,
    clean
  );

  const result = !credential ? 'invalid' : credential.status === 'revoked' ? 'revoked' : 'valid';
  const now = nowIso();

  db.run(
    `INSERT INTO verification_history
       (verifier_id, credential_no, credential_id, result, purpose, created_at, ip_address)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    verifierId,
    clean,
    credential?.id ?? null,
    result,
    String(purpose || 'Credential verification').slice(0, 200),
    now,
    req?.clientIp || null
  );

  if (!credential) return { ok: true, result, credential: null, credentialNo: clean };

  // Mask the graduate's identity: verification confirms authenticity without
  // disclosing personal data beyond what a verifier is permitted to see.
  const maskedName = credential.full_name
    .split(/\s+/)
    .map((part, index, arr) => (index === arr.length - 1 ? part : `${part[0]}.`))
    .join(' ');

  return {
    ok: true,
    result,
    credentialNo: clean,
    credential: {
      credentialNo: credential.credential_no,
      name: maskedName,
      publicId: credential.public_id,
      degree: credential.degree,
      programme: credential.programme,
      department: credential.department,
      classAwarded: credential.class_awarded,
      issuedOn: credential.issued_on,
      status: credential.status,
    },
  };
}

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

function notificationsFor(role, userId) {
  return db.all(
    `SELECT * FROM notifications
      WHERE audience_role = ? OR user_id = ?
      ORDER BY created_at DESC
      LIMIT 25`,
    role,
    userId
  );
}

module.exports = {
  GRADE,
  studentOverview,
  studentSchedule,
  studentResults,
  studentRevaluations,
  revaluationCandidates,
  studentRecords,
  submitRevaluation,
  examinerOverview,
  listExams,
  createExam,
  createPaper,
  submitPaper,
  evaluateScript,
  moderatorOverview,
  raiseModeration,
  endorseModeration,
  controllerOverview,
  approveResults,
  publishResults,
  resolveModeration,
  departmentOverview,
  adminOverview,
  getSettings,
  updateSetting,
  verifierOverview,
  verifyCredential,
  notificationsFor,
};
