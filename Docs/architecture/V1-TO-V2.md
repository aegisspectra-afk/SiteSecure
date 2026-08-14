# V1 → V2 Decision Record

**Status:** Binding for SITE SECURE V2  
**Source of V1 facts:** `Docs/SITE-SECURE-CONTEXT.md`  
**Rule:** Preserve business value. Replace technical debt. Do not copy architecture.

Every item is tagged:

| Tag | Meaning |
|-----|---------|
| **KEEP** | Business concept or product rule that V2 must preserve |
| **REBUILD** | Same purpose, new implementation |
| **REPLACE** | Different mechanism; V1 approach is rejected |
| **REMOVE** | Do not bring into V2 |
| **IMPROVE** | Keep the idea; raise the bar |
| **DEFER** | Valid product, not in the first implementation phases |

---

## 1. Product identity

| Item | V1 fact | V2 decision |
|------|---------|-------------|
| Hebrew-first RTL field SaaS for security installers | FACT | **KEEP** |
| Brand primary `#0b6bcb`, Heebo + Inter | FACT | **KEEP** (design tokens, not copy-paste CSS) |
| Field-first, not platform admin | FACT | **KEEP** |
| Founding Technician as a membership role, not a plan | FACT / hard rule | **KEEP** |
| Assignment-scoped technician access | FACT | **KEEP** + **IMPROVE** (apply to all technician-visible resources) |
| Model A (FT on an existing workspace) before Model B | FACT | **KEEP** until an explicit product change |
| Mounted under Aegis at `/site-secure/` | FACT | **REPLACE** — V2 is its own web origin |
| Auth owned by Aegis (ADR-001) | FACT | **REPLACE** — SITE SECURE owns Supabase Auth |
| Same-origin cookie sharing | FACT | **REMOVE** |
| Demo/localStorage dual runtime | FACT | **REMOVE** |
| Marketing landing inside the authenticated app repo | FACT | **REPLACE** — Public Web is a first-class SITE SECURE origin (marketing + CTAs). It is **not** deferred and **not** a screen inside `/app`. See [V2-PUBLIC-WEB.md](./V2-PUBLIC-WEB.md) |

---

## 2. Architecture

| Item | V1 | V2 |
|------|----|----|
| React SPA talking directly to Supabase for most CRUD | FACT | **REPLACE** — FastAPI is the write/business path |
| No backend of SITE SECURE’s own | FACT | **REPLACE** — `apps/api` (FastAPI) |
| No native mobile | FACT | **REPLACE** — Expo React Native client of the same API |
| Combined Netlify/Vercel static site with Aegis | FACT | **REMOVE** coupling |
| Shared `@aegis/contracts` event stubs | PARTIAL | **REPLACE** — SITE SECURE domain events inside V2 |
| Manual TypeScript types, no generated DB types | FACT | **REPLACE** — generated Postgres types + shared API contracts |
| Dual RBAC (legacy `lib/rbac` shims + authorization v2) | LEGACY | **REMOVE** shims; **REBUILD** one engine |
| Authorization pipeline `decide()` | FACT — good design | **KEEP** conceptually; **REBUILD** as a shared catalog + server engine |
| Feature flags not enforced in the router | FACT / gap | **IMPROVE** — enforce in API, then UI |
| Edge `recalculate-quote` as the only server pricing | FACT | **REBUILD** inside FastAPI (authoritative) |
| `html2canvas` + `jspdf` client PDFs | FACT | **REPLACE** — server-generated PDFs |
| Public `warranty-pdfs` bucket | FACT | **REPLACE** — private + signed URLs |
| Hybrid restored schema (`invites` CREATE missing, `companies.owner_id` not in 001) | LEGACY | **REMOVE** — clean migrations from zero |
| Duplicate `002_*` migrations, stub `005`, comment-only `020` | LEGACY | **REMOVE** |
| `AegisSpectraWebSite` duplicate | LEGACY | **REMOVE** (out of V2 repo entirely) |
| Direct client writes to Postgres | FACT | **REPLACE** — API writes; RLS remains defense-in-depth |

---

## 3. Domain language

V1 used installer slang mixed with Aegis names. V2 uses one vocabulary.

