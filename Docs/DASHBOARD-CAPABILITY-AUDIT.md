# SITE SECURE — Dashboard Capability & Product Audit

**Date:** 2026-09-21  
**Mode:** Research only — **zero code / CSS / API / schema / query changes**  
**Scope:** Factual map of what the existing product architecture can safely expose on Dashboard  
**Status:** Complete. **Stopped.** No Phase 3 implementation.

SITE SECURE stack (unchanged): React 19 / TypeScript / Vite / TanStack Router / TanStack Query / FastAPI / Supabase RLS.

---

## Executive summary

Phase 1B.3.1 successfully removed clutter. The remaining sparsity is **mostly absence of live operational rows**, not missing Dashboard plumbing.

The Dashboard already consumes a rich **server-composed** payload (`GET /dashboard`) for quotes + jobs (attention, today, summary, recent quotes, quote-event activity). Several other domains (tasks, service, warranties, projects list, knowledge, catalog) have **authorized list APIs** that Dashboard does **not** call.

There is **no** genuine workspace-wide user-facing activity/event stream. Current “Activity” is a **narrow synthesis** of `quote_events` + job `completed_at` inside the dashboard builder.

---

# OUTPUT 1 — CAPABILITY TABLE

| Capability | Domain | User value | Existing data? | Frontend source | Backend source | Authorization | Scope | Implementation class | Performance note | Caveat |
|---|---|---|---|---|---|---|---|---|---|---|
| Attention queue (quotes + jobs) | Dashboard | What needs action now | Yes | `OpsDashboard` merges `data.attention` + lead groups; `attentionQueue` | `apps/api/app/dashboard.py` `_quote_attention` / `_overdue_jobs` / `_unassigned_jobs` via `GET …/dashboard` | `dashboard.view` + gated `quotes.view` / `jobs.view` | Workspace; sales → own quotes; tech → assigned jobs; unassigned only when `assignments_reliable` | **AVAILABLE NOW** | Single dashboard request (quotes≤200, jobs≤100) | Not a separate Attention entity table |
| Lead follow-ups in Attention | Leads | Early-funnel next actions | Yes | `dashboard.tsx` `listLeads`; `filterLeadAttention` / `leadsToAttentionGroups` | `GET …/leads` (`ops_modules.list_leads`) | `leads.view` | Workspace | **AVAILABLE NOW** | Extra query after dashboard success; key `dashboard-lead-next` | Only statuses `new`/`contacted`/`visit_scheduling` with non-empty `next_action`; max 3 |
| Today’s scheduled / in-flight jobs | Today / Jobs | Day board | Yes | `data.today` → `ActiveWork` | `_today_jobs` in `dashboard.py` | `jobs.view`; tech variant scopes to `assigned_resource_ids` | Workspace / assigned | **AVAILABLE NOW** | Included in dashboard | Cap 24; timezone = workspace TZ |
| Next upcoming job today | Today / Jobs | “What’s next” | Yes (severity) | Same `today.items` — first `severity:"next"`, rest `later` | `_today_jobs` sorts & demotes | Same | Same | **AVAILABLE NOW** | None | Definition is **within today’s board**, not “next future day” |
| Quote status counts + open/approved **values** | Quotes | Commercial snapshot | Yes | `data.summary`, `CommercialPulse`, hero `quotesOpen` | `_ops_summary` sums `total_gross` server-side | `quotes.view` + feature `quotes` | Sales filtered to `owner_user_id` | **AVAILABLE NOW** | Included | Values are server-owned; conversion % is client display of server counts (`ux-metrics.quoteConversion`) |
| Recent quotes | Quotes | What changed commercially | Yes | `data.recent_quotes` → `RecentQuotes` (if no activity) | `_ops_summary` top 5 by `updated_at` order already on fetch | `quotes.view` | Same | **AVAILABLE NOW** | Included | Deduped against attention quote ids on client |
| Quote lifecycle activity | Quotes / Activity | Recent customer quote events | Partial | `data.activity` → `DashboardActivity` | `quote_events` (limit 8) + `_activity` | Requires `quotes.view` to fetch events | Workspace | **AVAILABLE NOW** (narrow) | Included | **Not** cross-domain activity |
| Job completion activity | Jobs / Activity | Recently closed jobs | Partial | Same `data.activity` | Jobs with `completed_at` in dashboard job batch | `jobs.view` | Scoped jobs | **AVAILABLE NOW** (narrow) | Included | Derived from job rows, not an event log |
| Usage / seat threshold banner | Team | Near-limit warning | Yes | `getUsage` when team perms | `GET …/usage` | `users.view` or `workspace.billing` | Workspace | **AVAILABLE NOW** | Separate query; staleTime 60s | Hidden for `sales` role in UI |
| Activation / setup strip | CRM / Quotes | New workspace guidance | Derived | `deriveActivation`, `workspaceSetup` | Counts from usage meter / customer probe + summary | CRM/quotes perms | Workspace | **AVAILABLE NOW** | Probe only if usage missing | Not a persisted maturity score |
| Create actions (quote/customer/site/lead/job) | Quick actions | Start work | Yes | `buildCreateActions` / `DashboardCreateMenu` / hero | Existing create routes/APIs | Per-permission + features | N/A | **AVAILABLE NOW** | No list cost | Job create href → `/app/today` (not inline create) |
| Outstanding tasks | Tasks | Personal/ops to-dos | Yes | Tasks page only: `api.listTasks` | `GET …/tasks` · `calendar.view` | `calendar.view` / edit | Workspace list; **no assignee filter in API** | **FRONTEND QUERY ONLY** | New query; not cached on Dashboard; list limit/cursor | Scoping to current user **not** implemented server-side |
| Task due-today / overdue labels | Tasks | Urgency | Fields exist (`due_at`, `status`) | UI shows `due_at`; filters `status==="open"` for complete | Same list | Same | — | **BUSINESS DEFINITION REQUIRED** | — | No authoritative “overdue task” flag; jobs overdue ≠ tasks |
| Open service calls | Service | Field support load | Yes | Service page: `listServiceCalls` | `GET …/service-calls` · `service.view` | `service.view`; assigned-scope empty page for tech with no assignments | Workspace / assigned | **FRONTEND QUERY ONLY** | New query; statuses filterable | Urgency = stored `priority` + `status` enums — no Dashboard attention kind |
| Active projects list | Projects | Delivery load | Yes | Projects page: `listProjects` | `GET …/projects` · `projects.view` | `projects.view` | Workspace / assigned filters where applied | **FRONTEND QUERY ONLY** | New query | Statuses exist (`draft`/`planned`/`in_progress`/…); **no** Dashboard “active projects” definition |
| Approved quote → pending project | Projects / Quotes | Conversion to delivery | Yes | Already in attention `quote_approved_pending_project` | Dashboard joins projects by `source_quote_id` | quotes + projects read path | Workspace | **AVAILABLE NOW** | Included | Authoritative “needs project” signal |
| Warranties by status / ends_on | Warranties | Expiry awareness | Yes | Warranties page: `listWarranties` (order `ends_on.asc`) | `GET …/warranties` · `warranties.view` | `warranties.view`; RLS `auth_site_visible` | Site-visible | **FRONTEND QUERY ONLY** for raw list; **BUSINESS DEFINITION / BACKEND** for reliable “expiring” if status not maintained | New query | Enum includes `expiring_soon`/`expired` but **no updater job found** — do not invent horizon rules client-side |
| Knowledge articles | Knowledge | Reference | Yes | Knowledge page | `GET …/knowledge` | `knowledge.view` | Workspace | **NOT APPROPRIATE** (as Dashboard ops) | — | Reference corpus, not daily command |
| Catalog products | Catalog | Pricing ops | Yes | Catalog routes | `/catalog/products` etc. | `catalog.view` | Workspace | **NOT APPROPRIATE** | — | Not operational “today” signal |
| Recent customers/sites by `updated_at` | CRM / Sites | Recency | Entity timestamps | List endpoints | `GET …/customers`, `GET …/sites` | `crm.view` / `sites.view` | Assigned scope possible | **NOT APPROPRIATE** as “activity feed” | — | **Recently updated entity ≠ activity event** |
| Customer 360 constructed timeline | Customers | Profile context | Client-built | `buildCustomerActivity` | Multiple entity lists on customer page | CRM + related | Customer scope | **NOT APPROPRIATE** for workspace Dashboard | N+1 risk if reused naively | Synthesizes create timestamps — not an event stream |
| Workspace audit log | Audit / Security | Compliance | Yes | Settings audit: `listAudit` | `GET …/audit` · `audit.view` | `audit.view` (+ plan feature `audit`) | Workspace | **NOT APPROPRIATE** for end-user Dashboard | Limit 100 | Security/ops log — not daily command narrative |
| Notifications feed | Notifications | Alerts | Prefs only | Settings notifications | Workspace settings JSON `notifications` | settings perms | Workspace | **NOT APPROPRIATE** | — | Preference bag, **no** notification event API |
| Cross-domain activity feed | Activity | Unified “what happened” | **No** | Only narrow `dashboard.activity` | `quote_events` + completed jobs | — | — | **BACKEND CAPABILITY REQUIRED** (for truthful feed) | — | See Activity verdict |
| Pipeline / forecast / revenue KPIs beyond quote totals | Commercial | Finance | Partial quote totals only | `CommercialPulse` / chart | `_ops_summary` / `_business_chart` | quotes.view | — | **AVAILABLE NOW** (quote totals); **NOT APPROPRIATE** for inventing revenue | Chart buckets by quote `updated_at` | Explicit vanity keys forbidden in dashboard payload |
| Open jobs count / overdue / unassigned | Jobs | Ops load | Yes | `summary.jobs_*`; KPI helpers | `_ops_summary` | jobs.view; unassigned only if assignments_reliable (owner/admin/manager) | Scoped | **AVAILABLE NOW** | Included | Technician home is `/app/today`, not ops Dashboard |

