# Local Supabase reset + pytest fixtures

**Local only.** After `supabase db reset`, Auth is empty and many `pytest -m live` suites skip with `password grant failed: 400`.

## Standard flow

```bash
supabase db reset
npm run db:seed-local-auth
```

Or without npm:

```bash
python apps/api/scripts/seed_local_pytest_auth.py
```

The seed script:

- Refuses non-loopback `SUPABASE_URL`
- Uses GoTrue `POST /auth/v1/admin/users` with the local **service role** key (`apps/api/.env` or `supabase status -o env`)
- Creates confirmed users with password `Test-Pass-2026!`:
  - `ss.phase3.a@sitesecure.test` (owner flows)
  - `ss.phase3.b@sitesecure.test` (second tenant)
  - `ss.phase3.viewer@sitesecure.test` — fixed UUID `b3ff2e4c-0c7a-41f7-9264-70c8784909c2`
  - `ss.phase3.tech@sitesecure.test` — fixed UUID `0242ad20-9a63-4b92-b571-be46cbc9c391`

It does **not** create workspaces; tests call `create_workspace` / API routes as today.

## Isolated Postgres (`SITESECURE_ISOLATED_DB_URL`)

Workforce RLS proofs and `test_create_workspace_atomic_rollback.py` need a disposable **local** Postgres URL (never cloud).

Add to `apps/api/.env` (gitignored):

```env
SITESECURE_ISOLATED_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

This is the default DB from `supabase status`. The suites create their own throwaway rows; sharing the main local DB is acceptable. For a separate database:

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "CREATE DATABASE sitesecure_isolated;"
```

Then point `SITESECURE_ISOLATED_DB_URL` at `.../sitesecure_isolated` and apply migrations there if needed.

## Pytest

From `apps/api`:

```bash
pytest -q -rs
```

Expect skips only where tests document optional gates (platform admin seed, C5 browser E2E, SSP activation prerequisites, etc.).