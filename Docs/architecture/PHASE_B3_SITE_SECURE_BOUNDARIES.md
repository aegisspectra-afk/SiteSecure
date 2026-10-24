# Phase B3 — Site Secure Boundary Audit & Extraction Plan

**Document status:** Phase B3 — documentation only (no product code changes)  
**Date:** 2026-10-19  
**Parents:** `PRODUCT_BOUNDARIES.md` (B1), `PHASE_B2_1_IMPLEMENTATION.md` (B2.1)  
**Scope:** Actionable ownership map and staged plan to separate **Site Secure** from **Platform Core** later, without breaking `/app/*` or existing diffs  

### Legend

| Marker | Meaning |
|--------|---------|
| **Fact** | Verified in repository code and/or migrations in this phase or cited parent docs |
| **Decision** | Binding guidance for B3 planning |
| **Proposal** | Forward-looking recommendation; not implemented |
| **Assumption** | Reasonable inference; not re-proven here |
| **Open** | Requires a later approved decision |

> This document **does not repeat** full SSP/FLEET extraction risk tables from B1. It adds Site Secure–specific ownership, API/DB boundaries, and an extraction sequence relative to Core.

---

## 1. Purpose and framing

### 1.1 What “extract Site Secure” means

**Decision:** Site Secure extraction means a future deployable (or clear package boundary) that owns CRM/ops **domain** APIs and `/app/*` product UI, while **Platform Core** remains the source of truth for identity, tenancy, memberships, invitations, entitlements, Platform Home, and Platform Admin.

It does **not** mean:

- Moving Auth or `create_workspace` into Site Secure  
- Letting Site Secure grant product entitlements  
- Building `CustomerRef` / `SiteRef` cross-product contracts now (B1 Decision)  
- Splitting SSP/FLEET as part of B3 (planning only elsewhere)

### 1.2 Relationship to B1 progress sequence

B1 sequence: **Platform Core → Site Secure → SSP → FLEET**.

| Step | Status |
|------|--------|
| Platform Core hardening (B2 / B2.1) | Done (archive fail-closed; entitlement revoke UX; Home focus refresh) |
| **Site Secure boundary clarity (B3)** | **This document** |
| SSP extract (B4) | Future — after O4 (SSO) + approval |
| FLEET extract (B5) | Future — after B4 + FleetMaster approval + documents strategy |

**Decision (B3 nuance):** Physically extracting Site Secure as its **own host** should happen **after** SSP and FLEET are peeled off (or clearly isolated), because today SS is the residual bulk of the monolith. Until then, treat SS as a **logical product module** with hard ownership rules inside the shared `apps/api` + `apps/web`.

**Proposal — two horizons:**

1. **Horizon A (near):** Ownership + API module boundaries + contract freeze (no new Core←SS domain coupling).  
2. **Horizon B (later):** Separate Site Secure API/UI deployable that calls Core session/entitlement contracts.

---

## 2. Ownership map by component

### 2.1 Platform Core (must stay Core)

| Component | Evidence | Notes |
|-----------|----------|--------|
| Supabase Auth + `profiles` | **Fact:** B1; `deps.current_user` (B2.1a fail-closed archive) | Soft-archive SoT |
| `workspaces`, active workspace | **Fact:** `workspaces` router; `PUT /me/active-workspace` | Do not change `create_workspace` without separate approval |
| Memberships / role_key | **Fact:** memberships + authz context | Per-product roles = Open O6 |
| Invitations (workspace + admin) | **Fact:** `workspaces.py` invite routes; `admin` invitations | **Decision:** remain Core (aligns B1 O5 recommendation) |
| Entitlements / overrides / plans | **Fact:** RPC `my_workspace_entitlements`; admin product overrides | SS consumes only |
| Platform Home | **Fact:** `GET /platform/home`; UI `/platform` | Product picker — not SS dashboard |
| Platform Admin | **Fact:** `/admin`, `/api/v1/admin/*` | Cross-tenant |
| Product registry (code) | **Fact:** `platform_products.py` | Maps `site_secure` composite features → entry paths |

