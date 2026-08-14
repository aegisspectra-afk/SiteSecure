# V2 CRM — Product + UX Specification

**Status:** Phase 7A. Source of truth for CRM **if approved**. **Not approved for 7B** until the human signs off (including the Public Web architecture update).  
**Stop.** Do not implement CRM. Do not add Customers / Sites / Leads screens. Do not implement Public Website UI. Do not change Dashboard UI except as listed under “Dashboard follow-through” *after* Phase 7B is explicitly started.

**Inherits (do not contradict):**

- UX OS: [V2-UX-PSYCHOLOGY.md](./V2-UX-PSYCHOLOGY.md)
- Visual: [V2-DESIGN-SYSTEM.md](./V2-DESIGN-SYSTEM.md)
- Public Web: [V2-PUBLIC-WEB.md](../architecture/V2-PUBLIC-WEB.md)
- Web IA: [V2-WEB.md](../architecture/V2-WEB.md)
- Mobile IA: [V2-MOBILE.md](../architecture/V2-MOBILE.md)
- RBAC: [V2-RBAC.md](../security/V2-RBAC.md) + `packages/authz/catalog.json`
- API: [V2-API.md](../architecture/V2-API.md)
- Data: [V2-DATABASE-DESIGN.md](../database/V2-DATABASE-DESIGN.md)
- Home: [V2-DASHBOARD-SPEC.md](./V2-DASHBOARD-SPEC.md) (Phase 6B implemented)

This document is the **Screen Rule** for CRM. The Operating System still wins on conflict.

**Product surface (do not redesign CRM because of this):** CRM is an **authenticated application** capability (`/app/customers`, `/app/leads`). It is not a Public Web section. Visitors convert via `/register` / `/contact`, never via a public customer list.

---

## 0. Why this exists before code

The failure mode is: *tables exist → ship a 360 with eight tabs, a lead Kanban, and buttons to Quotes / Jobs / Service that do not exist.*

SITE SECURE CRM is not a generic contacts app and not a second dashboard. It is the **relationship record** that the rest of the product hangs off: who the customer is, who to call, where the site is, and what already happened.

V1 had CRM (`clients` + Client 360) and a separate Sales funnel (`leads`). Intent to **KEEP:** customer as the commercial person/org; contacts; Customer 360 as the story of the relationship; tenant sales leads (not website marketing leads). Intent to **REBUILD:** FastAPI + `authorize()` + RLS, Hebrew/RTL OS, honest empty states, assignment-scoped field access. Intent to **REPLACE:** V1 name `clients` → `customers`; Aegis `website_leads` stay **out**.

Phase 6B Dashboard is live. Attention and quick actions stay **informational / absent** until this module’s **routes** exist. That rule does not change: CRM must not invent quote/job destinations.

---

## 1. Primary CRM goal

Answer only:

1. **מי הלקוח?** — person or business we work with  
2. **עם מי מדברים?** — contacts  
3. **איפה העבודה?** — sites (identity: name, code, address)  
4. **מה המצב המסחרי?** — leads in motion, then the customer record  
5. **מה כבר קרה אצל הלקוח?** — notes + projected quotes/jobs that already exist in the database  

If a widget does not answer one of those, it does not ship in CRM.

North star (OS §0): if the user asks «מה אני אמור לעשות כאן?» the screen has already failed.

**Primary action (workspace, management roles with `crm.create`):** `לקוח חדש` on the customer list.  
**Primary action (Customer 360 in 7B):** the next *real* object this role can create — almost always `אתר חדש` (`sites.create`) if the customer has no site. Not `הצעת מחיר` and not `עבודה חדשה` until those UIs exist.  
**Primary action (leads, if included in 7B):** `ליד חדש` on the list; on a lead, the **next status verb** or `המר ללקוח` when qualified and `customer_id` is null.

One primary per view. Everything else is quieter.

---

## 2. Sequencing honesty (read before any mock)

Audited against this repo on 2026-08-14. Architecture docs describe a fuller map than FastAPI currently implements.

### 2.1 What exists in Postgres (usable)

| Object | Migration | Notes |
|--------|-----------|--------|
| `customers` | `0010` | type `private`/`business`, status `active`/`inactive`, soft `deleted_at` |
| `customer_contacts` | `0010` | `is_primary`; **no** uniqueness on primary; **no** `deleted_at` |
| `customer_notes` | `0010` | human notes |
| `customer_activities` | `0010` | typed timeline; **do not duplicate** quote/job events |
| `sites` | `0011` | belongs to customer; code allocator `AS-S-#####`; address jsonb; `public_token` (portal later) |
| `site_zones`, `site_timeline_events` | `0011` | Site File / Phase 8, not CRM identity |
| `systems`, `equipment` | `0012` | Phase 8 |
| `documents` | `0013` | polymorphic; `entity_type` includes `customer` and `site` |
| `leads` | `0014` | funnel + `owner_user_id` + optional `customer_id`/`site_id` |
| `quotes` | `0016` | list filter `customer_id` exists in FastAPI |
| `jobs` | `0017` | FastAPI list filter is `site_id`, **not** `customer_id` |
| `service_calls` | `0018` | **no FastAPI router** |
| `assignments` | `0009` | technician/FT visibility |

