# DEPLOYMENT AND ENVIRONMENTS — SITE SECURE

**Date:** 2026-10-02 · Config-as-code only. Live hosts **NOT probed**.

## 1. Hosting map (from repo config)

| Component | Platform | Config evidence |
|-----------|----------|-----------------|
| Web SPA | Vercel | `vercel.json` — `npm ci`, `npm run web:build`, `outputDirectory: apps/web/dist`, SPA rewrites, security headers |
| API | Render | `render.yaml` — Docker `deploy/Dockerfile.api`, health `/health`, service name `site-secure-api-staging`, region frankfurt, plan free |
| DB/Auth/Storage | Supabase | `.env.example` + `supabase/` |
| Mobile | — | **NOT FOUND** |

Render blueprint references `WEB_PUBLIC_URL=https://site-secure-umber.vercel.app` — indicates a known web deployment URL in config; **live uptime NOT VERIFIED**.

## 2. Build / start (local — documented, not executed here)

| App | Build | Start (typical) |
|-----|-------|-----------------|
| Web | `npm run web:build` / `web:dev` | Vite |
| API | Docker or `uvicorn` (see deploy docs) | Render Dockerfile |
| DB | `supabase` CLI migrations | local or cloud |

Existing ops docs under `Docs/operations/` / `Docs/development/SETUP.md` may exist — treat as claims; reconcile with current scripts.

## 3. Environment variables (names only)

From `.env.example`:

| Name | Purpose | Consumers | Required? | Template? |
|------|---------|-----------|-----------|-----------|
| SUPABASE_URL | Project URL | API (+ shared) | yes | yes |
| SUPABASE_ANON_KEY | Anon key | API | yes | yes |
| SUPABASE_SERVICE_ROLE_KEY | Service role | **API only** | yes (API) | yes |
| API_PUBLIC_URL | Public API origin | API/docs | yes | yes |
| WEB_PUBLIC_URL | Public web origin | API CORS/links | yes | yes |
| APP_ENV | environment label | API | yes | yes |
| CORS_EXTRA_ORIGINS | extra origins | API | optional | yes |
| VITE_SUPABASE_URL | Web Supabase | Web build | yes | yes |
| VITE_SUPABASE_ANON_KEY | Web anon | Web build | yes | yes |
| VITE_API_URL | Web → API | Web build | yes | yes |
| EXPO_PUBLIC_* | Mobile stubs | Mobile (absent) | n/a | yes |
| PLATFORM_ADMIN_BOOTSTRAP_EMAIL | commented bootstrap | scripts | optional | commented |

**Values:** never documented. Local `.env` / `.env.local` exist on disk per inventory — treat as sensitive.

## 4. CORS / security headers

- API: CORSMiddleware with settings allowlist + credentials; methods/headers `*`.
- Web (Vercel): `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, noindex on app/auth paths.

## 5. CI/CD

- Vercel/Render git integration assumed by config; **GitHub Actions workflows:** scan for `.github/workflows` — if absent, CI may be platform-native only.
- Root scripts for lint/typecheck/test exist; CI execution **NOT VERIFIED**.

## 6. Branch → environment mapping

- Current branch: `feat/quote-cpq-phase-ab`.
- Mapping to staging/production: **NOT VERIFIED** from repo alone (Render blueprint named staging).

## 7. Backups / monitoring / rollback

- Docs mention beta backup checklists (`Docs/BETA_BACKUP_*`, `GATE_10_*`) — operational runbooks exist as documents.
- Live backup success: NOT VERIFIED.
- API logging: structured request logs; external APM: NOT FOUND in quick scan.

## 8. Limitations

Cannot claim Production health, secret correctness, or migration apply status without external access.