---

# OUTPUT 2 — DATA FLOW MAP

## A. Core Dashboard payload (already mounted)

```
PostgREST tables (RLS):
  workspaces, assignments, quotes, quote_events, jobs,
  customers, sites, projects(source_quote_id)
        ↓
apps/api/app/routers/dashboard.py :: get_dashboard
  require(ctx, "dashboard.view")
  authorize quotes.view / jobs.view / jobs.start / jobs.complete
        ↓
apps/api/app/dashboard.py :: build_dashboard
  → attention[], today{}, activity[], summary{}, recent_quotes[], business_chart?
        ↓
packages/api-client :: ApiClient.getDashboard
        ↓
apps/web/src/routes/app/dashboard.tsx
  useQuery(["dashboard", workspaceId])
        ↓
OpsDashboard / ObserveDashboard / (technician Navigate → /app/today)
  → DashboardCommandHero, CommandStatus, ActiveWork,
    DashboardActivity | RecentQuotes, ActivationCard, UsageThresholdBanner,
    CommercialPulse
```

**Also on Dashboard route (secondary):**

```
GET …/usage → ["usage", workspaceId]     (if users.view | workspace.billing)
GET …/leads → ["dashboard-lead-next"]    (if leads.view, after dashboard success)
GET …/customers?limit=1                  (activation probe fallback)
```