RLS is on. Customer visibility: members see workspace customers **unless** assigned-scope (technician/FT), who see a customer only if assigned to that customer **or** to one of its sites (`auth_customer_visible` in `0011`).

### 2.2 What exists in FastAPI today (usable)

Registered in `apps/api/app/main.py` (API `0.6.0`):

| Method | Path | Authz | Status |
|--------|------|-------|--------|
| GET | `/customers` | `crm.view` | list, `q` = `display_name` ilike, `status`, cursor |
| POST | `/customers` | `crm.create` | create |
| GET | `/customers/{id}` | `crm.view` | identity only — **not** 360 |
| PATCH | `/customers/{id}` | `crm.edit` | identity |
| DELETE | `/customers/{id}` | `crm.delete` | **soft** `deleted_at` |
| GET | `/customers/{id}/contacts` | `crm.view` | list |
| POST | `/customers/{id}/contacts` | `crm.edit` | create |
| GET | `/sites` | `sites.view` | list, filter `customer_id` |
| POST | `/sites` | `sites.create` | create; requires existing customer |
| GET/PATCH/DELETE | `/sites/{id}` | view/edit/delete | identity; soft delete |
| GET | `/quotes?customer_id=` | `quotes.view` | list (costs stripped without `quotes.view_cost`) |
| GET | `/jobs` | `jobs.view` | **no** `customer_id` query |
| GET/POST | `/documents…` | `documents.view` / `upload` | generic; signed upload |

**No** FastAPI router for: leads, customer notes, customer activities, contact patch/delete, Customer 360 aggregate, systems, equipment, service-calls, projects, warranties.

`packages/api-client` has **no** customer/site methods yet (only session, workspace, dashboard, job start/complete).

### 2.3 What exists in the web app today

| Path | Status |
|------|--------|
| `/app/dashboard`, `/app/today` | Phase 6B live |
| `/app/customers`, `/app/sites`, `/app/leads` | **do not exist** |
| Nav CRM items | **absent** (correct) |
| `moduleHref('customer.create')` | always `null` (correct until 7B) |

### 2.4 Architecture vs code (do not treat docs as shipped)

[V2-API.md](../architecture/V2-API.md) §5 lists `customers` **+ 360 aggregate**, `sites` **+ dossier read model**, and `leads` CRUD. Those are the **target contract**, not today’s OpenAPI.

[V2-ROADMAP.md](../architecture/V2-ROADMAP.md) Phase 7 is **CRM + customers + sites** (contacts, 360, site identity + code). Leads are **not** named in Phase 7. This spec still defines leads because they are in the CRM domain and the table/RLS already exist. Whether they **ship in 7B** is an explicit approval item (§22).

### 2.5 Rule for implementation (Phase 7B, after approval)

| Element | Ships when |
|---------|------------|
| Customer list / create / edit | Spec approved + `crm.view` / `crm.create` / `crm.edit` |
| Contacts on 360 | Contact list+create exist; **patch/delete/primary** added |
| Customer 360 shell | Aggregate (or composed) payload from **real** APIs |
| Nested quotes / jobs on 360 | Rows may **display** if the list API returns them; **click** only when `/app/quotes/:id` or `/app/jobs/:id` exists |
| Nested create quote / job | Those **module screens** exist **and** `can(permission)` |
| Site identity list/detail + create | Spec approved + `sites.*` |
| Site File (systems, equipment, timeline, public link) | Phase 8 |
| Leads list / detail / convert | Spec approved **and** human includes leads in 7B + new leads API |
| Service history tab | Service-call API + at least a list/detail |
| Documents on customer | Upload API exists; **RLS must allow `entity_type=customer`** for the caller (§14.3) |
| `crm.export` button | Export endpoint exists (not 7B) |
| Mobile Customers tab | Product IA includes assigned Customers on mobile ([V2-MOBILE.md](../architecture/V2-MOBILE.md)). **Not in 7B.** Not a public page |

A new workspace after onboarding will often have **zero customers**. That empty state is success.

---

## 3. Domain language and lifecycle

V2 vocabulary ([V1-TO-V2.md](../architecture/V1-TO-V2.md)):

| Say | Do not say |
|-----|------------|
| לקוח (`customers`) | client / `clients` |
| אתר (`sites`) | תיק אתר as a second entity |
| ליד (`leads`) | ליד שיווקי / `website_leads` |
| עבודה (`jobs`) | כרטיס / ticket as the field unit |
| תיק אתר | UX dossier of `sites` (Phase 8) |

**Lifecycle (business, not a wizard UI):**

