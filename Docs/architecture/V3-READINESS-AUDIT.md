# SITE SECURE V3 — Full Readiness Audit (A–L)

**Status:** APPROVED — Phase 0 decisions locked; see V3-PHASE0-DECISION-MEMO.md + V3-PHASE1-TECHNICAL-SPEC.md  
**Date:** 2026-09-11  
**Live project:** SiteSecureV1 (`rhxqqudlngimhplvndmz`)  
**Inputs:** live Postgres tables + quotas, `packages/authz/catalog.json`, FastAPI `authorize()`, web IA (`app-nav.ts`), migrations, prior `SITE_SECURE_CURRENT_STATE_AUDIT.txt` / Master Blueprint  
**Rule:** Audit → Architecture approval → Implementation. Preserve existing CPQ/CRM/field job functionality.

Companion interactive summary: Cursor canvas `v3-readiness-audit.canvas.tsx`.

---

## Verdict

SITE SECURE can become a **Modular Operations Platform** by **extending the existing Core**, not by rewriting it.

| Layer | Reality |
|-------|---------|
| Commercial Core (CRM, Quotes/CPQ, PDF, catalog, tenancy) | **Production-strong** |
| Access Core (RBAC `authorize()`, scopes, plans, overrides, hard quotas) | **Working foundation** — needs capability-model upgrade |
| Operational Core (jobs, service, checklists, systems/equipment) | **Partial / schema-ahead / usage-cold** |
| V3 pillars (Workforce, Inspections/Patrol, SITE AI, Enterprise configurator) | **Mostly missing** — build on shared entities |

**Live usage skew (critical):** ~529 workspaces, 867 quotes, 662 customers, 173 sites — but **22 jobs, 3 service calls, 0 systems, 0 equipment, 6 assignments**. The product is commercially used; the physical/ops twin is not yet activated.

---

# A. CURRENT STATE

## A.1 Stack

| Surface | Implementation |
|---------|----------------|
| Public web | `apps/web` `/` marketing (security-ops / Site File messaging) |
| Auth web | `apps/web` `/app/*` Hebrew RTL SPA |
| API | FastAPI `apps/api` — `authorize()` on mutations |
| Data | Supabase Auth + Postgres RLS + Storage |
| Authz catalog | `packages/authz/catalog.json` (API SoT) + SQL seeds |
| Mobile native | Not present — responsive/PWA-oriented web field UX |
| AI/LLM | Feature flag `ai` only — no model integration |

## A.2 Domain entities that exist today

| Entity | Table / surface | Maturity |
|--------|-----------------|----------|
| Workspace | `workspaces`, settings, counters | Strong |
| Profile / membership | `profiles`, `workspace_memberships` | Strong |
| Roles / permissions | `roles`, `permissions`, `role_permissions`, `workspace_roles` | Strong catalog; custom roles partial |
| Plans / features | `plans`, `features`, `plan_features`, `plan_limits`, `subscriptions` | Working |
| Feature overrides | `workspace_feature_overrides` | Working (1 live row) |
| Customers / contacts | `customers`, `customer_contacts` | Strong |
| Leads | `leads` | Working (thin usage) |
| Sites / zones / timeline | `sites`, `site_zones`, `site_timeline_events` | Sites strong; zones/timeline unused |
| Systems / equipment | `systems`, `equipment` | Schema ready, **0 rows** |
| Catalog / products | `products`, categories, packages | Strong |
| Quotes / CPQ / public share | quotes*, public tokens, PDF studio | Strong |
| Projects | `projects` | Working (thin) |
| Jobs | `jobs` (kinds: installation/service/maintenance/survey/other) | Partial FSM |
| Service calls / contracts | `service_calls`, `service_contracts` | List-level / schema |
| Assignments | `assignments` (site/job/project/service_call/customer) | Working, barely used |
| Tasks | `tasks` (calendar substitute) | Partial |
| Checklists | templates + `job_checklist_items` | Thin boolean items |
| Documents | `documents` (entity_type polymorphic) | Working evidence foundation |
| Audit | `audit_logs` | Partial coverage |
| Notifications | tables exist | **No product API/UI** |
| PDF templates | `pdf_document_templates` | Working for quote/service/project |
| Company profile | settings + logo | Working |
| Platform admin | `/admin`, beta participants | Working |

