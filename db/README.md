# Database Layer

This folder contains the shared MongoDB connection and database types.

- `index.ts` exposes one cached MongoDB client and the selected database.
- `schema.ts` keeps shared database record types until a real ORM/schema is selected.
- Migrations and seed files can live here later under `migrations/` and `seeds/`.

Configure `MONGODB_URI`, `MONGODB_DB`, and `DEV_MODE` in `.env.local`. Detailed
connection diagnostics are logged and exposed at `/api/database/status` only
when `DEV_MODE=true`; credentials are never included.

Rules for attempting: 

Keep the test window open and in fullscreen. Active question and section timers continue during refresh, disconnect, tab close, or power loss, so a 5 minute outage consumes 5 minutes from the active timers. If you skip a question, that question timer pauses and resumes from the saved remaining time when you reopen it. Submitted or timed-out questions cannot be edited.


otp view authorization:
role === "main-admin"
OR designation contains "hod"
OR designation contains "it"

But for sub-admins, the app checks designation:
role: sub-admin
designation: Operations HOD
=> can see OTP
role: sub-admin
designation: IT Administrator
=> can see OTP
role: sub-admin
designation: HR Admin
=> cannot see OTP