### 2.2 Site Secure (product domain)

| Component | Evidence | Notes |
|-----------|----------|--------|
| Customers, contacts, leads | **Fact:** B1 migrations; `customers` router | |
| Sites, systems, site assets | **Fact:** `sites`, `systems` | |
| Catalog, quotes, CPQ, CCTV design | **Fact:** `catalog*`, `quotes`, `quote_cpq`, `cctv`, `system_designs` | |
| Projects, jobs, service, tasks, warranties | **Fact:** `jobs`, `ops_modules`, related UI routes | |
| Search (CRM/ops fan-out) | **Fact:** `search.py` entities = customer/site/lead/quote/project/service/equipment | **Decision:** SS surface (B1 §8.6) |
| Dashboard / Today | **Fact:** `dashboard.py` quotes+jobs; UI `/app/dashboard`, `/app/today` | Entry from Home via `homeVariant` / `site_secure_entry_path` |
| Public quote customer flows | **Fact:** `public_quotes` | Product-owned public surface (distinct from `public_ssp`) |
| SS settings UX under `/app/settings/*` | **Fact:** settings routes (company, quotes, PDF, roles UI, users UI) | See §2.3 for which **APIs** stay Core |

### 2.3 Shared or split-careful (ambiguous today)

| Component | Classification | Verified fact | B3 decision / open |
|-----------|----------------|---------------|-------------------|
| `workspace_settings` API + table | **SS product config on Core tenancy key** | **Fact:** `workspace_settings.py` — branding, quotes, taxes, scheduling, notifications JSON, localization, PDF templates, workspace RBAC helpers | **Decision:** Logical owner = Site Secure. Physical `workspace_id` FK stays. On extract, settings API moves with SS; Core keeps workspace row only. |
| `team` (members, usage, security center, member audit list) | **Platform team ops, SS-hosted UI** | **Fact:** `team.py` under workspace prefix; settings Users UI calls it. **Fact:** usage meters also count SS-domain `quotes`/`customers` + storage (`authz/usage.py`) — Core API with SS quota coupling | **Decision:** API ownership = Core. UI may remain in SS shell until extract; do not move membership mutations into SS service. On Horizon B, usage may need a Core↔SS meter contract. |
| `documents` router + table | **Shared physical; logical by entity** | **Fact:** enum originally `customer,site,system,job,quote,project,warranty` (`0013`); later ALTERs add `equipment`, `workspace`, `vehicle`. Single mounted writer router `documents.py`. **Fact:** Fleet UI calls same API with `entity_type: "vehicle"` (`fleet/documents.tsx`). Note: `apps/api/app/documents/types.py` `DocumentType` = PDF/business kinds — distinct from DB `document_entity_type` | Keep B1 O1 open. SS extract must keep serving SS entity types; vehicle stays with FLEET strategy. |
| `audit_logs` / `write_audit` | **Shared workspace audit** | **Fact:** `write_audit` used across SS (~quotes/jobs/settings/team), Fleet, SSP, and Platform `workspaces` (invite paths) | B1 O2 open. **Proposal:** Core provides audit write primitive; products emit events. |
| `notifications` **table** | **Unclear write-site** | **Fact (B3):** API router grep shows `notifications` only as **JSON column** on `workspace_settings`, not row inserts into `notifications` table in `apps/api/app` | O3 remains Open; do not assign table to SS without write inventory. |
| `feedback`, `telemetry` | **Shared infra** | **Fact:** mounted in `main.py`; use authz context | **Decision:** stay with Core/API infra on extract. |
| `health` | Infra | **Fact** | Core / edge |
| App shell `/app` | **Shared SPA shell** | **Fact:** `routes/app/route.tsx` wraps AppShell; mounts SS + `/app/ssp` + `/app/fleet` | Horizon A: keep one shell. Horizon B: SS host owns shell without ssp/fleet mounts. |
| `packages/authz` + `catalog.json` | **Shared authorization catalog** | **Fact:** consumed by API engine | **Must not change without approval.** Extract needs versioned contract, not fork-by-accident. |
| `packages/api-client` | **Shared typed client** | **Fact:** session, platformHome, CRM, fleet, ssp methods in one package | **Proposal:** split or namespace modules before multi-host. |
| `packages/ui`, `design-system` | Shared presentation | **Fact** | Remain shared libraries. |

