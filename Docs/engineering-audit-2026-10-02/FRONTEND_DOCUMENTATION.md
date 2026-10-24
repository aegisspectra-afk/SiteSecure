# FRONTEND DOCUMENTATION — SITE SECURE

**Scope:** `apps/web`  
**Evidence date:** 2026-10-02 · HEAD `23a8121f…`  
**Status labels:** per IMPLEMENTATION_STATUS taxonomy

## 1. Stack & bootstrap

| Item | Evidence |
|------|----------|
| Package | `@site-secure/web` `0.1.1` (`apps/web/package.json`) |
| Bundler | Vite 6 (`vite`, `@vitejs/plugin-react`) |
| Router | TanStack Router + `@tanstack/router-plugin`; generated `src/routeTree.gen.ts` |
| Data | TanStack Query 5; Zod; `@supabase/supabase-js` |
| UI | `@site-secure/ui`, Tailwind 4, Lucide, ApexCharts, Lottie, pdfjs |
| Analytics | `@vercel/analytics` via `components/VercelAnalytics` in `__root.tsx` |

**Root route:** `src/routes/__root.tsx` — `ThemeRuntime` + `Outlet` + Vercel Analytics. No auth gate at root.

## 2. Route map (file routes)

71 route modules under `apps/web/src/routes/**/*.tsx` (AppleDouble excluded).

### Public / auth

| Path (file) | Purpose | Auth |
|-------------|---------|------|
| `index.tsx` | Marketing landing | Public |
| `login.tsx` | Login | Guest |
| `register.tsx` | Register | Guest |
| `forgot-password.tsx` / `reset-password.tsx` | Password recovery | Guest |
| `verify-email.tsx` | Email verify | Guest/flow |
| `onboarding.tsx` | Workspace create after auth | Authenticated, no workspace |
| `invite/$token.tsx` | Team invite accept | Mixed |
| `legal/index.tsx`, `legal/$slug.tsx` | Legal pages | Public |
| `q/$token.tsx`, `public/quotes/$token.tsx` | Public quote | Token public |
| `dev/ui.tsx` | UI playground | Dev (treat as non-prod) |

### App (`/app` layout: `app/route.tsx`)

**Guard evidence:** requires `user`; on API error without session shows `ErrorState`; if `!session.has_workspace` → onboarding path; uses `session.memberships[0]` only.

| Path | Purpose |
|------|---------|
| `app/index.tsx` | App home redirect/entry |
| `app/dashboard.tsx` | Dashboard |
| `app/today.tsx` | Field “today” |
| `app/analytics.tsx` | Analytics UI |
| `app/catalog.tsx` | Catalog |
| `app/customers/index.tsx`, `$customerId.tsx` | CRM |
| `app/leads/index.tsx`, `$leadId.tsx` | Leads |
| `app/quotes/index.tsx`, `new.tsx`, `$quoteId.tsx`, `$quoteId.preview.tsx` | Quotes / builder |
| `app/projects/index.tsx`, `$projectId.tsx` | Projects |
| `app/jobs/index.tsx`, `$jobId.tsx` | Field jobs |
| `app/sites/index.tsx`, `$siteId.tsx`, `$siteId_.assets.$assetId.tsx` | Sites / assets |
| `app/service/index.tsx` | Service calls **list** (no `$callId` route found) |
| `app/warranties/index.tsx`, `$warrantyId.tsx` | Warranties |
| `app/tasks/index.tsx` | Tasks (nav may label calendar) |
| `app/knowledge/index.tsx` | Knowledge |
| `app/settings/*` | Settings hub (company, users, roles, pdf-templates, security, …) |

### Portal

| Path | Purpose |
|------|---------|
| `portal/route.tsx`, `index.tsx`, `choose.tsx`, `invite/$token.tsx` | Customer portal UI |

**Note:** Matching API router `customer_portal.py` is **not mounted** in `main.py` → portal backend HTTP may be unavailable in running API (AUDIT-001). Frontend existence ≠ working end-to-end.

### Admin

| Path | Purpose |
|------|---------|
| `admin/route.tsx` + `index`, `users`, `organizations`, `invitations`, `beta`, `feedback`, `flags`, `audit`, `badges`, `archive` | Platform admin |

## 3. Layout & navigation

- **AppShell** (`components/AppShell`) wraps authenticated app routes.
- Navigation gating expected via authz `can()` + plan features (exact matrix: see AUTH doc; FE gating is UX-only — backend must enforce).
- Multi-workspace: **UI uses first membership only** (`app/route.tsx`).

## 4. State management

| Mechanism | Role |
|-----------|------|
| React Context session (`lib/session.tsx`) | User, memberships, entitlements surface |
| TanStack Query | Server state |
| Local component state | Forms, CCTV designer workspace |
| LocalStorage | Public locale key `site-secure-public-locale` (`i18n/public.ts`) |

No Redux/Zustand found in package.json dependencies.

## 5. API client pattern

- Package `@site-secure/api-client` + web `lib` helpers call `VITE_API_URL`.
- Supabase client uses `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`.
- **Never** service role in web (documented in README / `.env.example`).

## 6. Localization / RTL

| Area | HE | EN | Mechanism |
|------|----|----|-----------|
| In-app product UI | Primary (`i18n/he.ts` imports everywhere) | **NOT FOUND** as full catalog | Hardcoded HE object |
| Public landing | Yes | Yes | `public-he.ts` / `public-en.ts` + locale switch |
| Legal | HE (`legal-he.ts`) | Partial/unknown | |
| RTL | Expected Hebrew-first; many `dir="rtl"` usages | LTR for EN public | |

**Do not claim full i18n switch for `/app`.** Status: **PARTIALLY IMPLEMENTED** (public bilingual; app HE-first).

## 7. Major UI modules / components

| Area | Key components (examples) | Status (static) |
|------|---------------------------|-----------------|
| Quotes/CPQ | `QuoteBuilder`, `SystemBuilderDrawer`, CCTV panels | IMPLEMENTED — NOT FULLY VERIFIED (live) |
| Sites/Assets | Site dossier routes + asset detail | IMPLEMENTED — NOT FULLY VERIFIED |
| Dashboard/Today | dashboard/today routes | IMPLEMENTED — NOT FULLY VERIFIED |
| Settings | many settings routes | IMPLEMENTED — NOT FULLY VERIFIED |
| Portal | portal routes | PARTIALLY IMPLEMENTED (API mount gap) |
| Analytics | `app/analytics.tsx` | NOT VERIFIED depth |

## 8. Tests

`apps/web/tests`: **103** `*.ts/tsx` files covering quotes/CCTV, settings, sites/assets/IPAM UI, warranties, navigation, theme, etc.  
**This audit did not execute** `npm run web:test` (no dependency install/upgrade; avoid claiming pass/fail).

## 9. Gaps / FE findings

1. Service call detail route missing (`service/index` only) — PARTIAL.
2. Workspace switcher missing — PARTIAL.
3. Portal FE present while API router unwired — risk of UI-only failure.
4. AppleDouble / OneDrive copies may confuse local tooling — environmental.
5. Prior audit claimed unused dashboard components — **re-verify before deleting** (POTENTIALLY UNUSED).
