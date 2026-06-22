# KGM Hiring Portal

A Next.js 16 hiring portal with separate candidate and hiring-team experiences. Candidates enter an invitation OTP, complete a timed fullscreen assessment, and submit their answers. Hiring-team users sign in to create assessments, invite candidates, and review results.

## Getting Started

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Useful commands:

```bash
npm run dev
npm run lint
npm run build
npm run start
```

## Page Routes

### `/` - Candidate Portal

**Route file:** `app/page.tsx`

**View:** `OtpLoginForm` in `features/auth/components/otp-login-form.tsx`

**Access:** Public

This is the candidate sign-in page.

- Accepts a six-digit assessment access code.
- Rejects codes that are malformed, invalid, or expired.
- Matches the code against candidate invitations stored by the hiring workspace.
- Stores the active candidate and candidate-authenticated state in browser `localStorage`.
- Shows success or error notifications.
- Redirects a valid candidate to `/test`.
- Provides a link to the hiring-team login at `/admin/login`.

### `/test` - Test Overview

**Route file:** `app/test/page.tsx`

**View:** `TestOverview` in `features/test/components/test-overview.tsx`

**Access:** Candidate flow

This page summarizes the active assessment before and between sections.

- Shows the assessment title, role, section count, question count, and total allowed time.
- Lists every configured assessment section with its title, duration, question count, and completion progress.
- Starts or continues a section and requests fullscreen before opening it.
- Reads the active assessment and its generated sections from browser storage.
- Reads saved answers so progress survives route changes and refreshes.
- Allows a completed assessment to be reviewed and submitted.
- Displays a submission confirmation when the full assessment is complete.

### `/test/[section]` - Assessment Section

**Route file:** `app/test/[section]/page.tsx`

**Loading view:** `app/test/[section]/loading.tsx`

**View:** `SectionRunner` in `features/test/components/section-runner.tsx`

**Access:** Candidate flow

**Examples:** `/test/english`, `/test/general`, `/test/admin-mcqs`

This dynamic route runs one assessment section. The built-in section slugs are generated as static parameters, while the view resolves the active assessment configuration from browser storage.

- Presents one question at a time with text, single-choice, or multiple-choice inputs.
- Saves answers in `localStorage` and restores them after navigation or refresh.
- Displays question navigation, answered/skipped state, section progress, and previous/next controls.
- Enforces both a section timer and configured per-question timers.
- Persists timer deadlines in `sessionStorage` so refreshing does not restart time.
- Allows candidates to skip questions and revisit available questions.
- Requires an answer before final submission from the last question.
- Opens the next section or returns to the overview when appropriate.
- Shows a time-up dialog when the section timer expires, with overview and reset controls.
- Requires fullscreen and monitors tab visibility, fullscreen exit, and window focus loss.
- Records each enforcement violation in browser storage and displays a blocking warning.
- Automatically submits and terminates the assessment on the third violation.
- Calculates and stores the final result for hiring-team review.
- Shows a completion dialog for normal and automatic submissions.

If a section is being prepared, the route-level loading view displays skeleton placeholders for the section header, timer, navigation, and question card.

### `/admin/login` - Hiring Workspace Login

**Route file:** `app/admin/login/page.tsx`

**View:** `AdminLoginForm` in `features/auth/components/admin-login-form.tsx`

**Access:** Public only when signed out

This is the hiring-team sign-in page.

- Accepts the configured admin email and password.
- Sends credentials to `POST /api/admin/session`.
- Shows server-provided authentication errors.
- Redirects successful sign-ins to `/admin` and refreshes the route state.
- Provides a link back to the candidate portal.
- Redirects already authenticated admins to `/admin` through `proxy.ts`.

### `/admin` - Hiring Workspace Dashboard

**Route file:** `app/admin/page.tsx`

**View:** `AdminDashboard` in `features/test/components/admin-dashboard.tsx`

**Access:** Protected by the admin session cookie

This is the main hiring-team workspace.

- Displays pipeline totals for assessments, candidates, submissions, and average score.
- Creates role-specific assessments from the available JSON question banks.
- Configures section count, questions per section, section time, and question time.
- Validates that the selected question bank can satisfy the requested assessment size.
- Creates candidate invitations for a selected assessment.
- Generates a six-digit OTP and prepares an email invite.
- Displays and copies the most recently generated OTP.
- Lists assessments with invited, completed, and average-score statistics.
- Opens an assessment-specific analytics page at `/admin/[assessmentId]`.
- Shows recent submissions and their scores.
- Builds notifications for submissions, pending invitations, and available assessments.
- Supports individual and bulk notification read state.
- Provides responsive desktop and mobile workspace navigation.
- Signs out through `DELETE /api/admin/session` and returns to `/admin/login`.

