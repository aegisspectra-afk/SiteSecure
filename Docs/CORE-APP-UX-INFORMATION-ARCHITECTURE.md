# CORE APP UX — Information Architecture

**Date:** 2026-09-26  
**Mode:** Checkpoint A–C closed · Side task More UX cleanup (D1–D5)  
**Routes:** `/app/customers` (A) · Work spine (B) · `/app/tasks` (C) · More overflow honesty (D)

---

## Checkpoint A — Customers (COMPLETED)

### 1. Previous Customers state

The prior directory was an enrichment-heavy CRM-style index:

- KPI metric cards (total / active / sites / lead attention)
- Five parallel list queries (sites, quotes, projects, service, leads) joined client-side with `limit: 50`
- Count-based filters (`hasSites`, `hasQuotes`, …) on incomplete joins
- Mobile ActivityRow + desktop table both rendered
- Empty/error copy existed but mixed CRM language

### 2. Actual Customer data contract discovered

**API:** `GET /api/v1/workspaces/{id}/customers`

Authoritative `CustomerOut` fields used on the index:

| Field | Used on index |
|-------|----------------|
| `id` | yes (open route) |
| `display_name` | primary identity |
| `type` | secondary label |
| `status` | status chip |
| `phone` | contact (LTR) |
| `email` | contact (LTR) |
| `legal_name` | secondary only when distinct from `display_name` |
| `billing_address` | searchable only |
| `created_at` / `updated_at` | not shown on index |

**Permissions (unchanged):**

- View list/detail: `crm.view`
- Create: `crm.create` (presentation via `can()`; server + RLS authoritative)
- Technician has `crm.view`, not `crm.create`

**Detail route:** `/app/customers/$customerId` (CustomerProfile) — reused, not redesigned.

**Search contract (`q`):** `display_name`, `phone`, `email`, billing address `line|street|city|formatted` (server ilike). Status filter via API `status`. Type filter client-side on returned page.

### 3. Changes implemented

| Area | Change |
|------|--------|
| Page | Operational index: title, lead, truthful count, search, status/type filter, create when authorized |
| Desktop | Table: identity · phone · email · status · **פתיחת לקוח** |
| Mobile | Card list (not compressed table) with full-width open CTA |
| Data | Removed enrichment N+1 and KPI metrics |
| Search | Debounced server `q` aligned with API |
| States | Skeleton / empty / filtered-empty / error with required Hebrew CTAs |
| i18n | Spec-aligned copy |
| Tests | `customers-page.test.tsx` + helper coverage |
| QA | Playwright evidence under `Docs/core-app-ux-qa/customers/` |

**Files touched:**

- `apps/web/src/routes/app/customers/index.tsx`
- `apps/web/src/components/customers/CustomerDirectory.tsx`
- `apps/web/src/lib/customer-directory.ts`
- `apps/web/src/i18n/he.ts`
- `apps/web/src/styles.css` (customer-dir section)
- `apps/web/tests/customers-page.test.tsx` (new)
- `apps/web/tests/customer-directory.test.tsx`
- `apps/web/tests/address-customer-360.test.ts`
- `apps/web/scripts/customers_core_ux_qa.mjs` (new)

No AppShell / global nav refactor.

### 4. Search behavior

- Local Customers search only (not Global Search)
- Placeholder: «חיפוש לפי שם, טלפון, דוא״ל או כתובת…» — matches API `q`
- Debounced query → `listCustomers({ q, status, limit: 100 })`
- Does **not** search site addresses or contact persons (capability gaps)

### 5. Desktop behavior (1440)

- Identity-first table
- Obvious **פתיחת לקוח**
- Create **לקוח חדש** when `crm.create`
- Browser QA: PASS (dark + light), no horizontal overflow

### 6. Mobile behavior (390 / 360)

- Dedicated cards (table hidden &lt;1024px)
- Touch-height open button
- Browser QA: PASS dark (+390 light), no overflow

### 7. Loading / empty / filtered-empty / error

| State | Behavior |
|-------|----------|
| LOADING | Skeleton (`aria-busy`), never `—` |
| EMPTY | «אין עדיין לקוחות» + enablement copy + «הוספת לקוח» if authorized |
| FILTERED EMPTY | «לא נמצאו לקוחות שמתאימים לחיפוש» + «ניקוי חיפוש וסינונים» |
| ERROR | «לא הצלחנו לטעון את הלקוחות» + «ניסיון נוסף» — never shown as empty/0 from error |