## B. Today (technician home)

```
Same getDashboard / build_dashboard
  home_variant="today" → jobs filtered to assigned_resource_ids
        ↓
apps/web/src/routes/app/today.tsx
  useQuery(["dashboard", workspaceId]) → TodayHome
```

## C. Viable FRONTEND QUERY ONLY flows (not Dashboard-mounted today)

| Domain | DB/API | api-client | Existing screen query key | Potential Dashboard |
|---|---|---|---|---|
| Tasks | `tasks` ← `GET …/tasks` | `listTasks` | `["tasks", workspaceId]` | Additional mount; no shared cache with Dashboard today |
| Service | `service_calls` ← `GET …/service-calls` | `listServiceCalls` | service index | Additional; tech may get empty page via `empty_assigned_page` |
| Projects | `projects` ← `GET …/projects` | `listProjects` | `["projects", workspaceId, q]` | Additional |
| Warranties | `warranties` ← `GET …/warranties` | `listWarranties` | `["warranties", workspaceId]` | Additional; order `ends_on.asc` |
| Leads (fuller) | already secondary | `listLeads` | `dashboard-lead-next` / leads index | Already partially used |

## D. Explicit non-flows for Dashboard

| Source | Why not Dashboard activity |
|---|---|
| `GET …/audit` → `audit_logs` | Requires `audit.view`; security/compliance narrative |
| `buildCustomerActivity` | Client collage of create timestamps on one customer |
| Settings `notifications` JSON | Preferences, not events |
| Catalog / Knowledge list APIs | Reference data |

