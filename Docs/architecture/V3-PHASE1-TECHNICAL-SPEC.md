# SITE SECURE V3 — Phase 1 Technical Specification

**Status:** APPROVED WITH AMENDMENTS (A1–A10) — architecture/scope locked  
**Date:** 2026-09-11 (amended same day)  
**Depends on:** [V3-PHASE0-DECISION-MEMO.md](./V3-PHASE0-DECISION-MEMO.md) (LOCKED)  
**Audit:** [V3-READINESS-AUDIT.md](./V3-READINESS-AUDIT.md)

**Authorization to code:** `P1-T01` only, after this amended spec is committed. Do not start `P1-T02` until T01 is reviewed. No Phase 2 work authorized.

Phase 1 delivers **Core abstractions** only: capability/quota evolution, Workforce Person identity, Evidence multi-parent links, domain events, and non-breaking extensions to Asset (`equipment`) and Work Order (`jobs`) so Phases 2–5 can plug in without competing models.

Phase 1 does **not** ship: full Field Service UX, Inspection builder, Patrol, Workforce scheduling UI, SITE AI, homepage rewrite, or Enterprise configurator. **Do not broaden Phase 1 scope.**

---

## 0. Approved amendments (A1–A10)

Architecture/security clarifications — not a redesign. These override any conflicting earlier wording in this document.

### A1 — One canonical entitlement resolution path

During dual-model migration we keep:

- legacy `features` / `workspace_feature_overrides` / `auth_feature`
- new `capabilities` / `plan_capabilities` / `workspace_capability_overrides`

There must **not** be two independent entitlement truths for new V3 code.

**Canonical path for all new V3 functionality:**

```
Subscription (active|trialing|manual)
  → Plan Capability Default (plan_capabilities)
  → Workspace Capability Override (workspace_capability_overrides)
  → Effective Capability
```

Introduce one resolver used by all new code:

`resolve_capability(workspace_id, capability_key) → { enabled, limit, config, source, plan_key }`

| `source` | Meaning |
|----------|---------|
| `plan` | From plan_capabilities only |
| `workspace_override` | Override contributed enabled and/or limit/config |
| `legacy_bridge` | Derived solely via documented legacy alias when no capability row yet |

**Rules:**

- Application code must **not** independently query legacy + capability and pick whichever grants access.
- Legacy `features` remain for backward compatibility with **existing** `authorize()` / `permission_feature` gates.
- Documented aliases (e.g. `service` → `field_service.enabled`) have fixed precedence: if both exist and **contradict**, **fail closed** (`enabled=false`) and log/metric the conflict.
- Alias bridge is transitional; once `field_service.enabled` is seeded for all plans, prefer capability row; legacy remains for old permission_feature keys until remapped.

### A2 — Tenant integrity at database level

New FKs must enforce **same-workspace** (and related consistency), not merely ID existence. Survive API *and* service-role/direct writes via composite FK, CHECK, trigger, or SECURITY DEFINER validator.

| Constraint | Invariant |
|------------|-----------|
| `jobs.assigned_person_id` | `job.workspace_id = workforce_people.workspace_id` |
| `jobs.work_type_id` | `job.workspace_id = workspace_work_types.workspace_id` |
| `equipment.customer_id` | same workspace as equipment; if `site_id` set, `customer_id = sites.customer_id` |
| `workforce_people.membership_id` | membership.workspace_id = person.workspace_id |
| `workforce_people.user_id` + membership | user matches membership.user_id when both set |
| `evidence_links` | link.workspace_id = document.workspace_id = parent.workspace_id |

Negative tests required for each.

### A3 — Polymorphic evidence: registry + validator

`parent_type` is not a free string. Canonical registry enumerates attachable types.

**Phase 1 attachable:** `customer`, `site`, `system`, `job`, `quote`, `project`, `warranty`, `equipment` (when primary/support allowed).

**Reserved — documented but NOT attachable until entities exist:** `inspection_run`, `finding`, `corrective_action`, `checkpoint_scan`, `workforce_person` (optional later).

On every link create validate: supported type → parent exists → same workspace → caller permission/scope on parent → document same workspace → no duplicate.

**Evidence link does not grant access to its parent.** Dual-parent documents must never escalate visibility.

### A4 — Critical domain events are durable (not best-effort)

| Class | Examples | Requirement |
|-------|----------|-------------|
| **Critical** | `job.completed`, `capability.override_set`; later inspection/checkpoint/CA closes | If business txn commits, event **must** persist. Prefer same DB transaction/RPC. Failure to write event ⇒ fail the mutation (or compensating retry that cannot silently drop). |
| **Non-critical** | explicitly classified telemetry | May be best-effort only if labeled as such |

