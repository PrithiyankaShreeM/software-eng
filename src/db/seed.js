'use strict';

/**
 * ============================================================================
 *  DEMONSTRATION DATA
 * ============================================================================
 *
 *  Every account created here is 100% synthetic and exists only so faculty
 *  members can exercise each role during a project demonstration.
 *
 *  - No real student, staff or certificate data is used anywhere.
 *  - All demo accounts share one password so the login guide can be short.
 *  - `is_demo = 1` marks these rows, and the UI labels them as demo accounts.
 *
 *  The seed is idempotent: it only inserts when the users table is empty.
 */

const db = require('./index');
const config = require('../config');
const { hashPassword } = require('../lib/password');
const { ROLES } = require('../config/roles');

/** Shared password for every demonstration account. */
const DEMO_PASSWORD = 'Demo@2024';

/** Ordered guide shown on the login page for faculty demonstrations. */
const DEMO_ACCOUNTS = [
  {
    role: ROLES.STUDENT,
    roleLabel: 'Student',
    identifier: '',
    username: 'stu2024001',
    password: DEMO_PASSWORD,
    portal: 'Student',
    name: 'Aarav Menon',
    highlights: 'Schedule · Results · Revaluation tracking',
  },
  {
    role: ROLES.EXAMINER,
    roleLabel: 'Examiner',
    identifier: '',
    username: 'exm1001',
    password: DEMO_PASSWORD,
    portal: 'Staff',
    name: 'Dr. Priya Raman',
    highlights: 'Schedule exams · Author papers · Evaluate scripts',
  },
  {
    role: ROLES.MODERATOR,
    roleLabel: 'Moderator',
    identifier: '',
    username: 'mod2001',
    password: DEMO_PASSWORD,
    portal: 'Staff',
    name: 'Dr. Vikram Iyer',
    highlights: 'Review evaluations · Raise discrepancies',
  },
  {
    role: ROLES.CONTROLLER,
    roleLabel: 'Controller of Examinations',
    identifier: '',
    username: 'ctl3001',
    password: DEMO_PASSWORD,
    portal: 'Staff',
    name: 'Prof. Lakshmi Narayanan',
    highlights: 'Approve marks · Publish results',
  },
  {
    role: ROLES.DEPARTMENT_HEAD,
    roleLabel: 'Department Head',
    identifier: '',
    username: 'hod4001',
    password: DEMO_PASSWORD,
    portal: 'Staff',
    name: 'Dr. Suresh Kumar',
    highlights: 'Department analytics · Performance reports',
  },
  {
    role: ROLES.ADMINISTRATOR,
    roleLabel: 'Administrator',
    identifier: '',
    username: 'admin',
    password: DEMO_PASSWORD,
    portal: 'Administrator',
    name: 'System Administrator',
    highlights: 'Accounts · Roles · Settings · Audit logs',
  },
  {
    role: ROLES.EXTERNAL_VERIFIER,
    roleLabel: 'External Verifier',
    identifier: '',
    username: 'ver5001',
    password: DEMO_PASSWORD,
    portal: 'External Verifier',
    name: 'Tamil Nadu State Board (Verifier)',
    highlights: 'Verify degree certificates · Verification history',
  },
];

const DEPARTMENTS = [
  'Computer Science & Engineering',
  'Electronics & Communication',
  'Mechanical Engineering',
  'Business Administration',
  'Mathematics',
];

