# V2 RBAC

**Status:** Single authorization system for SITE SECURE V2  
**Engine location:** FastAPI `authorize()`; clients use the same catalog for UX hiding only  
**Catalog file:** `packages/authz/catalog.json` (seeded into Postgres)

UI hiding is not security. Every mutation is authorized on the server. RLS is the data-plane backstop ([V2-RLS.md](./V2-RLS.md)).

**Surfaces:** Public Web (visitor marketing) has **no roles** and must not call `authorize()` on tenant resources. Authenticated Web (`/app`) and Mobile share this catalog. Tokenized `/p/*` is token authz, not a membership role.

---

## 1. Separation

| Question | System |
|----------|--------|
| Who is this? | Supabase Auth → `profiles` |
| Which tenant? | Active workspace + `workspace_memberships.status = active` |
| What can they do? | This document |

Do not store tenant permissions on `profiles`. Do not use `auth.users.raw_user_meta_data` as RBAC.

---

## 2. Pipeline

```
Authenticated
  → Tenant active          workspace.status = active
  → Subscription valid     subscription.status in (trialing, active)  [enterprise manual-active allowed]
  → Feature included       plan ∪ overrides includes feature(action)
  → Role loaded            membership.role_key
  → Permission granted     role_permissions contains action
  → Scope check            all | owned | assigned | team
  → Resource state         e.g. cannot edit approved quote
  → Business rules         e.g. Solo seat limits, last-owner protection
  → ALLOW | DENY
```

Every DENY has a machine code (`UNAUTHENTICATED`, `TENANT_INACTIVE`, `SUBSCRIPTION_INVALID`, `FEATURE_NOT_INCLUDED`, `PERMISSION_DENIED`, `SCOPE_DENIED`, `RESOURCE_STATE`, `BUSINESS_RULE`) plus a Hebrew user message.

---

## 3. Roles (system)

Extensible via `roles` table. V2 ships these system roles (`is_system = true`).

| key | Hebrew | Default scope | Intent |
|-----|--------|---------------|--------|
| `owner` | בעלים | `all` | Full workspace, billing, delete |
| `administrator` | מנהל מערכת | `all` | Operations admin, not billing/delete by default (see grants) |
| `manager` | מנהל | `team` | Run jobs, quotes, CRM; no billing, limited user admin |
| `sales` | מכירות | `owned` | CRM, leads, quotes they own |
| `technician` | טכנאי | `assigned` | Field: assigned sites/jobs |
| `founding_technician` | טכנאי מייסד | `assigned` | Technician + limited CRM/quotes in assigned context; **not** a plan |
| `viewer` | צפייה בלבד | `all` | Read where feature exists; no mutations |

Do not branch product logic on `role === 'owner'` in React. Ask `can('workspace.billing')`.

Custom roles are allowed later as extra rows; they cannot use unconfigured scopes to escalate.

---

## 4. Scopes

| Scope | Meaning |
|-------|---------|
| `all` | Any resource in the workspace (still tenant-bound) |
| `owned` | `owner_user_id = user` (leads, quotes) |
| `assigned` | `assignments` match user to resource, or to its site |
| `team` | Workspace-wide operational data except billing/user-admin as denied by permissions |

**Not in v2.0:** `branch`, `region`, `department`. V1 returned “unconfigured → allow for owner/admin”, which is a footgun. Until branches exist, do not stub them.

### Assigned resolution

A user with `assigned` scope may access a resource if **any** is true:

1. Direct assignment to that resource
2. Assignment to the resource’s `site_id`
3. Assignment to the parent job/project that points at the same site (for documents, equipment, warranties on that site)
4. They created the resource **and** a business rule auto-assigned them (site insert trigger)

No open pool. Unassigned technicians see empty Today.

---

## 5. Features vs permissions

**Plans never grant permissions.**  
Plans expose features. Permissions may **require** a feature.

| Plan | Features |
|------|----------|
| `solo` | core, crm, sales, catalog, quotes, projects, service, settings |
| `business` | solo + inventory, finance, reports, automation, team, audit, api |
| `enterprise` | business + ai, branches (branches feature exists; scope unused until modeled) |

**Solo exception (KEEP from V1):** `users.invite` is not feature-gated so a Solo owner can invite Founding Technicians / technicians / viewers. Seat and **role** restrictions stay in business rules:

- Solo cannot invite `administrator`, `manager`, `sales` (product rule of Model A; adjustable later via plan limits)
- Solo member cap from `plan_limits.seats` (seed: 1 full operator + allowed FT/tech/viewer seats as configured)

---

## 6. Permission catalog (v2.0)

Keys are stable API strings. Groups match product areas.

### Core / workspace

`dashboard.view`  
`calendar.view` `calendar.edit`  
`settings.view` `settings.general` `settings.branding`  
`workspace.edit` `workspace.billing` `workspace.delete`  
`users.view` `users.invite` `users.manage` `roles.manage`  
`audit.view`

### CRM / sales

`crm.view` `crm.create` `crm.edit` `crm.delete` `crm.export`  
`leads.view` `leads.create` `leads.edit` `leads.delete` `leads.assign`  
`quotes.view` `quotes.create` `quotes.edit` `quotes.delete` `quotes.send` `quotes.approve` `quotes.export`  
`quotes.view_cost` `quotes.override_price`  
`catalog.view` `catalog.edit`