```
Lead
  → Customer          (explicit convert — never silent)
    → Site            (physical place; required before a job)
      → Quote         (Phase 9 UI; rows may already exist)
        → Project / Job   (Phase 10 UI)
          → Service       (later)
```

Rules:

- A **lead** may exist with no customer.  
- A **customer** may exist with no lead (walk-in / owner types them in).  
- A **site** always belongs to one customer (`customer_id` NOT NULL, `ON DELETE RESTRICT`).  
- A **quote** may point at customer and/or site and/or lead (columns exist).  
- **Do not** auto-create a customer when a lead is marked `won`. Convert is a verb with a result the user can open.  
- **Do not** create a site as a side effect of creating a customer.  
- A Public Web **Contact / Pilot** inquiry is **not** a tenant lead and **not** a customer. It must not appear in `/app/leads` or Customer 360.

---

## 4. Authorization

UI hiding is not security. `<Can>` / `can()` choose layout and hide CTAs. Every mutation runs `authorize()` on the server. RLS still scopes rows.

Do **not** branch React on `role === 'owner'`. Branch on `can('crm.create')`, `can('sites.create')`, `can('leads.create')`, `can('crm.delete')`, and `homeVariant()` only for shell home (already shipped).

### 4.1 Permissions (catalog.json — source of grants)

| Permission | Owner | Admin | Manager | Sales | Tech | FT | Viewer |
|------------|:-----:|:-----:|:-------:|:-----:|:----:|:--:|:------:|
| `crm.view` | • | • | • | • | • | • | • |
| `crm.create` / `crm.edit` | • | • | • | • | | • | |
| `crm.delete` / `crm.export` | • | • | • | | | | |
| `leads.view` | • | • | • | • | | • | • |
| `leads.create` / `edit` / `assign` | • | • | • | • | | | |
| `leads.delete` | • | • | • | | | | |
| `sites.view` | • | • | • | • | • | • | • |
| `sites.create` / `sites.edit` | • | • | • | | • | • | |
| `sites.delete` | • | • | | | | | |
| `documents.view` / `upload` | • | • | • | • | • | • | view only |

`crm.*` and `leads.*` are **not** currently listed in `permission_feature`. All shipped plans include features `crm` and `sales`. 7B should map `crm.*` → feature `crm` and `leads.*` → feature `sales` so a future feature-off is `FEATURE_NOT_INCLUDED`, not a silent 200.

Technician: `crm.view` only, assigned scope. **No** `לקוח חדש`.  
Founding Technician: `crm.create/edit`, `leads.view` (not mutate), `sites.create/edit`, assigned scope.  
Sales: CRM mutate, leads mutate, **`sites.view` only** — they do not create sites.  
Viewer: view only; **no** mutating primary.

### 4.2 Scope (data plane)

| Role | Customers / sites | Leads |
|------|-------------------|--------|
| Owner, admin, manager, viewer | Workspace (RLS member, not assigned-scope) | See §14.2 — **viewer SELECT is currently too narrow** |
| Sales | Workspace customers (RLS); quotes/leads **owned** | `owner_user_id = caller` (matches `owned`) |
| Technician / FT | Assigned customer or customer of an assigned site | FT: `leads.view`; RLS today = managerial **or** owned **or** assigned site. Tech has **no** `leads.view` — omit Leads nav |

FastAPI customer GET does not re-check `ResourceRef` beyond `crm.view`; **RLS is the row filter**. Keep it that way, and add `require(..., resource=)` on mutations (already true for patch/delete/create contact).

---

## 5. Tenant isolation

Non-negotiable:

- Every CRM route is `/api/v1/workspaces/{workspace_id}/...` with Bearer **user JWT**.  
- FastAPI uses the user-scoped PostgREST client (same as Dashboard). **No service role** on CRM reads or writes.  
- Cross-workspace id in the path → **404** (not 403 with “exists”). Same as live dashboard isolation.  
- Soft-deleted customers stay hidden (`deleted_at IS NULL` on SELECT policy).  
- Tests required in 7B: owner A cannot GET/PATCH owner B’s customer; technician does not list unassigned customers; sales cannot PATCH another user’s lead.

---

## 6. What each role sees

| Role | Nav (web) | Customer list | Customer 360 primary | Leads | Sites |
|------|-----------|---------------|----------------------|-------|-------|
| Owner / admin / manager | לקוחות, לידים (if 7B), אתרים | Full workspace | `אתר חדש` if `sites.create` and useful; else none | Full | Create/edit |
| Sales | לקוחות, לידים | Full workspace customers | **No** `אתר חדש`. Next real verb: `איש קשר חדש` if `crm.edit`, else none | **Owned** | View only |
| Technician | **היום** only — no CRM nav | URL may 200 on assigned rows; do not promote | Read-only peek if opened from a future job | Hidden | Create/edit assigned (from 360/site if they navigate) |
| Founding Technician | **היום** + **לקוחות** (assigned) | Assigned-only | `אתר חדש` allowed | View if RLS fixed; **no** create lead | Create/edit assigned |
| Viewer | לקוחות, לידים (read), אתרים | Full workspace | **None** | Read (after RLS fix) | View |