### 2.4 Explicit non-ownership (Site Secure must not own)

- Product entitlement grants / admin overrides  
- Platform Home registry beyond consuming `entry_path`  
- `ssp_*` / `public_ssp` / FleetMaster domain  
- Solo defaults / dual-write / `create_workspace` behavior  

---

## 3. Dependency matrix (Core ↔ Site Secure)

| Dependency | Direction | Verified? | Detail |
|------------|-----------|-----------|--------|
| JWT + `current_user` (incl. archive) | SS → Core | **Fact** | Every protected SS router uses `user_client` / `current_user` |
| `load_authz_context` + membership + workspace active | SS → Core | **Fact** | Standard authorize/require chain (B1 §5) |
| Effective features (`my_workspace_entitlements`) | SS → Core | **Fact** | SS features = composite set in `SITE_SECURE_FEATURES` (`platform_products.py`) |
| Action permissions (`authorize` / grants) | SS → Core catalog | **Fact** | `packages/authz` + server engine |
| Session JSON (`GET /auth/session`) | SS UI → Core | **Fact** | `useSession`; memberships[0], features, permissions |
| Active workspace switch | SS UI → Core | **Fact** | Clears RQ caches; used from Platform Home and settings |
| Platform Home entry into SS | Core → SS path | **Fact** | `entry_path` `/app/today` or `/app/dashboard` |
| Entitlement revoke UX | Core signals → SS UI | **Fact** | B2.1b `FEATURE_NOT_INCLUDED` → refresh; navigate `/platform` if SS product gone |
| SS domain tables → Core tables | SS → Core FKs | **Fact** (schema) | `workspace_id`, often `created_by` → `profiles` |
| Dashboard timezone | SS → Core | **Fact** | `dashboard.py` reads `workspaces.timezone` (beyond authz deps) |
| Team usage meters | Core → SS counts | **Fact** | Platform `team` usage aggregates SS quotes/customers/storage |
| Core → SS domain reads | Core → SS | **Fact (absence for Home)** | Home uses entitlements/permissions only, not CRM rows |
| SS → SSP domain | — | **Fact (absence)** | No ssp imports in sampled SS routers (e.g. customers); B1: no CRM FKs on ssp tables |
| SS → FLEET domain | — | **Fact (absence)** | No fleet imports in SS CRM routers; shared shell/nav icons only (**Fact:** `NavIcon` ssp/fleet glyphs) |
| Invitations from SS settings UI | SS UI → Core API | **Fact** | Workspace invite routes on `workspaces` router |

---

## 4. API and database boundaries

### 4.1 API — Site Secure owned (move with product on Horizon B)

Registered today (**Fact:** `main.py`):

`customers`, `sites`, `systems`, `search`, `jobs`, `ops_modules`, `quotes`, `quote_cpq`, `system_designs`, `catalog`, `catalog_import`, `cctv`, `public_quotes`, `dashboard`

**Plus (logical SS, careful extract):** `workspace_settings` (product config + PDF templates + workspace role grant editing UI backend).

**Documents:** keep shared endpoint until O1; filter by SS entity types in SS service if split early.

### 4.2 API — Platform Core owned (SS must keep calling)

`auth`, `platform_home`, `workspaces` (create/switch/invitations), `workspace_products`, `admin`, `team`, and entitlement-effective data behind session/authz.

### 4.3 API contracts to freeze for `/app/*` compatibility

Do **not** break without a versioned migration plan:

