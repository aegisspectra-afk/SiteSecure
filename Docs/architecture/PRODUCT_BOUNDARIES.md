# Aegis Platform — Product Boundaries

**Document status:** Phase B1 — documentation only  
**Date:** 2026-10-19  
**Scope:** Architecture boundaries for Platform Core, Site Secure, Aegis SSP, and Aegis FLEET  
**Code changes in this phase:** none  

### Legend

| Marker | Meaning |
|--------|---------|
| **Fact** | Verified in repository code and/or Supabase migrations |
| **Decision** | Approved for documentation in Phase B1 (this guidance) |
| **Proposal** | Forward-looking recommendation; not implemented |
| **Unverified** | Not confirmed against Staging/Production or live data |

---

## 1. Platform Core responsibilities

**Decision:** Users, Workspaces, memberships, invitations, and entitlements are owned by Aegis Platform Core.

| Area | Responsibility | Evidence |
|------|----------------|----------|
| Identity | Supabase Auth; `profiles` (including soft-archive, `is_platform_admin`, `last_workspace_id`) | **Fact:** `0003_profiles.sql`; `apps/api/app/deps.py` (`current_user`); `apps/api/app/routers/auth.py` |
| Tenancy | `workspaces`, create/join flows, active workspace preference | **Fact:** `0004_workspaces.sql`; `PUT /api/v1/me/active-workspace`; RPC `create_workspace` (behavior must not change without separate approval) |
| Membership | `workspace_memberships`, role assignment (`role_key`) | **Fact:** `0006_memberships.sql` |
| Invitations | Workspace and platform invitation flows | **Fact:** invitation RPCs; `/api/v1/admin/invitations*`; team invite paths under workspaces |
| Entitlements | `features`, `plans`, `plan_features`, `subscriptions`, `workspace_feature_overrides`; effective set via `my_workspace_entitlements` | **Fact:** `0008_features_plans.sql`; `0041_entitlements_effective_overrides.sql` |
| Product enablement (admin) | Platform Admin enables/disables toggleable modules for a workspace | **Fact:** `PUT /api/v1/admin/workspaces/{id}/products/overrides`; workspace member PUT denied |
| Launch surface | Aegis Platform Home — product picker only | **Fact:** `GET /api/v1/platform/home`; UI `/platform`; **Decision:** not a Site Secure dashboard |
| Platform Admin | Cross-tenant ops, beta, audit of admin actions | **Fact:** `/admin`, `/api/v1/admin/*`, `require_platform_admin`, `platform_admin_events` |
| Product registry (code) | Static mapping of product id → entitlement rules / entry paths | **Fact:** `apps/api/app/platform_products.py` (no DB product table in A2) |

Platform Core does **not** own CRM records, quote lines, SSP form bodies, or fleet vehicle telemetry.

---

## 2. Site Secure, SSP, and FLEET responsibilities

### 2.1 Site Secure

**Decision:** Site Secure remains the owner of CRM, customers, sites, quotes, catalog, projects, jobs, and service.

| Owns (logical product) | Notes |
|------------------------|--------|
| Customers, contacts, notes, activities, leads | **Fact:** `0010_customers.sql`, `0014_leads.sql` |
| Sites and related site structures | **Fact:** `0011_sites.sql` |
| Catalog and quotes / CPQ | **Fact:** `0015_catalog.sql`, `0016_quotes.sql`, CPQ migrations |
| Projects, jobs, service calls, tasks, warranties | **Fact:** `0017`–`0020`, service migrations |
| Product-local UX | `/app/*` (except module mounts for ssp/fleet); **Decision:** `search` and `dashboard` stay Site Secure product surfaces |
| Entry from Platform Home | **Fact:** `homeVariant` — technician → `/app/today`; otherwise → `/app/dashboard` |

Site Secure must not self-grant product entitlements; module assignment is Platform Admin only (**Fact:** Stage 4 / A2).

### 2.2 Aegis SSP