Field roles on web still must not get the Owner ops dashboard (already true). CRM is an extra nav item for FT, not a second home.

---

## 7. Screens required (web)

### 7.1 Route map (7B)

| Path | Title (he) | Gate |
|------|------------|------|
| `/app/customers` | לקוחות | `crm.view` + feature `crm` |
| `/app/customers/new` | לקוח חדש | `crm.create` |
| `/app/customers/:customerId` | display_name | `crm.view` (404 if invisible) |
| `/app/customers/:customerId/edit` | עריכת לקוח | `crm.edit` |
| `/app/sites` | אתרים | `sites.view` |
| `/app/sites/new?customer_id=` | אתר חדש | `sites.create` — **customer_id required** |
| `/app/sites/:siteId` | site name + code | `sites.view` — **identity only** |
| `/app/leads` | לידים | `leads.view` + feature `sales` — **if leads in 7B** |
| `/app/leads/new` | ליד חדש | `leads.create` |
| `/app/leads/:leadId` | lead title | `leads.view` |

No `/app/crm` umbrella that is a third dashboard. **לקוחות** is the CRM home for management **inside `/app`**. Public origin nav is marketing (התחברות / הרשמה), never לקוחות.

Create is a **route**, not a cramped modal: forms need labels, type-dependent fields, and errors (OS: evaluative ease + error prevention).

### 7.2 Customer list

**Rank 1:** who they are (display_name).  
**Rank 4:** `לקוח חדש` if `can('crm.create')` **and** this route exists. Otherwise **no** primary.  
**Rank 5:** search (`q`), status filter (הכל / פעיל / לא פעיל). Default **פעיל**.

Columns / row (comfortable-dense, ~40px, not a card grid):

1. Name (title-as-link to 360)  
2. Type — Hebrew `פרטי` / `עסק` (never `private`)  
3. Phone (`.ltr-meta`)  
4. Status marker + `פעיל` / `לא פעיל`  
5. Supporting: site count **only if** the list payload includes it (360/list enhancement). If the API does not send it, omit the column — do not N+1 from the SPA.

Row click → Customer 360. Chevron + hover/focus. Not color-only selected.

**Do not** put five icon buttons per row. Overflow (`עוד פעולות`) for edit/deactivate only if those permissions exist.

### 7.3 Customer create / edit

Stacked form, field groups at 24px.

Always:

- `display_name` (required) — label `שם`  
- `type` — `פרטי` / `עסק` (default `private`)  
- `phone`, `email` (optional, LTR)  
- `status` on edit only (default active on create)

When `type = business` (progressive disclosure):

- `legal_name` — `שם משפטי`  
- `tax_id` — `ח.פ / עוסק` (LTR)

Optional, collapsed **פרטים נוספים**:

- `billing_address`: `street`, `city`, `notes` (no map widget)  
- `notes` (customer-level text field — distinct from the notes **thread**)

Primary submit: `שמור לקוח` / `צור לקוח`.  
Cancel: back to list or 360.  
Delete: **not** on create. On edit, isolated destructive in overflow: `העבר ללא פעיל` (status) is preferred; `מחק לקוח` only if `crm.delete`. If the customer has sites, DELETE returns **409** with `לא ניתן למחוק לקוח עם אתרים. סמנו כלא פעיל.` Do not cascade-delete sites.

Smart defaults: type private, status active, locale/phone as typed. No fake “profile completeness %”.

### 7.4 Customer 360 (flagship of this phase)

This is the relationship **story**, scan-friendly: definition list + stacked sections. **Not** eight empty dossier tabs. **Not** a KPI header (no “12 quotes / ₪ revenue”).

```
PageHeader: display_name + status
            primary = next real create (see §1)
            overflow: ערוך לקוח, העבר ללא פעיל / מחק
   ↓
Identity (phone, email, type, tax_id if business, billing city)
   ↓
Contacts
   ↓
Sites (identity rows)
   ↓
Notes
   ↓
Documents (customer entity) — if documents.view
   ↓
Quotes (informational rows from API; no href until Quotes UI)
   ↓
Jobs (informational rows from API; no href until Jobs UI)
```

**Omit until their phase:** Service history, Warranties, Projects, Systems/Equipment, Finance/money, Public site link, Catalog, Inventory.

Section with zero rows: honest empty **inside the section**, no disguised CTA to an unbuilt module (see §11).

Contacts: name, role_title, phone, email, primary marker `ראשי`. Primary action in section: `איש קשר חדש` if `crm.edit`. One primary contact: setting `is_primary` clears others (API rule, missing in DB today).

Sites: code (LTR) + name + city + installation status Hebrew (`מתוכנן` / `בביצוע` / `הושלם` / `לא פעיל`). Click → `/app/sites/:id` (identity). `אתר חדש` if `sites.create`.