| V1 | V2 | Decision |
|----|----|----------|
| `companies` | `workspaces` | **REPLACE** name. Hebrew UI may still say «חברה». Owner is a membership role, not `owner_id` on the tenant row. |
| `clients` | `customers` | **REPLACE** name. Same business entity. |
| `site_files` as the site entity | `sites` | **REBUILD**. Site File is the **UX dossier**, not a parallel table. |
| `site_system_info` blob | `systems` | **IMPROVE** — first-class systems under a site |
| `service_tickets` ∪ in-progress `projects` = Field | `jobs` | **REBUILD** — Job is the field work unit |
| `service_tickets` | `service_calls` | **REPLACE** name. A service call may create a job. |
| `company_tasks` | `tasks` | **KEEP** concept, **REBUILD** table |
| `website_leads` | — | **REMOVE** from SITE SECURE. Marketing leads are not this product. |
| `leads` (tenant sales) | `leads` | **KEEP** |
| Quote statuses without VIEWED | add `viewed` | **IMPROVE** |
| `founding_technician` role + `AEGIS-FT-XXX` | keep role; code prefix becomes `SS-FT-` or workspace-configurable | **KEEP** role; **REPLACE** Aegis-branded code prefix |

---

## 4. Modules

| Module | V1 status | V2 |
|--------|-----------|-----|
| Auth / session | Aegis-coupled | **REBUILD** (Supabase Auth, SITE SECURE-owned) |
| Onboarding / workspace create | IMPLEMENTED | **REBUILD** (no silent workspace; keep that rule) |
| Dashboard | IMPLEMENTED | **REBUILD** UX; **KEEP** “what needs attention” intent |
| CRM / Customer 360 | IMPLEMENTED / PARTIAL panels | **KEEP** model; **IMPROVE** 360 completeness |
| Leads / sales funnel | IMPLEMENTED | **KEEP** funnel idea; **REBUILD** storage/API |
| Catalog | IMPLEMENTED | **KEEP** categories and quote-integration; **REBUILD** |
| Quotes + builder | Deepest V1 module | **KEEP** economics (cost, labor, VAT, margin, templates, versions, audit); **REBUILD** architecture (server totals, autosave via API) |
| Projects | IMPLEMENTED | **KEEP**; project is commercial engagement, not the field job |
| Site File | IMPLEMENTED, Supabase-only | **KEEP** concept; **REBUILD** as Site aggregate |
| Warranties | IMPLEMENTED | **KEEP** public token + pack; **IMPROVE** privacy of files |
| Field | IMPLEMENTED as union view | **REBUILD** around Jobs + mobile |
| Service | IMPLEMENTED | **KEEP**; split request (`service_calls`) from execution (`jobs`) |
| Calendar / tasks | IMPLEMENTED (ops tasks) | **KEEP** tasks; full calendar **DEFER** |
| Knowledge | IMPLEMENTED | **KEEP** as workspace knowledge; **DEFER** polish |
| Checklists / readiness / AAR | PARTIAL / IMPLEMENTED | **KEEP** for field quality |
| Inventory | PLANNED placeholder | **IMPROVE** — real module in Phase 11, schema designed now |
| Finance / invoices | PLANNED placeholder | **DEFER** implementation; design hooks in billing/quotes |
| Reports | PLANNED placeholder | **DEFER** until operational data exists |
| Site planning | PLANNED placeholder | **REMOVE** as a nav lie; revisit as a real CAD/plan feature later |
| Settings (41 IDs, mixed depth) | PARTIAL, “ready” flags lie | **REBUILD** — only ship settings that write for real |
| Product feedback FAB | IMPLEMENTED | **DEFER** as a platform extra, not a core domain |
| Checkout / Stripe | PARTIAL, Edge in Aegis | **REBUILD** in FastAPI when billing ships; plans/features data from day one |
| Customer public portal | Aegis-owned | **REBUILD** as SITE SECURE public routes |

---

## 5. Authorization — what to keep from V1

V1’s authorization **design** was ahead of its **implementation**. V2 keeps the design.

**KEEP**

- Pipeline: Authenticated → Tenant Active → Subscription Valid → Feature Included → Role Loaded → Permission Granted → Scope Check → Resource State → Business Rules
- Plans grant **features**, never permissions
- Roles: owner, administrator, manager, sales, technician, founding_technician, viewer
- Scopes that are actually implemented: `all`, `owned`, `assigned`, `team`
- FT `assigned` means assignee **or** site assignment — no open pool
- Super-admin of some other product must **not** bypass tenant RLS
- Solo may invite FT / technician / viewer (seat rules live server-side)
- `users.invite` exception so Solo can run Model A