| Contract | Why |
|----------|-----|
| `GET /api/v1/auth/session` shape (memberships, features, permissions, profile, has_workspace) | Entire AppShell + gates |
| `PUT /api/v1/me/active-workspace` | Workspace switch + cache clear |
| `GET /api/v1/platform/home` product cards + `entry_path` | Launch into SS |
| Error codes `FEATURE_NOT_INCLUDED`, `ACCOUNT_INACTIVE`, `TENANT_INACTIVE`, `PERMISSION_DENIED`, `API_UNAVAILABLE` | B2.1 UX + session hydrate |
| Workspace-scoped paths `/api/v1/workspaces/{workspace_id}/…` for CRM/ops | api-client + RQ keys |
| Public quote token routes (path + payload) | External customer links |
| Search hit `href` conventions into `/app/...` | Global search UX |
| Dashboard summary field names used by Today/Dashboard UI | High churn risk if renamed |

**Proposal:** Before Horizon B, publish a short “SS Public API surface” list generated from `packages/api-client` method groups used by `/app` routes (excluding ssp/fleet/admin).

### 4.4 Database — Site Secure owned tables (logical)

Per B1: customers/contacts/leads, sites, catalog, quotes/CPQ, projects, jobs, service, tasks, warranties, and related SS migrations.

### 4.5 Database — remain Platform / shared

| Object | Owner |
|--------|--------|
| Auth, profiles, workspaces, memberships, invitations, features/plans/overrides, platform_admin_events | Platform |
| `documents` (physical) | Shared until O1 |
| `audit_logs`, `idempotency_keys` | Shared infra (O2) |
| `notifications` table | Open O3 |
| `workspace_settings` row | SS config; keyed by Core workspace |

---

## 5. Web surface map (`/app/*`)

### 5.1 Site Secure routes (product)

Examples (**Fact:** route files under `apps/web/src/routes/app/`):  
`dashboard`, `today`, `customers`, `sites`, `leads`, `quotes`, `catalog`, `projects`, `jobs`, `service`, `tasks`, `warranties`, `analytics`, `knowledge`, and most of `settings/*` (company, quotes, PDF, appearance, etc.).

### 5.2 Mounted siblings (not SS domain)

| Path | Owner |
|------|--------|
| `/app/ssp/*` | SSP |
| `/app/fleet/*` | FLEET |
| `/app/platform-path/*` | Onboarding / commercial path (**Assumption:** closer to Core/growth than CRM domain — treat as Core-adjacent; do not move into SS domain package without review) |
| `/app/settings/users`, roles, security, audit | UI in SS shell; **APIs** largely Core (`team`, invitations, audit reads) |
| `/app/settings/products` | Entitlement visibility — Core data |

### 5.3 Shell behavior to preserve

- Guest → login; no workspace → onboarding; with workspace → **`/platform` then product** (`afterAuthPath`) — **Fact:** `auth-routes.ts`  
- `/app` layout requires session + workspace (**Fact:** `routes/app/route.tsx`)  
- B2.1b/c entitlement revoke + Home focus refresh must keep working across extract phases  

---

## 6. Recommended extraction order (Site Secure lens)

```text
[Done] B1 boundaries doc
[Done] B2/B2.1 Platform Core gates + revoke UX
[Now]  B3 SS ownership + contract freeze (this doc)
  │
  ├─ B3.1 (optional eng practice)  Module folders / import lint: no SS→ssp/fleet domain imports
  ├─ B3.2                          Contract checklist + api-client namespacing proposal
  │
  ├─ B4 SSP extract                (B1 order; reduces monolith noise)
  ├─ B5 FLEET extract              (after documents strategy progress)
  │
  └─ B6 Site Secure host split     Core API/UI vs SS API/UI; shared Auth project
         (Horizon B)
```

**Decision:** Do **not** attempt Horizon B (SS host split) before B4 at minimum. Extracting SS first would force moving the entire CRM monolith while still carrying ssp/fleet mounts and shared documents ambiguity.

**Proposal — Horizon B deploy shape (no implementation now):**