Quotes/jobs rows: number + Hebrew status + date. **Not** `<a>` while `moduleHref` is null (same rule as Dashboard attention).

### 7.5 Sites list + identity detail

Sites list is operational geography, not Site File.

**Rank 1:** site name + code.  
**Rank 4:** `אתר חדש` if `sites.create` — but create **requires a customer**. If the workspace has zero customers, the primary is **disabled with reason** `חסר לקוח` **or** omitted and the empty state sends them to `לקוח חדש` if `crm.create`. Never a site form that 404s on customer.

Filters: `q` on name, `customer_id`, installation status.

Identity detail fields: name, code (read-only, allocated on insert), customer (link to 360), address (`street`, `city`, optional `lat`/`lng` as numbers not a map product), `access_notes` (sensitive; still RLS), status.

**Do not** show `public_token`, portal URL, systems, photos timeline, warranties.

`Navigate` / Waze: only when address is complete enough **and** we are on a field job (mobile). Not a CRM list feature in 7B.

### 7.6 Leads (specified fully; ship in 7B only if approved)

Not a Trello clone. Default: **filter chips + list** (status). Optional compact columns later if they remain object lists, not WIP-limit toys.

Statuses (API enum, UI Hebrew):

| Enum | Hebrew |
|------|--------|
| `new` | חדש |
| `contacted` | נוצר קשר |
| `meeting` | פגישה |
| `spec` | אפיון |
| `quoted` | הוצאה הצעה |
| `follow_up` | מעקב |
| `won` | נסגר |
| `lost` | לא רלוונטי |

Sources: `website`, `referral`, `advertising`, `phone`, `other`, `manual` → Hebrew labels. Default create source `manual`.

List columns: title, status, owner, phone, updated. Sales sees **owned** only (RLS).

Detail:

- Fields: title, contact_name, phone, email, source, notes, owner (`leads.assign` to change)  
- Optional link to customer/site once converted  
- Rank 4: **one** next-status verb (`סמן שנוצר קשר`, …) — not eight equal pills  
- `המר ללקוח` when `customer_id` is null and `crm.create` (or `crm.edit` if attaching to existing). Convert copies name/phone/email into a **new** customer **or** attaches an existing customer (search). Sets `customer_id`. Does **not** by itself mark `won` unless the user also chooses that.  
- `נסגר` / `לא רלוונטי` in overflow (loss aversion: real state, not confirm-shaming copy)

Technician: no leads screens.  
FT: view assigned-site leads if RLS allows; no convert unless `crm.create` (FT has it) — convert is allowed **in assigned context** only.

**Do not** add lead attention kinds to Dashboard until the leads **route** exists (then Dashboard spec can grow `lead_stale` in a later slice). 7B may wire Dashboard **only** for customer create href, not a fake lead widget.

---

## 8. Authenticated web vs mobile vs public

CRM screens are **not** Public Web. Conversion on the origin is signup/contact ([V2-PUBLIC-WEB.md](../architecture/V2-PUBLIC-WEB.md) §8–§10).

| Capability | Authenticated web (7B) | Mobile | Public Web |
|------------|------------------------|--------|------------|
| Customer list / 360 / create | **Yes** (management + FT list) | Assigned **Customers tab** is product IA — **not 7B** | **Never** |
| Site identity list/detail | **Yes** | Later: assigned sites / peek | Never (tokenized `/p/s` is end-customer dossier, not CRM) |
| Leads pipeline | **Yes** if approved | **No** | **No** — public Contact is not `leads` |
| Customer peek (name, phone, site address) | 360 | Job payload now; Customers tab later | No |
| Quote builder / job complete | No (other phases) | Job complete is field, not CRM | No |

Mobile IA: Today, Jobs, Sites, **Customers** (assigned), Service (when it exists), Notifications, Profile. **Do not** implement Expo CRM in 7B. Do not add a marketing tab.

Web field roles: technician stays on Today; they do not need a desktop customer directory. FT gets `/app` לקוחות because they create customers in assigned work (KEEP from V1 FT CRM).

---

## 9. Explicitly NOT part of CRM (7A/7B)

- Quote builder, send, PDF, cost/margin  
- Jobs board, assign technician picker, start/complete (already on Today)  
- Service calls / service history product  
- Site File dossier (systems, equipment, zones, timeline, photos as a product, public token UX)  
- Projects, warranties, catalog, inventory, finance, reports, billing  
- Marketing `website_leads`, Aegis portal, Public Web contact forms dumped into tenant `leads`  
- Public Website UI (separate phase; [V2-PUBLIC-WEB.md](../architecture/V2-PUBLIC-WEB.md))  
- Notification bell, maps product, Kanban toys, CSV export (`crm.export`)  
- Vanity: “12 לקוחות החודש”, charts, health scores, AI summaries  
- Dark mode toggle, toast/tooltip projects, npm audit, idempotency (backlog)  
- Automatic V1 → V2 client migration  