Unit: all four. Browser: populated + filtered-empty (+ create/open). Empty/error covered in tests.

### 8. Authorization

- `RequirePermission crm.view` unchanged
- Create gated by `can(..., "crm.create")` presentation only
- No authz / RLS / technician broadening

### 9. RTL

Hebrew-first RTL verified in browser shots; chevron/open affordance RTL-correct.

### 10. Light / Dark

1440 + 390 light/dark populated verified.

### 11. Accessibility

- Search focus works
- Open/create focus-visible styles
- Skeleton `aria-busy` / search `aria-label`
- **PARTIAL:** full keyboard traversal of every table cell not exhaustively automated

### 12. Tests

- Focused Customers-related: **26 passed** (`customers-page` 17 + `customer-directory` 2 + `address-customer-360` 7)
- Full web: **471 passed** (63 files)
- `tsc --noEmit`: PASS (via build)
- Production build: PASS

### 13. Browser QA

Evidence: `Docs/core-app-ux-qa/customers/`

| Shot | Result |
|------|--------|
| 1440 dark/light populated | PASS |
| 390/360 dark (+390 light) | PASS |
| Filtered empty | PASS |
| Create form | PASS |
| Open customer detail | PASS |
| Search focus | PASS |

Script: `apps/web/scripts/customers_core_ux_qa.mjs`

### 14. Capability gaps intentionally NOT implemented

1. Site / quote / project / service / lead **counts** on the index (prior enrichment was incomplete `limit:50` joins — not authoritative)
2. Primary **contact person** name on the list (contacts are a separate endpoint; not on `CustomerOut`)
3. **Last activity** / health / pipeline / map / KPI dashboard decorations
4. Site-address search across all sites without a cheap authoritative contract
5. Exact workspace-wide total beyond current page (`next_cursor` → “מוצגים N · יש עוד”)
6. Schema migration / API broadening

### 15. Confirmation — Work / Tasks / More

Checkpoint A did **not** modify Work / Tasks / More. Checkpoint B (below) implements Work navigation only.

---

## Checkpoint B — Work (COMPLETED)

**Date:** 2026-09-26  
**Mode:** Work navigation / information architecture only  
**Stop:** No Tasks redesign · No More redesign · No SaaS Phase 2 · No migrations · No API changes

### 1. Previous navigation architecture

| Surface | Before |
|---------|--------|
| Desktop sidebar | Groups: `סביבת עבודה` · `מכירות ולקוחות` · `תפעול` / `עבודת שטח` · `מערכת` |
| Mobile bottom | Already `בית · לקוחות · עבודה · משימות · עוד` |
| Mobile Work sheet | Live ops destinations |
| Mobile More | Included a duplicate **Work** section plus sales/ops/manage |

### 2. Actual route inventory discovered (code)

| SURFACE | CURRENT ROUTE | LIVE? | NOTES |
|---------|---------------|-------|-------|
| Home / Dashboard | `/app/dashboard` | yes | Office home |
| Today | `/app/today` | yes | Technician home; office “ביקורים” under Work |
| Tasks | `/app/tasks` | yes | Not redesigned |
| Customers | `/app/customers` | yes | Checkpoint A |
| Leads | `/app/leads` | yes | More |
| Quotes | `/app/quotes` | yes | More |
| Catalog | `/app/catalog` | yes | More |
| Projects | `/app/projects` | yes | Work (non-field) |
| Jobs / FieldJob | `/app/jobs`, `/app/jobs/$jobId` | yes | Work |
| Sites | `/app/sites` | yes | Work |
| Service | `/app/service` | partial product | Work for office; **hidden for field home** (Service Call V1 incomplete) |
| Warranties | `/app/warranties` | partial | More (non-field) |
| Knowledge | `/app/knowledge` | yes | More |
| Settings | `/app/settings/*` | yes | More (authorized) |

### 3. Role / permission visibility (nav presentation via `can()` + features)

| Role | Home | Work surfaces | Excluded from Work nav |
|------|------|---------------|------------------------|
| Owner / Manager | Dashboard | Visits (Today), Projects, Jobs, Service, Sites | — |
| Technician | Today | Jobs, Sites | Projects, Service, Visits duplicate, Quotes, Settings, Leads, Warranties |
| Sales | Dashboard | Visits, Jobs, Sites (+ Projects/Service if entitled) | Field-only hide rules N/A |
| Viewer | Dashboard | Jobs/Sites if permitted | Settings |

