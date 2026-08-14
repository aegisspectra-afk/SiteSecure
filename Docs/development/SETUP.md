# Development setup — SITE SECURE V2

V2 is a monorepo. Do not connect to the V1 Supabase project (`flukzgqflaikmddeoica`).
The V2 project ref is `rhxqqudlngimhplvndmz`.

## Credentials

| Variable | Where |
|----------|--------|
| `SUPABASE_URL` | `https://rhxqqudlngimhplvndmz.supabase.co` — no `/rest/v1` suffix |
| `SUPABASE_ANON_KEY` | API + web + mobile (legacy JWT anon or `sb_publishable_…`) |
| `SUPABASE_SERVICE_ROLE_KEY` | **API only**. Must be the secret/`service_role` JWT, never `sb_publishable_…` |
| `API_PUBLIC_URL` | web + mobile |
| `WEB_PUBLIC_URL` | API (invite links) |

Never commit real keys. `.env` and `apps/api/.env` are gitignored. `.env.example` must stay empty of secrets.

Phase 3 FastAPI does **not** need the service role for normal user requests. It validates the caller JWT via `/auth/v1/user` and queries PostgREST with that JWT so RLS applies.

## API (Phase 3+)

```bash
cd apps/api
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000
pytest
```

Docs: `http://localhost:8000/api/docs`

Staging / private preview: [STAGING.md](../operations/STAGING.md).  
Web on Vercel (FastAPI separate): [VERCEL.md](../operations/VERCEL.md).

## Rules

- No demo/localStorage mode
- No V1 schema replay
- Hebrew-first RTL in UI
- After each phase: typecheck, lint, test
- If tenant isolation tests fail, stop. Do not build CRM/UI.