---

# OUTPUT 3 — ACTIVITY FEED FEASIBILITY

## Verdict: **PARTIAL** (narrow) / **NO** (truthful cross-domain)

### Evidence for PARTIAL (what exists today)

Server builder `_activity` (`apps/api/app/dashboard.py`):

1. **`quote_events`** — up to 8 rows (`event_type`, `quote_id`, `created_at`), labeled via `EVENT_LABEL_HE` (`sent`/`viewed`/`approved`/`rejected`/`expired`). Fetched only when `quotes.view`.
2. **Job completions** — any job in the dashboard job batch with `completed_at`, titled `עבודה {number} נסגרה`.
3. Sorted by `occurred_at` desc, capped at `ACTIVITY_CAP = 8`.
4. Technician variant clears quote events (`if variant == "today": events = []`) but may still append completions.

Frontend: `DashboardActivity` renders `data.activity` only when non-empty; else falls back to **RecentQuotes** (entity updates — **not** events).

### Evidence for NO (cross-domain user feed)

| Candidate | Finding |
|---|---|
| Unified activity / timeline table | **Not found** for workspace Dashboard use |
| Notification event stream API | **Not found** (settings prefs only) |
| Audit log | Exists (`audit_logs` + `audit.view`) — **inappropriate** as daily end-user feed |
| Customer/Lead “activity” UIs | **Client-synthesized** from entity create/update fields (`buildCustomerActivity`, lead profile) |

**Rule for future design:** Do not fabricate a workspace Activity feed from `updated_at` sorts. Expanding beyond quote_events + job completions requires **BACKEND CAPABILITY** (real event model) or stay explicitly domain-scoped (“Recent quote events”).

---

# OUTPUT 4 — DASHBOARD BUILDING BLOCK INVENTORY

## AVAILABLE NOW

- Server attention groups: quote awaiting customer/us, expiring tag, approved-pending-project, stale draft (sales), job overdue, job unassigned (ops + reliable assignments)
- Client lead follow-up attention (secondary query)
- Today job board + severity next/later
- Summary: quote status counts, `quotes_open`, `quotes_open_value`, `quotes_approved_value`, `jobs_open`/`overdue`/`unassigned`
- Recent quotes (≤5)
- Narrow activity (quote events + completions)
- Optional `business_chart` (monthly quote totals from same quote batch)
- Activation/setup from live customer/quote counts
- Usage threshold meters (team roles)
- Permission-aware create menu: quote, customer, site, lead, job
- Role home variants: ops / sales / today(technician) / observe(viewer)

## FRONTEND QUERY ONLY

- Tasks list (`listTasks`) — outstanding `status=open`
- Service calls list (`listServiceCalls`) — filterable by `status`
- Projects list (`listProjects`) — raw statuses
- Warranties list (`listWarranties`) — by `status` / `ends_on` order
- Broader leads list / filters beyond current attention slice
- Sites/customers lists (only if clearly labeled as directories, not activity)