No Kafka/distributed bus in Phase 1.

### A5 — Event payload policy

Payload = IDs + state transitions + small operational facts. **Not** a shadow database.

Forbid by default: tokens, passwords, secrets, full documents, huge text, unnecessary PII, nested full customer/job/person objects.

### A6 — Workforce Person identity invariants

- Authz always: `User → Membership → Role/Grants`. **Never** from Person.
- Ops references use `workforce_people.id`.
- **`membership_id` = canonical workspace authorization linkage** when present.
- `user_id` = convenience/reference only; never grants access alone.
- Cross-workspace membership/user link rejected at DB.
- Person without login remains valid.

### A7 — Numeric quota semantics

Interpret `limit_value` **only with** `enabled`:

| Case | Meaning |
|------|---------|
| `enabled=false` | Unavailable (ignore numeric) |
| `enabled=true`, `limit_value=0` | Unlimited |
| `enabled=true`, `limit_value>0` | Capped |
| Missing capability | Fail closed → `enabled=false` |

Never infer unlimited from missing/null. Unit-test all four.

### A8 — `metadata` jsonb is not long-term domain dump

Approved for extension stubs only. Phase 4+ must promote skills/certs/teams/availability (and similar Asset/WO concepts) to proper entities — not permanent JSON homes.

### A9 — `assigned_person_id` ≠ authorization

Phase 1 scope remains `assignments + user_id`. Setting `assigned_person_id` alone must **not** grant job access. Regression test required. Person↔Assignment reconciliation is Phase 2.

### A10 — Domain event idempotency

Critical mutations must not create misleading duplicate events on retry (e.g. two `job.completed` for one transition).

Minimum: unique idempotency key per critical transition (e.g. `(workspace_id, event_type, aggregate_id, transition_key)` or request correlation tied to status version). Repeat idempotent complete ⇒ same outcome, no second completion event.

---

## 1. Goals & non-goals

### Goals

1. Canonical capability + quota resolution with workspace overrides (fail-closed).
2. Public plan **labels** Free / Pro / Enterprise while keeping keys `solo` / `business` / `enterprise`.
3. `workforce_people` operational Person linked optionally to membership/user.
4. `evidence_links` multi-parent model on `documents`.
5. Durable `domain_events` with emitters on a few existing mutations.
6. Non-breaking Asset columns on `equipment` + Work Type / Job extension columns.
7. Authz catalog stubs for future module permissions (no broad UI).
8. Contracts that explicitly allow Inspection→Finding→Job and Person→Assignment→Job later.

### Non-goals

- Rewriting CPQ, CRM, tenancy, or `authorize()` pipeline.
- Renaming plan keys in Postgres.
- Building Patrol/Inspection product surfaces.
- Distributed message bus / Kafka / outbox-to-queue (unless already present).
- Homepage marketing rewrite.
- Deleting unused tables because usage-cold.

---

## 2. Existing tables reused

| Table | Phase 1 use |
|-------|-------------|
| `workspaces`, `subscriptions`, `plans`, `plan_features`, `plan_limits` | Plan defaults; keys unchanged |
| `features`, `workspace_feature_overrides` | Keep boolean path; map/alias into capabilities |
| `profiles`, `workspace_memberships`, `workspace_roles` | Auth identity + RBAC |
| `customers`, `sites`, `site_zones` | Spine; zones usable for Asset location |
| `equipment`, `systems` | Asset SoT (+ optional system group) |
| `jobs`, `service_calls`, `assignments` | Work Order SoT + request + scope |
| `documents` | Evidence blob SoT |
| `checklist_*`, `job_checklist_items` | Untouched product behavior; noted as Phase 3 evolve source |
| `audit_logs` | Continue; domain events complement (not replace) |
| `packages/authz/catalog.json` | Extend; remain API grant SoT |

---

## 3. New tables required

### 3.1 `capabilities` (catalog)

Global capability registry (similar to `features`).

| Column | Type | Notes |
|--------|------|-------|
| `key` | text PK | e.g. `field_service.enabled`, `inspections.monthly_runs` |
| `value_type` | text | `boolean` \| `integer` \| `json` |
| `description` | text | optional |

### 3.2 `plan_capabilities`