## A.3 Capability map (requested inventory)

| Capability | Status | Where |
|------------|--------|-------|
| Workspaces | EXISTS | create_workspace, multi-tenant RLS |
| Customers | EXISTS | CRM |
| Leads | EXISTS | CRM |
| Sites | EXISTS | Site dossier |
| Projects | EXISTS | Ops |
| Quotes / CPQ | EXISTS | Strong path |
| Catalog | EXISTS | Import + hierarchy |
| Tasks | PARTIAL | Used as “יומן” |
| Team | EXISTS | Members, invites, seats |
| Roles / Permissions | EXISTS | Catalog + workspace_roles |
| Documents / Photos | EXISTS | Storage + signed URLs |
| Audit | PARTIAL | Viewer + incomplete writers |
| Notifications | SCHEMA ONLY | 0021 |
| PDF generation | EXISTS | Quotes + template studio |
| Company Profile | EXISTS | Settings |
| Storage | EXISTS | Quotas + reservations |
| Subscription / Plan | EXISTS | solo/business/enterprise |
| Entitlements | EXISTS | `my_workspace_entitlements` |
| Feature Overrides | EXISTS | Boolean only |
| Usage / Quotas | EXISTS | seats, clients, quotes, storage_gb |
| Mobile UX | PARTIAL | Responsive field job / Today / bottom nav |
| Technician workflows | PARTIAL | Start/complete job, checklist, docs |

## A.4 Live plan / quota snapshot

| Plan | Subs | Seats op/field | Clients | Quotes | Storage |
|------|------|----------------|---------|--------|---------|
| solo | 491 | 1 / 3 | 30 | 50 | 15 GB |
| business | 22 | 15 / 40 | 150 | 200 | 100 GB |
| enterprise | 14 | 0 (=unlimited) | 0 | 0 | 0 |

Effective features = plan features **COALESCE** `workspace_feature_overrides.enabled` (aligned RPC + `auth_feature`).

## A.5 Authorization pipeline (already correct separation)

```
Auth → Tenant active → Subscription valid → Feature included
  → Role grants → Scope (all|owned|assigned|team) → Resource state → Business rules
```

Deny codes include `FEATURE_NOT_INCLUDED`, `PLAN_LIMIT_REACHED`, `PERMISSION_DENIED`, `SCOPE_DENIED`.  
**UI hiding is not auth** — already documented and enforced server-side for core mutations.

---

# B. GAP ANALYSIS (for V3)

| V3 need | Gap | Severity |
|---------|-----|----------|
| Single shared Person operational profile | Membership ≠ workforce profile | High |
| Workforce scheduling / shifts / certs | Missing | High |
| Inspections form builder | Checklist is job boolean only | High |
| Findings → Corrective Action → Verification | Missing | High |
| Patrol checkpoints / QR / timeline / missed scans | Missing | High |
| Work Order full FSM (request→dispatch→evidence→sign→report) | Jobs partial; no signature/parts/SLA close loop | High |
| Configurable work types beyond CCTV enums | `job_kind` enum limited; equipment categories CCTV-biased | Medium |
| Cross-module event bus | No domain events / outbox | High |
| Evidence multi-link graph | Documents single `entity_type`/`entity_id` | Medium |
| SITE AI retrieval + actions | Feature key only | High |
| Capability entitlements (not only booleans) | Boolean features + few quotas | High |
| Free/Pro naming | Keys are solo/business; prior lock opposed Free | Product decision |
| Enterprise deal configurator → provisioned entitlements | Overrides manual; no calculator/UI | High |
| Role-aware progressive UX for patrol/inspector | Nav still sales/ops/technician shaped | Medium |
| Homepage pillar messaging | Still security-company / Site File / Digital Twin | Medium |
| Notifications / realtime ops alerts | Schema only | Medium |
| Asset history activation | systems/equipment unused | High for Field+AI |
| Assigned-scope real usage | 6 assignments | Medium |
| Dual catalog drift (JSON vs SQL) | Ongoing risk | Medium |
| SECURITY DEFINER EXECUTE exposure to anon (advisor) | Hardening backlog | Medium |
| Native offline sync | Spec exists; not productized | Medium |

