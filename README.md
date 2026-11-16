# UniExam — Centralized Authentication & Role-Based Access Platform

A centralized authentication module for a university **examination and credential
management** system. It provides one branded login portal for every user
category, redirects each authenticated user to the dashboard for their assigned
role, and enforces permission-based access control on every route.

> **All data in this repository is synthetic.** Every student, staff member,
> mark and degree certificate is fabricated for teaching and demonstration.
> No real student credentials are stored anywhere. See
> [Demonstration accounts](#demonstration-accounts).

---

## Table of contents

1. [What this module delivers](#what-this-module-delivers)
2. [Quick start](#quick-start)
3. [Demonstration accounts](#demonstration-accounts)
4. [User roles and dashboards](#user-roles-and-dashboards)
5. [Role-based access control](#role-based-access-control)
6. [Security design](#security-design)
7. [Architecture](#architecture)
8. [Project layout](#project-layout)
9. [Testing](#testing)
10. [Configuration](#configuration)
11. [API-free JSON behaviour](#api-free-json-behaviour)
12. [Accessibility and design system](#accessibility-and-design-system)
13. [Known demo-mode limitations](#known-demo-mode-limitations)

---

## What this module delivers

| Requirement | Where it lives |
|---|---|
| Common login portal with university branding | `/login` · `src/views/auth/login.ejs` |
| Four login entry points (Student / Staff / Administrator / Verifier) | portal switcher on `/login` |
| User ID + password + show/hide + Remember me | login form, `src/public/js/app.js` |
| Forgot password with single-use reset links | `/forgot-password` · `src/services/passwordReset.js` |
| Login and logout | `src/routes/auth.js` |
| Preconfigured synthetic demo accounts + on-page guide | `src/db/seed.js` |
| Redirect to the correct dashboard after login | `src/services/auth.js` returns `dashboardPathForRole` |
| Student dashboard, schedule, results, revaluation, records | `src/routes/student.js` |
| Examiner: schedule, papers, rubrics, evaluate | `src/routes/examiner.js` |
| Moderator: review evaluations, raise discrepancies, endorse | `src/routes/moderator.js` |
| Controller: approve final marks, publish results | `src/routes/controller.js` |
| Department Head: departmental analytics and reports | `src/routes/department.js` |
| Administrator: accounts, roles, settings, audit log | `src/routes/admin.js` |
| External Verifier: credential verification + history | `src/routes/verifier.js` |
| Strict RBAC incl. direct-URL protection | `src/config/roles.js` + `src/middleware/auth.js` |
| Secure password storage, sessions, lockout, audit trail | `src/lib/password.js`, `src/services/*` |

---

## Quick start

Requires **Node.js 22.5+** (the app uses the built-in `node:sqlite` module, so
there is no native database dependency to compile).

```bash
npm install
npm start          # http://localhost:3000
```

The first run creates `data/uniexam.db`, applies the schema and seeds the
demonstration dataset (23 accounts, 13 examinations, evaluations, results,
credentials, notifications and settings).

Development with auto-restart:

```bash
npm run dev
```

Run the test suite:

```bash
npm test           # 69 integration tests
```

---

## Demonstration accounts

Every demo account is flagged `is_demo = 1` in the database and carries a
**DEMO** badge throughout the interface. The login page shows a faculty guide
that lists every role; clicking a User ID fills the form.

**Shared password for all demo accounts: `Demo@2024`**

| Role | User ID | Portal | What to demonstrate |
|---|---|---|---|
| Student | `STU2024001` | Student Login | Timetable, published results, revaluation tracking |
| Examiner | `EXM1001` | Staff Login | Schedule exams, author papers + rubrics, evaluate scripts |
| Moderator | `MOD2001` | Staff Login | Review evaluations, raise a discrepancy |
| Controller of Examinations | `CTL3001` | Staff Login | Approve final marks, publish results |
| Department Head | `HOD4001` | Staff Login | Department analytics and performance report |
| Administrator | `admin` | Administrator Login | Create/deactivate accounts, change roles, audit log |
| External Verifier | `VER5001` | External Verifier Login | Verify `MSU-DEG-2024-0001` (valid), `MSU-DEG-2022-0455` (revoked) |

Additional accounts exist to demonstrate particular behaviours:

| Scenario | Credentials |
|---|---|
| Deactivated account is refused | `EXM1004` / `Demo@2024` via Staff Login |
| Bad password / lockout after 5 attempts | any account, wrong password |
| Wrong portal for the account's role | `EXM1001` via *Student* Login |

All accounts are synthetic. Usernames are also accepted in lower case, and a
student may sign in with either `STU2024001` or `stu2024001`.

---

## User roles and dashboards

After a successful sign-in the server chooses the destination from the role
registry — the browser never decides where to go.

| Role | Lands on | Dashboard title |
|---|---|---|
| Student | `/student/dashboard` | Student Dashboard |
| Examiner | `/examiner/dashboard` | Examiner Dashboard |
| Moderator | `/moderator/dashboard` | Moderation Dashboard |
| Controller | `/controller/dashboard` | Examination Approval Dashboard |
| Department Head | `/department/dashboard` | Department Analytics Dashboard |
| Administrator | `/admin/dashboard` | System Administration Dashboard |
| External Verifier | `/verifier/dashboard` | Credential Verification Dashboard |

---

## Role-based access control

### Single source of truth

`src/config/roles.js` declares every role, every permission, and the one
permission each dashboard requires. Routes, navigation menus and templates
all derive from it — nothing is hard-coded per page.

```js
ROLE_PERMISSIONS = {
  student:            ['records:read', 'results:read', 'revaluation:submit', ...],
  examiner:           ['exam:schedule', 'paper:author', 'rubric:manage',
                       'script:evaluate', ...],
  moderator:          ['evaluation:review', 'moderation:approve', ...],
  controller:         ['marks:approve', 'results:publish', ...],
  department_head:    ['department:monitor', 'department:reports', ...],
  administrator:      ['accounts:create', 'roles:assign', 'audit:read', ...],
  external_verifier:  ['credential:verify', 'credential:read', ...],
};
```

### Guards

| Guard | Purpose |
|---|---|
| `requireAuth` | A live server-side session is mandatory. |
| `requireRole(...roles)` | Identity check when a role list is genuinely needed. |
| `requirePermission('x:y')` | Permission check for a single capability. |
| `requireDashboard(role)` | Resolves the dashboard's required permission from the registry and checks it against the **session** role — not the URL. |

### Direct URL entry cannot bypass authorisation

`tests/rbac.test.js` probes **every** dashboard from **every** role (49
combinations) plus anonymous access. A student typing `/examiner/dashboard`
receives a branded 403 and the attempt is written to the audit log as a
`critical` event:

```
access.dashboard_denied · Direct URL attempt to the examiner dashboard
from a "student" session.
```

### Separation of duties

| Control | Enforced by |
|---|---|
| Examiners cannot publish results | `results:publish` is not granted to any staff role except the Controller; the publish endpoint is guarded by that permission. |
| Moderators cannot overwrite marks directly | Moderation writes only to `moderation_actions`. The original `evaluations.marks_awarded` stays intact until a Controller resolves the correction. `evaluations` rows are additionally locked once `status ∈ {moderated, approved}`. |
| Only the Controller approves + publishes | `marks:approve` and `results:publish` are held by `controller` alone. Publishing requires a prior approval. |
| Administrators manage accounts and permissions | `accounts:*`, `roles:assign`, `passwords:reset`, `audit:read`, `settings:manage`. |
| Verifiers cannot see internal records | Their role contains no examination permission; the verification query returns only masked credential fields. |
| No self-service privilege escalation | There is no registration route at all. Roles are only ever set by an administrator, and the last administrator cannot be demoted or deactivated. |

---

## Security design

| Area | Implementation |
|---|---|
| Password storage | `scrypt` (N=16384, r=8, p=1) with a per-password random salt, stored as `scrypt$N$r$p$salt$hash`. Verification uses `crypto.timingSafeEqual`. |
| Session storage | Random 32-byte token in an `HttpOnly`, `SameSite=Lax` cookie; only its SHA-256 digest is stored server-side. The database cannot be replayed as a cookie. |
| Session lifecycle | Sliding idle timeout (120 min, or 30 days with *Remember me*), revoked on logout, password change, role change and deactivation. |
| Brute-force protection | Per-IP rate limit **and** per-account lockout after 5 failures for 15 minutes. Successful authentication clears the counter. |
| CSRF | Synchroniser token bound to the session, compared timing-safely on every `POST`. Anonymous tokens cover the login and reset forms. |
| Account enumeration | "No such user" and "wrong password" return the identical message. Account-state problems are disclosed only after the password is verified. |
| Password reset | 30-minute single-use token, SHA-256 hashed at rest, revokes all sessions on completion. Requests never reveal whether an account exists. |
| Open redirect | `next=` is honoured only for same-origin paths, and only if the role may open the target dashboard. |
| Headers | Helmet: CSP with no inline scripts, `frame-ancestors` limited to the preview hosts, no `X-Powered-By`. HSTS in production. |
| Audit trail | Append-only `audit_log` for logins, failures, lockouts, permission denials, account changes, role changes, settings changes and credential checks. |
| Password policy | ≥10 characters with upper, lower and a digit; enforced on reset, account creation and self-service change. |
| Production guard | The server refuses to boot in `NODE_ENV=production` without a `COOKIE_SECRET`. |

---

## Architecture

```
Browser
  │  cookie: uniexam.sid (opaque token)
  ▼
Express app (server.js)
  │  helmet → body parsers → cookie parser → static → rate limit
  │  request context → flash → session lookup → view locals → CSRF
  ▼
Routes  ── requireDashboard / requirePermission ──▶  Permission registry
  │
  ▼
Services (auth, session, accounts, passwordReset, examData, audit)
  │
  ▼
SQLite (node:sqlite) — users, sessions, audit_log, exams,
evaluations, moderation_actions, results, credentials, …
```

Rendering uses EJS with a single layout wrapper (`src/middleware/view.js`), so
every page — login, dashboard, error — shares the same header, navigation,
footer and branding. Dashboards compose into `layouts/app` → `layouts/base`.

---

## Project layout

```
server.js                     app factory, middleware chain, boot + seed
src/
  config/
    index.js                  environment configuration
    roles.js                  ROLES, PERMISSIONS, ROLE_PERMISSIONS, DASHBOARDS
  db/
    index.js                  schema, connection, transaction helpers
    seed.js                   synthetic demo dataset + demo credential guide
  lib/
    password.js               scrypt hashing, token generation, policy
  middleware/
    auth.js                   loadUser, requireAuth/Role/Permission/Dashboard
    csrf.js                   synchroniser-token CSRF protection
    view.js                   view locals, navigation, layout composition
    context.js                client IP + flash messages
  services/
    auth.js                   login / logout, lockout, account-state checks
    session.js                create, lookup, revoke, prune
    accounts.js               admin account lifecycle
    passwordReset.js          request/complete/admin reset
    examData.js               dashboard read-models and workflow actions
    audit.js                  append-only audit trail
  routes/                     auth, shared, student, examiner, moderator,
                              controller, department, admin, verifier
  views/
    layouts/                  base + app shells
    partials/                 brand, flash, icon set
    auth/                     login, forgot-password, reset-password
    dashboards/               one template per role and sub-page
    errors/                   403, 404, 500
  public/
    css/app.css               design system
    js/app.js                 progressive enhancement
tests/
  auth.test.js                21 authentication tests
  rbac.test.js                21 access-control tests
  dashboards.test.js          27 dashboard + workflow tests
```

---

## Testing

```bash
npm test
```

```
# tests 69
# pass 69
# fail 0
```

The suite boots a real HTTP server against a throwaway database and drives it
with a cookie-aware client, so every assertion exercises the real middleware
chain (sessions, CSRF, guards, templates).

Coverage highlights:

* **Authentication** — all seven roles sign in and land correctly; wrong
  password, unknown user, wrong portal, deactivated account; lockout after
  five failures; logout invalidates the token server-side; remember-me
  lifetime; cookie flags; CSRF rejection and forged tokens; the full password
  reset round-trip including replay rejection.
* **RBAC** — 49 dashboard × role combinations; permission matrix exclusivity;
  examiner cannot publish; moderator cannot write marks; two-step moderation
  requires Controller sign-off; verifier cannot reach internal records and the
  verification output is identity-masked; last-administrator protection;
  deactivation kills live sessions; role change forces re-authentication;
  open-redirect protection.
* **Dashboards** — every role's pages render without template errors; the full
  approve → publish lifecycle makes results visible to students; department
  scoping cannot be widened by a query parameter; consistent shell and
  branding on all seven dashboards.

---

## Configuration

Copy `.env.example` to `.env` and adjust:

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP port (bound to `0.0.0.0`) |
| `NODE_ENV` | `development` | `production` enables HSTS and strict secret checks |
| `COOKIE_SECRET` | dev-only default | Signs session and CSRF cookies — **required** in production |
| `COOKIE_SECURE` | `false` | Set `true` behind HTTPS |
| `DB_PATH` | `./data/uniexam.db` | SQLite file location |
| `SESSION_IDLE_MINUTES` | `120` | Idle timeout for a normal session |
| `SESSION_REMEMBER_DAYS` | `30` | Lifetime when *Remember me* is used |
| `MAX_LOGIN_ATTEMPTS` | `5` | Failures before lockout |
| `LOCKOUT_MINUTES` | `15` | Lockout duration |

---

## API-free JSON behaviour

The module is server-rendered, but guard middleware is content-negotiating so
that a fetch or an `/api/*` path receives a machine-readable refusal rather
than an HTML page:

```http
GET /admin/audit
Accept: application/json
→ 403 {"error":"forbidden","yourRole":"student","homeUrl":"/student/dashboard"}
```

```http
GET /admin/dashboard        (no session)
→ 401 {"error":"authentication_required","loginUrl":"/login?next=%2Fadmin%2Fdashboard"}
```

---

## Accessibility and design system

* Institutional navy + academic gold palette, serif wordmark, shared crest on
  every page.
* Skip link, visible focus rings, `aria-*` on tabs, toggles, modals and alerts,
  `aria-live` toasts.
* Password show/hide is a real toggle button with `aria-pressed`.
* Caps-Lock detection on the password field.
* Full keyboard support for modals (`Escape` closes), responsive sidebar with
  a scrim, print stylesheet for timetables and reports.
* `prefers-reduced-motion` respected; no motion-dependent information.

---

## Known demo-mode limitations

These are deliberate for a classroom demonstration and are flagged in the UI:

1. **Reset links are displayed on screen.** No SMTP server is configured, so
   the single-use link is surfaced in the interface after a reset request.
   Production would deliver it by email only.
2. **Temporary passwords are shown in a flash message** after an administrator
   resets an account, so the demonstration can continue without a mail server.
3. **SQLite is used for zero-setup persistence.** Swap `src/db` for PostgreSQL
   in a real deployment; the service layer is the only caller.
4. **Rate limiting is in-process** and resets on restart. Use a shared store
   behind multiple instances.

---

## Licence

MIT — written as a software-engineering course project.