## BACKEND CAPABILITY REQUIRED

- Truthful **cross-domain** activity / notification feed
- Dashboard-native summaries for service/tasks/warranties/projects (aggregated, scoped, capped) if multiple extra list calls become too costly or unsafe
- Automatic warranty status transitions to keep `expiring_soon`/`expired` trustworthy (if product wants status-based widgets without client date math)
- Task list **scoped to current user** (`assignee_id`) if personal task strip is required (API currently returns workspace page; no assignee query param)

## BUSINESS DEFINITION REQUIRED

- “Active projects” (which of `planned`/`in_progress`/… count?)
- “Urgent service” beyond stored `priority`/`status` labels
- Task “overdue” / “due today” as product concepts (fields exist; label does not)
- “Warranty requiring action” if not strictly `status IN (expiring_soon, expired)`
- Any pipeline stage math beyond existing quote status counts / approved-pending-project
- Workspace “maturity score” (explicitly out of scope — only existing activation counts)

## NOT APPROPRIATE FOR DASHBOARD

- Audit / security logs as Activity
- Catalog / knowledge as daily ops widgets
- Cost/margin fields (explicitly stripped: `COST_SELECT_FORBIDDEN`; vanity keys asserted out)
- Fake revenue/forecast KPIs
- Mislabeling `updated_at` entity sorts as Activity
- Weakening technician assignment scope or commercial isolation (`quotes.view_cost` denied for technician)

---

# OUTPUT 5 — CURRENT DASHBOARD LIMITATIONS (why sparse)

## Root cause split

| Cause | Explanation |
|---|---|
| **Actual absence of business data** | Activation mode when `quoteCount==0`; empty `attention`, empty `today.items`, empty `activity`, empty `recent_quotes` → Hero quiet state + empty Today + optional ActivationCard. Common on new workspaces. |
| **Capabilities not consumed** | Tasks, service calls, warranties, projects lists exist elsewhere but Dashboard does not query them — so a workspace with open service/tasks can still look “empty” on Dashboard if quotes/jobs are quiet. |
| **Intentional 1B.3 product restraint** | Usage wall removed; Attention list hidden when count=0; Activity omitted when empty; CommercialPulse only when quote records exist with open/approved value. |

**Critical distinction:** Sparsity after cleanup is **not** primarily missing UI chrome. It is (1) empty ops datasets and/or (2) non-quote/job domains never wired into Dashboard.

Technician sparsity is expected on `/app/today` when no assigned jobs for local today.

---

# SPECIFIC ANSWERS (1–12)

### 1. TODAY

- **Yes** — Dashboard/`Today` show real scheduled/in-flight jobs from server `_today_jobs`, workspace timezone `Asia/Jerusalem` default.
- **Source:** `jobs.scheduled_for` / status / `completed_at` inside `GET …/dashboard`.
- **Next upcoming:** Yes within today’s list — first remaining item stays `severity:"next"`; others demoted to `later`.
- **Manager vs technician:** Manager/ops sees workspace jobs (with `jobs.view`). Technician `home_variant=today` filters to `assigned_resource_ids` (job id or site id). Sales variant blanks jobs.

### 2. ATTENTION

- **Not** a single DB entity. **Unified presentation** over multiple authoritative rules:
  - **Server:** quote status buckets, approved-without-project, job overdue, job unassigned
  - **Client:** lead follow-ups via `leadsToAttentionGroups`
- Exact kinds: `quote_approved_pending_project`, `quote_awaiting_customer`, `quote_awaiting_us`, `quote_expiring`, `quote_stale_draft`, `job_unassigned`, `job_overdue`, `lead_follow_up`.

### 3. TASKS

- Outstanding tasks: **yes** via `GET …/tasks` (`status` filter supported; UI uses `open`).
- Scoped to current user: **not** today (no assignee filter in list API).
- Overdue/due-today: **fields exist**; product labels = **BUSINESS DEFINITION REQUIRED**.