### Delivery

`projects.view` `projects.create` `projects.edit` `projects.close` `projects.delete`  
`jobs.view` `jobs.create` `jobs.assign` `jobs.start` `jobs.complete` `jobs.cancel`  
`service.view` `service.create` `service.edit` `service.close` `service.assign`  
`sites.view` `sites.create` `sites.edit` `sites.delete`  
`systems.view` `systems.edit`  
`documents.view` `documents.upload` `documents.delete`

### Inventory / finance / reports (feature-gated)

`inventory.view` `inventory.edit`  
`finance.view` `finance.edit`  
`reports.view` `reports.export` `reports.financial`

### Field extras

`warranties.view` `warranties.issue`  
`knowledge.view` `knowledge.edit`

---

## 7. Role grants (initial)

This table is the human-readable form of `catalog.json`. When they disagree, **catalog.json + seed SQL win**.

| Permission | Owner | Admin | Manager | Sales | Tech | FT | Viewer |
|------------|:-----:|:-----:|:-------:|:-----:|:----:|:--:|:------:|
| dashboard.view | • | • | • | • | • | • | • |
| crm.view | • | • | • | • | • | • | • |
| crm.create/edit | • | • | • | • | | • | |
| crm.delete/export | • | • | • | | | | |
| leads.* (mutate) | • | • | • | • | | | |
| quotes.view | • | • | • | • | • | • | • |
| quotes.create/send/approve | • | • | • | • | | | |
| quotes.edit | • | • | • | • | | • | |
| quotes.view_cost / override | • | • | • | | | | |
| catalog.edit | • | • | • | | | | |
| projects.create/edit/close | • | • | • | | • | • | |
| jobs.view | • | • | • | • | • | • | • |
| jobs.assign | • | • | • | | | | |
| jobs.start/complete | • | • | • | | • | • | |
| service.assign | • | • | • | | | | |
| service.create/edit/close | • | • | • | | • | • | |
| sites.create/edit | • | • | • | | • | • | |
| users.invite | • | • | | | | | |
| users.manage / roles.manage | • | • | | | | | |
| workspace.billing / delete | • | | | | | | |
| audit.view | • | • | | | | | |
| inventory/finance (if feature) | • | • | • | | | | |

Technicians **view** quotes/customers only inside assigned scope (RLS). FT may **edit** quotes in assigned context but cannot send/approve or see cost — same commercial boundary as V1.

---

## 8. Resource state examples

| Action | Blocked when |
|--------|----------------|
| `quotes.edit` | status ∈ {approved, cancelled} unless `quotes.approve` + explicit revision flow |
| `quotes.send` | status ≠ draft (re-send is a distinct event on sent) |
| `jobs.start` | status ≠ scheduled |
| `jobs.complete` | status ≠ in_progress (and checklist required if template mandates) |
| `users.manage` on an owner | last owner protection |

---

## 9. Engine API

Python (source of truth at runtime):

```python
decision = authorize(
    user_id=...,
    workspace_id=...,
    action="quotes.send",
    resource=ResourceRef(type="quote", id=..., owner_user_id=..., site_id=..., assignee_ids=..., state="draft"),
    context=RequestContext(...),
)
if not decision.allowed:
    raise AuthorizationError(decision.code, decision.message_he)
```

TypeScript (UX):

```ts
const { allowed } = authorize(snapshot, { action: "quotes.send", resource });
```

The TS engine may be a **subset** (feature + permission + coarse scope) so buttons disable quickly. The server repeats the full pipeline. Never skip the server.

---

## 10. Founding Technician (Model A)

Product rules carried from V1:

1. FT is a **role**, not a plan.
2. Pilot: technicians join an existing workspace; Model B (own Solo workspace) is later.
3. Assignment-based visibility.
4. Cannot manage users, roles, billing, API, global audit, plan-gated admin modules.
5. Program end date does not auto-disable the account.
6. Technician code is unique in the workspace.

V2 changes: prefix `SS-FT-###` (not Aegis-branded). Same isolation intent, **broader RLS coverage** than V1 (quotes/leads included when the technician has those view permissions).

---

## 11. Client vs server

| Layer | Allowed to do |
|-------|----------------|
| Nav / `<Can>` | Hide what will 403 |
| FastAPI | Enforce |
| RLS | Enforce even if API is buggy |
| Direct PostgREST from the browser | **Not used for writes.** Reads via PostgREST are not the app contract; if anon key is abused, RLS still holds. |

---

## 12. Tests (minimum)

- Unauthenticated → DENY
- Viewer + `quotes.edit` → DENY
- Technician + `users.invite` → DENY
- Technician + `jobs.complete` on unassigned job → SCOPE_DENIED
- FT + `quotes.view_cost` → DENY
- Sales + other user’s owned lead (`owned` scope) → SCOPE_DENIED
- Solo owner invites administrator → BUSINESS_RULE
- Approved quote edit → RESOURCE_STATE
- Workspace B membership cannot authorize Workspace A resource → DENY (and RLS test separately)