**Decision:** SSP remains logically isolated as far as current schema and API allow.

| Owns | Notes |
|------|--------|
| `ssp_forms`, `ssp_form_versions`, `ssp_form_assignments`, `ssp_form_submissions` | **Fact:** `20261019140000_ssp_digital_forms_v1.sql` |
| Authenticated SSP API | **Fact:** `apps/api/app/routers/ssp_forms.py` — prefix `/api/v1/workspaces/{workspace_id}/ssp` |
| Public token submit | **Fact:** `apps/api/app/routers/public_ssp.py` — `/api/v1/public/ssp` |
| Entitlement gate | **Fact:** feature key `ssp`; permissions `ssp.forms.*` |

**Fact:** No `customer_id` / `site_id` FKs on SSP tables in current migrations. No router imports from Fleet.

### 2.3 Aegis FLEET

**Decision:** FLEET remains logically isolated as far as current schema and API allow.

| Owns | Notes |
|------|--------|
| `departments`, `department_memberships`, `fleet_vehicles`, mileage, maintenance, equipment, assignments, schedules | **Fact:** `20261006120000_fleetmaster.sql` |
| Fleet HTTP API | **Fact:** `fleet.py`, `fleet_ops.py`, `fleet_reports.py` |
| Entitlement gate | **Fact:** feature key `fleet`; permissions `fleet.*` |

**Fact:** Fleet tables reference `workspaces` and `profiles`; no CRM `customer_id` / `site_id` FKs found in the FleetMaster migration. Fleet routers use `UserClient` (no `ServiceClient` in those routers — **Fact** from code audit).

**Constraint:** FleetMaster application files must not be modified without explicit approval (project rule). Extraction planning may reference them; implementation touching them requires a later approved phase.

### 2.4 Isolation principle

**Decision:** Prefer isolation. Do **not** build `CustomerRef` or `SiteRef` integration contracts in the current phase.

Shared cross-product identity is limited to Platform concerns: user, workspace, membership, entitlements (**Decision** + **Fact** of current schema).

---

## 3. Data ownership

### 3.1 Clear ownership

| Data | Owner | Source of truth | Consumers today |
|------|-------|-----------------|-----------------|
| Auth users / profiles | Platform | Auth + `profiles` | All products |
| Workspaces / memberships / invitations | Platform | Platform tables + RPCs | All products |
| Plans / features / overrides / subscriptions | Platform | Platform tables + entitlements RPC | Authorize + Home |
| `platform_admin_events` | Platform | Admin write path | Admin audit UI |
| CRM / sites / quotes / catalog / projects / jobs / service | Site Secure | SS tables | Site Secure only (**Fact:** SSP/Fleet APIs do not read these tables) |
| `ssp_*` | SSP | SSP tables | SSP (+ public token path) |
| `fleet_*` / departments | FLEET | Fleet tables | FLEET |

### 3.2 Shared or ambiguous tables (document carefully)

#### `documents`

| Aspect | Status |
|--------|--------|
| Physical storage | **Fact:** single `public.documents` table (`0013_documents.sql`) |
| Entity typing | **Fact:** Fleet migration adds enum value `document_entity_type = 'vehicle'` (`20261006120000_fleetmaster.sql`) |
| Logical ownership | **Decision for B1:** documents are **logically** owned by the product that owns the entity (e.g. vehicle docs → FLEET; quote/site docs → Site Secure). The table is **not** presented as physically split. |
| Physical split | **Open / deferred** until FK map, RLS policies, entity types, and storage buckets are fully inventoried |

#### `audit_logs`

| Aspect | Status |
|--------|--------|
| Physical storage | **Fact:** `public.audit_logs` + RLS (`0022_audit.sql`) |
| Writers | **Fact:** application `write_audit` / related helpers used across workspace operations; Platform Admin also writes `platform_admin_events` (separate table) |
| Decision | **Open:** keep one shared workspace audit table vs per-product audits + platform ingest — document current state only until decided |