Creating a quote **API** already exists. CRM still must not show `הצעת מחיר` until `/app/quotes/new` exists.

---

## 10. How Customer 360 works (data)

Prefer **one** authorized read so the SPA does not crawl five lists:

```
GET /api/v1/workspaces/{workspace_id}/customers/{customer_id}/360
```

- `authorize('crm.view')`  
- User JWT + RLS on every child query  
- 404 if customer not visible  
- `extra="forbid"`  
- **Never** include `cost_total`, `margin_*`, `total_gross` on nested quotes  

Illustrative payload:

```json
{
  "customer": { "id": "…", "display_name": "…", "type": "private", "status": "active" },
  "contacts": [],
  "sites": [{ "id": "…", "code": "AS-S-00001", "name": "…", "installation_status": "planned" }],
  "notes": [],
  "documents": [],
  "quotes": [{ "id": "…", "number": "Q-00012", "status": "sent", "status_label_he": "נשלחה ללקוח" }],
  "jobs": [{ "id": "…", "number": "J-00003", "title": "…", "status": "scheduled", "status_label_he": "מתוכננת" }]
}
```

If 7B ships composition instead of `/360`, the client may call existing list endpoints **with** `customer_id` and small limits — but **jobs must gain `customer_id`** first. Do not fetch the workspace job list and filter in the browser.

Hebrew status labels: API should send `status_label_he` (or a shared catalog). UI never shows raw enums as the only text.

---

## 11. Empty states

Honest. Permission-aware. Not marketing.

| Screen | Who | Copy | Primary |
|--------|-----|------|---------|
| Customer list | `crm.create` | **אין לקוחות עדיין** / צרו לקוח כדי להוסיף אתר ולהתחיל עבודה. | `לקוח חדש` |
| Customer list | viewer / tech (no create) | **אין לקוחות להצגה** / אין פעולת יצירה בתפקיד זה. (Tech: מוצגים רק לקוחות של אתרים ששובצתם אליהם.) | none |
| 360 contacts | `crm.edit` | **אין אנשי קשר** / הוסיפו איש קשר לשיחה ולשטח. | `איש קשר חדש` |
| 360 contacts | no edit | **אין אנשי קשר** | none |
| 360 sites | `sites.create` | **אין אתרים ללקוח זה** / הוסיפו אתר עם כתובת כדי שאפשר יהיה לתכנן עבודה. | `אתר חדש` |
| 360 sites | sales (no create) | **אין אתרים ללקוח זה** / הוספת אתר נעשית על ידי תפעול. | none |
| 360 quotes | any | **אין הצעות מחיר עדיין** — **no** `הצעת מחיר` button until Quotes UI | none |
| 360 jobs | any | **אין עבודות עדיין** — **no** `עבודה חדשה` until Jobs UI | none |
| Sites list | zero customers + `crm.create` | **אין אתרים** / קודם צרו לקוח. | `לקוח חדש` (not a broken site form) |
| Sites list | has customers + `sites.create` | **אין אתרים עדיין** / צרו אתר ללקוח. | `אתר חדש` |
| Leads list | `leads.create` | **אין לידים עדיין** / צרו ליד כדי לפתוח תהליך מכירה. | `ליד חדש` |
| Leads list | view only | **אין לידים להצגה** | none |

Never:

- “Create your first customer” in English  
- Feature tour, video, or “SITE SECURE עוזר לכם לגדול”  
- A create button that 403s  
- Greyed fake modules (“קריאות שירות — בקרוב”)  

Loading: existing `DashboardSkeleton` pattern / list skeleton with `role="status"`.  
Error: Hebrew + `נסה שוב` (already a primitive).

---

## 12. Shell and Dashboard follow-through (only in 7B)

Nav group **לקוחות ומכירות** — **`/app` only** ([V2-WEB.md](../architecture/V2-WEB.md)):

- `לקוחות` → `/app/customers` if `crm.view`  
- `לידים` → `/app/leads` if leads ship **and** `leads.view`  
- Do **not** add Quotes / Catalog until those phases  

**אתרים** sits under **תפעול**, not duplicated as a third CRM home. 360 still lists sites.

Technician web nav stays **היום** only.  
FT: **היום** + **לקוחות**.

After customer routes exist, Dashboard `moduleHref('customer.create')` returns `/app/customers/new`. Quick action `לקוח חדש` may appear for roles with `crm.create`. Attention rows for **customers** are not required in 7B. Quote/job attention stays informational until those UIs exist.

Do not change Dashboard layout, KPIs, or add CRM widgets on home.

---

## 13. UX Psychology decisions (binding)

