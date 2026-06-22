# Database Layer

This folder contains the shared MongoDB connection and database types.

- `index.ts` exposes one cached MongoDB client and the selected database.
- `schema.ts` keeps shared database record types until a real ORM/schema is selected.
- Migrations and seed files can live here later under `migrations/` and `seeds/`.

Configure `MONGODB_URI`, `MONGODB_DB`, and `DEV_MODE` in `.env.local`. Detailed
connection diagnostics are logged and exposed at `/api/database/status` only
when `DEV_MODE=true`; credentials are never included.