#### `notifications`

| Aspect | Status |
|--------|--------|
| Physical storage | **Fact:** `0021_notifications.sql` |
| Primary use | **Fact:** present in shared schema; consumed mainly with Site Secure-style app flows (**Unverified** whether Fleet/SSP write notifications in all paths) |
| Decision | **Open:** treat as shared infra vs product-owned until write-site inventory is complete |

#### `idempotency_keys`

| Aspect | Status |
|--------|--------|
| Physical storage | **Fact:** `0022_audit.sql` (same migration file as audit) |
| Role | Infrastructure for safe retries of mutating API calls |
| Ownership | **Decision for B1 docs:** Platform / API infrastructure concern; not a product domain table |
| Cross-product event idempotency | **Proposal only** — not implemented as a multi-product outbox |

---

## 4. Router and API map

### 4.1 Registered today (**Fact:** `apps/api/app/main.py`)

| Classification | Routers |
|----------------|---------|
| Platform | `auth`, `platform_home`, `workspaces` (tenancy), `workspace_products`, `admin` |
| Shared / team | `team` (memberships within workspace) |
| Site Secure | `customers`, `sites`, `systems`, `search`, `jobs`, `ops_modules`, `quotes`, `quote_cpq`, `system_designs`, `catalog`, `catalog_import`, `cctv`, `public_quotes`, `dashboard`, `workspace_settings` (mostly) |
| SSP | `ssp_forms`, `public_ssp` |
| FLEET | `fleet`, `fleet_ops`, `fleet_reports` |
| Infra / ambiguous | `health`, `feedback`, `telemetry`, `documents` |

**Fact:** On-disk but **not** included in `create_app()`: `customer_portal.py`, `connections.py`, `ipam.py`.  
**Decision:** Do not delete or modify unmounted routers in B1 (or without a later approved phase).

### 4.2 Future split (**Proposal** — no endpoint renames in B1)

| Future API | Would host |
|------------|------------|
| Platform API | `/api/v1/auth/*`, `/me/*`, `/platform/*`, `/admin/*`, workspace create/switch, entitlements, invitations |
| Site Secure API | CRM, sites, quotes, catalog, projects, jobs, service, SS search/dashboard |
| SSP API | `/workspaces/{id}/ssp/*`, `/public/ssp/*` |
| FLEET API | Fleet routers under `/workspaces/{id}/…` |

Same URL paths may remain initially; separation may start as deployable units sharing Auth/Workspace contracts.

---

## 5. Security requirements (JWT, membership, entitlements, permissions, RLS)

Every product API (present or future) must enforce the following chain. Most steps are **Fact** in Site Secure API today (`load_authz_context`, `authorize`, RLS helpers).

| Step | Requirement | Current mechanism (**Fact**) |
|------|-------------|------------------------------|
| 1 | Valid JWT | `Authorization: Bearer`; `UserClient` / Auth user |
| 2 | Account active | Reject if `profiles.archived_at` set |
| 3 | Active membership in path workspace | Membership query / authz context |
| 4 | Workspace active | `workspace_status == active` → else `TENANT_INACTIVE` |
| 5 | Product entitlement | Feature present in `my_workspace_entitlements` (e.g. `ssp`, `fleet`, or Site Secure feature set) |
| 6 | Action permission | `authorize(action)` using grants + `permission_feature` map |
| 7 | Tenant isolation | RLS via `auth_workspace_ids` / `auth_is_member` (and product-specific helpers e.g. department scope for Fleet) |
| 8 | UI is not security | Hiding cards/nav is insufficient; server must deny |

**Platform Admin:** `require_platform_admin` before service-role admin operations (**Fact**).

**Service-role caution (**Fact**):**

- `public_ssp` uses `ServiceClient` without user JWT (token-based); high privilege in-process — must stay SSP-scoped.
- `admin` uses `ServiceClient` after platform-admin check — must remain Platform-only.
- Fleet routers: `UserClient` only (lower escalation surface for extraction).
- Do not weaken RLS to “make products work” across boundaries.