**Does not need rebuilding:** workspace tenancy, customers/sites spine, CPQ, PDF, `authorize()`, seats/quotas foundation, document storage, public quote flow.

---

# C. DOMAIN MODEL (target SoT)

## C.1 Canonical shared entities

```
Workspace
  └── Customer
        └── Site
              ├── Asset          ← SoT: extend equipment (+ systems)
              ├── Checkpoint     ← NEW (patrol)
              ├── Document/Evidence links
              └── Work / Inspection history

Person                 ← SoT: profiles + membership + NEW operational_profile
  ├── Team memberships
  ├── Skills / Certifications
  ├── Shifts / Availability
  └── Assignments (Work, Inspection, Patrol unit)

WorkOrder              ← SoT: extend jobs (alias in product language)
  ├── optional Request/Intake ← extend service_calls
  ├── Checklist/Inspection run refs
  └── Evidence links

InspectionTemplate / InspectionRun   ← evolve checklist_* 
  ├── Responses / Findings
  └── CorrectiveActions → may spawn WorkOrder

Evidence               ← evolve documents + link table
  └── linkable to Site, Asset, WorkOrder, Inspection, Finding, Person

AuditEvent / DomainEvent
```

## C.2 Source-of-truth decisions (recommended)

| Concept | SoT | Do not create |
|---------|-----|---------------|
| Site | `sites` | duplicate site tables per module |
| Customer | `customers` | — |
| Asset | `equipment` (+ `systems`) | parallel `assets` table |
| Person | `profiles` + `workspace_memberships` + `person_profiles` | separate “employees” user store |
| Work Order | `jobs` | parallel `work_orders` |
| Service Request | `service_calls` | — |
| Evidence blob | `documents` | copy files per parent |
| Evidence relations | NEW `evidence_links` | duplicate storage objects |
| Commercial quote | `quotes` | — |
| Entitlement boolean/capability | plan + overrides (+ NEW capability values) | hard-code in pages |

## C.3 Naming aliases (product vs persistence)

| Product language | Persistence |
|------------------|-------------|
| Work Order | `jobs` |
| Asset | `equipment` |
| Free / Pro / Enterprise | map onto `solo` / `business` / `enterprise` **or** migrate keys after approval |
| SITE AI context | permission-filtered views over shared tables |

---

# D. MODULE MAP

```
                    ┌─────────────────────────────┐
                    │      SITE SECURE CORE        │
                    │ Customer Site Asset Person   │
                    │ Work Evidence Audit Entitlements │
                    └─────────────┬───────────────┘
           ┌──────────────┬───────┴────────┬──────────────┐
           ▼              ▼                ▼              ▼
      SITE AI        Workforce     Inspections &     Technical /
                                   Compliance        Field Service
```

| Module | Depends on | Produces |
|--------|------------|----------|
| **Field Service** | Site, Asset, Person, Evidence | Work history, reports |
| **Inspections** | Site, Asset, Person, Evidence | Findings, CA, patrol events |
| **Workforce** | Person, Teams | Shifts, qualifications, dispatch candidates |
| **SITE AI** | All above + Quotes/Projects (scoped) | Answers, proposed actions (never direct mutate without confirm) |
| **Commercial** (existing) | Customer, Site, Catalog | Quotes, projects seed |

**Anti-pattern forbidden:** separate “Workforce Sites” or “Inspection Customers”.

---

# E. RBAC MATRIX (V3 direction)