| Column | Type | Notes |
|--------|------|-------|
| `plan_key` | text FK → plans | |
| `capability_key` | text FK → capabilities | |
| `enabled` | boolean NOT NULL DEFAULT false | for boolean caps; also gates numeric caps |
| `limit_value` | integer NULL | numeric quotas; `0` = unlimited (same convention as today); NULL = N/A |
| `config` | jsonb NOT NULL DEFAULT `{}` | optional structured defaults |
| PK | `(plan_key, capability_key)` | |

### 3.3 `workspace_capability_overrides`

Extends boolean-only `workspace_feature_overrides` without deleting it.

| Column | Type | Notes |
|--------|------|-------|
| `workspace_id` | uuid FK | |
| `capability_key` | text FK | |
| `enabled` | boolean NULL | NULL = do not override enabled bit |
| `limit_value` | integer NULL | NULL = do not override limit |
| `config` | jsonb NULL | NULL = do not override config |
| `reason` | text | required for Enterprise ops hygiene |
| `set_by` | uuid NULL FK profiles | |
| `created_at` / `updated_at` | timestamptz | |
| PK | `(workspace_id, capability_key)` | |

**Precedence (fail-closed):**

```
effective.enabled = COALESCE(override.enabled, plan_capability.enabled, false)
effective.limit   = COALESCE(override.limit_value, plan_capability.limit_value, 0)
  -- if capability not on plan and no override → deny / limit 0 with enabled false
effective.config  = COALESCE(override.config, plan_capability.config, {})
```

Subscription must still be `trialing|active|manual` (same as `auth_feature` today).  
If entitlements RPC fails → empty features/capabilities (current fail-closed).

### 3.4 Compatibility: `features` ↔ capabilities

- Keep `features` rows and `auth_feature()` / `workspace_feature_overrides` working.
- Seed mapping: each legacy feature key `F` implies capability `F` **or** explicit alias table:

| Legacy feature | Capability |
|----------------|------------|
| `service` | `field_service.enabled` (+ keep `service` boolean for old checks) |
| `ai` | `site_ai.enabled` |
| `team` | `workforce.enabled` (initial; refine in Phase 4) |
| `audit`, `api`, … | same-key boolean capabilities |

Phase 1 rule: **`authorize()` continues to use `permission_feature` → legacy feature keys** until permissions are remapped. New module permissions may require new feature/capability keys added in catalog.

`my_workspace_entitlements` return shape (extended, backward compatible):

```json
{
  "plan_key": "solo",
  "status": "active",
  "features": ["core", "crm", "..."],
  "capabilities": {
    "field_service.enabled": { "enabled": true, "limit": null },
    "field_service.monthly_work_orders": { "enabled": true, "limit": 25 },
    "site_ai.monthly_usage": { "enabled": false, "limit": 0 }
  },
  "plan_label": "Free"
}
```

Clients that only read `features` keep working.

### 3.5 `workforce_people`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `workspace_id` | uuid NOT NULL | |
| `display_name` | text NOT NULL | |
| `status` | text NOT NULL | `active` \| `inactive` \| `archived` |
| `user_id` | uuid NULL FK profiles | login identity when present |
| `membership_id` | uuid NULL FK workspace_memberships | authz linkage when present |
| `title` | text NULL | |
| `team_key` | text NULL | Phase 1 stub; teams table Phase 4 |
| `region` | text NULL | |
| `phone` | text NULL | |
| `metadata` | jsonb NOT NULL DEFAULT `{}` | skills/certs stubs until Phase 4 tables |
| `created_at` / `updated_at` | timestamptz | |
| UNIQUE | `(workspace_id, user_id)` WHERE user_id IS NOT NULL | |
| UNIQUE | `(workspace_id, membership_id)` WHERE membership_id IS NOT NULL | |

RLS: member read; managerial write (Phase 1). Assigned-scope users may read Persons linked to their assignments later — Phase 2/4.

**Invariant:** Authorization decisions continue to use **membership role/grants**, not Person rows. Person is operational SoT.

### 3.6 `evidence_links`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `workspace_id` | uuid NOT NULL | |
| `document_id` | uuid NOT NULL FK documents ON DELETE CASCADE | |
| `parent_type` | text NOT NULL | see enum list below |
| `parent_id` | uuid NOT NULL | |
| `relation` | text NOT NULL DEFAULT `supporting` | `primary` \| `supporting` |
| `created_at` | timestamptz | |
| `created_by` | uuid NULL | |
| UNIQUE | `(document_id, parent_type, parent_id)` | |

**Parent types (Phase 1):**  
`customer`, `site`, `system`, `job`, `quote`, `project`, `warranty` (existing document entities)  
**Plus reserved for later:** `equipment`, `inspection_run`, `finding`, `corrective_action`, `checkpoint_scan`, `workforce_person`

