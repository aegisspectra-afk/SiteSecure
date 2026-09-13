# FINAL EXTERNAL BETA SMOKE — GO / NO-GO

**Date (UTC):** 2026-09-11  
**External URL:** `https://site-secure-umber.vercel.app`  
**API:** `https://site-secure-api-staging.onrender.com`  
**QA run:** `6f789dd7` (disposable `@sitesecure.test` only)

---

## Deployment Identity

**PASS**

| Item | Value |
|---|---|
| Tag | `beta-0.1.5` |
| Commit | `dde129b48589db2a82eab4675c4e018cb74fc89d` |
| Deployment | `dpl_APAPuFbddnZvGrFTW9aWURCWqRE9` |
| Alias | `https://site-secure-umber.vercel.app` → same deployment |
| Bundle asset | `/assets/index-BflGOKlb.js` |
| APP_VERSION | `0.1.5-beta` only |

`TAGGED TREE == DEPLOYED TREE`

## HTTPS / Environment

**PASS**

- Valid HTTPS on web + API
- API external (Render), Supabase external (`rhxqqudlngimhplvndmz`)
- No LAN API; no localhost API base in live config
- No `service_role` / backup credentials / QA passwords in client bundle
- Anon client key present (expected)

## Registration

**PASS** — signup → confirm → login

## Workspace Creation

**PASS** — `Workspace Role = OWNER` (not technician). Platform admin = false.

## Clean Workspace

**PASS** — customers/sites/quotes/projects/catalog products all **0** at creation (no starter SKUs / seeded CCTV / foreign data).

## Dashboard

**PASS** — HTTP 200, Commercial Pulse/`summary` present, empty workspace safe.  
Timing (API): ~3.8s. UI shell→useful ~4.2s settle. Usable (not 13–19s blank).

## Customer / Site

**PASS** — create, persist, relationship OK.

## Document Durability

**PASS** (independent reprobe after harness classify bug on first pass)

- upload → Storage PUT → complete → URL → refresh/reopen
- Classification: **HEALTHY** (object present; not OBJECT_MISSING)
- No new complete-without-object defect observed on production

## Photo

**PASS** — owner upload/complete/URL; Storage object present.

## Quote Builder

**PASS** (create / line / persist / reopen). Item PATCH returned 403 in one harness path (P3/harness); create+persist OK.

## PDF

**PASS** — `%PDF` 200, ~30KB, customer quote generated.

## CCTV Empty Catalog

**PASS** — recommend 200, `blocking=True`, no invented priced SKUs.

## Catalog Isolation

**PASS** for tenant emptiness + workspace-owned add-one.  
**FAIL side-effect:** technician can list catalog prices (see commercial isolation).

## Technician Invite

**PASS** — invite `technician` 200; `founding_technician` rejected 403; accept success; membership role = technician; not platform admin.

## Technician Field Flow

**PASS with caveat** — assigned job visible; after **site** assignment, photo upload/complete/URL works.  
Job-only assignment initially returned `SCOPE_DENIED` for site document upload (P2 if UI does not also assign site).

## Technician Scope

**PASS** — sees assigned job; unassigned job hidden; direct unassigned → 404; no stack leak.

## Technician Commercial Isolation

**FAIL — P1**

| Check | Result |
|---|---|
| GET `/quotes` as technician | **200**, returns owner quote list row |
| GET `/quotes/{id}` | 403 (detail blocked) |
| POST quote | 403 |
| GET `/catalog/products` | **200**, returns product with `list_price` |
| POST catalog product | 403 |

Role grants in DB include `quotes.view` + `catalog.view` for `technician`. List endpoints expose commercial summary/pricing. Canonical Private Beta expectation was deny/hide.

## Tenant Isolation

**PASS** — cross-workspace Customer/Site/Job/Quote/Document → 404.

## Platform Admin Isolation

**PASS** — owner + technician `is_platform_admin=false`; admin overview denied for tech.

## Beta Participant Model

**PASS (structural)** — Owner ≠ technician; platform admin false; badge ≠ platform admin.  
Beta participant row **absent until platform enroll** (expected ops step; layers remain independent).

## Feedback Center

**PASS** — bug submission + list retrieval.

## Password Recovery

**PASS** — recover accepted (or rate-limited 429); admin generate_link redirect targets production `/reset-password` (no localhost).

## Session / Logout

**PASS** — logout→login, relogin, session OK (UI + API).

## Network Recovery

**PASS** — offline/online reload recovers (Playwright).

## Mobile

**PASS** — 390px no horizontal overflow; login/app usable in smoke.

## Error Experience

**PASS** — no stack traces / blank dashboard / false success observed in exercised paths.

## Pre-Beta Backup

| Item | Value |
|---|---|
| FULL backup id | `20260911T130434Z` |
| `last_backup_ok` | **true** |
| DB | PASS |
| Storage objects | 31 (~838KB) |
| `error_count` | 0 |

### PRE-BETA BASELINE

```text
APP_VERSION: 0.1.5-beta
TAG: beta-0.1.5
COMMIT: dde129b48589db2a82eab4675c4e018cb74fc89d
DEPLOYMENT: dpl_APAPuFbddnZvGrFTW9aWURCWqRE9
DB BACKUP: PASS
STORAGE BACKUP: PASS
TIMESTAMP: 2026-09-11T13:07:52Z
BACKUP_ID: 20260911T130434Z
```

## Backup Operator State

**PASS** — `Docs/BETA_BACKUP_OPERATOR_CHECKLIST.md` matches live mode: **daily operator-run** (not automated). Status shows last success, age, db_ok, storage counts.

## Performance

| Area | Approx | Class |
|---|---|---|
| Login / web | usable | usable |
| Dashboard API | ~3.8s | usable |
| Customer/Site/Quote | ~2–3s each | usable |
| Document upload | usable on reprobe | usable |
| Full backup | ~3.5 min | ops OK |

## Defects

| Sev | Item |
|---|---|
| **P1** | Technician commercial isolation incomplete: quote **list** + catalog **list/prices** readable despite field-only contract |
| P2 | Technician site document upload after job-only assign → `SCOPE_DENIED` until explicit site assignment |
| P3 | Quote item PATCH 403 in one API shape / harness path; UI re-login fill flake in first Playwright pass (follow-up PASS) |

**P0 = 0**  
**Unresolved P1 = 1** → blocks GO

## Pilot Decision

**NO-GO** for first 3–5 external technicians until technician commercial list isolation matches canonical deny/hide (quotes + catalog).

Unlock:

1. Fix technician `quotes.view` / `catalog.view` exposure (role grants and/or list authorization) so commercial lists are 403 or empty-without-data per product contract  
2. Re-verify technician GET quotes/catalog on production  
3. Re-run this smoke commercial section only (full matrix optional)

---

## Final verdict

**CONTROLLED PRIVATE BETA NO-GO — EXTERNAL BLOCKER REMAINS**