Keep pipeline: **Plan ≠ Entitlement ≠ Permission ≠ Scope**.

## E.1 Proposed system roles (extend, don’t replace)

| Role key | Intent | Default scope |
|----------|--------|---------------|
| `owner` | Full workspace + billing | all |
| `administrator` | Ops admin | all |
| `manager` | Dispatch / compliance ops | team |
| `sales` | CRM/CPQ | owned |
| `technician` | Field execution | assigned |
| `inspector` | **NEW** inspections | assigned |
| `patrol_officer` | **NEW** scans / shift sites | assigned |
| `dispatcher` | **NEW** schedule/assign | team |
| `viewer` | Read | all |
| custom via `workspace_roles` | Org-specific | inherits base_role scope |

> `founding_technician` is being retired in migrations; do not re-center V3 on it.

## E.2 Permission groups to add

| Group | Examples |
|-------|----------|
| workforce.* | `workforce.view`, `workforce.manage`, `shifts.edit`, `certs.manage`, `dispatch.assign` |
| inspections.* | `inspections.view`, `inspections.run`, `templates.manage`, `findings.manage`, `corrective.assign` |
| patrol.* | `patrol.scan`, `patrol.schedule.manage`, `patrol.report.view` |
| field.* | keep/extend `jobs.*`, `service.*`; add `jobs.parts`, `jobs.signature`, `jobs.report` |
| evidence.* | `evidence.view`, `evidence.upload`, `evidence.delete` (stricter than docs.delete) |
| site_ai.* | `site_ai.query`, `site_ai.propose_action`, `site_ai.confirm_action` |

## E.3 Scope rules (unchanged principles)

| Scope | Meaning |
|-------|---------|
| all | Workspace-wide (still tenant-bound) |
| owned | owner_user_id |
| assigned | assignments / shift sites / patrol unit |
| team | operational without billing |

**Patrol Officer example:** entitlement Workforce/Inspections Pro may be on workspace, but role only grants `patrol.scan`, `inspections.run`, `evidence.upload`, `sites.view` (assigned). No `users.manage`, no quotes, no template edit, no evidence delete.

## E.4 AI rule

Every AI action: **Intent → `authorize(action)` → Preview → User confirm → Execute via same API path → Audit** (`ai.proposed`, `ai.confirmed`, `ai.executed`).

---

# F. ENTITLEMENT MATRIX

## F.1 Capability model (target)

Move from boolean-only features toward **capability keys** (boolean + numeric):

| Capability | Free (solo) | Pro (business) | Enterprise |
|------------|-------------|----------------|------------|
| `core.*` CRM/Sites | ✓ limited quotas | ✓ higher | custom |
| `quotes.*` / catalog | ✓ | ✓ | custom |
| `field_service.enabled` | ✓ basic jobs | ✓ advanced | custom |
| `field_service.monthly_work_orders` | low | higher | custom/0 |
| `inspections.enabled` | basic templates | ✓ builder | custom |
| `inspections.monthly_runs` | low | higher | custom |
| `inspections.custom_templates` | ✗ / limited | ✓ | ✓ |
| `inspections.patrol_checkpoints` | ✗ | ✓ | ✓ |
| `workforce.enabled` | ✗ or read-only roster | ✓ | ✓ |
| `workforce.max_workers` | — | cap | custom |
| `workforce.scheduling` | ✗ | ✓ | ✓ |
| `workforce.certifications` | ✗ | ✓ | ✓ |
| `site_ai.enabled` | limited Q&A | ✓ + recommendations | custom allowance |
| `site_ai.monthly_usage` | low | medium | custom |
| `site_ai.actions` | ✗ | ✓ | ✓ |
| `api` / `audit` / `sso` | per today | business+ | enterprise/custom |

Exact numbers: **TBD after usage/cost analysis** (do not hard-code fake limits now).

## F.2 Plan key decision (requires approval)

