# KGM Hiring Portal

KGM Hiring Portal is a Next.js 16 hiring and assessment system for job postings, assessment setup, candidate invitations, timed candidate attempts, and hiring-team review.

The application has two separate experiences:

- Candidate flow: OTP verification, assessment overview, timed section runner, autosaved attempt state, and final submission.
- Admin flow: protected hiring workspace for assessments, jobs, invites, submissions, users, settings, analytics, and review decisions.

## Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript
- MongoDB Node driver
- Tailwind CSS 4
- Nodemailer for invitation, reset, and admin email flows
- shadcn-style local UI primitives in `components/ui`

## Getting Started

Install dependencies:

```bash
npm install
```

Create `.env.local` from `.env.example` and fill the values listed in [Environment Variables](#environment-variables).

Start development:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

Useful commands:

```bash
npm run dev
npm run lint
npm run build
npm run start
```

## Environment Variables

Use `.env.local` for local secrets. Keep real credentials out of committed files.

```env
MAIN_ADMIN_NAME=Faheem Siddiqi
MAIN_ADMIN_DESIGNATION=IT Administrator
ADMIN_EMAIL=admin@kgm.com
ADMIN_PASSWORD=replace-with-a-strong-password

APP_BASE_URL=http://localhost:3000

ADMIN_MAIL_HOST=smtp.gmail.com
ADMIN_MAIL_PORT=587
ADMIN_MAIL_SECURE=false
ADMIN_MAIL_USER=your-email@gmail.com
ADMIN_MAIL_PASSWORD=your-google-app-password
ADMIN_MAIL_FROM=KGM Hiring <your-email@gmail.com>
ADMIN_MAIL_TEST_TO=test-recipient@example.com

MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB=kgm_hiring
DEV_MODE=true
```

### Environment Notes

- `ADMIN_EMAIL` and `ADMIN_PASSWORD` seed the primary admin login when the admin collection is initialized.
- `APP_BASE_URL` is required for admin invitations, password reset links, and candidate invite links.
- `ADMIN_MAIL_*` values enable SMTP delivery. If they are absent, invite records are still created and the UI keeps a manual OTP fallback.
- `MONGODB_URI` and `MONGODB_DB` are required for server data.
- `DEV_MODE=true` enables richer diagnostics and should not be used in production.

## Product Flow

1. Admin signs in at `/admin/login`.
2. Admin creates or edits assessments from JSON-backed question banks at `/admin/assessments`.
3. Admin creates jobs at `/admin/jobs` and attaches one assessment to each job in the current UI.
4. Admin opens a job detail page and invites a candidate.
5. The server stores a job-level candidate assignment with concrete assessment IDs and a unique OTP.
6. Email delivery is attempted through SMTP. If email fails or SMTP is not configured, the invite still exists and privileged admins can use the manual OTP fallback.
7. Candidate opens `/assessment/verify` or uses an invite link with `?otp=...`.
8. Candidate sees all pending assessments attached to the job invite and can complete them one by one.
9. Starting or resuming an assessment creates or loads a server attempt record.
10. Progress, answers, current section/question, timers, and violations are saved through candidate attempt APIs.
11. Candidate can submit at any point with confirmation.
12. Submission creates a reviewable record. The job invite is marked complete only after all assigned assessments are submitted.
13. Admin reviews submissions, evaluates written answers, and makes a terminal accepted, rejected, or forwarded decision.

## Business Rules

- Admin routes are protected by an HTTP-only admin session cookie.
- Candidate access uses OTP verification through `/assessment/verify`.
- Expired invites cannot be started, continued, or submitted.
- Submitted assessments cannot be reopened by the candidate.
- A job invite can contain multiple assessments; each assessment has its own attempt and submission state.
- Repeat job attempts are separate assignments, but a new assignment is blocked while a prior assignment for the same candidate and job is still pending.
- Active duplicate invites reuse the existing OTP instead of creating a new database record.
- OTP values are masked by default. Main admin, HOD-designated users, and IT-designated users can view candidate OTPs.
- Fullscreen, focus, and visibility violations are recorded. They do not terminate the assessment by default.
- Final review decisions are terminal. The review flow is action-based and does not store mutable admin remarks.
- The frontend currently keeps job assessment selection to one assessment unless the backend/data model is intentionally expanded.

## UI Pages

### Public and Candidate Pages

- `/` - Public landing/candidate entry surface.
- `/jobs` - Public job listing.
- `/jobs/[jobId]` - Public job detail.
- `/assessment/verify` - Secure OTP verification entrypoint.
- `/assessment` - Candidate assessment overview.
- `/assessment/[section]` - Timed section runner.

### Admin Pages

- `/admin/login` - Hiring-team sign in.
- `/admin` - Analytics-first hiring dashboard.
- `/admin/jobs` - Job list, create flow, and job status overview.
- `/admin/jobs/[jobId]` - Job analytics, candidates, invite flow, score graph, and top performers.
- `/admin/jobs/[jobId]/configure` - Dedicated job configuration route.
- `/admin/assessments` - Assessment list and create flow.
- `/admin/assessment/[assessmentId]` - Canonical assessment detail and section configuration.
- `/admin/[assessmentId]` - Legacy assessment analytics route retained for compatibility.
- `/admin/submissions` - Submission list and review entry.
- `/admin/submissions/[submissionId]` - Full submission review with answers and scoring.
- `/admin/notifications` - Admin notification center.
- `/admin/settings` - Admin/user management area.
- `/admin/setup-password` - Invitation password setup.
- `/admin/request-access-invitation` - Admin access request.
- `/admin/request-reset-link` - Password reset request.
- `/admin/reset-password` - Password reset completion.
- `/admin/auth-required` - Protected-route fallback.

## API Routes

### Admin APIs

- `POST`, `DELETE`, `GET /api/admin/session` - Admin login, logout, and current session.
- `GET`, `POST /api/admin/assessments` - List and create assessments.
- `GET`, `POST`, `PATCH`, `PUT /api/admin/jobs` - List, create, status update, and edit jobs.
- `POST`, `PATCH /api/admin/candidates` - Create candidate assignments and update invite email status.
- `GET /api/admin/hiring-records` - Full candidate/submission snapshot.
- `GET /api/admin/hiring-records?view=analytics` - Lean analytics snapshot for dashboards and lists.
- `POST /api/admin/candidate-invites` - Send or resend candidate invite email.
- `GET`, `POST /api/admin/users` - Admin user management.
- `POST /api/admin/request-access-invitation` - Request admin access.
- `POST /api/admin/request-reset-link` - Request password reset link.
- `POST /api/admin/reset-password` - Complete password reset.
- `POST /api/admin/setup-password` - Complete invited admin password setup.
- `POST /api/admin/submission-emails` - Send submission-related email.
- `GET`, `PATCH /api/admin/submissions/[submissionId]` - Load and review one submission.
- `POST /api/admin/test-email` - Send test email to verify SMTP.

### Candidate and Public APIs

- `GET /api/jobs` - Public job listing.
- `POST /api/candidate/otp` - Verify candidate OTP and load pending assessments.
- `POST`, `PATCH /api/candidate/attempts` - Start/resume and autosave assessment attempt state.
- `POST /api/candidate/submissions` - Submit candidate assessment.
- `GET /api/database/status` - Database connectivity status.

## MongoDB Schema

The application creates indexes at runtime from the server helper modules. Main collections:

### `admin_users`

Stores hiring-team users.

Important fields:

- `name`, `designation`, `email`
- `passwordHash`
- `role`: `main-admin` or `sub-admin`
- `isAdmin`, `canManageAdmins`, `paused`
- `mustChangePassword`
- `temporaryPasswordBackup`
- `invitationExpiresAt`
- `resetTokenHash`, `resetTokenExpiresAt`, `resetTokenPurpose`
- `createdAt`, `updatedAt`, `lastLoginAt`

Indexes:

- unique `email`
- TTL `invitationExpiresAt`

### `admin_sessions`

Stores admin login sessions.

Important fields:

- `userId`, `email`
- `tokenHash`
- `createdAt`, `expiresAt`

Indexes:

- unique `tokenHash`
- TTL `expiresAt`

### `assessments`

Stores configured assessments built from resource question banks.

Important fields:

- `code`, `name`, `description`
- `questionBankId`
- `sectionSettings`
- `createdAt`, `updatedAt`

Indexes:

- unique `code`
- `questionBankId, updatedAt`
- `updatedAt, createdAt`

### `jobs`

Stores public/admin job postings.

Important fields:

- `slug`, `title`, `department`
- `location`, `experience`, `status`
- `summary`, `description`
- `responsibilities`, `requirements`, `tags`
- `assessmentIds`
- `createdAt`, `updatedAt`, `reopenedAt`

Indexes:

- unique `slug`
- `status, updatedAt`
- `assessmentIds`

### `assessmentCandidates`

Stores candidate invitations and job assignments.

Important fields:

- `name`, `email`
- `assessmentId`
- `jobId`, `jobTitle`
- `assessmentIds`
- `otpCode`
- `cvUrl`
- `invitedAt`, `inviteExpiresAt`
- `inviteEmailStatus`, `inviteEmailFailure`
- `submittedAt`

Indexes:

- unique `otpCode`
- `assessmentId, invitedAt`
- `jobId, invitedAt`
- `email, jobId, submittedAt`
- `inviteExpiresAt, submittedAt`
- `invitedAt`

### `candidateAssessmentAttempts`

Stores server-backed candidate runtime state.

Important fields:

- `candidateId`, `assessmentId`
- `status`
- `startedAt`, `updatedAt`, `submittedAt`
- `currentSectionSlug`, `currentQuestionId`
- `answers`
- `questionStatuses`
- `questionRemainingSeconds`
- `sectionDeadlines`, `questionDeadlines`
- `violations`

Indexes:

- unique `candidateId, assessmentId`

### `assessmentSubmissions`

Stores final candidate submissions and admin review state.

Important fields:

- `candidateId`, `assessmentId`
- `assessmentTitle`
- `candidateName`, `candidateEmail`
- `submittedAt`
- `answeredCount`, `totalQuestions`, `score`
- `status`
- `violations`
- `answers`
- `textScores`
- `reviews`
- `evaluatedAt`, `evaluatedBy`
- `decision`

Indexes:

- `assessmentId, submittedAt`
- `submittedAt`
- `assessmentId, score`
- unique `candidateId, assessmentId`

## Data and Persistence

Server-backed data:

- Admin users and sessions
- Assessment definitions
- Jobs
- Candidate invites and assignment state
- Candidate attempt state
- Candidate submissions and reviews

Browser-backed runtime mirror:

- Candidate auth flags and active candidate/assessment IDs
- Local answer mirror for fast UI rendering
- Local attempt mirror after server autosave
- Notification read state
- Temporary UI state for assessment runner transitions

The server is the source of truth for invite validity, expiry, submissions, attempts, review decisions, and admin authentication.

## Performance and Optimization

The API layer is designed to avoid broad client-side filtering for routine dashboard work.

- Dashboard summary stats are produced server-side through aggregation.
- `/api/admin/hiring-records?view=analytics` returns a lean snapshot without heavy answer/review payloads.
- Full submission payloads are loaded only where detailed review requires answers.
- Job listing uses an aggregation pipeline with `$lookup` and `$facet` for rows, status counts, and pagination metadata.
- Dashboard submission totals, score buckets, pending review counts, auto-submitted counts, and violation totals are aggregated server-side.
- Candidate and submission list reads use projections and indexed sorts.
- Mongo indexes are created from helper modules on first use.
- Candidate attempts use compound uniqueness so one candidate can complete multiple assessments under one job invite without duplicate submissions.

## UI and Design Rules

- Keep candidate and admin flows visually and technically separate.
- Use restrained shadcn-style surfaces for admin pages.
- Use route-level loading skeletons for admin and assessment routes.
- Keep dashboard and job-detail analytics centered on invitation, assessment, submission, score, and review state.
- Keep configuration flows explicit with Save/Cancel where draft values exist.
- Show immediate feedback after create, update, invite, resend, status, and review actions.
- Keep candidate instructions near the assessment overview header.
- Do not expose OTPs or sensitive review data only through frontend hiding; server responses must enforce visibility.
- Prefer professional labels over demo wording.
- Avoid unrelated UI redesign when changing API or persistence behavior.

## Route Protection

`proxy.ts` protects `/admin/:path*`.

- Signed-out admin visitors are redirected to `/admin/login`.
- Signed-in admin visitors requesting `/admin/login` are redirected to `/admin`.
- Candidate and public job routes are not protected by the admin session cookie.

## Error Diagnostics

The app centralizes server and browser diagnostics:

- `lib/server-error.ts` normalizes server errors and API responses.
- `instrumentation.ts` captures server/runtime startup errors.
- `instrumentation-client.ts` reports browser, route, promise, network, and API errors.
- `app/error.tsx` and `app/global-error.tsx` provide consistent recovery screens.
- `DEV_MODE=true` enables detailed local diagnostics with redaction for secrets, tokens, cookies, and connection strings.

## Main Source Areas

```text
app/                         App Router pages, route handlers, loading UI, errors
components/admin/            Admin shell and navigation
components/ui/               Local shadcn-style primitives
db/                          MongoDB connection helper
features/auth/components/    Candidate and admin auth views
features/jobs/components/    Public/admin job views
features/test/components/    Assessment overview, runner, dashboard, review UI
features/test/resources/     JSON question banks
features/test/admin-storage.ts
                              Browser mirror and client API helpers
lib/admin-users.ts           Admin users, sessions, roles, password/reset tokens
lib/assessments.ts           Assessment persistence and validation
lib/hiring-records.ts        Candidate invites, attempts, submissions, analytics
lib/jobs.ts                  Job persistence and job list aggregation
lib/mail/                    SMTP mail service and email builders
proxy.ts                     Admin route protection
```

## Deployment Checklist

- Set secure `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
- Set `APP_BASE_URL` to the deployed origin.
- Set `MONGODB_URI` and `MONGODB_DB`.
- Configure `ADMIN_MAIL_*` for production email delivery.
- Set `DEV_MODE=false` or omit it.
- Run `npm run lint`.
- Run `npm run build`.
