# SITE SECURE — Engineering Audit Documentation Index

**Audit mode:** DOCUMENTATION ONLY (no application code, config, schema, dependency, deploy, commit, or push changes).  
**Audit datetime (local):** 2026-10-02 ~23:40–24:00 Asia/Jerusalem (UTC+3)  
**Repository root:** `C:\Users\shimd\OneDrive\Desktop\BUSINESS & TECHNOLOGY\Projects\SiteSecure\current\SiteSecureV1`  
**Git branch:** `feat/quote-cpq-phase-ab`  
**Git HEAD:** `23a8121f802ec71b27f100f938b595cb6c1e24e4`  
**HEAD subject:** `feat(quotes): ship SYSTEM-DESIGNER-1 CCTV Designer founding-beta` (2026-10-01)  
**Working tree note:** thousands of untracked macOS AppleDouble `._*` files pollute `git status` and `.git/objects/pack`; these are **not** product changes. Real product dirty state: **NOT fully separated in this pass** — treat AppleDouble noise as documented interference.

## What SITE SECURE is (CURRENT STATE)

Hebrew-first (RTL) multi-tenant SaaS for security-system businesses (CCTV / install / service). Monorepo:

| Layer | Technology | Location | Deploy target (config evidence) |
|-------|------------|----------|----------------------------------|
| Web | React 19 + Vite 6 + TanStack Router/Query | `apps/web` | Vercel (`vercel.json`) |
| API | FastAPI 0.7.0 title in code + Python ≥3.12 | `apps/api` | Render Docker (`render.yaml`, `deploy/Dockerfile.api`) |
| DB/Auth/Storage | Supabase (Postgres + GoTrue + Storage) | `supabase/` | External Supabase project |
| Shared packages | authz, api-client, ui, design-system, types | `packages/*` | Consumed by web (and authz by API) |
| Mobile | Referenced in `.env.example` only | `apps/mobile` | **NOT FOUND** (0 files) |

## How to navigate this audit pack

| Doc | Purpose |
|-----|---------|
| [SYSTEM_OVERVIEW.md](./SYSTEM_OVERVIEW.md) | Architecture & system context |
| [FILE_INVENTORY.csv](./FILE_INVENTORY.csv) / [FILE_INVENTORY.md](./FILE_INVENTORY.md) | File index |
| [FRONTEND_DOCUMENTATION.md](./FRONTEND_DOCUMENTATION.md) | Routes, UI, i18n |
| [BACKEND_DOCUMENTATION.md](./BACKEND_DOCUMENTATION.md) | FastAPI services |
| [API_REFERENCE.md](./API_REFERENCE.md) | Endpoint inventory |
| [DATABASE_DOCUMENTATION.md](./DATABASE_DOCUMENTATION.md) | Tables, migrations, RLS notes |
| [AUTH_SECURITY_DOCUMENTATION.md](./AUTH_SECURITY_DOCUMENTATION.md) | AuthZ + security findings |
| [MODULES_AND_FEATURES.md](./MODULES_AND_FEATURES.md) | Business modules matrix |
| [BUSINESS_FLOWS.md](./BUSINESS_FLOWS.md) | End-to-end flows |
| [DEPLOYMENT_AND_ENVIRONMENTS.md](./DEPLOYMENT_AND_ENVIRONMENTS.md) | Deploy & env |
| [TESTING_AND_QUALITY.md](./TESTING_AND_QUALITY.md) | Tests |
| [TECHNICAL_DEBT_AND_RISKS.md](./TECHNICAL_DEBT_AND_RISKS.md) | Debt |
| [DEPENDENCY_MAP.md](./DEPENDENCY_MAP.md) | Dependency maps |
| [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) | Status matrix |
| [GLOSSARY.md](./GLOSSARY.md) | Terms |
| [DOCUMENTATION_COVERAGE.md](./DOCUMENTATION_COVERAGE.md) | Scan coverage |
| [AUDIT_FINDINGS.md](./AUDIT_FINDINGS.md) | Numbered findings |
| [DOCUMENTATION_CHANGELOG.md](./DOCUMENTATION_CHANGELOG.md) | What this pack created |

## Existing docs (NOT overwritten)

Prior documentation remains under `Docs/` (many phase reports), root `README.md`, `SITE_SECURE_CURRENT_STATE_AUDIT.txt` (2026-08-29, **outdated vs current counts**), `SITE_SECURE_MASTER_PRODUCT_BLUEPRINT.md`, `Docs/PRODUCT_STATUS_UNIFIED.md` (2026-09-13). This pack is additive under `Docs/engineering-audit-2026-10-02/`.

## What was verified vs not

**Verified (static):** repo structure, git HEAD, route file list, FastAPI `main.py` router wiring, endpoint decorator inventory, migration file list, authz catalog, deploy config files, package manifests, TypeScript `database.ts` table list vs migration `CREATE TABLE` set.

**NOT VERIFIED in this audit:** live Production/Staging E2E, live Supabase schema equality to migrations, Render/Vercel runtime health, secret values, payment provider, full test suite execution (no install/upgrade; tests not run as a batch in this pass).

**Application code/config changes made by this audit:** none (documentation + helper artifact scripts under this folder only).
