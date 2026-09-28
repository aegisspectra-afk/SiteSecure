# SITE SECURE — Supabase Migration Deployment Report

**Date:** 2026-09-24  
**Mode:** Controlled production-like database deployment (migration-by-migration)  
**Channel:** MCP `apply_migration`  
**Operator:** Cursor agent under explicit user approval  

---

## Target

| Field | Value |
|-------|-------|
| Project name | SiteSecureV1 |
| Project ref | `rhxqqudlngimhplvndmz` |
| Region | ap-northeast-1 |
| Status at start | ACTIVE_HEALTHY |

---

## Backup

| Field | Value |
|-------|-------|
| Backup id | `20260924T160516Z` |
| Path | `_backup_vault/20260924T160516Z/` |
| Manifest | ok |
| Host match | `rhxqqudlngimhplvndmz.supabase.co` |
| Size (approx) | ~37.7 MB |
| Backup completed (UTC) | 2026-09-24T16:08:33Z |
| PITR | Unavailable / unknown (Free plan) |

Checkpoint 0 reconfirmed backup artifact before first mutation.

---

## Migration heads

| Point | Head |
|-------|------|
| START | `0051_job_dispatch_lifecycle` |
| END | `0056_system_design_equipment_intent` |

Applied only: **0052 → 0053 → 0054 → 0055 → 0056**. No later migrations. No repair. No reset.

Remote history versions recorded:

| Version | Name |
|---------|------|
| 20260924161151 | `0052_assignment_history` |
| 20260924161308 | `0053_service_call_numbers` |
| 20260924161348 | `0054_system_designs` |
| 20260924161752 | `0055_system_design_apply_owned` |
| 20260924162200 | `0056_system_design_equipment_intent` |

---

## Checkpoint 0 — PASS

- Project name = SiteSecureV1  
- Project ref = rhxqqudlngimhplvndmz  
- Remote head = `0051_job_dispatch_lifecycle`  
- Backup `20260924T160516Z` present, MANIFEST ok, host match  

---

## 0052 — `assignment_history` — PASS

**Apply:** MCP `apply_migration` → success  

**Verified:**

1. Migration recorded  
2. `assignments.unassigned_at` / `unassigned_by` exist (timestamptz / uuid, nullable)  
3. Assignment rows readable; total **11** (matches backup `assignments.jsonl` line count)  
4. No row loss  
5. Indexes: `assignments_active_unique`, `assignments_active_resource_idx`  
6. Active query (`unassigned_at IS NULL`) works — 11 active, 0 historical  
7. Historical filter path queryable  
8. `auth_assigned` / `auth_site_visible` SECURITY DEFINER, `search_path=public`, filter `unassigned_at IS NULL` (scope not broadened)  
9. RLS policies on `assignments` intact (`select` / managerial write/update/delete)  

**Narrow live smoke:** PostgREST active-assignment select OK; dashboard endpoint 200 for owner workspace.

---

## 0053 — `service_call_numbers` — PASS

**Apply:** success  

**Verified:**

1. Migration recorded  
2. `service_calls.number` text NOT NULL  
3. All **3** existing service calls present (matches backup)  
4. Values: `SR-00001`, `SR-00001` (other workspace), `SR-00002` — valid `SR-#####`  
5. Unique per `(workspace_id, number)` — no duplicate violation  
6. Index `service_calls_workspace_number_uidx`; trigger `service_calls_set_number`; function SECURITY DEFINER + `search_path=public`  
7. Reads OK  

No new business service-call records created for testing.

---

## 0054 — `system_designs` — PASS

**Apply:** success  

**Verified:**

1. Migration recorded  
2. Tables `system_designs`, `system_design_components` exist  
3. Expected columns / CHECKs / PKs / FKs / indexes present  
4. RLS enabled + **FORCE RLS** on both tables  
5. Policies: designs select/insert/update/delete; components select + write(ALL)  
6. Helper `system_design_quote_visible` SECURITY DEFINER, `search_path=public`  
7. Cross-workspace: user A cannot read Design planted in Workspace B (empty under RLS)  
8. Live API: create Design 200; soft-delete 200; PostgREST component insert + revision CAS (update where revision=N) OK  

