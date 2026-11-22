# Portal OTP — local SQL apply

If `supabase db push` / CLI fails (e.g. inbucket config error), apply manually on local Postgres:

```text
supabase/migrations/20261122180000_portal_otp_sessions.sql
```

From repo root with local stack running:

```powershell
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/migrations/20261122180000_portal_otp_sessions.sql
```

Or copy the file path into the Supabase Studio SQL editor on `127.0.0.1:54323`.