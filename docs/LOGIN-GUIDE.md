# Faculty Demonstration Guide — Login Walkthrough

> **All accounts and data in this guide are synthetic.** They exist purely so
> that each role can be demonstrated during the project evaluation. No real
> student records, marks or certificates are used anywhere in this system.

---

## 1. Where to start

| | |
|---|---|
| **URL** | `http://localhost:3000` (redirects to `/login`) |
| **Shared demo password** | `Demo@2024` |
| **Portal selection** | Choose the correct tab before signing in |

The login page carries a **Demonstration Accounts** panel. Clicking a User ID
fills the form and selects the matching portal automatically, so the
demonstration flows quickly.

---

## 2. The seven demonstrations

### 2.1 Student — `STU2024001` (Student Login)

**What to show**

1. The dashboard: upcoming examinations, published results, average marks and
   open revaluation requests.
2. **Examination Schedule** — the personal timetable with hall and timing.
3. **Results** — only *published* results appear. Note the caption: results are
   released by the Controller of Examinations.
4. **Revaluation** — submit a request with a reason ≥ 20 characters; it appears
   immediately as *Submitted* with a four-step progress timeline.
5. **Academic Records** — semester-wise marks, GPA and issued degree certificates.

**What to prove**: the student has no link to examiner, moderator,
administrator or verifier modules. Typing `/examiner/dashboard` directly
produces a 403 page.

---

### 2.2 Examiner — `EXM1001` (Staff Login)

**What to show**

1. The workspace header states the role's limits explicitly: papers,
   schedules and evaluations, but *not* result publication.
2. **Schedule examination** — fill the modal and the new paper appears in the
   master timetable (and on student timetables).
3. **Question papers** — a paper cannot be submitted without a rubric; the
   system explains that moderators rely on it.
4. **Evaluation queue** — record marks for a script. Note the locked state once
   a script enters moderation.

**What to prove**: there is no publish control anywhere in this workspace.
Posting directly to `/controller/exams/1/publish` returns 403.

---

### 2.3 Moderator — `MOD2001` (Staff Login)

**What to show**

1. The moderation queue: flagged scripts and evaluations awaiting review.
2. **Raise a discrepancy** — propose new marks and give a rationale.
3. Open the database/interfaces side by side to show the **original examiner
   mark is unchanged**; the correction sits in a separate moderation record.
4. **Endorse** the correction. It now appears in the Controller's queue.

**What to prove**: a moderator cannot apply a correction. Only endorsement is
possible here; the Controller must authorise it.

---

### 2.4 Controller of Examinations — `CTL3001` (Staff Login)

**What to show**

1. The **two-step gate**: *Approve marks* freezes the mark set; *Publish
   results* releases it to students.
2. The moderation sign-off queue — review an endorsed correction and approve or
   reject it, recording a decision note.
3. Switch to a student account and refresh **Results**: the newly published
   paper is now visible.

**What to prove**: publishing without prior approval is refused with an
explanatory message.

---

### 2.5 Department Head — `HOD4001` (Staff Login)

**What to show**

1. Department analytics: exams conducted, enrolment, average marks, pass rate.
2. **Student performance** — per-student averages across published results.
3. **Performance report** — a printable departmental report.

**What to prove**: the view is scoped to the head's own department. Appending
`?department=Mechanical Engineering` to the URL changes nothing.

---

### 2.6 Administrator — `admin` (Administrator Login)

**What to show**

1. Account statistics, live sessions and the recent security-event feed.
2. **Create an account** — role is chosen by the administrator only; the new
   user is forced to change the password at first sign-in.
3. **Deactivate** the newly created account, then try to sign in as it: the
   login is refused. Any live session for that user dies immediately.
4. **Re-role** an account and observe that existing sessions are revoked —
   the user must sign in again so the new permission set is loaded.
5. **Roles & permissions** — the complete matrix, including the separation of
   duties notes.
6. **Audit log** — filter by category and see every login, failure, lockout and
   permission denial.

**What to prove**: the administrator cannot deactivate or demote their own
account, and the last administrator cannot be removed. Passwords are never
displayed — only scrypt hashes exist in storage.

---

### 2.7 External Verifier — `VER5001` (External Verifier Login)

**What to show**

1. **Verify a credential**:
   * `MSU-DEG-2024-0001` → **Authentic** (issued)
   * `MSU-DEG-2022-0455` → **Revoked**
   * `MSU-DEG-1999-9999` → **No matching credential**
2. Point out the **masked name** (`A. Menon`) and the notice that full personal
   details are withheld.
3. **Verification history** — every check, timestamped and attributed.

**What to prove**: `/student/results`, `/student/records`, `/admin/accounts`
and all staff dashboards return 403 for this role. No marks, coursework or
contact details appear anywhere in the verification output.

---

## 3. Security demonstrations

| Scenario | How to reproduce | Expected result |
|---|---|---|
| Wrong password | Any account + bad password | *"Invalid User ID or password"* — identical to an unknown user |
| Unknown user | `STU9999999` | Same message as above; no account disclosure |
| Wrong portal | `EXM1001` via Student Login | Refused with a role-appropriate explanation |
| Deactivated account | `EXM1004` via Staff Login | Refused; contact the examination office |
| Account lockout | 5 wrong passwords on one account | Locked for 15 minutes, even with the correct password |
| CSRF | Submit a form without the token | 403 *"security token"* page |
| Direct URL bypass | Student → `/examiner/dashboard` | Branded 403; attempt recorded as a critical audit event |
| Password reset | *Forgot password* with `STU2024001` | Single-use link (shown on screen in demo mode); replaying it fails |
| Session revocation | Sign in twice, change the password | Other sessions are signed out; the current one survives |
| Open redirect | `?next=https://evil.example.com` | Ignored; the role's own dashboard is used |

---

## 4. Reset the demonstration

To restore a pristine dataset, stop the server, delete the database and restart:

```bash
rm -f data/uniexam.db*
npm start
```

The seed is idempotent — it only inserts when the `users` table is empty —
so restarting without deleting the file preserves whatever was demonstrated.