### 4. PROJECTS / JOBS

- Jobs “open”: authoritative `OPEN_JOB` set in `dashboard.py`.
- Projects: statuses in `he.projectStatuses` / API rows; **no** Dashboard “active projects” aggregate.
- Do **not** invent active — use existing statuses only after definition.

### 5. SERVICE

- Open calls: **yes** (`status` filter on `listServiceCalls`).
- Urgency: stored `priority` + status (`open`/`in_progress`/`waiting`/`closed`).
- Auth: `service.view` (+ create/edit/close/assign as applicable); technician empty list when assigned scope empty.

### 6. QUOTES

- Safely available on Dashboard already: recent, open counts, status counts, `total_gross`-based open/approved values, updated_at ordering.
- Server-owned values: counts and sums in `_ops_summary`; chart series in `_business_chart`.
- Do not invent client financial calculations beyond display formatting / ratio of **server counts**.

### 7. LEADS

- Exists: list + statuses + `next_action` / `next_action_at` / priority.
- Dashboard already surfaces a **small** follow-up slice.
- “Active leads” as a KPI = needs status-set definition (**BUSINESS DEFINITION**) if beyond current filter.

### 8. CUSTOMERS / SITES

- **No** workspace activity event stream.
- Sorting by `updated_at` = **recently updated entity**, not activity.
- Customer 360 timeline = constructed create events — profile-only.

### 9. ACTIVITY

- See Output 3: **PARTIAL / NO** for cross-domain.
- Audit exists but is **not** end-user Dashboard appropriate.

### 10. WARRANTIES

- Data: `status` enum includes `expiring_soon`/`expired`; `ends_on` indexed order.
- Meaningful “requiring action” **without new rules** only if using stored status values as-is.
- No automatic status transition code found → reliability caveat.

### 11. COMMERCIAL SNAPSHOT

- Authoritative existing: open quote count/value, approved value, status counts, recent quotes, approved-pending-project attention, optional monthly chart from quotes.
- Do **not** add forecasts/pipeline math beyond these.

### 12. QUICK ACTIONS (availability map — not product ranking)

| Action | Permission | Feature gate | Entry |
|---|---|---|---|
| New quote | `quotes.create` | `quotes` | `NewQuoteButton` / create menu |
| New customer | `crm.create` | `crm` | `/app/customers` |
| New site | `sites.create` | — | `/app/sites` |
| New lead | `leads.create` | — | `/app/leads` |
| New job | `jobs.create` | — | `/app/today` |
| Invite user | `users.invite` | — | `/app/settings/users` (admin live action) |

Technically safe to expose **only** when `can()` + feature checks pass (already how `buildCreateActions` works). Viewer: create disabled. Technician: no quotes/leads create in catalog grants.

---

# ROLE MATRIX (factual)

| Capability | Owner/Admin | Office (manager/sales) | Technician/Field |
|---|---|---|---|
| `GET /dashboard` | Yes (`dashboard.view`) | Yes | Yes, but UI routes to `/app/today` |
| Quote attention / commercial summary | Yes | Sales: **own quotes only**; no jobs summary noise | No `quotes.view` → no quote sections/events |
| Job today / overdue | Yes | Manager yes; sales jobs blanked | Assigned jobs only |
| Job unassigned attention | Owner/admin/manager (`assignments_reliable`) | Manager yes; sales no | No |
| Lead attention query | If `leads.view` | Sales/manager yes | No `leads.view` |
| Service/tasks/warranties lists | If entitled | Per grants | Service/tasks/warranties view yes; lists may be assignment-scoped / empty |
| Audit feed | Often yes (`audit.view`) | Manager **no** audit in catalog | No |
| Usage banner | Team perms | Manager may; sales UI suppressed | Typically no `users.view` |
| Create quote/customer/lead | Yes | Sales: quote/customer/lead; not job create | No quote/lead/customer create |
| Cost/margin | `quotes.view_cost` (admin/manager) | Sales: no view_cost | Denied (commercial isolation) |

