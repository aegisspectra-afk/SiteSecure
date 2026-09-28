# SUPABASE MIGRATION DEPLOYMENT READINESS — 2026-09-24

**Mode:** Backup / recovery gate  
**Migrations applied in this pass:** **NONE**  
**Schema mutations:** **NONE**  
**Prerequisite:** `Docs/SUPABASE-MIGRATION-PREFLIGHT-2026-09-24.md`

---

## Executive result

| Item | Value |
|------|-------|
| **TARGET** | SiteSecureV1 (`rhxqqudlngimhplvndmz`) — PRIMARY / PRODUCTION-LIKE |
| **REMOTE HEAD** | `0051_job_dispatch_lifecycle` (`20260913211416`) — **unchanged** |
| **BACKUP** | Fresh logical vault **`20260924T160516Z`** created successfully |
| **BACKUP VERIFIED** | **Yes** — `MANIFEST.ok=true`, core tables present, non-empty |
| **PITR** | **UNKNOWN / unavailable on Free** — org plan = `free` / `tier_free`; no branches |
| **RECOVERY PLAN** | Logical vault restore (scoped) per `Docs/RECOVERY_RUNBOOK.md`; full wipe of live project **not** default |
| **EXECUTION CHANNEL** | **B — authenticated MCP `apply_migration`** (preserves history, ordered, no CLI login required). CLI link optional later. |
| **PENDING** | 0052 → 0053 → 0054 → 0055 → 0056 |
| **RISK** | MEDIUM / MEDIUM / MEDIUM–HIGH / **HIGH** / LOW |
| **READINESS** | **READY FOR EXPLICIT DEPLOYMENT APPROVAL** |

**This document does not authorize execution.** Wait for a separate explicit approval message before applying any migration.

---

## 1. Backup capabilities (established facts)

| Capability | Finding | Confidence |
|------------|---------|------------|
| Org subscription plan | **Free** (`tier_free`) via MCP `get_organization` | HIGH |
| Supabase Dashboard automatic daily backups / PITR | **Not evidenced** on Free; docs historically say Free relies on logical vault | **UNKNOWN as product feature; treat as unavailable** |
| On-demand physical backup API via MCP | **No create-backup tool** in authenticated MCP toolset | HIGH |
| Database branching | `list_branches` → **[]** empty | HIGH |
| `restore_project` MCP | Exists but restores a **paused** project — **not** a pre-migration backup mechanism; **do not use** for this gate | HIGH |
| Logical DB+Storage vault (`logical_backup.py`) | **Available and proven** (Gate 10 / Gate 10B) | HIGH |
| Restore procedure | `logical_restore.py` scoped workspace restore into scratch / disposable WS; never default full wipe of Beta | HIGH |

**Conclusion:** Safe recovery point for this deploy = **fresh logical vault**, not PITR.

---

## 2. Fresh backup created (before any schema mutation)

| Field | Value |
|-------|-------|
| Timestamp (UTC) | `2026-09-24T16:08:33.583754+00:00` |
| Backup ID | `20260924T160516Z` |
| Type | Logical application vault (JSONL tables + Auth metadata + Storage binaries) |
| Target project | SiteSecureV1 / `rhxqqudlngimhplvndmz.supabase.co` |
| Success | **`ok: true`**, `error_count: 0`, `db_ok: true` |
| Duration | ~197s |
| Artifact path | `_backup_vault/20260924T160516Z/` (local; gitignored) |
| Size | ~37.7 MB total |
| Storage objects | 34 / 837894 bytes |
| Restore method | `python apps/api/scripts/durability/logical_restore.py --backup-id 20260924T160516Z …` (scoped; see runbook) |

Prior stale backup (`20260913T181710Z`) remains retained; **use `20260924T160516Z` as the migration checkpoint**.

---

## 3. Backup verification

| Check | Result |
|-------|--------|
| Directory exists | Yes |
| `MANIFEST.json` `ok` | **true** |
| `db/` JSONL count | 66 files |
| Non-empty overall | Yes (~37.7 MB) |
| Host matches target | `rhxqqudlngimhplvndmz.supabase.co` |

### Core tables (required evidence)

| Table | Lines in vault | Status |
|-------|----------------|--------|
| workspaces | 558 | OK |
| customers | 673 | OK |
| sites | 181 | OK |
| quotes | 872 | OK |
| quote_items | 163 | OK |
| projects | 12 | OK |
| jobs | 28 | OK |
| assignments | 11 | OK |
| service_calls | 3 | OK |

### Expected empty (tables not yet deployed)

| Table | Lines | Note |
|-------|-------|------|
| system_designs | 0 | Expected — table absent remotely; backup treats missing as empty |
| system_design_components | 0 | Same |

**No production restore test performed** (correct — would be destructive / require disposable project approval).