**Backward compat:** Keep `documents.entity_type` + `entity_id` as the **primary** parent. On upload complete, insert matching `evidence_links` row (`relation=primary`). New multi-parent attaches add `supporting` links only.

### 3.7 `domain_events`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `workspace_id` | uuid NOT NULL | |
| `event_type` | text NOT NULL | e.g. `job.completed` |
| `aggregate_type` | text NOT NULL | `job`, `document`, … |
| `aggregate_id` | uuid NOT NULL | |
| `actor_user_id` | uuid NULL | |
| `correlation_id` | uuid NULL | |
| `payload` | jsonb NOT NULL DEFAULT `{}` | minimal facts, no secrets |
| `created_at` | timestamptz NOT NULL DEFAULT now() | immutable |

Indexes: `(workspace_id, created_at DESC)`, `(workspace_id, event_type, created_at DESC)`, `(workspace_id, aggregate_type, aggregate_id)`.

RLS: privileged/`audit` feature read (align with audit_logs); **no** authenticated UPDATE/DELETE. Writes via service role / SECURITY DEFINER writer used by API (same pattern as audit).

### 3.8 `workspace_work_types`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `workspace_id` | uuid NOT NULL | |
| `key` | text NOT NULL | `installation`, `service_call`, … |
| `label_he` | text NOT NULL | |
| `label_en` | text NULL | |
| `maps_to_job_kind` | `job_kind` NULL | compat bridge to existing enum |
| `is_active` | boolean NOT NULL DEFAULT true | |
| `sort_order` | int NOT NULL DEFAULT 0 | |
| UNIQUE | `(workspace_id, key)` | |

Seed defaults per workspace from current `job_kind` values.

---

## 4. Exact schema changes on existing tables

### 4.1 `equipment` (Asset)

Additive, nullable columns:

| Column | Type | Purpose |
|--------|------|---------|
| `asset_type_key` | text NULL | generalized type (`camera`, `vehicle`, `tool`, …) |
| `sku` | text NULL | |
| `customer_id` | uuid NULL FK customers | denormalized convenience; must match site.customer_id when set |
| `warranty_ends_on` | date NULL | |
| `metadata` | jsonb NOT NULL DEFAULT `{}` | extensibility |
| `retired_at` | timestamptz NULL | |

Keep existing `category` enum for backward compat; map known categories → `asset_type_key` on write when null.

**Do not** rename table to `assets`.

### 4.2 `jobs` (Work Order)

Additive columns (Phase 1; FSM expansion mostly Phase 2):

| Column | Type | Purpose |
|--------|------|---------|
| `work_type_id` | uuid NULL FK workspace_work_types | |
| `priority` | text NOT NULL DEFAULT `normal` | `low\|normal\|high\|critical` |
| `instructions` | text NULL | |
| `sla_due_at` | timestamptz NULL | |
| `origin_inspection_id` | uuid NULL | reserved FK later |
| `origin_finding_id` | uuid NULL | reserved |
| `origin_corrective_action_id` | uuid NULL | reserved |
| `assigned_person_id` | uuid NULL FK workforce_people | operational assignee |
| `dispatched_at` | timestamptz NULL | |
| `on_site_at` | timestamptz NULL | |
| `verified_at` | timestamptz NULL | |
| `metadata` | jsonb NOT NULL DEFAULT `{}` | |

**Status enum:** Phase 1 **keeps** `scheduled|en_route|in_progress|completed|cancelled`.  
Document mapping to target lifecycle; Phase 2 migration may ADD values (`dispatched`, `on_site`, `blocked`, `verified`) via careful `ALTER TYPE` / new text+check strategy — **out of Phase 1** unless a zero-downtime approach is approved in a dedicated task.

Existing `jobs.start` / `jobs.complete` behavior unchanged.

### 4.3 `documents`

| Change | Notes |
|--------|-------|
| Extend `document_kind` | ADD values: `scan_evidence`, `generated_report` (keep `document`, `photo`, `signature`, `pdf_export`) |
| Optional: extend `document_entity_type` | ADD `equipment` for primary parent on assets |

Prefer evidence_links for new parents; enum extension only where primary parent needed for RLS today.

### 4.4 `plans` labels

Update `label_he` / `label_en` (and catalog `label_he`):

| key | label |
|-----|-------|
| solo | Free |
| business | Pro |
| enterprise | Enterprise |

No key renames.

---

