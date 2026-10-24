# FILE INVENTORY — SITE SECURE

**Generated:** 2026-10-02  
**Machine CSV:** [FILE_INVENTORY.csv](./FILE_INVENTORY.csv) (2071 rows after AppleDouble filter)  
**Raw scan input:** `_audit_inventory_raw.csv` at repo root (audit helper; not product)  
**Exclusions policy:** [_exclusions.json](./_exclusions.json)

## 1. Scan scope

| Category | Count | Notes |
|----------|------:|-------|
| Indexed files (CSV) | 2071 | Excludes `node_modules`, `.git`, `dist`, venvs, caches, `_backup_vault`, `_qa_local_archive`, `Fintech App UI/`, `lottiefiles/`, `Images/`, `.external-reference/`, `._*` |
| In Git (among indexed) | 1427 | |
| Not in Git (among indexed) | 644 | Includes local `.env*`, many Docs QA PNGs, build leftovers, untracked docs assets |
| Excluded trees | See `_exclusions.json` | Not silently omitted — listed |

## 2. By file type (indexed)

| FileType | Count |
|----------|------:|
| asset_image | 825 |
| frontend_source | 453 |
| test | 196 |
| documentation | 143 |
| backend_source | 137 |
| config | 133 |
| sql | 89 |
| other | 48 |
| document_pdf | 32 |
| env | 6 |
| script | 6 |
| stylesheet | 3 |

**Note:** Docs QA folders contribute most PNGs. Binary image content was **not** semantically analyzed.

## 3. Top-level module buckets

| Module / top path | Approx files | Role |
|-------------------|-------------:|------|
| `Docs/` | 962 | Historical reports, QA snapshots, architecture notes |
| `apps/web` | (subset of apps 947) | SPA source, tests, scripts, public |
| `apps/api` | (subset) | FastAPI, tests, scripts |
| `supabase/` | 92 | Migrations, seed, RLS tests, config |
| `packages/*` | 32 | Shared libraries |
| `deploy/` | 4 | API Docker |
| Root configs | small | `package.json`, `vercel.json`, `render.yaml`, env templates |

## 4. Critical source files (non-exhaustive)

| Path | Role |
|------|------|
| `apps/api/app/main.py` | API app factory; router mount list |
| `apps/api/app/deps.py` | Auth user, authz context, entitlements RPC |
| `apps/api/app/authz/*` | Authorization engine |
| `apps/api/app/routers/*.py` | HTTP endpoints (some unwired — see API_REFERENCE) |
| `apps/web/src/routes/**` | File-based routes (71 `.tsx`) |
| `apps/web/src/lib/session.tsx` | Session provider |
| `apps/web/src/i18n/he.ts` | Primary app strings (Hebrew) |
| `packages/authz/catalog.json` | Roles, plans, permissions grants |
| `packages/types/src/database.ts` | Generated DB types (**stale vs migrations**) |
| `supabase/migrations/*.sql` | Schema + RLS + RPCs (87 files) |
| `.env.example` | Env **names** only |
| `vercel.json` / `render.yaml` | Deploy |

## 5. Per-directory notes

### `apps/web/src`
- `routes/` — TanStack file routes (auth, `/app/*`, `/admin/*`, portal, public quotes).
- `components/` — ~178 TS/TSX component files (count from scan).
- `lib/` — ~93 TS/TSX helpers (API wrappers, CCTV designer logic, auth helpers).
- `i18n/` — `he.ts` (app), `public-he.ts` / `public-en.ts` / `public.ts` (marketing), `legal-he.ts`.

### `apps/api/app`
- `routers/` — HTTP layer.
- Domain helpers: `quote_*`, `cctv_*`, `catalog_import/`, `documents/`, `system_designs/`, `ipam.py`, etc.
- Local artifacts under `apps/api/` (`_q00012_*.pdf/png`, `_rtl_*.pdf`) — QA leftovers; **POTENTIALLY UNUSED** in runtime; indexed if not excluded.

### `packages`
- `authz` — catalog + TS exports used by web; API loads JSON catalog.
- `api-client` — typed client surface.
- `ui` / `design-system` — shared UI/tokens.
- `types` — DB types (drift).

### `supabase`
- `migrations/` — chronological + timestamped migrations; includes duplicate number collision `0048_*` (two files).
- `seed/0001_dev.sql` — dev seed.
- `tests/rls_isolation.sql` — SQL RLS tests.
- `functions/` — edge functions if any (present in tree; detailed content review: partial).

### `Docs`
- Large historical documentation + QA PNG trees. Prior audits: `SITE_SECURE_CURRENT_STATE_AUDIT.txt`, `PRODUCT_STATUS_UNIFIED.md`. **Do not assume they match HEAD.**

## 6. Environment / secrets handling in inventory

Indexed `.env`, `.env.local`, `apps/web/.env*` may exist locally. **Values are never copied into this documentation.** Only names from `.env.example` are listed in DEPLOYMENT doc.

## 7. Integrity statement

Every non-excluded, non-AppleDouble file under the scan roots should appear in `FILE_INVENTORY.csv`. Excluded roots appear only in `_exclusions.json`. If a path is missing from both, that is a coverage defect — report in DOCUMENTATION_COVERAGE.md.

## 8. Helper artifacts in this folder (audit-only)

| File | Purpose |
|------|---------|
| `_generate_audit_artifacts.py` | Regenerates CSV + endpoint/table JSON |
| `_api_endpoints.json` | Endpoint extract |
| `_tables.json` | Tables from `database.ts` |
| `_tables_from_migrations.json` | Tables from `CREATE TABLE` |
| `_rpcs.json` / `_enums.json` | From `database.ts` |
| `_exclusions.json` | Exclusion policy |
| `_audit_inventory_raw.csv` | Repo-root raw list (companion) |