const STUDENTS = [
  { username: 'stu2024001', publicId: 'STU2024001', name: 'Aarav Menon', programme: 'B.E. Computer Science', dept: DEPARTMENTS[0] },
  { username: 'stu2024002', publicId: 'STU2024002', name: 'Diya Krishnan', programme: 'B.E. Computer Science', dept: DEPARTMENTS[0] },
  { username: 'stu2024003', publicId: 'STU2024003', name: 'Rohan Pillai', programme: 'B.E. Computer Science', dept: DEPARTMENTS[0] },
  { username: 'stu2024004', publicId: 'STU2024004', name: 'Ananya Subramanian', programme: 'B.E. Computer Science', dept: DEPARTMENTS[0] },
  { username: 'stu2024005', publicId: 'STU2024005', name: 'Karthik Rajan', programme: 'B.Tech Electronics', dept: DEPARTMENTS[1] },
  { username: 'stu2024006', publicId: 'STU2024006', name: 'Meera Venkatesh', programme: 'B.Tech Electronics', dept: DEPARTMENTS[1] },
  { username: 'stu2024007', publicId: 'STU2024007', name: 'Aditya Balaji', programme: 'B.E. Mechanical', dept: DEPARTMENTS[2] },
  { username: 'stu2024008', publicId: 'STU2024008', name: 'Sneha Anand', programme: 'B.B.A. Business Administration', dept: DEPARTMENTS[3] },
  { username: 'stu2024009', publicId: 'STU2024009', name: 'Vishal Sundaram', programme: 'B.Sc. Mathematics', dept: DEPARTMENTS[4] },
  { username: 'stu2024010', publicId: 'STU2024010', name: 'Ishita Raghavan', programme: 'B.E. Computer Science', dept: DEPARTMENTS[0] },
  { username: 'stu2024011', publicId: 'STU2024011', name: 'Nikhil Chander', programme: 'B.E. Mechanical', dept: DEPARTMENTS[2] },
  { username: 'stu2024012', publicId: 'STU2024012', name: 'Pooja Thirumalai', programme: 'B.Tech Electronics', dept: DEPARTMENTS[1] },
];

const STAFF = [
  { username: 'exm1001', publicId: 'EXM1001', name: 'Dr. Priya Raman', role: ROLES.EXAMINER, dept: DEPARTMENTS[0], designation: 'Senior Examiner — Computer Science' },
  { username: 'exm1002', publicId: 'EXM1002', name: 'Dr. Arun Prakash', role: ROLES.EXAMINER, dept: DEPARTMENTS[1], designation: 'Examiner — Electronics' },
  { username: 'exm1003', publicId: 'EXM1003', name: 'Dr. Nandini Bose', role: ROLES.EXAMINER, dept: DEPARTMENTS[4], designation: 'Examiner — Mathematics' },
  { username: 'mod2001', publicId: 'MOD2001', name: 'Dr. Vikram Iyer', role: ROLES.MODERATOR, dept: DEPARTMENTS[0], designation: 'Chief Moderator — Computer Science' },
  { username: 'mod2002', publicId: 'MOD2002', name: 'Dr. Kavitha Selvam', role: ROLES.MODERATOR, dept: DEPARTMENTS[2], designation: 'Moderator — Mechanical' },
  { username: 'ctl3001', publicId: 'CTL3001', name: 'Prof. Lakshmi Narayanan', role: ROLES.CONTROLLER, dept: DEPARTMENTS[0], designation: 'Controller of Examinations' },
  { username: 'hod4001', publicId: 'HOD4001', name: 'Dr. Suresh Kumar', role: ROLES.DEPARTMENT_HEAD, dept: DEPARTMENTS[0], designation: 'Head — Computer Science & Engineering' },
  { username: 'hod4002', publicId: 'HOD4002', name: 'Dr. Fatima Sheikh', role: ROLES.DEPARTMENT_HEAD, dept: DEPARTMENTS[1], designation: 'Head — Electronics & Communication' },
];

function iso(date) {
  return date.toISOString();
}

