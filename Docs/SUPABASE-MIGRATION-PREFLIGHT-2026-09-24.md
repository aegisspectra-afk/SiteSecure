# SUPABASE MIGRATION PREFLIGHT — 2026-09-24

**Mode:** READ-ONLY verification  
**Migrations applied in this pass:** **NONE**  
**Database mutations:** **NONE**  
**Secrets printed:** **NONE**

**Source of concern:** `Docs/SITE-SECURE-MASTER-PROJECT-BASELINE.md` — migrations `0052` / `0054` / `0055` / `0056` in repo, previously not confirmed live.

---

## 1. Connection status

| Check | Result |
|-------|--------|
| Supabase CLI installed (npx) | Yes — CLI **v2.117.0** via `npx` (system `supabase` binary: not on PATH) |
| CLI authenticated (`supabase login` / `SUPABASE_ACCESS_TOKEN`) | **No** — `LegacyPlatformAuthRequiredError` |
| Repo CLI-linked (`supabase link`) | **No** — `supabase/.temp` has only `cli-latest`; no project-ref link file |
| `supabase/config.toml` | Present — local `project_id = "site-secure-v2"` (name label, not cloud ref) |
| Supabase MCP authenticated | **Yes** (this session) |
| Remote reachable via MCP | **Yes** |
| App `.env` `SUPABASE_URL` host ref | `rhxqqudlngimhplvndmz` (matches active project) |
| `DATABASE_URL` / direct Postgres URL in env | **Absent** |

**Summary:** MCP read access works. CLI is **not** logged in / not linked. Do not use CLI push until login+link after explicit approval.

---

## 2. Target environment identity

| Field | Value |
|-------|-------|
| Cloud project name | **SiteSecureV1** |
| Project ref | `rhxqqudlngimhplvndmz` |
| Status | `ACTIVE_HEALTHY` |
| Region | `ap-northeast-1` |
| Postgres | 17.6.x |
| Matches repo `.env` URL | **Yes** |
| Other org projects | `Site Secure MVP` (INACTIVE), `SiteSecureV1-Gate10B-Recovery` (INACTIVE), personal inactive project |

**Environment classification:** **PRIMARY / PRODUCTION-LIKE**

Rationale:

- Only **ACTIVE_HEALTHY** project named SiteSecureV1  
- Same ref as prior durable CCTV verification docs  
- Holds substantial live-ish data (e.g. quotes ~872, customers ~673, products ~5k)

**Not labeled** “staging” in Supabase metadata. Treat as **production tenant database** for migration risk.

**Identity confidence:** HIGH (not UNKNOWN). Proceeding with read-only analysis is allowed.

---

## 3. Local migration inventory (critical window)

Local folder: `supabase/migrations/` — **66 files**.

### Sequence around 0051–0056

| Order | Filename | Purpose | Depends on |
|-------|----------|---------|------------|
| … | `0051_job_dispatch_lifecycle.sql` | Job dispatch lifecycle | jobs/assignments |
| **1 pending** | `0052_assignment_history.sql` | Soft-close assignments (`unassigned_at`/`unassigned_by`); partial unique; rewrite `auth_assigned` / `auth_site_visible` | `assignments`, profiles |
| **2 pending** | `0053_service_call_numbers.sql` | `service_calls.number` + backfill + NOT NULL + unique + trigger | `service_calls`, `next_code` |
| **3 pending** | `0054_system_designs.sql` | R1 tables `system_designs` + `system_design_components`, RLS, `system_design_quote_visible` | `quotes`, `workspaces`, `sites` |
| **4 pending** | `0055_system_design_apply_owned.sql` | R3 RPC `system_design_apply_owned(...)` SECURITY DEFINER | **0054 tables** |
| **5 pending** | `0056_system_design_equipment_intent.sql` | Additive `equipment_intent jsonb` on components | **0054 components table** |

### Migrations AFTER 0056 (local)

None with higher numeric prefix. Remaining files are **timestamp-prefixed historical** migrations (CPQ, catalog import, badges, FT retirement) that appear **already applied** remotely under timestamp versions.

**Important:** Local numbered files (`0052_…`) vs remote timestamp versions (`20260913211416_0051_…`) — history naming differs, but **content mapping by migration name suffix is clear**.

---

## 4. Remote migration history

Source: MCP `list_migrations` + `SELECT … FROM supabase_migrations.schema_migrations`.

**Latest remote applied:**

| Version | Name |
|---------|------|
| `20260913211416` | `0051_job_dispatch_lifecycle` |

Immediately prior: `v3_capabilities_registry`, technician isolation, sites lat/long, etc.

**Remote does NOT contain** (by name):

- `0052_assignment_history`
- `0053_service_call_numbers`
- `0054_system_designs`
- `0055_system_design_apply_owned`
- `0056_system_design_equipment_intent`

---

## 5. Exact pending migrations