## 5. Entity relationships (Phase 1)

```
Workspace
  ├─ Subscription (plan_key)
  ├─ Capability overrides
  ├─ WorkforcePerson ──optional── User/Membership
  ├─ Customer
  │    └─ Site
  │         ├─ Equipment (Asset)
  │         └─ Job (Work Order) ── optional WorkType
  │              ├─ Assignments (user scope)
  │              └─ assigned_person_id → WorkforcePerson
  ├─ Documents
  │    └─ EvidenceLink* → parents
  └─ DomainEvent*
```

Reserved nullable origin FKs on jobs are **logical contracts** for Phase 3; physical FK constraints to inspection tables are added when those tables exist.

---

## 6. Capability schema (seed set)

Boolean (enabled) and integer (limit) examples — **numeric values TBD / placeholder**, marked `TBD` in seed comments; use conservative Free defaults that do not break current Solo behavior.

| Capability | Free (`solo`) | Pro (`business`) | Enterprise |
|------------|---------------|------------------|------------|
| `field_service.enabled` | true | true | true |
| `field_service.monthly_work_orders` | TBD (≥ current practical use) | TBD | 0 unlimited or custom |
| `field_service.advanced_scheduling` | false | true | true |
| `inspections.enabled` | false* | true | true |
| `inspections.monthly_runs` | 0 | TBD | custom |
| `inspections.custom_templates` | false | true | true |
| `inspections.corrective_actions` | false | true | true |
| `inspections.patrol_checkpoints` | false | true | true |
| `workforce.enabled` | false* | true | true |
| `workforce.max_people` | 0 | TBD | custom |
| `workforce.scheduling` | false | true | true |
| `workforce.certifications` | false | true | true |
| `site_ai.enabled` | false | false** | true |
| `site_ai.monthly_usage` | 0 | TBD | custom |
| `site_ai.actions` | false | false** | true |
| `site_ai.cross_module_analysis` | false | false | true |

\*Free may still use basic jobs via legacy `service` feature — `field_service.enabled` mirrors `service`.  
\*\*Pro AI may open later; Phase 1 seeds follow current catalog (`ai` enterprise-only) unless product overrides.

Legacy features remain the gate for existing permissions until remap task.

---

## 7. Quota resolution

| Layer | Source |
|-------|--------|
| Plan numeric defaults | `plan_capabilities.limit_value` and/or existing `plan_limits` |
| Workspace override | `workspace_capability_overrides.limit_value` |
| Runtime check | **Canonical** `resolve_capability` + `evaluate_capability_limit` (A1/A7) |
| DB hard triggers | Keep existing customer/quote/storage triggers; **do not** rewrite in Phase 1 |

**Semantics (A7):** `enabled=false` ⇒ unavailable; `enabled=true` + `limit=0` ⇒ unlimited; `enabled=true` + `limit>0` ⇒ capped; missing ⇒ fail closed. Never treat missing as unlimited.

Dual-write period: seat/storage/quote limits stay on `plan_limits` until consolidated. New V3 numeric caps use capability resolver only.

---

## 8. RBAC permission namespace (Phase 1 stubs)

Add to catalog (grants initially to owner/administrator/manager only where sensible):

| Permission | Feature/capability gate | Notes |
|------------|-------------------------|-------|
| `workforce.people.view` | `workforce.enabled` or `team` | |
| `workforce.people.manage` | `workforce.enabled` or `team` | |
| `evidence.link` | `core` / documents | attach supporting parents |
| `events.view` | `audit` | domain event read |
| `assets.view` | (sites/systems) | alias clarity for equipment |
| `assets.edit` | systems.edit | |

Do **not** yet add patrol/inspector roles to production invites (Phase 3/4). Document intended roles in catalog comments / Docs only.

`permission_feature` map must include new keys → feature/capability. Fail closed if feature missing.

---

## 9. Scope model

Unchanged scopes: `all | owned | assigned | team`.

Phase 1 additions:

- Jobs may reference `assigned_person_id`; **scope still resolves via `assignments` + user_id** until Phase 2 dispatch binds Person→User.
- Evidence visibility: user can read a document if **any** linked parent is visible under existing site/job visibility helpers.
- Domain events: read = privileged + audit entitlement (same as audit_logs).

No `branch`/`region` scopes in Phase 1.

---

## 10. Domain event contract

### Envelope

```ts
type DomainEvent = {
  id: string;
  workspace_id: string;
  event_type: string;      // dotted past-tense noun
  aggregate_type: string;
  aggregate_id: string;
  actor_user_id: string | null;
  correlation_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;      // timestamptz
};
```