**Tokens:** Do not pass access tokens in URLs (**Decision** aligned with A2). Future multi-app SSO is **Proposal** only (see open decisions).

---

## 6. Integration contracts

### 6.1 Existing (Fact)

| Contract / behavior | Status |
|---------------------|--------|
| Session payload with memberships, features, permissions | **Fact:** `GET /api/v1/auth/session` |
| Active workspace switch with membership check | **Fact:** `PUT /api/v1/me/active-workspace` |
| Platform Home product list (server-filtered) | **Fact:** `GET /api/v1/platform/home` |
| Entitlement effective features | **Fact:** RPC `my_workspace_entitlements` |
| Admin product override + `platform_admin_events` | **Fact:** admin products endpoints |
| Shared `workspace_id` on product tables | **Fact:** SSP and Fleet FKs to `workspaces` |
| Customer/Site refs between products | **Fact:** not present |

### 6.2 Proposed only (not implemented)

| Proposed contract | Purpose | Notes |
|-------------------|---------|--------|
| `Identity.Session` / `WorkspaceRef` as versioned DTOs | Stable handoff when apps split | Today: session JSON shape; formal versioning **Proposal** |
| `Entitlement.Changed` event | Notify products when overrides change | **Proposal** — no outbox bus found |
| `Crm.CustomerRef` / `Crm.SiteRef` | Cross-product references | **Decision:** do **not** build now |
| `Ssp.SubmissionReceived` / `Fleet.VehicleAssigned` | Optional business sync | **Proposal** — only if product need appears |
| Multi-product outbox, retries, cross-app idempotency | Reliability for events | **Proposal** — distinct from existing `idempotency_keys` table for API mutations |

**Decision:** Do not assume all data must be shared. Prefer isolation; add contracts only when a concrete product requirement exists.

---

## 7. Dependencies and risks before extracting SSP and FLEET

### 7.1 Extraction order

**Decision:** Future extraction order is **SSP before FLEET**.

Rationale (**Fact**-based): SSP schema has no CRM FKs and no Fleet imports; public token surface is self-contained. FLEET additionally couples to `profiles`, department RLS, and shared `documents` enum/`vehicle` entity typing.

### 7.2 SSP extraction risks

| Risk | Severity | Notes |
|------|----------|--------|
| `public_ssp` + service_role | High | Must move with SSP service boundary |
| Shared SPA routing `/app/ssp` | Medium | Handoff from `/platform` |
| Session / cookie strategy across hosts | High if split domains | **Open** (SSO/BFF) |
| Entitlement mid-session revoke | Medium | Already returns users toward `/platform` on SSP gate |

### 7.3 FLEET extraction risks

| Risk | Severity | Notes |
|------|----------|--------|
| Touching FleetMaster files | Process | Requires explicit approval |
| `documents` + `vehicle` entity type | High | Physical split deferred |
| Department membership RLS | Medium | Must move with Fleet DB policies |
| Shared `profiles` FKs | Medium | Identity remains Platform |

### 7.4 Shared blockers

| Blocker | Notes |
|---------|--------|
| Single `apps/web` + `apps/api` deployable | **Fact** today |
| Solo defaults / dual-write / `create_workspace` | Must not change without separate approval |
| `packages/authz/catalog.json` | Must not change without separate approval |
| Unmounted routers | Leave untouched (**Decision**) |

---

## 8. Architectural decisions approved in this guidance

1. Users, Workspaces, memberships, invitations, and entitlements → **Platform Core**.  
2. Site Secure owns CRM, customers, sites, quotes, catalog, projects, jobs, and service.  
3. SSP and FLEET stay logically isolated as much as current design allows.  
4. **No** CustomerRef or SiteRef in the current phase.  
5. **`role_key` unchanged** for now; per-product roles to be re-evaluated before extraction.  
6. Site Secure **`search` and `dashboard` remain product surfaces**; `/platform` is product selection only.  
7. Future extraction order: **SSP then FLEET**.  
8. Phase **B1 = documentation only** (no lint/CI).  
9. Do **not** delete or modify unmounted routers.  
10. Progress sequence: Platform Core → Site Secure → SSP → FLEET.  
11. `documents`: logical ownership by product entity; **no claim of physical split**.  
12. Cross-product event/outbox machinery is **proposal**, not current Fact.

