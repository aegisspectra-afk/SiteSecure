# Aegis SSP (`apps/ssp`)

Standalone authenticated SSP product UI (Phase **B4.2**). Port **5174**.

Embedded SSP under Site Secure (`apps/web` → `/app/ssp`) remains available. Public tablet routes (`/ssp/:token`) stay on the web origin until B4.3.

## Prerequisites

- Node ≥ 20
- `npm install` from monorepo root
- Same **public** env as web (Supabase **anon** + API). Never add `SUPABASE_SERVICE_ROLE_KEY`.

## Environment

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase URL |
| `VITE_SUPABASE_ANON_KEY` | Anon key only |
| `VITE_API_URL` | FastAPI origin (prod / non-proxy) |
| `VITE_PLATFORM_HOME_URL` | Default `http://localhost:5173/platform` |
| `VITE_WEB_ORIGIN` | Default `http://localhost:5173` — hosts public `/ssp/:token` links |

Dev server proxies `/api` → FastAPI (see `vite.config.ts`).

## Run

```bash
npm run ssp:dev          # http://localhost:5174
npm run ssp:typecheck
npm run ssp:smoke
npm run ssp:build
```

Sign in on `/login` with email/password (Supabase Auth). There is **no** automatic session share with `localhost:5173`.

### Windows path with `&`

If `ssp:build` fails on HTML emit paths:

```bat
subst S: C:\ssv1-j
S:
cd apps\ssp
npm run build
```

## Routes

| Path | Gate |
|------|------|
| `/login` | Public |
| `/` | Session + workspace + `ssp` + `ssp.forms.view` |
| `/forms/$formId` | Same shell gate; edit actions use finer `can()` |
| `/submissions` | + `ssp.submissions.view` |
| `/submissions/$submissionId` | + `ssp.submissions.view` |