Reserved recovery project `SiteSecureV1-Gate10B-Recovery` (`nycprpxzpcomiufavlys`) remains **INACTIVE** and **not fully provisioned** — not used in this gate.

---

## 4. Recovery plan (if migration fails)

### Principles

1. SQL migrations are **not** auto-reversible.  
2. Prefer **STOP → investigate** over blind reverse DDL.  
3. Prefer **scoped logical restore** into scratch / disposable workspaces over wiping `rhxqqudlngimhplvndmz`.  
4. Full project wipe of SiteSecureV1 requires **written exception approval**.  
5. Checkpoint vault: **`20260924T160516Z`**.

### Per migration

| Migration | Manual rollback possible? | Data loss risk if rolled back | Full restore safer? | Objects to remove/revert | Partial-sequence app impact |
|-----------|---------------------------|-------------------------------|---------------------|--------------------------|-----------------------------|
| **0052** | Partial — drop columns `unassigned_at`/`unassigned_by`, restore hard unique, restore old `auth_assigned`/`auth_site_visible` defs from prior migration text | Low if no reassigns written yet; **history of unassigns lost** if columns dropped after use | Usually **no** — manual reverse DDL preferred if only 0052 applied | Columns, partial index, helper functions | API/Dashboard already expect `unassigned_at`; leaving 0052 applied is better than reverse if healthy |
| **0053** | Drop column `number`, drop trigger/function/unique | Numbers lost; 3 rows easily re-backfilled | No | `service_calls.number` + trigger | Service UI may show numbers; reverse only if corruption |
| **0054** | `DROP TABLE` components then designs (CASCADE careful) | Any Designs created after deploy **lost** | Only if Designs already valuable and corrupt | Tables, policies, `system_design_quote_visible` | App Design features fail until re-applied; Quotes unaffected |
| **0055** | `DROP FUNCTION system_design_apply_owned(...)` | Runtime Apply history not in RPC; **quote_items already mutated by Apply calls** are the risk | **If Apply corrupted quote lines → scoped restore of quote_items / quotes preferred** | Function + grants | **Highest risk.** Without RPC, Apply fails; bad Apply may leave wrong quote lines |
| **0056** | `DROP COLUMN equipment_intent` | Intent JSON lost | No | Column only | E2 features degrade; R1/R3 intact |

### Special attention — 0055

- Migrate-time: creates SECURITY DEFINER RPC only (no mass DELETE).  
- Runtime Apply: can delete/replace **owned** quote items.  
- On security invariant failure after 0055: **STOP**; do **not** apply 0056; investigate grants/`search_path`/authz; consider dropping function **only if** unused; if Apply already ran wrongly → **scoped data restore**, not function drop alone.

---

## 5. Partial-deploy failure plan

| State | Decision | Why |
|-------|----------|-----|
| 0052 OK, **0053 fails** | **SAFE TO RETRY** 0053 after fix (or **STOP AND INVESTIGATE** if constraint/data error) | 0052 independently valuable for Field/Dashboard; 0053 independent of Designs |
| 0052–0053 OK, **0054 fails** | **STOP AND INVESTIGATE** | Do not invent Design tables by hand; fix SQL/permissions then retry 0054. **No rollback of 0052/0053** unless they caused outage |
| 0052–0054 OK, **0055 fails** | **STOP AND INVESTIGATE** — **do not proceed to 0056** | R1 tables can stay; Apply unavailable is safer than a broken SECURITY DEFINER RPC. Drop function only after diagnosis |
| 0052–0055 OK, **0056 fails** | **SAFE TO RETRY** 0056 (additive) | R1/R3 usable without E2 column; retry LOW-risk ALTER |
| Unknown corruption after any step | **RESTORE RECOMMENDED** (scoped vault) or escalate | Prefer runbook scoped restore over production wipe |
| Security invariant fail on 0055 post-check | **STOP AND INVESTIGATE** (+ consider **ROLLBACK** of function) | Do not continue sequence |

**Default:** do **not** automatically roll back successful earlier migrations.

---

## 6. Execution channel

| Option | Status | Verdict |
|--------|--------|---------|
| A. Linked Supabase CLI | CLI exists via npx; **not logged in / not linked** | Requires user `supabase login` + `supabase link --project-ref rhxqqudlngimhplvndmz` — **not done** |
| **B. MCP `apply_migration`** | Authenticated; records migration history; runs SQL; ordered; failures visible | **PREFERRED for this deploy** |
| C. Manual SQL paste | Error-prone; history risk | **Avoid** |

**Recommendation:** On explicit approval, apply via **MCP `apply_migration`** one file at a time with post-checks between steps.

**User action for CLI (optional, not required if MCP used):**

```bash
npx supabase login
npx supabase link --project-ref rhxqqudlngimhplvndmz
# then only after approval: migration apply flow — NOT in this task
```

Do not paste access tokens into chat logs.

---

## 7. Target reconfirmation (pre-readiness)