**Do not weaken** assignment scope or commercial isolation to populate widgets.

---

# NEW VS ACTIVE WORKSPACE (existing signals only)

| Signal | Source | Interpretation |
|---|---|---|
| `customerCount == 0` | usage `quota_clients` or probe | No CRM yet |
| `quoteCount == 0` | sum of summary status counts | Activation incomplete (`deriveActivation.complete`) |
| Empty attention + today + activity + recent | dashboard payload | No ops/commercial motion in scoped data |
| Setup steps percent | `workspaceSetup` | Derived progress only |

**No** new maturity score. These counts already distinguish low-data vs activated workspaces.

---

# MOBILE VS DESKTOP (content class only — no layout)

| Class | Examples |
|---|---|
| High-value compact signals | Attention count, today count, quotes_open, jobs_overdue, doc/status chips |
| List/row content | Attention rows, today jobs, tasks, service calls, recent quotes, narrow activity |
| Larger analytical content | CommercialPulse strip + chart, usage meters, multi-series |

---

# PERFORMANCE NOTES (FRONTEND QUERY ONLY)

| Capability | Endpoint | Expected request | Cached elsewhere? | Extra Dashboard request? | Pagination | N+1 risk |
|---|---|---|---|---|---|---|
| Tasks | `GET /tasks?limit=` | Workspace page | Yes on `/app/tasks` only | **Yes** if mounted | cursor | Low if single page |
| Service | `GET /service-calls` | Optional `status=` | Service page | **Yes** | cursor | Enrichment does customer/site name batch in API |
| Projects | `GET /projects` | Optional `q` | Projects page | **Yes** | cursor | Low |
| Warranties | `GET /warranties` | Optional status/site/customer | Warranties page | **Yes** | cursor | Low |
| Leads | already on Dashboard | limit 20 | Shareable key | Already | limit | Low |

Dashboard core already parallelizes PostgREST reads server-side (quotes/jobs/assignments/events/customers/sites/projects).

---

# SECURITY SUMMARY

- **Workspace isolation:** All paths under `/api/v1/workspaces/{workspace_id}`; RLS on tables.
- **RBAC:** `authorize` / `require` + frontend `can()` + feature entitlements (`packages/authz/catalog.json`).
- **Technician scope:** `assigned_resource_ids` + `empty_assigned_page` / list filters (`authz/scope.py`).
- **Commercial isolation:** Dashboard strips cost/margin; technician lacks `quotes.view` / `quotes.view_cost`.
- **Audit:** Gated `audit.view` — not a Dashboard shortcut.
- Aggregation on Dashboard must continue to go through the same authorize gates — **never** a bypass.

---

# CODE REFERENCE INDEX (primary)

| Area | Path / symbol |
|---|---|
| Dashboard API | `apps/api/app/routers/dashboard.py` · `get_dashboard` |
| Dashboard compose | `apps/api/app/dashboard.py` · `build_dashboard`, `_today_jobs`, `_activity`, `_ops_summary` |
| Web route | `apps/web/src/routes/app/dashboard.tsx` |
| Ops UI | `apps/web/src/components/dashboard/OpsDashboard.tsx` |
| Attention merge | `apps/web/src/lib/attention-queue.ts` |
| Create actions | `apps/web/src/components/dashboard/DashboardCreateMenu.tsx` · `buildCreateActions` |
| Home variants | `apps/web/src/lib/home.ts` · `homeVariant` |
| api-client | `packages/api-client/src/index.ts` · `getDashboard`, `listTasks`, `listServiceCalls`, … |
| RBAC catalog | `packages/authz/catalog.json` |
| Ops modules | `apps/api/app/routers/ops_modules.py` |
| Audit | `apps/api/app/routers/team.py` · `list_audit` |
| Warranties schema | `supabase/migrations/0019_warranties.sql` |

---

## STOP

Documentation only. No Dashboard redesign, no Phase 3 implementation, no API/query changes from this audit.