function daysFromNow(days, hour = 10, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Populate the database. Returns a summary of what was created.
 * @param {{force?: boolean}} options
 */
async function seed({ force = false } = {}) {
  const existing = db.get('SELECT COUNT(*) AS c FROM users');
  if (existing.c > 0 && !force) {
    return { skipped: true, reason: 'database already contains users' };
  }

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const now = new Date().toISOString();
  const created = { users: 0, exams: 0, papers: 0, evaluations: 0, results: 0, credentials: 0 };

  db.transaction(() => {
    // ------------------------------------------------------------------
    // Users
    // ------------------------------------------------------------------
    const insertUser = db.getDb().prepare(`
      INSERT INTO users
        (username, public_id, full_name, email, role, department, programme,
         designation, password_hash, status, is_demo, password_changed_at,
         created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 1, ?, ?, ?)
    `);

    // Primary demo student — the one printed on the login guide.
    const primaryStudent = STUDENTS[0];
    const primaryId = Number(
      insertUser.run(
        primaryStudent.username,
        primaryStudent.publicId,
        primaryStudent.name,
        `${primaryStudent.username}@student.msu.example.edu`,
        ROLES.STUDENT,
        primaryStudent.dept,
        primaryStudent.programme,
        'Undergraduate Student',
        passwordHash,
        now,
        now,
        now
      ).lastInsertRowid
    );
    created.users += 1;

    const studentIds = [primaryId];
    for (const s of STUDENTS.slice(1)) {
      const id = Number(
        insertUser.run(
          s.username,
          s.publicId,
          s.name,
          `${s.username}@student.msu.example.edu`,
          ROLES.STUDENT,
          s.dept,
          s.programme,
          'Undergraduate Student',
          passwordHash,
          now,
          now,
          now
        ).lastInsertRowid
      );
      studentIds.push(id);
      created.users += 1;
    }

    const staffIds = {};
    for (const s of STAFF) {
      const id = Number(
        insertUser.run(
          s.username,
          s.publicId,
          s.name,
          `${s.username}@msu.example.edu`,
          s.role,
          s.dept,
          null,
          s.designation,
          passwordHash,
          now,
          now,
          now
        ).lastInsertRowid
      );
      staffIds[s.username] = id;
      created.users += 1;
    }

    const adminId = Number(
      insertUser.run(
        'admin',
        'ADM9001',
        'System Administrator',
        'admin@msu.example.edu',
        ROLES.ADMINISTRATOR,
        'Examinations Office',
        null,
        'Platform Administrator',
        passwordHash,
        now,
        now,
        now
      ).lastInsertRowid
    );
    created.users += 1;

    const verifierId = Number(
      insertUser.run(
        'ver5001',
        'VER5001',
        'Tamil Nadu State Board (Verifier)',
        'verification@tnstateboard.example.edu',
        ROLES.EXTERNAL_VERIFIER,
        null,
        null,
        'Accreditation Verifier',
        passwordHash,
        now,
        now,
        now
      ).lastInsertRowid
    );
    created.users += 1;

    // A deactivated account so the demonstration can show the blocked state.
    insertUser.run(
      'exm1004',
      'EXM1004',
      'Dr. Ramesh Babu (Deactivated)',
      'exm1004@msu.example.edu',
      ROLES.EXAMINER,
      DEPARTMENTS[2],
      null,
      'Examiner — Mechanical (former)',
      passwordHash,
      now,
      now,
      now
    );
    db.run(
      "UPDATE users SET status = 'inactive' WHERE username = 'exm1004'"
    );
    created.users += 1;

    // ------------------------------------------------------------------
    // Examinations
    // ------------------------------------------------------------------
    const insertExam = db.getDb().prepare(`
      INSERT INTO exams
        (code, title, programme, semester, department, exam_date, start_time,
         duration_mins, hall, status, scheduled_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const examSpecs = [
      { code: 'CS501', title: 'Design & Analysis of Algorithms', programme: 'B.E. Computer Science', semester: 5, dept: DEPARTMENTS[0], offset: 4, time: '09:30', mins: 180, hall: 'Exam Hall A — Block 1', status: 'scheduled' },
      { code: 'CS502', title: 'Operating Systems', programme: 'B.E. Computer Science', semester: 5, dept: DEPARTMENTS[0], offset: 6, time: '13:30', mins: 180, hall: 'Exam Hall A — Block 1', status: 'scheduled' },
      { code: 'CS503', title: 'Database Management Systems', programme: 'B.E. Computer Science', semester: 5, dept: DEPARTMENTS[0], offset: 9, time: '09:30', mins: 180, hall: 'Exam Hall B — Block 2', status: 'scheduled' },
      { code: 'CS504', title: 'Computer Networks', programme: 'B.E. Computer Science', semester: 5, dept: DEPARTMENTS[0], offset: 12, time: '13:30', mins: 180, hall: 'Exam Hall B — Block 2', status: 'scheduled' },
      { code: 'EC501', title: 'Digital Signal Processing', programme: 'B.Tech Electronics', semester: 5, dept: DEPARTMENTS[1], offset: 5, time: '09:30', mins: 180, hall: 'Exam Hall C — Block 3', status: 'scheduled' },
      { code: 'EC502', title: 'VLSI Design', programme: 'B.Tech Electronics', semester: 5, dept: DEPARTMENTS[1], offset: 8, time: '13:30', mins: 180, hall: 'Exam Hall C — Block 3', status: 'scheduled' },
      { code: 'ME501', title: 'Thermodynamics II', programme: 'B.E. Mechanical', semester: 5, dept: DEPARTMENTS[2], offset: 7, time: '09:30', mins: 180, hall: 'Exam Hall D — Block 4', status: 'scheduled' },
      { code: 'MA501', title: 'Discrete Mathematics', programme: 'B.Sc. Mathematics', semester: 5, dept: DEPARTMENTS[4], offset: 10, time: '09:30', mins: 180, hall: 'Exam Hall E — Block 5', status: 'scheduled' },
      // Completed exams whose results are already published.
      { code: 'CS401', title: 'Theory of Computation', programme: 'B.E. Computer Science', semester: 4, dept: DEPARTMENTS[0], offset: -40, time: '09:30', mins: 180, hall: 'Exam Hall A — Block 1', status: 'completed' },
      { code: 'CS402', title: 'Software Engineering', programme: 'B.E. Computer Science', semester: 4, dept: DEPARTMENTS[0], offset: -38, time: '13:30', mins: 180, hall: 'Exam Hall A — Block 1', status: 'completed' },
      { code: 'CS403', title: 'Computer Graphics', programme: 'B.E. Computer Science', semester: 4, dept: DEPARTMENTS[0], offset: -35, time: '09:30', mins: 180, hall: 'Exam Hall B — Block 2', status: 'completed' },
      // Completed exams pending result approval — drives the Controller view.
      { code: 'CS505', title: 'Artificial Intelligence', programme: 'B.E. Computer Science', semester: 5, dept: DEPARTMENTS[0], offset: -12, time: '09:30', mins: 180, hall: 'Exam Hall A — Block 1', status: 'completed' },
      { code: 'EC503', title: 'Embedded Systems', programme: 'B.Tech Electronics', semester: 5, dept: DEPARTMENTS[1], offset: -10, time: '13:30', mins: 180, hall: 'Exam Hall C — Block 3', status: 'completed' },
    ];

    const examIds = {};
    for (const spec of examSpecs) {
      const date = daysFromNow(spec.offset);
      const id = Number(
        insertExam.run(
          spec.code,
          spec.title,
          spec.programme,
          spec.semester,
          spec.dept,
          isoDate(date),
          spec.time,
          spec.mins,
          spec.hall,
          spec.status,
          staffIds['exm1001'] || null
        ).lastInsertRowid
      );
      examIds[spec.code] = id;
      created.exams += 1;
    }

    // ------------------------------------------------------------------
    // Registrations — every student sits the papers for their programme
    // ------------------------------------------------------------------
    const csStudents = studentIds.slice(0, 4).concat(studentIds[9]);
    for (const examCode of ['CS501', 'CS502', 'CS503', 'CS504', 'CS401', 'CS402', 'CS403', 'CS505']) {
      for (const sid of csStudents) {
        db.run(
          'INSERT OR IGNORE INTO registrations (exam_id, user_id) VALUES (?, ?)',
          examIds[examCode],
          sid
        );
      }
    }
    for (const sid of [studentIds[4], studentIds[5], studentIds[11]]) {
      for (const examCode of ['EC501', 'EC502', 'EC503']) {
        db.run('INSERT OR IGNORE INTO registrations (exam_id, user_id) VALUES (?, ?)', examIds[examCode], sid);
      }
    }
    for (const examCode of ['ME501']) {
      db.run('INSERT OR IGNORE INTO registrations (exam_id, user_id) VALUES (?, ?)', examIds[examCode], studentIds[6]);
      db.run('INSERT OR IGNORE INTO registrations (exam_id, user_id) VALUES (?, ?)', examIds[examCode], studentIds[10]);
    }
    db.run(
      'INSERT OR IGNORE INTO registrations (exam_id, user_id) VALUES (?, ?)',
      examIds['MA501'],
      studentIds[8]
    );

    // ------------------------------------------------------------------
    // Question papers + rubrics
    // ------------------------------------------------------------------
    const insertPaper = db.getDb().prepare(`
      INSERT INTO question_papers
        (exam_id, title, total_marks, rubric, status, author_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const paperSpecs = [
      { exam: 'CS501', title: 'DAA — End Semester Paper (Set A)', status: 'submitted', rubric: 'Part A: 10 × 2 marks · Part B: 5 × 6 marks · Part C: 2 × 20 marks' },
      { exam: 'CS502', title: 'Operating Systems — End Semester Paper (Set A)', status: 'submitted', rubric: 'Part A: 10 × 2 marks · Part B: 5 × 6 marks · Part C: 2 × 20 marks' },
      { exam: 'CS503', title: 'DBMS — End Semester Paper (Set B)', status: 'draft', rubric: 'Part A: 10 × 2 marks · Part B: 5 × 6 marks · Part C: 2 × 20 marks' },
      { exam: 'CS505', title: 'Artificial Intelligence — End Semester Paper', status: 'approved', rubric: 'Part A: 10 × 2 marks · Part B: 4 × 8 marks · Part C: 1 × 28 marks' },
      { exam: 'EC503', title: 'Embedded Systems — End Semester Paper', status: 'approved', rubric: 'Part A: 10 × 2 marks · Part B: 5 × 6 marks · Part C: 2 × 20 marks' },
    ];

    const paperIds = {};
    for (const spec of paperSpecs) {
      const id = Number(
        insertPaper.run(
          examIds[spec.exam],
          spec.title,
          100,
          spec.rubric,
          spec.status,
          staffIds['exm1001'] || null,
          iso(daysFromNow(-20)),
          iso(daysFromNow(-5))
        ).lastInsertRowid
      );
      paperIds[spec.exam] = id;
      created.papers += 1;
    }

    // ------------------------------------------------------------------
    // Evaluations
    // ------------------------------------------------------------------
    const insertEval = db.getDb().prepare(`
      INSERT INTO evaluations
        (paper_id, exam_id, student_id, examiner_id, marks_awarded, max_marks,
         status, remarks, evaluated_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const csMarks = {
      0: { 501: 78, 502: 72, 505: 81 },
      1: { 501: 65, 502: 69, 505: 74 },
      2: { 501: 88, 502: 91, 505: 86 },
      3: { 501: 54, 502: 61, 505: 58 },
      9: { 501: 71, 502: 76, 505: 69 },
    };
    const evalStatusByExam = { 501: 'evaluated', 502: 'evaluated', 505: 'evaluated' };

    for (const [studentIndex, marks] of Object.entries(csMarks)) {
      const sid = studentIds[Number(studentIndex)];
      for (const [examCode, mark] of Object.entries(marks)) {
        const examKey = `CS${examCode}`;
        const id = Number(
          insertEval.run(
            paperIds[examKey] || null,
            examIds[examKey],
            sid,
            staffIds['exm1001'],
            mark,
            100,
            evalStatusByExam[examCode] || 'evaluated',
            mark < 60 ? 'Referred for moderation — borderline script.' : 'Evaluated against approved rubric.',
            iso(daysFromNow(-6)),
            iso(daysFromNow(-6))
          ).lastInsertRowid
        );
        created.evaluations += 1;
        // Flag one borderline script so the moderation queue is non-empty.
        if (mark < 60) {
          db.run("UPDATE evaluations SET status = 'flagged' WHERE id = ?", id);
        }
      }
    }

    // Electronics evaluations (awaiting controller approval)
    const ecMarks = { 4: 83, 5: 76, 11: 68 };
    for (const [studentIndex, mark] of Object.entries(ecMarks)) {
      insertEval.run(
        paperIds['EC503'] || null,
        examIds['EC503'],
        studentIds[Number(studentIndex)],
        staffIds['exm1002'],
        mark,
        100,
        'evaluated',
        'Evaluated against approved rubric.',
        iso(daysFromNow(-4)),
        iso(daysFromNow(-4))
      );
      created.evaluations += 1;
    }

    // ------------------------------------------------------------------
    // Moderation actions
    // ------------------------------------------------------------------
    const flagged = db.all("SELECT * FROM evaluations WHERE status = 'flagged'");
    for (const ev of flagged) {
      db.run(
        `INSERT INTO moderation_actions
           (evaluation_id, moderator_id, original_marks, proposed_marks, reason, status, created_at)
         VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
        ev.id,
        staffIds['mod2001'],
        ev.marks_awarded,
        Math.min(100, ev.marks_awarded + 4),
        'Script re-checked against rubric: awarded partial credit for question 7(c) omitted in original evaluation.',
        iso(daysFromNow(-3))
      );
    }
    // One already-approved moderation, for history.
    const alreadyOk = db.get(
      "SELECT * FROM evaluations WHERE status = 'evaluated' AND marks_awarded >= 70 LIMIT 1"
    );
    if (alreadyOk) {
      db.run(
        `INSERT INTO moderation_actions
           (evaluation_id, moderator_id, original_marks, proposed_marks, reason, status,
            created_at, resolved_at, resolved_by, controller_notes)
         VALUES (?, ?, ?, ?, ?, 'approved', ?, ?, ?, ?)`,
        alreadyOk.id,
        staffIds['mod2001'],
        alreadyOk.marks_awarded,
        alreadyOk.marks_awarded,
        'Sample re-verification: no discrepancy found across all five answer booklets.',
        iso(daysFromNow(-7)),
        iso(daysFromNow(-7)),
        staffIds['ctl3001'],
        'Verified and accepted.'
      );
    }

    // ------------------------------------------------------------------
    // Result publications
    // ------------------------------------------------------------------
    db.run(
      `INSERT INTO result_publications (exam_id, approved_by, approved_at, published_at, status)
       VALUES (?, ?, ?, ?, 'published')`,
      examIds['CS401'],
      staffIds['ctl3001'],
      iso(daysFromNow(-30)),
      iso(daysFromNow(-29))
    );
    db.run(
      `INSERT INTO result_publications (exam_id, approved_by, approved_at, published_at, status)
       VALUES (?, ?, ?, ?, 'published')`,
      examIds['CS402'],
      staffIds['ctl3001'],
      iso(daysFromNow(-28)),
      iso(daysFromNow(-27))
    );
    db.run(
      `INSERT INTO result_publications (exam_id, status) VALUES (?, 'awaiting_approval')`,
      examIds['CS505']
    );
    db.run(
      `INSERT INTO result_publications (exam_id, status) VALUES (?, 'awaiting_approval')`,
      examIds['EC503']
    );

    // ------------------------------------------------------------------
    // Published results
    // ------------------------------------------------------------------
    const insertResult = db.getDb().prepare(`
      INSERT INTO results (exam_id, student_id, marks, max_marks, grade, published_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const grade = (m) => (m >= 90 ? 'O' : m >= 80 ? 'A+' : m >= 70 ? 'A' : m >= 60 ? 'B+' : m >= 50 ? 'B' : m >= 40 ? 'C' : 'F');

    const publishedMarks = {
      CS401: { 0: 82, 1: 71, 2: 93, 3: 58, 9: 76 },
      CS402: { 0: 76, 1: 68, 2: 89, 3: 62, 9: 81 },
      CS403: { 0: 88, 1: 74, 2: 95, 3: 55, 9: 79 },
    };
    for (const [examCode, marks] of Object.entries(publishedMarks)) {
      for (const [studentIndex, mark] of Object.entries(marks)) {
        insertResult.run(
          examIds[examCode],
          studentIds[Number(studentIndex)],
          mark,
          100,
          grade(mark),
          iso(daysFromNow(-29))
        );
        created.results += 1;
      }
    }

    // ------------------------------------------------------------------
    // Revaluation requests
    // ------------------------------------------------------------------
    db.run(
      `INSERT INTO revaluations (student_id, exam_id, reason, status, created_at, updated_at)
       VALUES (?, ?, ?, 'under_review', ?, ?)`,
      studentIds[3],
      examIds['CS402'],
      'Requesting re-check of Part C question 4 — I believe all three sub-parts were attempted.',
      iso(daysFromNow(-14)),
      iso(daysFromNow(-9))
    );
    db.run(
      `INSERT INTO revaluations (student_id, exam_id, reason, status, decision_note, created_at, updated_at)
       VALUES (?, ?, ?, 'completed', ?, ?, ?)`,
      studentIds[1],
      examIds['CS401'],
      'Marks total in the published result differs from my expectation for Part B.',
      'Revaluation completed: script re-checked, marks confirmed with a +2 correction applied.',
      iso(daysFromNow(-35)),
      iso(daysFromNow(-25))
    );

    // ------------------------------------------------------------------
    // Degree certificates (credential registry)
    // ------------------------------------------------------------------
    const insertCredential = db.getDb().prepare(`
      INSERT INTO credentials
        (student_id, credential_no, degree, programme, department, class_awarded, issued_on, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertCredential.run(
      studentIds[0],
      'MSU-DEG-2024-0001',
      'Bachelor of Engineering (Computer Science)',
      'B.E. Computer Science',
      DEPARTMENTS[0],
      'First Class with Distinction',
      isoDate(daysFromNow(-180)),
      'issued'
    );
    insertCredential.run(
      studentIds[2],
      'MSU-DEG-2024-0002',
      'Bachelor of Engineering (Computer Science)',
      'B.E. Computer Science',
      DEPARTMENTS[0],
      'First Class with Distinction',
      isoDate(daysFromNow(-180)),
      'issued'
    );
    insertCredential.run(
      studentIds[5],
      'MSU-DEG-2023-0117',
      'Bachelor of Technology (Electronics)',
      'B.Tech Electronics',
      DEPARTMENTS[1],
      'First Class',
      isoDate(daysFromNow(-400)),
      'issued'
    );
    insertCredential.run(
      studentIds[7],
      'MSU-DEG-2022-0455',
      'Bachelor of Business Administration',
      'B.B.A. Business Administration',
      DEPARTMENTS[3],
      'Second Class',
      isoDate(daysFromNow(-700)),
      'revoked'
    );
    created.credentials += 4;

    // Verification history for the external verifier demo account.
    db.run(
      `INSERT INTO verification_history
         (verifier_id, credential_no, credential_id, result, purpose, created_at, ip_address)
       SELECT ?, 'MSU-DEG-2024-0001', id, 'valid', 'Employment background check', ?, '203.0.113.24'
         FROM credentials WHERE credential_no = 'MSU-DEG-2024-0001'`,
      verifierId,
      iso(daysFromNow(-9))
    );
    db.run(
      `INSERT INTO verification_history
         (verifier_id, credential_no, credential_id, result, purpose, created_at, ip_address)
       SELECT ?, 'MSU-DEG-2022-0455', id, 'revoked', 'Admissions cross-verification', ?, '203.0.113.24'
         FROM credentials WHERE credential_no = 'MSU-DEG-2022-0455'`,
      verifierId,
      iso(daysFromNow(-4))
    );

    // ------------------------------------------------------------------
    // Notifications
    // ------------------------------------------------------------------
    const notifications = [
      { role: ROLES.STUDENT, title: 'Semester 5 examination timetable published', body: 'The final timetable for Semester 5 end-semester examinations is now available under Examination Schedule. Hall tickets will be issued two weeks before the first paper.', severity: 'info', offset: -2 },
      { role: ROLES.STUDENT, title: 'Revaluation window closes in 7 days', body: 'Revaluation requests for the Semester 4 end-semester examinations must be submitted before the deadline. Late requests cannot be accepted.', severity: 'warning', offset: -1 },
      { role: ROLES.STUDENT, title: 'Semester 4 results published', body: 'Theory of Computation and Software Engineering results have been published. Please review your academic record for the consolidated grade sheet.', severity: 'success', offset: -28 },
      { role: ROLES.EXAMINER, title: 'Question-paper submission deadline', body: 'All Semester 5 question papers with rubrics must be submitted to the moderation queue before the end of this week.', severity: 'warning', offset: -1 },
      { role: ROLES.MODERATOR, title: '4 scripts flagged for moderation', body: 'Borderline evaluations have been flagged by examiners and require a moderation decision.', severity: 'warning', offset: -1 },
      { role: ROLES.CONTROLLER, title: '2 result sets awaiting approval', body: 'AI (CS505) and Embedded Systems (EC503) evaluations are complete and await final marks approval before publication.', severity: 'info', offset: -1 },
      { role: ROLES.DEPARTMENT_HEAD, title: 'Department performance report ready', body: 'The Semester 4 performance summary for Computer Science & Engineering is available for review.', severity: 'info', offset: -3 },
      { role: ROLES.ADMINISTRATOR, title: 'Scheduled security review', body: 'Quarterly access review of staff accounts is due. Review role assignments from the account management screen.', severity: 'info', offset: -5 },
      { role: ROLES.EXTERNAL_VERIFIER, title: 'Credential registry synchronised', body: 'The degree certificate registry has been synchronised with the Office of the Controller of Examinations.', severity: 'success', offset: -2 },
    ];

    for (const n of notifications) {
      db.run(
        `INSERT INTO notifications (audience_role, title, body, severity, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        n.role,
        n.title,
        n.body,
        n.severity,
        iso(daysFromNow(n.offset))
      );
    }

    // ------------------------------------------------------------------
    // Settings
    // ------------------------------------------------------------------
    const settings = [
      ['institution.name', 'Meridian State University'],
      ['institution.code', 'MSU'],
      ['examination.semester', 'Odd Semester 2026'],
      ['examination.revaluationFee', '250'],
      ['examination.revaluationWindowDays', '15'],
      ['examination.passPercentage', '40'],
      ['security.maxLoginAttempts', '5'],
      ['security.sessionIdleMinutes', '120'],
      ['security.mfaRequiredForStaff', 'false'],
      ['results.autoPublish', 'false'],
    ];
    for (const [key, value] of settings) {
      db.run(
        `INSERT INTO settings (key, value, updated_at, updated_by)
         VALUES (?, ?, ?, 'system.seed')
         ON CONFLICT(key) DO NOTHING`,
        key,
        String(value),
        now
      );
    }

    // ------------------------------------------------------------------
    // Seed audit entry
    // ------------------------------------------------------------------
    db.run(
      `INSERT INTO audit_log
         (created_at, actor_id, actor_name, actor_role, action, category, severity,
          target, detail, ip_address, user_agent, outcome)
       VALUES (?, NULL, 'System', 'System', 'system.seed', 'settings', 'info',
               'database', 'Demonstration dataset created.', '127.0.0.1', 'seed', 'success')`,
      now
    );
  });

  return { skipped: false, ...created };
}

/** Demo credentials for the login guide, enriched with public IDs. */
function demoCredentials() {
  const rows = db.all(
    `SELECT username, public_id, full_name, role
       FROM users
      WHERE is_demo = 1 AND status = 'active'
      ORDER BY CASE role
        WHEN 'student' THEN 1
        WHEN 'examiner' THEN 2
        WHEN 'moderator' THEN 3
        WHEN 'controller' THEN 4
        WHEN 'department_head' THEN 5
        WHEN 'administrator' THEN 6
        WHEN 'external_verifier' THEN 7
        ELSE 8 END, username`
  );

  const byRole = Object.fromEntries(
    DEMO_ACCOUNTS.map((a) => [a.role, { ...a }])
  );

  return rows.map((row) => {
    const template = byRole[row.role] || {};
    return {
      role: row.role,
      roleLabel: template.roleLabel || row.role,
      name: row.full_name,
      identifier: row.public_id,
      username: row.username,
      password: DEMO_PASSWORD,
      portal: template.portal || 'Staff',
      highlights: template.highlights || '',
    };
  });
}

module.exports = { seed, demoCredentials, DEMO_PASSWORD, DEMO_ACCOUNTS };