**REMOVE**

- Legacy `lib/rbac` shims
- Unconfigured scopes (`branch`, `region`, `department`) that silently elevate owner/admin
- UI-only permission checks
- Hardcoded `session.role === 'owner'`

**IMPROVE**

- One catalog (JSON) consumed by Postgres seed, FastAPI, web, and mobile
- Permissions as data, not only TypeScript maps
- Feature gates on API routes, not only nav
- Assignment RLS on every technician-visible resource, including quotes and leads when scoped

---

## 6. Data model — keep vs drop

**KEEP as entities (renamed/cleaned)**

Workspace, membership, invitation, profile, role, permission, feature, plan, subscription, customer, contact, note, activity, lead, site, zone, system, equipment, document, photo, quote, quote item, quote template, quote event, quote version, product, category, project, job, service call, service contract, warranty, task, checklist, notification, audit log, assignment.

**REMOVE as V2 tables**

- `website_leads`
- `companies.owner_id` as the tenancy key
- Parallel `site_files` vs customers (site belongs to customer)
- Demo store schema
- `company_api_keys` until a real public API program exists (**DEFER**)
- `user_device_sessions` as a custom table if Supabase Auth sessions suffice; device metadata for mobile push is a **notifications** concern
- Product-feedback inbox as a core migration (**DEFER**)

**DO NOT recreate placeholders as fake modules**

Inventory and finance are real future modules. They get tables when their phase starts, from this design, not from V1 stubs.

---

## 7. UX — keep vs raise

**KEEP**

- Make the next action obvious (V1 field + quote builder already aimed here)
- Quote builder as the flagship desktop experience
- Site File as a technical dossier, not a generic CRUD page
- Technician home ≠ manager dashboard
- Smart defaults (VAT, customer address, assigned technician)
- Goal-gradient onboarding (workspace journey)
- No silent workspace create

**REMOVE / do not copy**

- Placeholder routes in the nav
- Settings items marked ready that are shells
- Cinematic provisioning as a substitute for a reliable create-workspace API
- Emoji / gradient marketing patterns inside the authenticated app
- Shrinking the desktop shell into a mobile web drawer as “the field product”

**IMPROVE**

- Dedicated mobile information architecture
- Screen-by-screen UX psychology review (see `docs/ux/V2-UX-PSYCHOLOGY.md`)
- i18n from day one (Hebrew default, English ready) — V1 hardcoded Hebrew
- Dark mode tokens from day one (light default)
- Accessible focus, labels, contrast

---

## 8. Material decisions (documented because they are irreversible-ish)

These are architect decisions V2 makes now. They are not “ask the user” items; they are recorded so they can be challenged.

1. **SITE SECURE owns authentication.** Aegis SSO is a future optional identity provider, not the bootstrap. Cost: no shared session with Aegis on day one. Benefit: V2 can ship as a real SaaS.
2. **FastAPI is the system of record for writes and pricing.** Supabase is Auth + Postgres + Storage + Realtime + RLS. Clients do not treat PostgREST as the application API.
3. **Job is the field work unit.** Projects and service calls create jobs; technicians complete jobs.
4. **Site File is a view of Site**, not a second entity.
5. **No V1→V2 automatic data migration in this build.** Export/transform/import comes after the V2 schema is stable.
6. **No demo mode.** Local development uses a local or dedicated V2 Supabase project and seed data.
7. **Founding Technician Model A remains.** Role + assignments + seat rules. Not a plan.
8. **SITE SECURE is three clients of one backend:** Public Web (visitor origin), Authenticated Web (`/app`), Mobile (Expo). Same Auth user and workspace after signup. Tokenized `/p/*` is a fourth, noindex, tenant-customer view — not marketing.

---

## 9. What “done” means for this analysis

If a V1 fact is not listed above, the default is:

- Business behavior → **KEEP** unless it conflicts with tenant isolation, server authority, or honesty of the UI
- Implementation → **REBUILD**
- Coupling to Aegis, demo store, duplicate RBAC, hybrid schema → **REMOVE**