---

## 9. Open decisions

| ID | Topic | Status |
|----|--------|--------|
| O1 | Physical split of `documents` (FK/RLS/storage inventory) | Open — deferred |
| O2 | `audit_logs`: single shared table vs per-product + ingest | Open — document current Fact only |
| O3 | `notifications` write-site ownership inventory | Open / partly **Unverified** |
| O4 | SSO, domains, BFF for multi-app auth handoff | **Decided (near-term):** explicit login per app — see `PHASE_B4_3_O4_DECISION.md` / `PHASE_B4_SSP_EXTRACTION.md` §10. Cookie/BFF remains future upgrade pending domain facts |
| O5 | Whether `team` invitations remain Platform-only after extract | Recommended yes; formal sign-off open |
| O6 | Per-product roles (`product_memberships` or filtered grants) | Revisit before extract; `role_key` stays for now |
| O7 | Fate of unmounted routers (`ipam`, `connections`, `customer_portal`) | Open — do not change now |
| O8 | Versioned Identity DTO vs continuing session JSON | Open |

---

## 10. Phased plan (entry, success, rollback)

| Phase | Entry criteria | Success criteria | Rollback |
|-------|----------------|------------------|----------|
| **B1 — This document** | Phase B direction approved | `PRODUCT_BOUNDARIES.md` merged into docs set; decisions recorded | Delete/revert doc only |
| **B2 — Platform Core hardening** | B1 accepted; A2 Home stable | Platform remains SoT for identity/entitlements; no Solo/`create_workspace` changes | Revert Platform-only code changes |
| **B3 — Site Secure boundary clarity** | B2 accepted | SS ownership of CRM/ops documented in eng practice; no cross-product DB reads introduced | Docs / small refactors only |
| **B4 — SSP extract (future)** | B3 + O4 decision + explicit approval | Separate SSP deployable or host; same Auth; `ssp` entitlement enforced; public_ssp moved safely | Redeploy monolith paths; feature-flag traffic back |
| **B5 — FLEET extract (future)** | B4 stable + FleetMaster approval + O1 progress | Fleet API/UI separable; documents strategy agreed | Same as B4 for Fleet routes |
| **B6 — Sync contracts (optional)** | Real product need | Versioned events with idempotency; failures do not block login | Disable consumers |

**Non-goals until explicitly approved:** SQL migrations for split, deploy, catalog edits, FleetMaster refactors, create_workspace/Solo changes, app split implementation, lint/CI boundary enforcement.

---

## Appendix A — Evidence index (Fact)

| Topic | Location |
|-------|----------|
| Router registration | `apps/api/app/main.py` |
| Platform Home | `apps/api/app/routers/platform_home.py`, `apps/api/app/platform_products.py` |
| Entitlements RPC | `supabase/migrations/0041_entitlements_effective_overrides.sql` |
| SSP schema | `supabase/migrations/20261019140000_ssp_digital_forms_v1.sql` |
| Fleet schema | `supabase/migrations/20261006120000_fleetmaster.sql` |
| Documents | `supabase/migrations/0013_documents.sql` |
| Audit + idempotency | `supabase/migrations/0022_audit.sql` |
| Notifications | `supabase/migrations/0021_notifications.sql` |
| Platform admin events | `supabase/migrations/20260908205910_platform_admin_beta_participants_events.sql` |

---

## Appendix B — Document history

| Version | Date | Change |
|---------|------|--------|
| 1.0 | 2026-10-19 | Phase B1 initial boundaries document (docs only) |