**Note (resolved by 0056):** Immediately after 0054 only, API GET/PATCH selected `equipment_intent` (app already E2-aware) → PostgREST 42703 mapped to BUSINESS_RULE. After 0056, full R1 API CRUD + CAS verified (see below).

---

## 0055 — `system_design_apply_owned` — PASS (high-risk)

**Apply:** success  

### Database object

| Check | Result |
|-------|--------|
| Recorded | Yes |
| Function | `system_design_apply_owned(...)` exact 11-arg signature |
| SECURITY DEFINER | Yes |
| Owner | `postgres` |
| `search_path` | `{search_path=public}` |
| REVOKE FROM PUBLIC | Intended; PUBLIC execute false for privilege check pattern |
| GRANT authenticated | Yes |
| anon EXECUTE | Present via Supabase default privileges (same pattern as `auth_assigned` / `auth_is_member`) |
| Anon call (Bearer anon) | **UNAUTHENTICATED** (auth.uid() null) |

### Tenant isolation / authz

| Probe | Result |
|-------|--------|
| Non-member (phase3.b) Apply on owner Design | **PERMISSION_DENIED** |
| Wrong `p_actor_id` ≠ auth.uid() | **PERMISSION_DENIED** |
| RPC membership gate | `auth_is_member` required |
| quotes.edit | Enforced on API Apply path; RPC itself checks membership + actor (as designed in migration) |

### Functional R3 (controlled smoke — ephemeral product + Design on draft Q-00055)

| Step | Result |
|------|--------|
| Design → component with catalog product → Apply | OK (`inserted: 1`) |
| `quote_item_id` / `applied_product_id` / qty / fingerprint / `last_apply_id` | Linked |
| Design `current_apply_id`, `apply_fingerprint`, `lifecycle_status=applied`, revision++ | OK |
| Money on line from priced `p_lines` | unit_price 150, cost 60, line_net 300 |
| Re-Apply | `deleted: 1`, `inserted: 1`; quote item count stable (no blind append) |
| Stale revision | **REVISION_CONFLICT** |
| Diverged owned qty without confirm | **DIVERGED** |
| Intent-only Apply | Not tested here (E3); separately blocked after 0056 |

**Cleanup:** Design, components, owned quote items, ephemeral `DEPLOY-SMOKE-*` product removed. Final `system_designs` count = 0; no smoke products left.

**Unit:** `tests/test_system_designs_r3_apply.py` + R1 → **42 passed**.

---

## 0056 — `system_design_equipment_intent` — PASS

**Apply:** success  

**Verified:**

1. Migration recorded  
2. `system_design_components.equipment_intent` **jsonb**, nullable  
3. Existing components remain valid (0 rows at verify time)  
4. Live API: persist manufacturer / model_reference / display_description / selected_attributes  
5. Reload/hydration returns same intent  
6. Commercial keys rejected (`product_id` → VALIDATION_ERROR) — no fabricated product/SKU/cost/price  
7. Intent-only Apply → VALIDATION_ERROR “אין רכיבים נבחרים להחלה” (**expected; E3 NOT STARTED**)  
8. Full R1 after 0056: CREATE/GET/PATCH/CAS(409)/DELETE all via real API  

---

## Full live verification summary