### Phase 1 event types to emit

| event_type | When |
|------------|------|
| `job.created` | POST /jobs |
| `job.assigned` | POST /jobs/{id}/assign |
| `job.started` | POST /jobs/{id}/start |
| `job.completed` | POST /jobs/{id}/complete |
| `document.uploaded` | documents complete |
| `workforce_person.created` | POST people |
| `workforce_person.updated` | PATCH people |
| `capability.override_set` | platform/admin override write |

Reserve (emit no-op / document only):  
`inspection.*`, `finding.*`, `corrective_action.*`, `checkpoint.*`, `certification.*`, `asset.updated` (emit when equipment PATCH lands).

### Writer API (internal)

`emit_domain_event(..., *, critical: bool, idempotency_key: str | None)`

- **Critical** (A4): `job.completed`, `capability.override_set` — must be written in the **same DB transaction** as the successful mutation (RPC or transactional service write). If event insert fails, mutation fails / rolls back. Not best-effort.
- **Non-critical:** only when explicitly classified; best-effort allowed with metric.
- **Idempotency (A10):** unique constraint on critical transition key (e.g. `workspace_id + event_type + aggregate_id + idempotency_key`). Retried completion must not insert a second `job.completed`.
- **Payload (A5):** IDs + transitions + small facts only; redaction helper enforced in tests.

---

## 11. Evidence linking model

1. Upload flow unchanged → creates `documents` row with primary `entity_type`/`entity_id`.
2. Trigger or API: upsert `evidence_links` primary row (registry-validated).
3. `POST /documents/{id}/links` adds supporting parents after **canonical validator** (A3): type registered & attachable → parent exists → same workspace → authorize parent → document workspace match → no duplicate.
4. Reserved future parent types exist in docs/registry as `attachable=false` until entities ship.
5. `GET` by parent lists documents via links UNION primary entity match — visibility is **intersection of caller rights on each parent considered**, never union escalation (A3).
6. Delete document cascades links.

Kinds: existing + `scan_evidence`, `generated_report`.

**Evidence link ≠ access grant** to any parent.

---

## 12. Workforce identity relationship

```
auth.users
  └── profiles
        └── workspace_memberships (RBAC)  ← sole authz path
              └── optional workforce_people.membership_id  ← CANONICAL link (A6)
        └── optional workforce_people.user_id  ← convenience only; never grants access
```

Rules (A6 / A9):

- Authz always Membership → grants/scope. Person never authorizes.
- Creating a membership does **not** require a Person; Person may exist without login.
- DB enforces same-workspace membership; if both user_id and membership_id set, user must match membership.user_id.
- `jobs.assigned_person_id` is operational only — does **not** replace `assignments` scope (A9).
- Invites / seats remain membership-based.
- `metadata` may hold early stubs only (A8) — not permanent skills/certs model.

---

## 13. Backward compatibility strategy

| Area | Strategy |
|------|----------|
| Entitlements JSON | Additive fields; `features[]` still authoritative for old clients |
| `auth_feature` | Unchanged semantics |
| Jobs API | New fields optional; old clients ignore |
| Equipment API | New fields optional |
| Documents | Primary entity columns remain required |
| Plan keys | Unchanged |
| Checklists | Untouched |
| Catalog grants | Additive permissions; existing roles keep prior grants |

---

## 14. Migration / rollback strategy

### Migrations (suggested filenames)

1. `00xx_v3_capabilities.sql` — capabilities, plan_capabilities, workspace_capability_overrides, seed, extend `my_workspace_entitlements`
2. `00xx_v3_plan_labels.sql` — Free/Pro/Enterprise labels
3. `00xx_v3_workforce_people.sql` — table + RLS + grants
4. `00xx_v3_evidence_links.sql` — table + backfill primary links + kind enum values
5. `00xx_v3_domain_events.sql` — table + RLS + write RPC
6. `00xx_v3_equipment_asset_columns.sql` — additive columns
7. `00xx_v3_jobs_work_order_columns.sql` — additive columns + work_types seed

### Rollback

- Prefer **forward-fix** migrations.
- New tables can be left in place if feature-flagged off.
- Do not drop columns that may contain data; stop writers via API flag if revert needed.
- Entitlements RPC must remain able to return legacy `features` even if capabilities empty.

### Feature flags

Optional `feature_flags` rows: `v3_capabilities`, `v3_workforce_people`, `v3_domain_events` — default off in production until Task acceptance, then on.

---