| Local file | Remote status | Schema objects today |
|------------|---------------|----------------------|
| `0052_assignment_history.sql` | **PENDING** | `unassigned_at` **absent** |
| `0053_service_call_numbers.sql` | **PENDING** | `service_calls.number` **absent** |
| `0054_system_designs.sql` | **PENDING** | tables **absent** |
| `0055_system_design_apply_owned.sql` | **PENDING** | RPC **absent** |
| `0056_system_design_equipment_intent.sql` | **PENDING** | column **absent** |

**Pending count in critical path: 5** (includes **0053**, not only the four named in the baseline concern).

---

## 6. Schema object verification (read-only)

| Object | Exists remotely? |
|--------|------------------|
| `assignments.unassigned_at` | **No** |
| `assignments.unassigned_by` | **No** |
| Index `assignments_active_unique` | **No** |
| Current hard unique on assignments | **Yes** — `assignments_workspace_id_user_id_resource_type_resource_id_key` |
| `public.system_designs` | **No** |
| `public.system_design_components` | **No** |
| `system_design_components.equipment_intent` | **No** |
| Function `public.system_design_apply_owned` | **No** |
| `service_calls.number` | **No** |

This matches prior `PGRST205` / `PGRST202` reports.

---

## 7. Drift findings

| Pattern | Finding |
|---------|---------|
| A. Not recorded + objects absent | **YES — all five pending** |
| B. Not recorded + objects already exist | **NO** |
| C. Recorded + objects exist | N/A for these five |
| D. Recorded + objects missing | **NO** |

**Additional history note (non-blocking for object drift):**

- Remote has `sites_latitude_longitude` — not present as an identically named local file in the numeric series (may exist elsewhere / applied out-of-band).  
- Remote has split/renamed historical migrations vs local filenames.  
- This is **migration-history naming drift**, not schema conflict with 0052–0056 objects.

**Classification for 0052–0056:** clean Case **A** — safe to apply in order **after** operator preconditions.

---

## 8. Migration dependency graph

```text
0051 (APPLIED remotely)
  └─► 0052 assignment history
        └─► (Dashboard/Today/auth_assigned consumers)
  └─► 0053 service call numbers   [independent of 0052; after 0051]
        └─► 0054 system_designs (R1)
              └─► 0055 system_design_apply_owned (R3)  [REQUIRES 0054]
                    └─► 0056 equipment_intent         [REQUIRES 0054]
```

**Do not** skip 0053. **Do not** run 0055/0056 before 0054.

---

## 9. Risk assessment per pending migration

| Migration | Risk | Why |
|-----------|------|-----|
| **0052** | **MEDIUM** | Drops existing UNIQUE constraints on `assignments`; replaces with **partial** unique (`WHERE unassigned_at IS NULL`); **CREATE OR REPLACE** `SECURITY DEFINER` helpers `auth_assigned` / `auth_site_visible`. No TRUNCATE/DELETE of rows. Lock risk low (11 assignment rows). |
| **0053** | **MEDIUM** | Backfill UPDATE all service_calls; then `SET NOT NULL`; unique `(workspace_id, number)`; SECURITY DEFINER trigger. Only **3** rows today — low failure probability, but NOT NULL is irreversible without column drop. |
| **0054** | **MEDIUM–HIGH** | New tables + FORCE RLS + SECURITY DEFINER visibility helper + grants. Additive schema; no data rewrite. High product impact if wrong, but reversible by drop (destructive). |
| **0055** | **HIGH** | Large `SECURITY DEFINER` Apply RPC; can `DELETE FROM quote_items` **at runtime** when Apply runs (not at migrate time). `CREATE OR REPLACE` + GRANT to `authenticated`. Must keep pricing in Python (already designed). |
| **0056** | **LOW** | Additive nullable `jsonb` column + comment. `IF NOT EXISTS`. |

**No pending migration contains:** `TRUNCATE`, bare `DELETE FROM` at migrate-time (0055 delete is inside function body), column type change of existing money columns, or mass product/quote rewrites.

---

## 10. Existing-data compatibility (read-only)

| Check | Result |
|-------|--------|
| `assignments` row count | **11** |
| Duplicate groups on `(workspace_id, user_id, resource_type, resource_id)` | **0** — 0052 unique rewrite should succeed |
| `service_calls` row count | **3** — 0053 backfill feasible |
| `service_calls.number` | Column absent — backfill path will create values |
| Live quotes (for later R3 usage) | **821** `deleted_at IS NULL` — no migration conflict |
| Jobs | **28** — unaffected by DDL |

**No evidence of constraint failure for 0052/0053** on current counts.

0054/0055/0056 create empty structures — no existing Design rows to conflict.

---

## 11. Backup / recovery readiness

| Item | Status |
|------|--------|
| Supabase plan PITR | **UNKNOWN** from this pass (org historically Free / logical vault per Gate 10B docs) |
| Operator logical vault | Present under `_backup_vault/` |
| Last successful vault | `20260913T181710Z` — `last_backup_ok: true` |
| Age | **~11 days** (as of 2026-09-24) — **STALE vs daily checklist** |
| Gate 10 policy | Backup before risky migrations; refresh if age > ~24h |
| Reversibility | 0056 easy reverse; 0052/0053/0054/0055 **not trivially reversible** without careful down migrations |