| Option | Pros | Cons |
|--------|------|------|
| **A. Keep keys** `solo`/`business`/`enterprise`; market as Free/Pro/Enterprise | Zero migration risk | Naming drift forever |
| **B. Rename keys** to `free`/`pro`/`enterprise` | Matches V3 product language | Migration of 527 subscriptions + catalog + tests |

**Recommendation:** Option A short-term (labels only), Option B only with a dedicated migration task after Enterprise configurator design.

## F.3 Overrides

Keep `workspace_feature_overrides` and extend toward **`workspace_capability_overrides`** (key, enabled, limit_value, reason, set_by, audited). Enterprise configurator writes here after deal approval — not quote-only.

---

# G. EVENT / WORKFLOW MAP

## G.1 Cross-module happy path

```
InspectionRun (fail)
  → Finding (severity)
    → CorrectiveAction (SLA)
      → WorkOrder (jobs) created (manual confirm or automation if entitled)
        → Workforce Assignment / Shift-aware dispatch
          → Field execution + Evidence links
            → Verification on Finding
              → Finding closed
                → Site history + DomainEvent
                  → SITE AI index/context update (async)
```

## G.2 Patrol path

```
PatrolSchedule (site, window, checkpoints[])
  → ScanEvent (checkpoint, person, unit, device, geo?, ts)
    → Compliance evaluation (complete/late/missed/duplicate)
      → DailyPatrolReport
        → DomainEvents for AI / notifications
```

## G.3 Event contract (minimal)

`domain_events` (or audit subtype) fields: `workspace_id`, `type`, `aggregate_type`, `aggregate_id`, `actor_user_id`, `payload`, `created_at`, `correlation_id`.

Consumers: notifications, AI indexer, report generators, automations (feature-gated).

**No silent cross-module writes without audit.**

---

# H. ENTERPRISE CONFIGURATOR DESIGN

## H.1 Actors

- SITE SECURE Platform Admin (existing `is_platform_admin`)
- Optional internal sales operator role later

## H.2 Flow

1. **Draft Deal** — select base package, users, sites, storage, modules, AI allowance, API, SSO, audit retention, support tier, add-ons  
2. **Price calculation** — deterministic pricing table (versioned) → monthly/annual  
3. **Internal approval** — optional  
4. **Provision** — write subscription plan_key=`enterprise` + capability overrides + limits; emit audit `enterprise.provisioned`  
5. **Customer sees** effective entitlements via existing `my_workspace_entitlements` (extended)

## H.3 Data

| Table (conceptual) | Purpose |
|--------------------|---------|
| `enterprise_pricebook` | Versioned unit prices |
| `enterprise_deals` | Draft/approved configurations + price snapshot |
| `workspace_capability_overrides` | Runtime entitlements after provision |
| `platform_admin_events` | Already exists — extend for deal audit |

## H.4 Non-goals (v1 configurator)

- Public self-serve Enterprise checkout  
- Automatic Stripe metering (can come later)  
- Customer-editable Enterprise limits

---

# I. UX / IA PROPOSAL

## I.1 Principles

- **Role + entitlement aware nav** (already started in `app-nav.ts`)  
- Progressive complexity: Solo/Free owner sees CRM + basic field; Patrol sees Today/Scan only  
- Contextual Quick Actions on Site / Person / Finding / Work Order  
- Mobile-first for scan, inspection run, job execution

## I.2 Target nav groups (entitlement-gated)

| Group | Items |
|-------|-------|
| Overview | Dashboard / Today / Schedule |
| Commercial | Customers, Leads, Quotes, Catalog *(existing)* |
| Sites | Sites, Assets |
| Field Service | Work Orders, Service Desk, Dispatch |
| Inspections | Templates, Runs, Findings, Patrol |
| Workforce | People, Teams, Shifts, Certifications |
| Intelligence | SITE AI |
| System | Settings, Roles, Audit, Billing |

## I.3 Persona shells