| Deployable | Serves |
|------------|--------|
| Platform Core | Auth session, Home, Admin, workspaces/invites/team, entitlements |
| Site Secure | SS routers + `/app` SS routes + `public_quotes`; calls Core for session |
| SSP / FLEET | Per B1/B2.1 SSP contract |

Cookie/BFF: reuse B2.1 §6 recommendation (Option A parent-domain cookie first).

---

## 7. Staged implementation plan (small steps)

| Stage | Work | Code? | Success signal |
|-------|------|-------|----------------|
| **B3.0** | This document accepted as eng reference | Docs only | Linked from architecture index / team practice |
| **B3.1** | Enforce “no new SS↔SSP/FLEET domain coupling” in review checklist | Process (± optional lint later) | PRs cite ownership |
| **B3.2** | Freeze list of SS API paths + session fields; add changelog rule | Docs (+ tests later) | Breaking change requires explicit approval |
| **B3.3** | Inventory `audit_logs` / `notifications` writers (close O2/O3 for SS rows) | Read-only audit | Owners assigned |
| **B3.4** | `api-client` internal namespaces (`platform.*` vs `siteSecure.*`) without URL changes | Optional refactor | Import clarity; **no** catalog/`create_workspace` edits |
| **B4+** | SSP then FLEET extract per B1 | Separate approved phases | Products on own hosts or packages |
| **B6** | SS vs Core deploy split | Separate approval | `/app/*` SS flows green against Core session; Home still launches SS |

**Non-goals for B3:** product code changes, migrations, RLS edits, deploy, catalog.json, FleetMaster, Solo/`create_workspace`, git mutations.

---

## 8. Backward-compatibility risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Renaming `/api/v1/workspaces/{id}/…` SS paths | High | Keep paths; split deploy behind same URL or gateway |
| Session field rename/removal | High | Version DTO (B1 O8) before host split |
| Moving `team`/invitations into SS service | High | Forbidden without reversing B3 Decision |
| Splitting `documents` without vehicle strategy | High | Wait for O1; dual-read period |
| Entitlement mid-session stale UI | Medium | Keep B2.1b/c behavior on SS host |
| Shared `AppShell` nav assuming ssp/fleet always mounted | Medium | Feature-flag mounts; Home remains launcher |
| `workspace_settings` mistaken as Core product | Medium | Document ownership; move with SS on B6 |
| Accidental `catalog.json` / Solo changes during modularization | Critical | Listed in §10 forbidden set |

---

## 9. Success criteria (B3 complete)

B3 is successful when:

1. Ownership of SS vs Core vs shared is documented and **Decision**-tagged (this file).  
2. Ambiguous components (`workspace_settings`, `team`, `documents`, notifications) have an explicit **Decision** or **Open** ID — not silent.  
3. API contracts required for `/app/*` are listed for freeze.  
4. Extraction order places **SS host split after SSP (and preferably FLEET)** peel.  
5. No product code, DB, catalog, FleetMaster, or git state was changed to produce this plan.  
6. New SS work can be reviewed against §2 ownership map without re-auditing B1/B2.

*(Horizon B success is out of scope for B3; tracked under future B6.)*

---

## 10. Files / areas forbidden without separate approval

| Item | Reason |
|------|--------|
| `create_workspace` RPC / workspace creation behavior | Tenancy SoT; Solo coupling |
| Solo defaults / dual-write paths | Explicit project ban |
| `packages/authz/catalog.json` | Authorization SoT |
| FleetMaster application files | Explicit project ban |
| Supabase migrations / RLS changes for “split” | Needs dedicated phase |
| Staging/Production deploy | Out of scope |
| Git stage/commit/reset/clean/discard | Preserve existing diffs |
| Unmounted routers (`customer_portal`, `connections`, `ipam`) | B1 Decision — leave untouched |
| Implementing SSO/BFF or extracting SSP/SS hosts in B3 | Planning only |

---

## 11. New findings in B3 (delta vs B1/B2 only)