## 15. API contracts affected

| Endpoint | Change |
|----------|--------|
| `GET` session / entitlements consumers | Parse optional `capabilities`, `plan_label` |
| `GET /workspaces/{id}/usage` | May expose new capability meters later; Phase 1 minimal |
| `GET/POST/PATCH .../workforce/people` | **New** |
| `POST .../documents/{id}/links` | **New** |
| `GET .../documents?parent_type&parent_id` | Include linked evidence |
| `GET .../events` | **New** (audit-gated) |
| Jobs CRUD | Accept/return new optional fields |
| Equipment CRUD | Accept/return new optional fields |
| Platform admin override APIs | Capability override write (if exposed); else service-role only Phase 1 |

All mutations: `authorize()` + tenancy.

---

## 16. Frontend contracts affected

| Area | Phase 1 change |
|------|----------------|
| `@site-secure/authz` | Labels Free/Pro/Enterprise; helpers `getCapability()`, `planLabel()` |
| Session typing | `capabilities?: Record<string, {enabled, limit}>` |
| Settings → Team | Optional thin People list behind flag (or API-only Phase 1) |
| Jobs / Site / Equipment forms | Do not require new fields in UI yet |
| Homepage | **No change** |
| Nav | **No new modules** in nav until Phase 2+ |

Prefer **API + catalog + minimal settings surface**; avoid large UX in Phase 1.

---

## 17. Test strategy

| Layer | Coverage |
|-------|----------|
| Unit | Capability precedence matrix; label mapping; Person user/membership consistency |
| API | CRUD people; evidence link attach/deny; events emitted on job complete |
| Live | Entitlements RPC override; fail-closed on RPC error; cross-tenant deny |
| Regression | Existing quote/customer/job/quota/invite tests green |

---

## 18. Security tests

- Cross-workspace: cannot read people/events/links of other tenants.
- Override write: non-platform/non-privileged denied.
- Evidence link to invisible parent → `SCOPE_DENIED` / `PERMISSION_DENIED`.
- Domain events: no update/delete for authenticated.
- Entitlements RPC failure → deny feature-gated actions (existing behavior preserved).
- No secrets in `domain_events.payload` (assert redaction helper).

---

## 19. Tenancy / isolation tests

- RLS policies on all new tables (`FORCE ROW LEVEL SECURITY`).
- Assigned-scope technician cannot list all workforce people (Phase 1 managerial-only list OK).
- Document link cannot escalate site visibility.

---

## 20. Regression gates (must stay green)

- Auth session + invite accept  
- Customer/Site CRUD  
- Quote create/send/public approve/PDF  
- Job start/complete + checklist  
- Hard quotas customers/quotes/storage  
- Entitlements overrides (`test_entitlements_live`)  
- Cross-tenant isolation suite  
- Service-role boundary tests  

### Additional acceptance gates (amendments)

**Capability**

- [ ] Conflicting legacy/new entitlement behavior deterministic (fail closed)
- [ ] Missing capability fails closed
- [ ] Disabled + limit=0 does not grant unlimited access
- [ ] Workspace override cannot leak to another tenant

**Person**

- [ ] Cross-workspace membership link rejected
- [ ] `assigned_person_id` from another workspace rejected
- [ ] Person without login remains valid
- [ ] Person alone never grants authorization
- [ ] `assigned_person_id` alone does not grant job access (A9)

**Evidence**

- [ ] Cross-workspace document/parent linking rejected
- [ ] Invalid / reserved parent type rejected
- [ ] Missing parent rejected
- [ ] Evidence link does not escalate parent visibility
- [ ] Reserved future types not attachable before domain exists

**Domain Events**

- [ ] Critical event written atomically with critical mutation
- [ ] Event immutable
- [ ] Retry does not create misleading duplicate critical event
- [ ] Payload redaction policy enforced
- [ ] Cross-tenant event read denied

**Work Types / Asset**

- [ ] Cross-workspace `work_type_id` rejected
- [ ] Asset/site/customer consistency enforced

---

## Phase 1 Task breakdown

Each task is independently reviewable/testable, small, and backward compatible unless noted.

**Approved order (do not parallelize foundations):**

`P1-T01` → `P1-T02` → `P1-T03` → `P1-T04` → `P1-T07` → (`P1-T05` ∥ `P1-T06` ∥ `P1-T08` ∥ `P1-T09`) → `P1-T10`

Do not start multiple implementation tasks until capability resolver + events model (through T07) are verified.

### P1-T01 — Plan labels Free / Pro / Enterprise