| OS theme | CRM decision |
|----------|----------------|
| Decision fatigue | One primary per view. 360 is stacked sections, not a toolbar of six fills. Lead next-status is one verb. |
| Goal gradient | Empty list continues the real chain: לקוח → אתר → (later) הצעה → עבודה. No cinematic %. |
| Evaluative ease | Hebrew verbs: `צור לקוח`, `אתר חדש`, `המר ללקוח`. Status sentences, not `PENDING`. |
| Affordances | Rows look clickable (chevron + title link) **only** if the destination route exists. Disabled site-create shows `חסר לקוח`. |
| Hierarchy | Name first, status second, overflow last. No avatar stack. |
| Progressive disclosure | Business legal/tax fields; address under פרטים נוספים; lead lost/won in overflow. |
| Error prevention | Cannot create site without customer; cannot hard-delete customer with sites (409). |
| Reciprocity | First customer is the gift — empty CRM is a blank list plus one verb, not a tour. |
| Role-specific next action | Sales: leads + customers, not `אתר חדש`. Tech: Today, not a directory. Viewer: no primary. FT: Today home, CRM for assigned create. |
| Anti-AI-SaaS | No health scores, no “insights” cards, no purple gradients, no fake activity graph. |

Fail the screen (OS §25) if: primary not obvious in 2 seconds; disabled looks enabled; fake progress; enum/`Action` copy; color-only selected/error; unauthorized CTA; dead-end link; cross-workspace leak.

---

## 14. API required for 7B

### 14.1 Already sufficient (reuse)

- Customer CRUD + contact **list/create**  
- Site identity CRUD + `customer_id` filter  
- Quote list `?customer_id=` (display only)  
- Documents upload/complete/url (after RLS fix)  
- `authorize()` + user JWT pattern  

### 14.2 Must add

| Endpoint | Why |
|----------|-----|
| `PATCH/DELETE .../customers/{id}/contacts/{contact_id}` | Edit / remove contact; `crm.edit` / privileged delete |
| `POST .../customers/{id}/contacts/{id}/primary` or patch `is_primary` **with** clearing others | One ראשי |
| `GET/POST .../customers/{id}/notes` | 360 notes thread; `crm.view` / `crm.edit` |
| `GET .../customers/{id}/360` | Aggregate (§10) |
| `GET .../jobs?customer_id=` | Nested jobs without client-side scan |
| **Leads CRUD** `GET/POST /leads`, `GET/PATCH /leads/{id}` | If leads in 7B |
| `POST .../leads/{id}/convert` | Create or attach customer; `leads.edit` + `crm.create` as required |
| `GET .../customers` optional `phone`/`email` in `q` | Search that matches how people look up a client |

Contact create already requires `crm.edit` (not `crm.create`) — keep that: adding a contact is editing the customer.

Lead status changes are PATCH `status` with resource-state rules (cannot resurrect `lost` without `leads.edit`; no skip-to-won without convert if product requires customer — **do not** over-constrain: won-without-customer is allowed but 360 of lead shows `המר ללקוח` as the obvious next step).

### 14.3 Data-plane fixes (same phase, not optional if the UI would lie)

1. **Leads SELECT + viewer:** today only managerial **or** owner **or** assigned-site. Viewer has `leads.view` + scope `all` but would see **no rows**. Add viewer (read) to the SELECT policy.  
2. **Documents `entity_type = customer`:** assigned-scope SELECT currently allows site/system docs only (`0013`). Technicians would not see customer files. Extend SELECT with `auth_customer_visible` for customer entities. Office roles already pass `NOT assigned_scope`.  
3. **`permission_feature`:** map `crm.*` → `crm`, `leads.*` → `sales`.  
4. **Primary contact:** enforce one primary per customer (transaction in API; unique partial index optional).  
5. **Customer search:** `q` today is display_name only — document as limitation if 14.2 search slip is deferred.

Do **not** use service role to “fix” visibility.

### 14.4 Client package

`packages/api-client`: typed `listCustomers`, `createCustomer`, `getCustomer`, `patchCustomer`, `deleteCustomer`, contacts, notes, `getCustomer360`, sites, leads (if in 7B). Query keys include `workspaceId`. Workspace switch clears cache (web architecture).

---

## 15. Copy (Hebrew UI)

| Use | Copy |
|-----|------|
| Nav | לקוחות, לידים, אתרים |
| List primary | לקוח חדש, ליד חדש, אתר חדש |
| 360 | אנשי קשר, אתרים, הערות, מסמכים, הצעות מחיר, עבודות |
| Save | שמור לקוח / שמור שינויים / צור לקוח |
| Convert | המר ללקוח |
| Inactive | לא פעיל |
| Delete confirm | פעולה זו תסתיר את הלקוח. אתרים לא יימחקו. |
| 403 | אין הרשאה ליצור לקוח / אין הרשאה להוסיף אתר |
| Code / phone / email | `.ltr-meta` |

Site installation status: `מתוכנן`, `בביצוע`, `הושלם`, `לא פעיל`.

---

## 16. Accessibility and layout