| Persona | Home | Primary CTAs |
|---------|------|--------------|
| Owner | Ops dashboard | New quote, invite, usage |
| Dispatcher/Manager | Schedule board | Assign, create WO |
| Technician | Today | Start job, upload evidence |
| Inspector | Assigned inspections | Start run, capture finding |
| Patrol officer | Shift timeline | Scan checkpoint |
| Sales | Pipeline (wire or replace unused SalesSnapshot) | New lead/quote |

## I.4 Mobile

Extend existing bottom nav pattern (`בית · לקוחות · עבודה · משימות · עוד`) with Work sheet entries for Scan / Inspections when entitled — **do not** dump full desktop sidebar onto mobile.

---

# J. HOMEPAGE PLAN

Current public copy positions SITE SECURE as a **security operations platform for security companies** (Site File, Digital Twin, technicians/devices).

## J.1 Required messaging shift

**Hero:** “One operational platform for sites, teams and field work.”

## J.2 Sections to change

| Section | Change |
|---------|--------|
| Hero | Brand + new UVP; CTA Free start + Enterprise contact |
| Pillars | SITE AI · Workforce · Inspections & Compliance · Technical & Field Service |
| Connection story | Site → Inspection → Finding → Work Order → Workforce → Field → Evidence → AI |
| Pricing | Free / Pro / Enterprise (labels); Enterprise CTA → configuration request |
| Preview chrome | Show connected ops (not only CCTV install card) |
| ICP language | Broaden beyond installers while **keeping** security/field credibility |

## J.3 Preserve

Hebrew/RTL quality, trust/security claims discipline, auth doors `/login` `/register`, no fake tenant data.

## J.4 Do not ship homepage rewrite before

Product architecture approval (this doc) + plan naming decision — otherwise marketing and product diverge again.

---

# K. MIGRATION PLAN (no production break)

## K.1 Strategy

**Strangler / expand-in-place** on Core entities. No big-bang rewrite. Feature flags for new modules.

## K.2 Phased data migration

| Step | Action | Risk control |
|------|--------|--------------|
| 1 | Document SoT aliases (Job=WO, Equipment=Asset) in API/UI | Dual naming, same IDs |
| 2 | Add nullable operational columns / side tables (`person_profiles`, `evidence_links`) | Backfill null-safe |
| 3 | Generalize enums via lookup tables where needed (`work_types`) | Keep old enum values readable |
| 4 | Evolve checklists → inspection templates with compatibility shim for `job_checklist_items` | Old jobs still open |
| 5 | Capability entitlements additive; old boolean features continue to resolve | Fail-closed on unknown |
| 6 | Plan label mapping Free/Pro without key rename first | Avoid 527-row subscription rewrite |
| 7 | Activate systems/equipment UX so Asset spine gets data | Required before AI quality |
| 8 | Homepage/IA only after Phase 0–1 contracts locked | Prevent false promises |

## K.3 Regression gates (must stay green)

- Auth session / invite accept  
- Customer/Site CRUD + assigned scope  
- Quote create/send/public approve/PDF  
- Job start/complete + checklist  
- Quota enforcement  
- Cross-tenant isolation tests  
- Entitlements RPC / overrides  

## K.4 Rollback

Module flags off; new tables nullable; no destructive drops of quotes/customers/sites/jobs.

---

# L. IMPLEMENTATION ROADMAP

Each phase is independently verifiable. **Do not start Phase 2+ until Phase 0 acceptance is signed off.**

## Phase 0 — Architecture locks (1–2 weeks)

**Deliverables:** this audit approved; SoT decisions locked; capability catalog draft; event schema draft; plan naming decision; AI RBAC contract.

**Acceptance:**
- [ ] Written approval of SoT table (C.2)
- [ ] Plan key Option A or B chosen
- [ ] Module dependency map accepted
- [ ] Non-negotiable principles checklist signed

## Phase 1 — Core abstractions

**Tasks:**
1. `person_profiles` + skills/certs stubs  
2. `evidence_links` on documents  
3. Work type configuration (compat with `job_kind`)  
4. Capability entitlement schema + resolver behind existing authorize  
5. Domain event writer (minimal)

