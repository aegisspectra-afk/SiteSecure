# SITE SECURE — SaaS Phase 1 Production Deployment

**Date:** 2026-09-24  
**Mode:** Controlled production migration deploy + verification  
**Channel:** MCP `apply_migration` (same established path as 0052–0056)  
**Operator:** Cursor agent under explicit user deployment request  

---

## Target

| Field | Value |
|-------|-------|
| Project name | SiteSecureV1 |
| Project ref | `rhxqqudlngimhplvndmz` |
| Region | ap-northeast-1 |
| Status | ACTIVE_HEALTHY |
| Identity confidence | HIGH (matches prior 0052–0056 deploy + `.env` host) |

No other Supabase project was authorized or mutated.

---

## Backup

| Field | Value |
|-------|-------|
| Backup id | `20260924T191907Z` |
| Path | `_backup_vault/20260924T191907Z/` (gitignored) |
| Manifest `ok` | **true** |
| Host match | `rhxqqudlngimhplvndmz.supabase.co` |
| Size (approx) | ~36.1 MB |
| Completed (UTC) | 2026-09-24T19:21:36Z |
| `error_count` | 0 |
| Core tables present | workspaces 560 · memberships 760 · invitations 282 · subscriptions 558 · quotes 872 |

**BACKUP: PASS** — fresh logical vault before any schema mutation.

PITR: unavailable / unknown on Free plan (same as prior Gate 10 posture). Recovery = logical vault + runbook.

---

## Migration heads

| Point | Version | Name |
|-------|---------|------|
| PREVIOUS | `20260924162200` | `0056_system_design_equipment_intent` |
| APPLIED | `20260924192253` | `saas_phase1_member_technician_quotas` |
| CURRENT | `20260924192253` | `saas_phase1_member_technician_quotas` |

**Repo file:** `supabase/migrations/20260924191046_saas_phase1_member_technician_quotas.sql`  

**Note:** MCP assigns apply-time version `20260924192253` (same pattern as numbered 0052–0056 files vs remote timestamps). Content matches the repo SQL. Do **not** re-apply the local file blindly via CLI without reconciling history.

Prerequisite chain 0052–0056: already present. Not reapplied.

---

## SQL safety review (PASS)

Migration changes **only**:

| Object | Change |
|--------|--------|
| `plan_limits` | Upsert `max_members` / `max_technicians` (+ legacy seat mirror keys) |
| `subscriptions` | Additive `source`, `override_expires_at`, `override_reason` |
| `_plan_limit_or_zero` | Helper |
| `_workspace_member_occupancy` | Active members + pending invites (email-deduped) |
| `enforce_invitation_seat_quota` | BEFORE INSERT trigger, SECURITY DEFINER, `search_path=public`, subscription `FOR UPDATE` |
| `accept_invitation` | CREATE OR REPLACE — member/technician caps; maps retired `founding_technician` → `technician` |

**Does NOT alter:** pricing, quote lifecycle/snapshots/PDF, public approval, CCTV, System Design, Equipment Intent, job lifecycle, assignment history, Platform Admin authority, RLS enablement model.

**RLS:** invitations / subscriptions / memberships / workspaces remain RLS + FORCE RLS enabled.

**Idempotency:** `ON CONFLICT` for limits; `ADD COLUMN IF NOT EXISTS`; `DROP TRIGGER IF EXISTS` + recreate; function replace.

**Over-cap policy:** does **not** deactivate existing members; blocks new consumption only.

**Rollback / recovery:** READY via vault `20260924T191907Z`. Manual reverse would drop trigger/helpers and restore prior `accept_invitation` definition from history — prefer investigate-first; do not auto-rollback.

---

## Existing-data preflight (PASS)

| Check | Result |
|-------|--------|
| Plan mix (active) | solo 514 · business 22 · enterprise 15 · no-sub 2 (GATE10B QA fixtures) |
| Solo over Free caps (members>3 or techs>2 incl. pending) | **19** workspaces |
| Customer-named over-limit | **0** |
| Over-limit names | All `Seat Limit *` / `Invite Stale *` (prior automated seat tests) |
| Legacy `role_key = founding_technician` | **0** memberships, **0** invitations |
| Null role memberships/invites | **0** |
| Unexpected lock risk for real customers | **NONE** — over-cap test WS keep existing members; new invites blocked |

Compatibility decision: leave 19 test over-cap workspaces as-is (section 23 behavior). No grandfather plan override required for real customers.

---

## Deployment result

| Step | Result |
|------|--------|
| Backup | PASS |
| History / dependency | PASS (head was 0056; target absent) |
| Data preflight | PASS |
| SQL safety | PASS |
| `apply_migration` | **SUCCESS** |
| Schema object verify | PASS (limits 3/2, trigger, occupancy, accept defs, override cols) |

---