Assessment, invitation, result, and notification data is currently stored in browser `localStorage`.

### `/admin/[assessmentId]` - Assessment Analytics

**Route file:** `app/admin/[assessmentId]/page.tsx`

**View:** `AssessmentAnalytics` in `features/test/components/assessment-analytics.tsx`

**Access:** Protected by the admin session cookie

**Example:** `/admin/assistant-admin-officer`

This dynamic route provides detailed management and review for one assessment.

- Shows invited, completed, average-score, and auto-submitted metrics.
- Visualizes score distribution across four score bands.
- Ranks and displays the top five candidates.
- Creates an invitation directly for the current assessment.
- Edits per-section question-type settings using draft values with explicit Save and Cancel actions.
- Lists candidates with OTP, invitation date, result state, and CV actions.
- Opens available CV links in an embedded preview panel.
- Shows a submission log with status, score, date, and violation count.
- Opens a selected submission for question-by-question review.
- Displays candidate answers alongside expected answers and grading outcomes.
- Shows an "Assessment not found" card with a dashboard return action when the ID does not exist.

## API Routes

### `/api/admin/session`

**Route file:** `app/api/admin/session/route.ts`

#### `POST`

Authenticates a hiring-team user.

- Expects JSON containing `email` and `password`.
- Compares credentials with `ADMIN_EMAIL` and `ADMIN_PASSWORD`.
- Returns `401` with an error message for invalid credentials.
- Creates an HTTP-only, same-site admin session cookie valid for eight hours after successful authentication.

#### `DELETE`

Signs out the hiring-team user by deleting the admin session cookie.

## Route Protection

`proxy.ts` applies to `/admin/:path*`.

- Signed-out visitors requesting an admin page are redirected to `/admin/login`.
- Signed-in visitors requesting `/admin/login` are redirected to `/admin`.
- Candidate routes and the candidate portal are not covered by the admin cookie.

## Environment Variables

Configure the hiring-team credentials in `.env.local`:

```env
ADMIN_EMAIL=admin@kgm.com
ADMIN_PASSWORD=replace-with-a-secure-password
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/?appName=KgmCluster
MONGODB_DB=kgm_hiring
DEV_MODE=true
```

When these variables are absent, development fallbacks from the session route are used. Production deployments should always provide secure values.

## Centralized Error Diagnostics

The application includes centralized diagnostics for server, API, MongoDB, browser, network, promise, and React rendering errors.

- `lib/server-error.ts` normalizes server errors, assigns correlation IDs, records timestamps, preserves nested cause chains, and generates consistent API error responses.
- `instrumentation.ts` captures MongoDB startup failures and errors handled by the Next.js server runtime.
- `instrumentation-client.ts` reports uncaught browser errors, unhandled promise rejections, failed network requests, non-successful API responses, and route transitions in the browser console.
- When `DEV_MODE=true`, recoverable errors also open a detailed in-browser modal with navigation between recent errors, copyable diagnostics, context, cause chains, stack traces, and a **Close and continue** action.
- A development-only diagnostics endpoint streams buffered startup, database, request, and background server errors into that modal, including failures that otherwise appear only in the IDE terminal.
- `app/error.tsx` and `app/global-error.tsx` provide consistent recovery screens for route and root-layout rendering failures.
- API failures include an error ID that can be matched with the corresponding `[error:<id>]` entry in the server console.

Set `DEV_MODE=true` locally to include detailed server diagnostics, context, cause chains, and stack traces in API responses. Open the browser developer tools and inspect the **Console** and **Network** tabs for grouped `[diagnostics]` messages.

Detailed diagnostics are development-only. Production responses expose safe messages and correlation IDs while passwords, tokens, cookies, connection strings, and URI credentials are redacted from logged diagnostic data. Do not enable `DEV_MODE` in production.

## Data and Persistence

The current application remains browser-first for hiring workflow data. MongoDB is connected and health-checked by the server infrastructure, but assessment and candidate records have not yet been migrated to it.

- `localStorage` holds assessments, candidates, OTP invitations, active candidate/assessment IDs, answers, question status, violations, results, and notification read state.
- `sessionStorage` holds active section and question timer values.
- The admin login uses an HTTP-only cookie and is the only server-managed session.
- Data is specific to the browser and origin in which it was created; clearing site data removes it.

## Main Source Areas

```text
app/                         Page routes, API route, layout, and loading UI
features/auth/components/    Candidate and admin login views
features/test/components/    Test overview, section runner, dashboard, analytics
features/test/resources/     JSON assessment question banks
features/test/admin-storage.ts
                              Assessments, candidates, results, and violations
features/test/assessment-storage.ts
                              Candidate answer persistence
proxy.ts                     Admin route protection
```
