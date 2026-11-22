# Portal OTP — local SQL apply

If `supabase db push` / CLI fails (e.g. inbucket config error), apply manually on local Postgres:

```text
supabase/migrations/20261122205000_portal_otp_sessions.sql
```

From repo root with local stack running:

```powershell
# Prefer: npx supabase db reset
# Or apply this file alone:
docker exec -i supabase_db_site-secure-v2 psql -U postgres < supabase/migrations/20261122205000_portal_otp_sessions.sql
```

Or copy the file path into the Supabase Studio SQL editor on `127.0.0.1:54323`.