## Post-deploy schema verification

| Check | Result |
|-------|--------|
| Trigger `invitations_enforce_seat_quota` | Present |
| `enforce_invitation_seat_quota` | SECURITY DEFINER · `search_path=public` |
| `accept_invitation` | SECURITY DEFINER · contains `max_members` / `max_technicians` / FT map |
| `plan_limits` solo | max_members=3 · max_technicians=2 |
| `subscriptions.source` / override cols | Present |
| RLS still on | invitations, subscriptions, memberships, workspaces |

---

## Quota verification (controlled)

Ephemeral `SAAS-P1-*` workspaces (later suspended):

| Scenario | Result |
|----------|--------|
| Owner + tech invite + tech invite | ALLOW |
| Additional technician | BLOCK (`PLAN_LIMIT_REACHED`; Free saturates member cap first at 3) |
| Additional viewer at member cap | BLOCK `member_quota_exceeded` |
| Revoke pending → seat frees | PASS (re-invite succeeds) |
| Founding_technician role at DB counts as tech for quota | PASS (3rd blocked) |
| Concurrent final technician seat (2 parallel inserts) | **exactly 1 success, 1 fail**; final pending techs = 2 |

---

## Concurrency verification

**PASS** — two concurrent technician invite inserts with one seat remaining: success_count=1, fail_count=1, final pending technicians=2. Never exceeded max_technicians=2.

---

## Invite acceptance

| Check | Result |
|-------|--------|
| Live `test_invite_accept_live.py` suite | PASS (included in 28 live green) |
| Accept preserves workspace / role / quota mapping | Covered by live suite against deployed `accept_invitation` |
| Service-role cannot plant past Free cap (INSERT trigger) | PASS (test updated for Phase 1 semantics) |
| Tokens | Not printed |

---

## Authz / tenancy / Platform Admin

| Check | Result |
|-------|--------|
| Live tenant isolation + invite + platform admin | **28 passed** |
| Technician cannot invite (API 403) | PASS |
| Cross-workspace isolation | PASS (suite) |
| Owner ≠ Platform Admin | PASS (suite / admin probes) |
| Founding role not inviteable via API | PASS |
| FT badge elevation | None (role catalogue unchanged; quota only) |

---

## Application smoke

| Area | Result | Notes |
|------|--------|-------|
| Invite create/accept (API TestClient → live DB) | PASS | Via live pytest |
| Platform Admin live | PASS | In 28-pack |
| Field technician Today/FieldJob browser UI | NOT browser-automated this pass | Authz/tenant live green; FT product QA previously PASS |
| Storage 15 GiB end-to-end | **PARTIAL** | Not in this deploy |

---

## Tests / build

| Suite | Result |
|-------|--------|
| Focused unit (limits/occupancy/quota/invite errors/entitlements/job lifecycle/authorize/authz_scope) | **87 passed** |
| Live tenant + invite + platform admin | **28 passed** |
| Web vitest full | **456 passed** (62 files) |
| `tsc --noEmit` | **PASS** |
| `npm run build` (web) | **PASS** |

**Test alignment fixes (not product redesign):**

- `test_invite_accept_errors.py` — expect 409 for `PLAN_LIMIT_REACHED` (Phase 1 contract)
- `test_solo_field_seat_limit_reached` — Free saturates `max_members` first when inviting only technicians
- `test_invite_accept_seat_limit_blocks_stale_invite` — INSERT trigger blocks over-cap plant (service_role included)
- `test_technician_cannot_invite` — PostgREST RLS deny may return 400

Prior Phase 1 baseline cited 59 API focused / 456 web — web matched; API focused selection here is 87 unit + 28 live.

---

## Unresolved / follow-ups

1. Storage Phase 3 still PARTIAL (upload-path inventory / bypass proof).  
2. Phase 2 Plan & Billing Settings UI not part of this deploy.  
3. Multi-workspace `memberships[0]` limitation unchanged.  
4. Remote migration version ≠ local filename timestamp — document for future CLI sync.  
5. Ephemeral `SAAS-P1-*` smoke workspaces set to `suspended` after verify.  
6. Field UI browser smoke not re-run in this session.

---

## Readiness decision

**READY TO INVITE FIRST REAL FOUNDING TECHNICIAN: YES**

Conditions:

- Invite into a workspace with Free capacity (or Pro/Business), **one operational workspace** preferred.  
- Founding Technician = `role_key=technician` + programme/badge (not a role).  
- Seat quotas now enforced on production DB.

**HARD BLOCKERS: NONE** for first FT invite on capacity-available workspace.

---

## Absolute constraints honored

- No Phase 2 / Service Call V1 / schema redesign  
- No fourth plan key  
- No storage architecture change  
- No fake billing  
- No secrets / invite tokens in this report  
- No reapply of 0052–0056  