**Scope:** catalog.json labels; `plans` SQL labels; `planLabel()` consumers; i18n usage surfaces.  
**Not in scope:** key rename; billing provider.  
**AC:**
- [ ] UI shows Free/Pro/Enterprise for solo/business/enterprise
- [ ] DB keys unchanged; subscriptions untouched
- [ ] No new `plan ===` feature branches introduced

### P1-T02 — Capability registry + plan_capabilities seed

**Scope:** migrations for `capabilities`, `plan_capabilities`; seed Free/Pro/Enterprise defaults; docs for TBD quotas.  
**AC:**
- [ ] Tables exist with RLS/grants as catalog tables
- [ ] Every Phase 0 example capability key exists
- [ ] Legacy features still seeded

### P1-T03 — Entitlements RPC + AuthzContext capabilities

**Scope:** extend `my_workspace_entitlements`; parse in `deps.py`; keep fail-closed; optional `AuthzContext.capabilities`.  
**AC:**
- [ ] Old clients using `features` only still work
- [ ] Override enabled/limit precedence tests pass
- [ ] RPC error → empty entitlements / deny

### P1-T04 — Workspace capability overrides + audit

**Scope:** `workspace_capability_overrides`; writer (platform admin or privileged API); emit `capability.override_set`; keep `workspace_feature_overrides` working.  
**AC:**
- [ ] Boolean + limit override works
- [ ] Audit/domain event recorded
- [ ] Cross-tenant deny

### P1-T05 — workforce_people foundation

**Scope:** table, RLS, API list/create/patch, permissions stubs, optional link to membership.  
**AC:**
- [ ] Person without user allowed
- [ ] Unique user/membership constraints enforced
- [ ] Does not change invite/seat logic
- [ ] Domain events on create/update

### P1-T06 — Evidence links

**Scope:** table, backfill primary links, kind enum extensions, link API, query-by-parent.  
**AC:**
- [ ] Existing uploads still work
- [ ] Supporting second parent without file copy
- [ ] Authz on parent visibility
- [ ] Cascade on document delete

### P1-T07 — Domain events infrastructure

**Scope:** table, writer helper, emit from job create/assign/start/complete + document complete; read API audit-gated.  
**AC:**
- [ ] Events immutable via API
- [ ] job.completed appears after complete
- [ ] Tenant isolation
- [ ] Payload has no tokens/PII beyond ids/names policy

### P1-T08 — Equipment Asset additive columns

**Scope:** migration + API schema fields; mapping category→asset_type_key; emit `asset.updated` on patch.  
**AC:**
- [ ] Old equipment payloads valid
- [ ] New fields optional
- [ ] No `assets` table created

### P1-T09 — Jobs Work Order additive columns + work_types

**Scope:** `workspace_work_types` seed; job columns; API optional fields; origin ids unconstrained uuid for now.  
**AC:**
- [ ] Existing job start/complete unchanged
- [ ] Can set priority/instructions/work_type_id
- [ ] assigned_person_id accepts workforce_people in workspace
- [ ] Status enum unchanged

### P1-T10 — Catalog permissions + regression pack

**Scope:** permission_feature entries; grant matrix updates; CI checklist doc; run regression gates.  
**AC:**
- [ ] All gates green
- [ ] Phase 1 flag documentation
- [ ] No homepage/nav module leak for unshipped pillars

---

## Suggested implementation order

```
T01
 → T02 → T03 → T04 → T07
 → T05 ∥ T06 ∥ T08 ∥ T09
 → T10
```

Foundational capability resolver (T02–T04) and critical events (T07) must be verified before parallel entity tasks.

---

## Explicit Phase 1 out-of-scope checklist

- [ ] Inspection templates/runs/findings/CA  
- [ ] Patrol checkpoints/scans  
- [ ] Shift scheduling UI  
- [ ] Job status enum expansion / full FSM  
- [ ] SITE AI  
- [ ] Homepage rewrite  
- [ ] Enterprise pricing calculator  
- [ ] Plan key rename `solo`→`free`  
- [ ] Security Twin / Cyber schemas  

---

## Approval

| Approver | Item | Sign-off |
|----------|------|----------|
| Product | Scope / TBD quotas placeholders OK | APPROVED |
| Architecture | Schema + SoT + A1–A10 | APPROVED |
| Security | Entitlement precedence + RLS + tenant integrity | APPROVED |
| Eng | Task breakdown & regression gates | APPROVED |

**Authorized next step:** implement **P1-T01 only**. Do not begin P1-T02 until T01 reviewed.