**Before ANY apply:** run fresh `logical_backup.py` (or equivalent verified checkpoint) and confirm `last_backup_ok: true`.

---

## 12. Proposed execution sequence (DO NOT RUN YET)

Preconditions for every step:

1. Explicit human approval for **SiteSecureV1** (`rhxqqudlngimhplvndmz`)  
2. Fresh logical backup OK  
3. Apply method chosen (MCP `apply_migration` **or** CLI after `supabase login` + `link`)  
4. Maintenance window / low field activity  

| Step | Migration | Precondition | Expected change | Post-check | Recovery note |
|------|-----------|--------------|-----------------|------------|---------------|
| 1 | `0052_assignment_history` | 0051 applied; backup OK | `unassigned_at`/`unassigned_by`; partial unique; auth helpers | §13 A–B | Restore from vault / recreate hard unique if needed (hard) |
| 2 | `0053_service_call_numbers` | backup OK | `number` filled + NOT NULL + unique + trigger | service_calls.number not null | Drop column/trigger (ops) |
| 3 | `0054_system_designs` | backup OK | tables + RLS + helper | §13 C–F | DROP tables (destroys Design data only) |
| 4 | `0055_system_design_apply_owned` | **0054 live** | RPC `system_design_apply_owned` | §13 I–L | DROP FUNCTION |
| 5 | `0056_system_design_equipment_intent` | **0054 live** | `equipment_intent` column | §13 M–N | DROP COLUMN |

**Exact order is confirmed:** `0052 → 0053 → 0054 → 0055 → 0056`  
(0053 can theoretically swap with 0052; keep numeric order for history clarity.)

---

## 13. Post-deploy verification checklist

| ID | Check |
|----|-------|
| A | `assignments.unassigned_at` exists |
| B | Dashboard/Today assignment filters (`unassigned_at is.null`) succeed (no 400) |
| C | `system_designs` selectable (service + authenticated member) |
| D | `system_design_components` selectable |
| E | RLS: member of WS A cannot read WS B Designs |
| F | R1 CRUD create/list/patch/soft-delete |
| G | Revision CAS → 409 on stale revision |
| H | R2 CCTV hydrate/persist round-trip |
| I | `system_design_apply_owned` exists in `pg_proc` |
| J | Atomic Apply inserts owned catalog lines |
| K | `quote_item_id` ownership linkage |
| L | Divergence confirmation path |
| M | `equipment_intent` persists jsonb |
| N | E2 hydrate/recalculate without inventing product_id |
| O | Quote pricing recalculate still correct |
| P | Share/Send/PDF snapshot paths unchanged |
| Q | Technician commercial deny still holds |

---

## 14. Automated test results (local)

| Suite | Result |
|-------|--------|
| Web: E1/E2, CCTV sizing/persistence, Quote Builder, structural stages, dashboard | **137 passed** |
| API: R1, R3 Apply, CCTV recommend/sizing parity, pricing, A3 outbound, job lifecycle | **98 passed** |
| `tsc --noEmit` + production `npm run build` (web) | **Pass** |

No code changes made to force green.

---

## 15. GO / NO-GO recommendation

### **NO-GO for migration execution right now**

| GO criterion | Met? |
|--------------|------|
| Target environment known | **Yes** — SiteSecureV1 / `rhxqqudlngimhplvndmz` |
| Remote migration history readable | **Yes** |
| Pending migrations unambiguous | **Yes** — five files, Case A |
| No unexplained object drift (B/D) | **Yes** |
| Ordering clear | **Yes** |
| Existing data appears compatible | **Yes** |
| No unexpected migrate-time destructive ops | **Yes** (with noted MEDIUM/HIGH risks) |
| Relevant regression tests pass | **Yes** |
| Recovery/backup position ready | **No** — last vault **stale (~11 days)**; PITR **UNKNOWN**; CLI not linked |

**Also by task rule:** even a green preflight must **not** apply migrations until a separate explicit approval.

### What must be resolved before GO-to-execute

1. Fresh logical backup (Gate 10 checklist) — confirm `last_backup_ok`  
2. Explicit written approval naming project **SiteSecureV1** / ref `rhxq…`  
3. Choose apply channel (MCP vs CLI login+link)  
4. Operator available for post-checks A–Q  

### Preflight analytical quality

Schema/history analysis is **sufficient and trustworthy**. The blocker is **operational readiness**, not unknown drift.

---

## Appendix — Comparison to prior baseline claim

| Claim | Preflight 2026-09-24 |
|-------|----------------------|
| 0052 undeployed | **Confirmed** |
| 0054/0055 undeployed | **Confirmed** |
| 0056 undeployed | **Confirmed** |
| Also pending 0053 | **Newly explicit** — must run before/with the Design chain |
| Objects already secretly present | **Falsified** — all absent |

---

## Confirmation

**NO DATABASE CHANGES WERE MADE.**  
**NO MIGRATIONS WERE APPLIED.**  
**NO `db push` / repair / reset was run.**  
**NO secrets were printed.**