**Acceptance:**
- [ ] Existing CPQ/jobs unchanged for users without new flags  
- [ ] Entitlement resolver returns legacy booleans + new caps  
- [ ] Evidence can link to 2+ parents without file copy  
- [ ] Audit on entitlement override changes  

## Phase 2 — Technical / Field Service depth

**Tasks:** dispatch/schedule UI, assignment UX, mobile job context pack, signature, service report PDF, parts/asset change hooks.

**Acceptance:**
- [ ] Request→WO→Assign→On-site→Complete→Report path works on mobile  
- [ ] Site/Asset history updated  
- [ ] RBAC on every mutation  
- [ ] No regression on quote→project→job  

## Phase 3 — Inspections & Compliance (+ Patrol)

**Tasks:** dynamic form builder, runs, findings, corrective actions, checkpoint registry, scan API, daily patrol report.

**Acceptance:**
- [ ] Template with conditional fields + photo/signature  
- [ ] Fail→Finding→CA→optional WO  
- [ ] Patrol window with missed/late/duplicate detection  
- [ ] Report export + events visible to entitled roles  

## Phase 4 — Workforce

**Tasks:** teams, shifts, availability, certification expiry, dispatch suggestions, workload views.

**Acceptance:**
- [ ] Person assignable across WO/Inspection/Shift without duplicate records  
- [ ] Cert expiry creates workforce task (entitled)  
- [ ] Patrol/technician scheduling without assuming all are technicians  

## Phase 5 — SITE AI + Enterprise configurator

**Tasks:** permission-scoped retrieval Q&A; propose-action flow; usage metering; Enterprise pricebook + provisioner; homepage pillar refresh.

**Acceptance:**
- [ ] AI cannot read/write beyond `authorize()`  
- [ ] Confirm-required for mutating actions + audit trail  
- [ ] Enterprise deal → live entitlements  
- [ ] Homepage matches shipped modules (no vapor pillars)

---

## Technical debt that blocks V3 (priority)

1. Boolean-only entitlements (cannot express patrol/AI quotas cleanly)  
2. No domain event / outbox model  
3. Checklist model too weak for inspections  
4. Person model too weak for workforce  
5. systems/equipment unused (AI/field context empty)  
6. Catalog JSON vs SQL drift  
7. Notifications product absent  
8. Advisor: broad SECURITY DEFINER EXECUTE grants — harden before AI/tools expand attack surface  
9. Storage ACL coarser than document RBAC (existing G-024)  
10. Homepage/product language drift vs prior security-twin blueprint — reconcile explicitly

---

## Relationship to prior blueprint

`SITE_SECURE_MASTER_PRODUCT_BLUEPRINT.md` targeted a **Security Operations Platform** (twin, cyber health, CCTV-centric ICP).  
This V3 brief **widens** the product to a **Modular Operations Platform** (Workforce, Patrol, Inspections, SITE AI) while **keeping** the Site spine and commercial Core.

**Explicit reconciliation required before coding:**
- Keep Digital Twin / cyber as later Enterprise add-ons under Assets/Inspections, **or** demote in near-term roadmap  
- Replace “no Free near-term” lock if Free/Pro marketing is mandatory  
- Confirm Asset SoT remains `equipment`

---

## Approval checklist

- [ ] A Current State acknowledged  
- [ ] B Gaps prioritized  
- [ ] C Domain SoT approved  
- [ ] D Module map approved  
- [ ] E RBAC direction approved  
- [ ] F Entitlement / plan naming approved  
- [ ] G Event workflows approved  
- [ ] H Enterprise configurator approved  
- [ ] I UX/IA approved  
- [ ] J Homepage timing approved  
- [ ] K Migration constraints approved  
- [ ] L Phase 0–1 authorized to start (only)

**Next step after approval:** Phase 0 decision memo (plan keys, SoT aliases, first module to build) — still no broad feature coding until that memo is accepted.