- `dir="rtl"`; LTR islands for codes, phone, email, tax_id  
- Labels outside placeholders  
- List semantics (`table` or `list` + row links), focus rings, named buttons  
- Hit targets ≥44px on small web; this is still **not** the technician product  
- Stacked sections, spacing scale 4–64 only  
- Tokens/primitives only (`PageHeader`, `EmptyState`, `Status`, `Button`, inputs). No one-off CRM palette  
- Virtualize if lists can exceed ~100 rows (`@tanstack/react-virtual` already in V1; add when needed, not as decoration)

---

## 17. Acceptance criteria (this spec)

Phase 7A is complete when the human can answer yes to:

1. Primary CRM goal is the relationship record (who / contact / site / commercial motion / what happened) — not a report.  
2. Primary actions are named per screen and permission-gated.  
3. Each of the seven roles has a defined nav and CTA set.  
4. Data that exists today is listed (§2.1) without assuming service-call/quote UIs.  
5. API that exists today is listed (§2.2).  
6. APIs to add are listed (§14).  
7. Screens/routes are listed (§7).  
8. Authenticated web vs mobile vs public is explicit (§8). Public Web is not a CRM nav.  
9. Out-of-scope is explicit (§9).  
10. Customer 360 composition and omitted tabs are explicit (§7.4, §10).  
11. Site always belongs to a customer; identity ≠ Site File (§3, §7.5).  
12. Lead → customer is an explicit convert; marketing / Public Web inquiries are **not** tenant leads (§3, §8).  
13. `authorize()` + `<Can>` + RLS are the three layers (§4, §5).  
14. Cross-tenant 404 and user JWT are required (§5).  
15. OS psychology is applied (§13, §11).  

Phase 7B is **not** started by this document.

---

## 18. Known gaps (honest)

| Gap | Impact | 7B? |
|-----|--------|-----|
| No leads FastAPI | Sales has no pipeline UI | Only if leads approved |
| No `/360` | Waterfall or missing nested jobs | **Yes** (or jobs `customer_id`) |
| No contact patch/delete | 360 contacts are append-only | **Yes** |
| No notes API | Tables idle | **Yes** |
| Jobs list no `customer_id` | Cannot nest jobs honestly | **Yes** |
| Viewer leads RLS | `leads.view` lies | **Yes** if leads UI |
| Customer documents RLS for assigned-scope | Field cannot see customer files | **Yes** if customer docs ship |
| `q` = name only | Phone lookup fails | Should |
| Site code prefix `AS-S-` | V1 Aegis leftover | Keep allocator; do not bikeshed in 7B |
| `public_token` unused in UI | Correct until public portal | Omit |
| Dashboard UTC `scheduled_for` | Field day boundary | Backlog (not CRM) |
| Bundle / toast / tooltip RTL / dark / audit / idempotency | Backlog | No |

---

## 19. What must be approved before Phase 7B

The human confirms:

1. **This document** is the CRM Screen Rule (or lists deltas).  
2. **7B scope (recommended):**  
   - Customers list/create/edit/soft-delete  
   - Contacts full CRUD + single primary  
   - Notes  
   - Customer 360 as specified (quotes/jobs **informational**)  
   - Sites identity list/create/detail (not Site File)  
   - Nav + Dashboard `לקוח חדש` href  
   - RLS/feature fixes in §14.3 that the shipped UI depends on  
3. **Leads in 7B — recommended yes:** table + RLS exist; sales otherwise has no commercial object; convert completes the lifecycle; no Quotes UI required. Roadmap Phase 7 did not name leads — **override or defer** must be explicit.  
4. **Site codes** stay `AS-S-#####` for 7B.  
5. **Still forbidden in 7B:** quote/job/service **screens**, Site File tabs, maps product, export, **mobile Customers tab**, notification bell, vanity KPIs, **Public Website UI**.

If leads are deferred, delete `/app/leads` from 7B and keep this spec’s lead chapters as the next slice. Do not leave a לידים nav placeholder.

---

## 20. Implementation order (Phase 7B only — do not run now)

When the human says **Proceed to Phase 7B — CRM Implementation**:

1. Catalog `permission_feature` + RLS fixes required by the approved slice  
2. API: contacts patch/delete/primary, notes, jobs `customer_id`, `/360`; leads+convert if approved  
3. Isolation + authz tests (including viewer/sales/FT/technician)  
4. `packages/api-client`  
5. Routes + nav + `<Can>`  
6. List / form / 360 / site identity (+ leads if approved)  
7. Empty/loading/error as §11  
8. Dashboard `moduleHref('customer.create')` only  
9. Typecheck, lint, tests, build  
10. **STOP** — do not start Quotes UI, Jobs UI, Site File, or Public Website UI  

---

This spec is where the installer’s **people and places** become real screens, still bounded by FastAPI, RLS, and honest destinations. If a proposed CRM widget cannot name its permission, its source row, and a live route (or honestly have none), it does not belong in 7B.