Founding Technician badge / plan keys are **not** consulted by navigation.

### 4. Work surfaces selected

1. **ביקורים** → `/app/today` (office roles only; field home already is Today)
2. **פרויקטים** → `/app/projects` (non-field)
3. **עבודות** → `/app/jobs`
4. **שירות** → `/app/service` (non-field; existing list surface)
5. **תיקי אתר** → `/app/sites`

Shared helper: `workNav()` in `apps/web/src/lib/app-nav.ts` (desktop Work group + mobile Work sheet).

### 5. Work surfaces intentionally excluded

1. **Service Call V1 capability** — incomplete; kept office-visible list only, still hidden for technician field home
2. **Installations / calendar / dispatch / maps** — not shipped; no fake nav entries
3. **Knowledge / Warranties** — secondary; placed under **עוד**, not Work
4. **Quotes / Leads / Catalog / Settings** — commercial/admin; under **עוד**

### 6. Desktop implementation

Sidebar groups are now:

`בית · לקוחות · עבודה · משימות · עוד`

- Active state via existing `isNavSelected` / `aria-current`
- Keyboard arrow walk unchanged (`nextSidebarIndex`)
- No AppShell redesign beyond nav data

### 7. Mobile implementation

- Bottom spine unchanged: `בית · לקוחות · עבודה · משימות · עוד`
- Work sheet lists `workNav()` only
- More sheet **no longer duplicates Work** (sales / ops extras / manage only)
- Quote Builder dock / `--ops-bottom-nav-offset` untouched

### 8. Technician behavior

- Home = Today
- Work sheet = Jobs + Sites only
- No projects / service / quotes / settings in sidebar or Work sheet
- Direct `/app/jobs/$jobId` FieldJob still loads lifecycle UI
- Today board empty when no assigned-for-today jobs (data), not a nav regression

### 9. Owner / manager behavior

- Work includes Visits, Projects, Jobs, Service, Sites
- Customers / Tasks / Settings remain reachable
- Settings under More group + mobile manage section

### 10. Direct-route compatibility

No route migrations. Bookmarks to `/app/jobs`, `/app/projects`, `/app/today`, `/app/service`, `/app/sites` resolve unchanged.

### 11. RTL

Hebrew-first RTL verified in browser shots (sidebar + bottom nav + Work sheet).

### 12. Light / Dark

Owner 1440 light + dark sidebar verified; mobile dark primary QA.

### 13. Accessibility

- Work / More buttons: `aria-expanded`, `aria-haspopup="dialog"`
- Links: `aria-current="page"` when selected
- Focus-visible styles on bottom nav / sidebar retained
- **PARTIAL:** exhaustive keyboard audit of every sheet row not automated beyond existing patterns

### 14. Tests

| Suite | Result |
|-------|--------|
| `work-navigation.test.ts` | 10 passed |
| `foundation.test.tsx` (nav) | 13 passed |
| `settings-expansion.test.ts` | 8 passed |
| Full web Vitest | **484 passed** (65 files) |
| `npm run web:typecheck` | PASS |
| `npm run web:build` | PASS |
| API tests | **not run** (no API changes) |

### 15. Browser QA

Evidence: `Docs/core-app-ux-qa/work-navigation/` · script `apps/web/scripts/work_navigation_qa.mjs`

| Check | Result |
|-------|--------|
| Owner 1440 dark groups + Work active | PASS |
| Owner 390 Work sheet | PASS |
| Owner 360 jobs | PASS |
| Owner light sidebar | PASS |
| Technician 390 Work = Jobs+Sites | PASS |
| Technician 1440 no commercial leak | PASS |
| Direct FieldJob route | PASS (`tech-390-direct-fieldjob.png`) |
| Quotes list bottom nav present | PASS (no dock collision introduced) |

### 16. Capability gaps discovered but NOT implemented

1. Service Call V1 full product (nav correctly limited for field)
2. Warranties as a true operational Work stream
3. Assign-for-today seeding in Phase1B QA workspace (Today empty for tech)
4. Desktop collapsible Work sub-menu (flat list is intentional / restrained)
5. SaaS Phase 2 plan UI in nav

### 17–20. Confirmations