| ID | Finding | Class |
|----|---------|--------|
| N1 | `search` entity set is exclusively SS CRM/ops (no ssp/fleet entities) | **Fact** — strengthens SS ownership of search |
| N2 | `dashboard` aggregates quotes/jobs — SS-only | **Fact** |
| N3 | `workspace_settings` is product configuration (quotes/branding/PDF/RBAC helpers), not Platform Home | **Fact** → **Decision:** logical SS |
| N4 | `team` remains membership/usage API on Core while UI lives under `/app/settings` | **Fact** → **Decision:** API Core |
| N5 | No `notifications` **table** writes found under `apps/api/app` routers; settings JSON only | **Fact** (code grep) — O3 still Open for DB triggers/other writers |
| N6 | SS host split should follow SSP/FLEET peel; B3 is ownership + contract freeze | **Decision** |
| N7 | SS↔SSP/FLEET domain coupling absent in CRM routers; shared shell/nav only | **Fact** (focused check) |
| N8 | `team` usage meters couple Core API to SS quota tables; Horizon B needs meter contract | **Fact** (follow-up audit) |
| N9 | Documents entity enum also includes `equipment` / `workspace`; Fleet consumes shared upload API (no Fleet router table writes) | **Fact** (follow-up audit) |
| N10 | `dashboard` depends on `workspaces.timezone` | **Fact** (follow-up audit) |

---

## 12. Open decisions (SS-specific + inherited)

| ID | Topic | Status |
|----|--------|--------|
| O1 | Physical `documents` split | Inherited open |
| O2 | `audit_logs` shared vs per-product | Inherited open |
| O3 | `notifications` table ownership | Inherited; B3 N5 narrows API picture |
| O4 | SSO/BFF | Inherited; required before multi-host SS |
| O5 | `team`/invitations Core-only | **B3 Decision:** yes for API |
| O6 | Per-product roles | Inherited; unchanged `role_key` for now |
| O7 | Unmounted routers | Inherited — do not change |
| O8 | Versioned Identity DTO | Inherited — needed before Horizon B |
| **O9 (new)** | Classify `/app/platform-path/*` as Core-adjacent vs SS | **Open** — Assumption Core-adjacent |
| **O10 (new)** | Whether `workspace_settings.notifications` JSON becomes the only “notifications” product surface | **Open** until O3 closed |

---

## 13. Next recommended step

1. Accept this document as the Site Secure ownership baseline.  
2. Execute **B3.1–B3.2** as process/docs (contract freeze checklist) — still no product extract.  
3. Continue product roadmap toward **B4 SSP extract** only after O4 decision; keep SS modularization opportunistic.  
4. Do **not** schedule Horizon B (SS vs Core deploy split) until SSP peel is underway or complete.

---

## Appendix A — Evidence index (B3-focused)

| Topic | Location |
|-------|----------|
| Router registration | `apps/api/app/main.py` |
| SS feature composite + entry paths | `apps/api/app/platform_products.py` |
| Search entities | `apps/api/app/routers/search.py` |
| Dashboard | `apps/api/app/routers/dashboard.py` |
| Workspace settings | `apps/api/app/routers/workspace_settings.py` |
| Team | `apps/api/app/routers/team.py` |
| Documents enum (SS originals) | `supabase/migrations/0013_documents.sql` |
| App gate + shell | `apps/web/src/routes/app/route.tsx` |
| After-auth → `/platform` | `apps/web/src/lib/auth-routes.ts` |
| Parent boundaries | `Docs/architecture/PRODUCT_BOUNDARIES.md` |
| Core session/entitlement UX | `Docs/architecture/PHASE_B2_1_IMPLEMENTATION.md` |

---

## Appendix B — Document history

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-10-19 | Phase B3 initial SS boundary audit & extraction plan (docs only) |
| 1.1 | 2026-10-19 | Incorporate follow-up fact sheet: team usage↔SS meters, documents entity ALTERs + Fleet UI shared API, dashboard timezone, DocumentType vs entity enum (N8–N10) |
