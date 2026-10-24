# Workforce Intelligence (`apps/WorkForce`)

Standalone authenticated Workforce UI. Port **5175**.

There is no public self-signup. Managers create employee users from the authenticated app. `/register` on the platform is unchanged.

## Prerequisites

- Node ≥ 20
- `npm install` from the monorepo root
- Same **public** env as web (Supabase **anon** + API). Never add `SUPABASE_SERVICE_ROLE_KEY`.

## Environment

Copy `apps/WorkForce/.env.example` to `apps/WorkForce/.env`, then fill the public keys from `apps/web/.env` (or the root `SUPABASE_URL` / `SUPABASE_ANON_KEY`).

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase URL |
| `VITE_SUPABASE_ANON_KEY` | Anon / publishable key only |
| `VITE_API_URL` | FastAPI origin (`http://localhost:8000`) |
| `VITE_PLATFORM_HOME_URL` | SITE SECURE platform URL. Local default `http://localhost:5173/platform`. Production must not use localhost. |

The Vite config also falls back to root `SUPABASE_URL` and `SUPABASE_ANON_KEY` when the `VITE_` names are missing. Restart the dev server after changing env.

## Run

```bash
npm run workforce:dev    # http://localhost:5175
```

Sign in on **http://localhost:5175/login** with the same email/password as SITE SECURE (Supabase Auth). There is no public `/register` here. After login the app opens `/` only when the server session includes the `workforce` entitlement; otherwise the user stays blocked and API calls still fail closed.

SITE SECURE login remains **http://localhost:5173/login**. The session is not shared automatically across ports. Production WorkForce and SITE SECURE origins must be listed in API CORS and Supabase Auth redirect URLs — never bake `localhost:5175` into a production build.

## Vercel

Root Directory is the **repository root**, not `apps/WorkForce`. Create a separate Vercel project from the same Git repo and set **`SITESECURE_VERCEL_APP=workforce`**. Leave that variable unset on the SITE SECURE project.

Production `vite build` fails unless `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL`, and `VITE_PLATFORM_HOME_URL` are public HTTPS values. FastAPI stays off Vercel. See `Docs/operations/VERCEL.md`.