| Area | Result | Notes |
|------|--------|-------|
| Field / assignments | **PASS (schema + query)** | 11/11 active; dashboard 200; technician Today UI not browser-automated this session |
| Service numbers | **PASS** | All 3 calls numbered; unique per workspace |
| R1 | **PASS (live API)** | CRUD, components, revision CAS, soft-delete, RLS |
| R2 | **PASS (API persistence)** | requirements / engineering_result / recommendation_meta / components persisted + reloaded; full System Builder UI reopen not browser-automated |
| R3 | **PASS (RPC + semantics)** | Apply, ownership, fingerprint, re-Apply, conflict, diverge; confirmation-token UI flow not separately UI-tested |
| E2 | **PASS (live API + units)** | Persist/reload/reject commercial; intent-only Apply blocked |
| Quote commercial | **PASS (smoke)** | List + open draft Q-00055; free line add/remove 200; cross-workspace quote GET → 404 |
| RLS | **PASS** | Cross-ws Design deny; anon designs empty; FORCE RLS on Design tables |
| Authz | **PASS (probed)** | Cross-ws quote deny; Apply membership/actor deny; quotes.view/edit paths exercised |

---

## Automated regression

Pre-deploy baseline (from readiness/preflight): Web **137**, API **98** (focused suite selection).

Post-deploy (exact suites):

| Suite | Result |
|-------|--------|
| Focused API (R1/R3, CCTV recommend, pricing, A3/share/public, job lifecycle, dispatch, authorize, authz_scope) | **139 passed** |
| Focused web (E1/E2, quote builder/stages/structural/lifecycle/lines/mobile/apply, dashboard, workspace-header) | **161 passed** |
| Full web `vitest run` | **439 passed** (59 files) |
| `tsc --noEmit` | **PASS** (exit 0) |
| Production `npm run build` (web) | **PASS** |
| Naive `pytest` all API tests | Collection error on `test_pdf_studio_verification.py` (missing `pypdf` in portable toolchain) — **not** used as baseline comparator |

Count deltas vs 137/98 reflect **suite selection expansion**, not regressions.

---

## Status changes (baseline)

See `Docs/SITE-SECURE-MASTER-PROJECT-BASELINE.md` updates:

| Item | Prior | After this deploy |
|------|-------|-------------------|
| 0052 assignment history | Often undeployed / Field BLOCKED | **Deployed + schema verified** — assignment schema blocker **CLOSED** |
| 0053 service numbers | Pending | **Deployed + verified** |
| R1 | CODE COMPLETE / PROD BLOCKED | **CODE COMPLETE / PRODUCTION VERIFIED (live API)** |
| R2 | BLOCKED on R1 | **CODE COMPLETE / PRODUCTION VERIFIED (API persistence path)** |
| R3 | CODE COMPLETE / PROD BLOCKED | **CODE COMPLETE / PRODUCTION VERIFIED (RPC semantics)** |
| E2 | CODE COMPLETE / PROD BLOCKED | **CODE COMPLETE / PRODUCTION VERIFIED (live API)** |
| E3 | NOT STARTED | **NOT STARTED** (unchanged) |

---

## Remaining blockers

1. **E3** — Intent-only Apply still unsupported (expected).  
2. Full browser E2E of System Builder reopen / technician Today UI / Quote Stage 2–4 PDF share journey — not claimed as automated browser proof in this report.  
3. `system_design_apply_owned` EXECUTE also visible to `anon` via platform default privileges; function rejects null `auth.uid()`. Same pattern as other auth helpers — not patched in this deploy (no manual privilege surgery authorized).

---

## Test data created / removed

| Object | Action |
|--------|--------|
| Ephemeral products `DEPLOY-SMOKE-*` | Created then deleted |
| Ephemeral system designs / components / owned quote items on draft Q-00055 | Created then deleted |
| Temporary Design for RLS cross-ws probe | Inserted via service role then deleted |
| Real customer Quotes | Not Send/Approve/Revise mutated; one free line briefly added and removed on Q-00055 |

---

## Absolute constraints honored

- No batch opaque multi-migration apply  
- No migration repair / reset / manual schema edits  
- No automatic rollback  
- No E3 implementation  
- No Product Completion Plan started  

---

## Final verdict

**All five approved migrations are deployed and checkpoint-verified on SiteSecureV1 / rhxqqudlngimhplvndmz.**  
Remote head: **`0056_system_design_equipment_intent`**.