- **Tasks content modified:** NO  
- **More content modified:** NO (only removed duplicate Work section from More command center; sales/manage/ops extras unchanged as product pages)  
- **SaaS Phase 2 modified:** NO  
- **Migrations:** NONE  
- **API changes:** NONE  

### Files touched (Checkpoint B)

- `apps/web/src/lib/app-nav.ts`
- `apps/web/src/i18n/he.ts` (group labels only)
- `apps/web/tests/foundation.test.tsx`
- `apps/web/tests/settings-expansion.test.ts`
- `apps/web/tests/work-navigation.test.ts` (new)
- `apps/web/scripts/work_navigation_qa.mjs` (new)
- `Docs/CORE-APP-UX-INFORMATION-ARCHITECTURE.md`
- `Docs/core-app-ux-qa/work-navigation/*`

---

## Checkpoint C — Tasks (COMPLETED)

**Date:** 2026-09-26  
**Mode:** Tasks list honesty + create→complete authz fix (Option A)  
**Stop:** No calendar · No assignee UI · No Work/More/Today/Jobs changes · No migrations · No RLS changes

### C0 — Technician create → complete (Option A)

**Root cause:** `POST /tasks` set `created_by` but left `assignee_id` null when omitted. RLS `tasks_update` allows managerial **or** `assignee_id = auth.uid()` — not creator. Technicians creating untitled-assignee tasks could not PATCH status.

**Exact change:** In `create_task`, when `assignee_id` is omitted from the payload, default `assignee_id` to the actor (`created_by`). Explicit `assignee_id` is preserved.

| | |
|--|--|
| Migration | **NONE** |
| RLS changes | **NONE** |
| Authz key renames | **NONE** |
| Permission changes | **NONE** |

**Files:** `apps/api/app/routers/ops_modules.py`, `apps/api/tests/test_tasks_assignee.py`  
**Live re-verify:** CREATE 200 · `assignee_id = actor` · PATCH done 200 · `status = done`

### C1–C4 — UX

| Item | Result |
|------|--------|
| Copy | Title **משימות**; lead is a light team to-do list; no calendar framing / assignment claims |
| List | Row-level complete; open/all filters; open-first sort; Hebrew status/type; no search farm; no detail route |
| States | Skeleton loading · error+retry · empty+CTA |
| Mobile 390/360 | No overflow · touch ≥44px · RTL |
| Desktop 1440 | Pass (dark + light) |

### C5 — Evidence

- Focused web: `tests/tasks.test.tsx` (14)
- API: `tests/test_tasks_assignee.py` (5)
- Browser QA: `Docs/core-app-ux-qa/tasks/`
- Full web tests: 498 passed
- Typecheck / Build: see final report

### Files touched (C)

- `apps/api/app/routers/ops_modules.py`
- `apps/api/tests/test_tasks_assignee.py`
- `apps/web/src/routes/app/tasks/index.tsx`
- `apps/web/src/lib/tasks.ts`
- `apps/web/src/i18n/he.ts`
- `apps/web/src/styles.css`
- `apps/web/tests/tasks.test.tsx`
- `apps/web/scripts/tasks_core_ux_qa.mjs`
- `Docs/core-app-ux-qa/tasks/*`
- `Docs/CORE-APP-UX-INFORMATION-ARCHITECTURE.md`

---

## Side task — More UX cleanup (COMPLETED)

**Date:** 2026-09-26  
**Mode:** Overflow honesty only (D1–D5)  
**Stop:** No Work/Tasks/Quotes/Settings product redesign · No migrations · No API

| Step | Result |
|------|--------|
| D1 | Honest More filter copy · workspace chevron removed · sections מכירות / משאבים / ניהול · Quick Visit removed |
| D2 | `canSettings()` exported and used by `AppShell` account/More gear (same as desktop More link) |
| D3 | Tech More = knowledge only · no commercial leak · Work not restored |
| D4 | Warranties dead search removed · Knowledge/Leads error+retry |
| D5 | `tests/more-navigation.test.ts` · `scripts/more_overflow_qa.mjs` · `Docs/core-app-ux-qa/more/` |

---

## Future context only (NOT STARTED)

### Next IA / product streams (not auto-started)

Service Call V1 · Warranties-as-Work · Global Search · assignee UI · calendar — only if explicitly approved.

---

## STOP

More UX cleanup complete. Awaiting review before any further checkpoint.