| Check | Value | Match |
|-------|-------|-------|
| Project name | SiteSecureV1 | Yes |
| Project ref | `rhxqqudlngimhplvndmz` | Yes |
| Status | ACTIVE_HEALTHY | Yes |
| Remote head | `0051_job_dispatch_lifecycle` | Yes |
| Backup host | same ref | Yes |
| Org | Site Secure / Free | Yes |

**No other project is authorized for this sequence.**

---

## 8. Final execution plan (DO NOT RUN)

**Order:**

1. `0052_assignment_history.sql`  
2. `0053_service_call_numbers.sql`  
3. `0054_system_designs.sql`  
4. `0055_system_design_apply_owned.sql`  
5. `0056_system_design_equipment_intent.sql`  

**Global preconditions before step 1:**

- Explicit human approval naming SiteSecureV1 / `rhxq…`  
- Vault `20260924T160516Z` still present and `last_backup_ok`  
- Low-write window preferred  
- Operator ready for post-checks  

### Per-migration checkpoint template

| Phase | Action |
|-------|--------|
| PRE-CHECK | Confirm remote head = previous step; no unexpected objects |
| APPLY | MCP `apply_migration` with exact file SQL / name |
| POST-CHECK | Checks below |
| STOP CONDITION | Any post-check fail → stop sequence; follow §5 |

### 0052 post-check

- `assignments.unassigned_at` / `unassigned_by` exist  
- 11 assignment rows still readable  
- Partial unique index present  
- `auth_assigned` references `unassigned_at IS NULL`  
- Dashboard/Today assignment query no longer 400 on `unassigned_at`  
- Do **not** yet claim Field Ops fully production-verified  

### 0053 post-check

- `service_calls.number` exists, NOT NULL  
- 3 existing calls have non-empty unique numbers  
- Unique `(workspace_id, number)` exists  
- Trigger/function present  

### 0054 post-check

- Tables `system_designs`, `system_design_components` exist  
- Indexes/constraints present  
- RLS + FORCE RLS as migration requires  
- Policies + `system_design_quote_visible` exist  
- Cross-workspace select denied  
- R1 CRUD smoke + revision CAS  

### 0055 post-check (highest risk — STOP on fail)

- Exact function `public.system_design_apply_owned(...)` exists  
- SECURITY DEFINER / `search_path=public`  
- REVOKE PUBLIC / GRANT authenticated as designed  
- Unauthorized / cross-workspace cannot Apply  
- Controlled catalog Apply: ownership, fingerprint, revision  
- Server pricing still authoritative after Apply  
- Divergence / confirmation still enforced at API  
- **If any security invariant fails → STOP; do not run 0056**  

### 0056 post-check

- Column `equipment_intent` exists  
- Existing components remain valid (null OK)  
- E2 JSON persists; hydrate/recalc; no fake product_id/SKU/price  

---

## 9. End-to-end verification plan (after full sequence)

Only after all five migrate + per-step checks:

**Field:** Dashboard, Today, assignment hydration, technician scope  

**System Design:** create / persist requirements / engineering / recommendation / reload / reopen / recalculate / CAS  

**R3:** catalog Apply, ownership, re-Apply, divergence, confirmation, atomic replace  

**E2:** manufacturer / model_reference / display_description / selected_attributes / resolution / reload  

**Quote regression:** manual quote, pricing, Stages 2–3, Preview, Share, Send, public, PDF, approve/reject, Revise  

**Authz/RLS:** isolation, technician commercial deny, `quotes.view_cost`, `quotes.edit`, cross-workspace Design denial  

### Status vocabulary after deploy

| Outcome | Status label |
|---------|--------------|
| Migrations applied + verification pass | **PRODUCTION VERIFIED** (per domain) |
| Migrations applied + verification fail | **DEPLOYED / VERIFICATION FAILED** |
| Migrations applied + not yet tested | **DEPLOYED / NOT VERIFIED** |

Do **not** mark R1/R2/R3/E2 PRODUCTION VERIFIED on apply alone.

---

## 10. Readiness decision

### READY FOR EXPLICIT DEPLOYMENT APPROVAL

**Because:**

- Target identity confirmed  
- Remote head still 0051  
- No object drift for pending objects  
- Fresh verified logical backup `20260924T160516Z`  
- Execution channel chosen (MCP)  
- Recovery / partial-failure plans written  
- Prior automated suites green (preflight)  

**Still required before anyone applies:**

1. Explicit approval message (human) naming this project/ref and sequence  
2. Operator online for 0055 security checkpoint  

### NOT done in this task

- No migration apply  
- No schema change  
- No CLI link  
- No production restore drill  

---

## Confirmation

**NO DATABASE SCHEMA CHANGES WERE MADE.**  
**NO MIGRATIONS WERE APPLIED.**  
**NO `db push` / repair / reset.**  
**Secrets were not printed.**
