# BETA 0.1.5 — Candidate Cut + External Readiness

**Date (UTC):** 2026-09-11  
**Final verdict:** **BETA 0.1.5 EXTERNAL READINESS FAIL — PRIVATE BETA BLOCKED**

Candidate **cut and tagged** successfully. External invite remains blocked: production deploy of `beta-0.1.5` could not be authorized from this environment (`vercel deploy --prod` → Not authorized). Therefore `TAGGED TREE == DEPLOYED TREE` is **not** proven.

---

## Runtime Fix

`apps/api/app/routers/documents.py`

- `complete_upload` requires Storage object (`storage_object_size`); else cleanup + `409 STORAGE_OBJECT_MISSING`
- `document_url` refuses incomplete (`byte_size` null) **and** completed-but-missing binaries (no fake signed URL)

Invariant: complete ⇒ object exists ⇒ downloadable; incomplete ⇒ not downloadable.

## Failure Matrix

Unit: `tests/test_documents_durability.py` — **6 passed**  
Live: `beta_015_durability_matrix.py` — **all A–H + backup regression PASS**

| Check | Result |
|---|---|
| A complete with object | PASS |
| B complete without object | PASS (409) |
| C incomplete download | PASS (409) |
| D download after complete | PASS |
| E cross-workspace | PASS |
| F tech quotes denied | PASS |
| G tech unassigned doc | PASS |
| H path bound to DB row | PASS |
| Backup regression meta+binary | PASS |

## Storage Reconciliation

`reconcile_015.json` (post-matrix):

| Class | Count |
|---|---|
| HEALTHY | 22 |
| QA_FIXTURE | 42 |
| METADATA_ONLY_BY_DESIGN | 2 |
| OBJECT_MISSING | 2 |
| Total | 68 |

No new unexplained lifecycle breaks from the fix. Fixtures still classified.

### Historical OBJECT_MISSING (not deleted)

| ID (sanitized) | Kind | Note |
|---|---|---|
| `a7815481-…` | signature | Historical completed orphan (P2 cleanup) |
| `3f4dd535-…` | document | Gate10B intermediate leftover; download now returns 409 |

## Runtime Commit

`8b8d5bd11ec0f4746d57b765730e2afddef978fe` — fix(documents)…

## Operational Backup Commit

`645092c63b28573087b7c84b76818c9df90a4566` — ops(durability)…

## Version

`dde129b48589db2a82eab4675c4e018cb74fc89d` — `APP_VERSION = 0.1.5-beta`

## Tests

- API unit (durability + authz + dashboard + domain + platform_admin): **29 passed** earlier; durability **6 passed** at cut
- Web typecheck: PASS  
- Web production build: PASS  
- Vitest dashboard/feedback/auth: PASS (prior run in session)  
- Core smoke (owner upload/quote/cctv/pdf + tech commercial deny): **OK True**

## Core Smoke

Owner login → dashboard → customer/site → upload/complete/download → quote → cctv → pdf: **PASS** (local API :8010)  
Technician quotes/catalog deny: **PASS**

## Backup Regression

Scoped upload → backup → poison → restore → metadata+binary: **PASS**

## Backup Status

At cut: `last_backup_ok=true`, id `20260911T121302Z_ws1` (matrix-scoped; overwrote LAST_STATUS).  
Earlier full vault still present: `20260911T120312Z` (22 objects).  
Operator checklist: `Docs/BETA_BACKUP_OPERATOR_CHECKLIST.md`

## Candidate Integrity

Tracked working tree clean at tag (untracked QA/archives remain; do not affect build).  
`SOURCE/TESTED/CANDIDATE` = `dde129b` / `0.1.5-beta`

## Tag

`beta-0.1.5` → `dde129b48589db2a82eab4675c4e018cb74fc89d`

## beta-0.1.4

Unchanged: `88c976e92e1257e9b60e7316bb09c8c38b7b7544`

## External URL

Configured/stable target observed: **https://site-secure-umber.vercel.app** (Vercel project `site-secure`).  
HTTPS login page loads. Not localhost/LAN/tunnel.

## Deployment

**FAIL** — `npx vercel deploy --prod --yes` → **Not authorized**.  
Deployed tree **not** verified as `beta-0.1.5`.

## HTTPS / Environment / External flows

| Item | Result |
|---|---|
| HTTPS (URL exists) | PASS (site responds) |
| Environment security (deployed 0.1.5) | **NOT VERIFIED** (not deployed) |
| Registration / new workspace / external docs/photo | **NOT RUN** on deployed 0.1.5 |
| CCTV empty / tech external / tenant / platform admin | **NOT RUN** on deployed 0.1.5 |
| Beta participant model | Architecture unchanged; **NOT re-verified externally** |

## Feedback Channel

In-app feedback center exists (`feedbackOpen` / feedback types bug|feature|general) — **available in product**. Also `support@aegis-spectra.com` in legal copy.

## Backup Operator Procedure

`Docs/BETA_BACKUP_OPERATOR_CHECKLIST.md` + `Docs/RECOVERY_RUNBOOK.md`

## Defects

| Sev | Item |
|---|---|
| **P0** | Cannot deploy `beta-0.1.5` from this agent session (Vercel auth) → external Beta blocked |
| P2 | 2 historical OBJECT_MISSING rows retained (download hardened to 409) |
| P2 | LAST_STATUS overwritten by scoped matrix backup; operators should prefer full daily vault |

## Pilot Recommendation

**NO-GO** for 3–5 technicians until:

1. Authorized production deploy of `beta-0.1.5` (`dde129b`)
2. External smoke sections 18–25 completed against that deploy

---

## Final verdict

**BETA 0.1.5 EXTERNAL READINESS FAIL — PRIVATE BETA BLOCKED**
