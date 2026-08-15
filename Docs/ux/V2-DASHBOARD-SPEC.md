# V2 Dashboard — Product + UX Specification

**Status:** Phase 6A **APPROVED** (source of truth). Phase 6B **implemented**.  
**Stop.** Do not start CRM / Customers / Sites / Jobs / Quotes UI without a new approval.

**Inherits (do not contradict):**

- SaaS OS: [V2-SAAS-EXPERIENCE.md](../architecture/V2-SAAS-EXPERIENCE.md)
- Application shell: [V2-APP-SHELL.md](./V2-APP-SHELL.md)
- UX OS: [V2-UX-PSYCHOLOGY.md](./V2-UX-PSYCHOLOGY.md)
- Visual: [V2-DESIGN-SYSTEM.md](./V2-DESIGN-SYSTEM.md)
- Web IA: [V2-WEB.md](../architecture/V2-WEB.md)
- Mobile IA: [V2-MOBILE.md](../architecture/V2-MOBILE.md)
- RBAC: [V2-RBAC.md](../security/V2-RBAC.md) + `packages/authz/catalog.json`
- API: [V2-API.md](../architecture/V2-API.md)
- Data: [V2-DATABASE-DESIGN.md](../database/V2-DATABASE-DESIGN.md)

This document is the **Screen Rule** for home. The Operating System still wins on conflict.

---

## 0. Why this exists before code

The failure mode is: *we have tables → put every count on a dashboard.*

SITE SECURE home is not a report, not a marketing landing, and not seven KPI cards. It is the next action for **this role**, from **real records**, through **FastAPI + `authorize()` + RLS**.

V1 had a dashboard with KPIs and ops alerts. Intent to **KEEP:** “what needs attention.” Intent to **REBUILD:** layout, copy, role split, and any vanity metric.

Until Phase 6B is explicitly started, `/app` stays the honest Phase 5 placeholder: **סביבת העבודה פעילה**. That is correct. Do not replace it with a fake-rich screen.

---

## 1. Purpose

The Dashboard (web) and Today (field) answer only:

1. **מה קרה?** — recent state changes the user did not necessarily cause  
2. **מה דורש תשומת לב?** — objects that lose value if ignored  
3. **מה אני צריך לעשות עכשיו?** — one primary next action  
4. **מה אפשר ליצור?** — quick actions, only if the destination module exists and `can(permission)` is true

If a widget does not answer one of those four, it does not ship.

North star (OS §0): if the user asks «מה אני אמור לעשות כאן?» the screen has already failed.

---

## 2. Sequencing honesty (read before any mock)

Domain **tables** for customers, sites, quotes, jobs, service calls, assignments, and notifications already exist. FastAPI today exposes **session, workspaces, customers, sites, jobs, quotes, documents**. There is **no** dashboard aggregate endpoint, **no** service-call router, **no** notifications list API, and **no** CRM/Quotes/Jobs **UI**.

Attention without a destination is a dead end. Quick actions without a route are placeholders. Both are forbidden by the OS.

**Rule for implementation (Phase 6B, after approval):**

| Element | Ships when |
|---------|------------|
| Dashboard **shell** + role layout + empty/loading/error | Spec approved + `dashboard.view` |
| Attention **group** | Server can compute it from real rows **and** the object has a live route, **or** the row itself is the destination (rare) |
| Attention **click** | Goes to that object (`/app/quotes/:id`, `/app/jobs/:id`, …), never to a report |
| Quick action | Target create/list route exists **and** `can(permission)` **and** the plan feature is on |
| “קריאות שירות פתוחות” | Service-call API + at least a service list/detail exist |
| In-app bell / unread count | Notifications phase (original roadmap Phase 12). Not faked on Dashboard |
| Technician **Today** on mobile | Mobile foundation. Web Today-lite may exist for field roles who open the SPA |

A new workspace after onboarding will often have **zero** attention. That empty state is success, not a reason to invent charts.

**Recommended product order after this spec is approved** (human may override):

1. Build the dashboard **API + shell** so empty/loading/error are real.  
2. Wire attention/quick actions only to modules as they land (CRM → Quotes → Jobs → Service).  
3. Do not delay CRM in order to “fill” the Dashboard.

The Owner sketch in this file is the **target**. First shippable UI may show fewer sections. Fewer real sections beat a full fake.

---

## 3. Authorization

Permission: `dashboard.view` (all seven roles).  
UI hiding is not security. `<Can>` / `can()` choose layout and hide CTAs. Every follow-up mutation still runs `authorize()` on the server. RLS still scopes rows.

Do **not** branch React on `role === 'owner'`. Branch on:

- `can('dashboard.view')` (gate the route)
- `can('quotes.approve')`, `can('jobs.assign')`, `can('crm.create')`, … for CTAs
- `can('quotes.view_cost')` — cost/margin **never** on this screen even if true (this is not the quote builder)
- session `role_key` only to select the **home variant** listed below (a catalog-driven `home_variant` is preferred when implemented)

| Role | Home variant | Default scope | Web home | Mobile home |
|------|----------------|---------------|----------|-------------|
| `owner` | `ops` | all | Dashboard | Not primary |
| `administrator` | `ops` | all | Dashboard | Not primary |
| `manager` | `ops` | team | Dashboard | Optional check-in |
| `sales` | `sales` | owned | Dashboard (owned pipeline) | Not primary |
| `technician` | `today` | assigned | Today-lite (not ops) | **Today** |
| `founding_technician` | `today` | assigned | Today-lite + assigned CRM peek | **Today** |
| `viewer` | `observe` | all (read) | Read-only Dashboard | Not primary |

Web is the management product. Field roles on web still must not see the Owner ops layout. Same product, different goal.

---

## 4. Route and shell

| Path | Who | Title (rank 1) |
|------|-----|----------------|
| `/app/dashboard` | `ops`, `sales`, `observe` | `סקירה` |
| `/app/today` | `today` | `היום` |
| `/app` | all | Redirect: field → `/app/today`, else → `/app/dashboard` |

Nav (management): under **סקירה**, item `סקירה` → `/app/dashboard`. Selected state = weight + background + start border (already in shell).  
Nav (field on web): `היום` instead of `סקירה`. Do not show both as equal homes.

Do **not** add Calendar, Reports, Inventory, Billing to this nav until those modules exist.

Page header:

- Ops/Sales/Viewer: title `סקירה`. Primary (rank 4) = the single highest-permission create that exists (see §10). If none exist yet, **no** primary button — empty state carries the next honest sentence.
- Today: title `היום`. Primary = next job verb (`התחל עבודה` / `נווט` / `סיים עבודה`), not `+ עבודה חדשה`, unless there is no current job and `jobs.create` is allowed.

One primary per view. Quick actions are secondary, quieter, not a row of equal filled buttons.

---

## 5. Shared layout (web, RTL)

Allowed layout: **stacked sections**, not a 12-column card grid.

```
PageHeader (title + one primary)
   ↓
Attention (rank 1 body)     — objects that need a person
   ↓
Today / pipeline (rank 2)   — time-ordered work (ops: unassigned/today jobs; sales: quotes; field: jobs)
   ↓
Quick actions (rank 5)      — only live destinations; ghost/secondary
   ↓
Activity (rank 3)           — what happened; no required click
```

Spacing: 24 between sections, 16 inside a section. Radius 8 on the page panel if used; **do not** wrap every row in its own elevated card. Rows are a list: name, Hebrew status marker, chevron. Hover/focus + title-as-link. Not color-only selected.

Density: comfortable-dense. Table-like rows ~40px. No avatar stack. No decorative map.

---

## 6. Attention model

Attention is a **typed, ranked list of objects**, optionally grouped.

A group header may show a **count that equals the real set** (`2 הצעות ממתינות לאישור`). That count is a label for the group, not a KPI tile, not a sparkline, not duplicated in a second widget.

**Severity** (text + marker, not color alone):

| Severity | Marker | When |
|----------|--------|------|
| `now` | warning marker + Hebrew | SLA / overdue / unassigned work waiting |
| `next` | info/action marker | waiting on customer or on us, not late |
| `info` | muted | FYI only — prefer Activity instead |

**Click:** the object. Not `/app/reports`. Not a modal of stats.

**Cap:** 5 rows per group on the home. If more, `הצג הכל` only when the filtered list route exists. Otherwise show 5 and stop (no fake “+12 more”).

**Empty attention:** do not show the section header with `0`. Omit the section. The page-level empty (goal gradient) takes over.

### 6.1 Attention kinds (catalog)

Only kinds whose **data + destination** exist may be returned by the API.

| Kind | Hebrew group | Source of truth | Needs permission to **see** | Destination | Available when |
|------|----------------|-----------------|-----------------------------|-------------|----------------|
| `quote_awaiting_us` | הצעות ממתינות לאישור | `quotes.status in (sent, viewed)` and waiting on **us** (approve) **or** waiting on customer — split below | `quotes.view` | quote | Quotes API exists; quote **UI** for click |
| `quote_awaiting_customer` | ממתינות לאישור הלקוח | `sent` / `viewed`, not expired | `quotes.view` | quote | same |
| `quote_expiring` | הצעות שפג תוקפן בקרוב | `valid_until` within 7 days, status sent/viewed | `quotes.view` | quote | same |
| `job_unassigned` | עבודות ללא טכנאי | job not `completed`/`cancelled` and no `assignments` of type job | `jobs.view` + typically `jobs.assign` to act | job | Jobs API exists; job UI for click |
| `job_overdue` | עבודות באיחור | `scheduled_for < now`, status in scheduled/en_route/in_progress | `jobs.view` | job | same |
| `job_today` | (belongs in Today section, not Attention) | — | — | — | — |
| `service_open` | קריאות שירות פתוחות | `service_calls.status in (open, in_progress, waiting)` | `service.view` | service call | **Blocked** until service API + UI |
| `service_critical` | קריאות קריטיות | priority `critical` and not closed | `service.view` | service call | same block |
| `lead_follow_up` | לידים למעקב | `leads.status = follow_up` (sales: owned) | `leads.view` | lead | Blocked until leads API + UI |
| `subscription_risk` | חיוב דורש טיפול | `subscriptions.status = past_due` | `workspace.billing` | billing | Blocked until billing UI; do not show `0` |

**Do not invent:** “overloaded technician”, “team utilization %”, “monthly revenue”, “conversion rate”, “open customers”, “sites count”, “documents uploaded this week”.

Overloaded technician is a **later** attention kind: only when we can define a real rule (e.g. >N open jobs assigned) **and** the destination is that technician’s job list. Until then, absent.

### 6.2 Waiting-on-us vs waiting-on-customer

OS: evaluative ease. Do not dump all non-draft quotes into one pile.

- **לאישור אצלנו** — `quotes.approve` is the next verb (Owner/Admin/Manager/Sales as granted). Viewer sees the row without the verb.  
- **ממתין לאישור הלקוח** — status `sent`/`viewed`. Next verb is follow-up, not approve.

Copy is a sentence a person would say, never `PENDING_APPROVAL`.

---

## 7. Role specifications

Each role: user goal, rank 1–5, primary CTA, sections, empty, forbidden.

### 7.1 Owner — `ops`

**Goal:** keep the business moving: money-adjacent quotes, unassigned field work, real billing risk.

**Rank 1:** Attention groups (quotes waiting, unassigned jobs, overdue jobs; service when live).  
**Rank 2:** Today’s scheduled jobs (short).  
**Rank 3:** Activity.  
**Rank 4 (primary):** first live create, preference order: `לקוח חדש` (`crm.create`) → `הצעת מחיר` (`quotes.create`) → `עבודה חדשה` (`jobs.create`).  
**Rank 5:** remaining quick actions as secondary.

Target sketch (only live rows appear):

```
סקירה                              [לקוח חדש]

דורש תשומת לב
  2 הצעות ממתינות לאישור
    Q-00012  לקוח א  אתר ב  ● ממתין לאישור הלקוח
    Q-00018  לקוח ג          ● לאישור אצלנו
  1 עבודה ללא טכנאי
    J-00004  לקוח א  אתר ב  ● מתוכננת · אין טכנאי

היום
  09:00  לקוח א  אתר ב  ● מתוכננת

פעולות מהירות
  לקוח חדש     הצעת מחיר     עבודה חדשה     (ghost/secondary; one may be promoted to header)

פעילות
  הלקוח אישר הצעה Q-00010
  עבודה J-00003 נסגרה
```

**Empty (no customers yet):** continue onboarding gradient, honest:

```
אין עדיין לקוחות
צרו לקוח ראשון כדי להתחיל הצעות ועבודות.
[לקוח חדש]     ← only if CRM create route exists
```

If CRM does not exist yet: **אין עדיין פעילות להצגה** + body: `מודולי הלקוחות, ההצעות והעבודות יתווספו בהמשך.` No fake button. No KPI zeros.

**Owner-only extra:** `subscription_risk` when billing exists. Never `מחק סביבה` on this page.

**Forbidden:** revenue charts, seat utilization, “health score”, map of all sites, weather, motivational quote.

---

### 7.2 Administrator — `ops`

**Goal:** run operations. Same attention engine as Owner **minus** billing and workspace delete.

**Rank 4:** same create preference as Owner (`crm.create` is granted).  
**Difference:** no `workspace.billing` CTA; no past-due banner unless we later add a non-billing “contact the owner” info row (do not invent in v1).  
**Users:** inviting people is Settings, not a Dashboard tile. A single attention kind `invites_pending` may be added when invitations UI exists — not a “team members: 4” KPI.

Layout = Owner ops without billing. Do not clone the page into a different visual theme.

---

### 7.3 Manager — `ops`

**Goal:** assign work and clear SLA. Not billing, not user admin.

**Rank 1:** `job_unassigned`, `job_overdue`, `service_open` (when live), quotes waiting **if** `quotes.approve` (manager has it).  
**Rank 4:** `עבודה חדשה` if `jobs.create` and route exist; else `הצעת מחיר` if that route exists.  
**Rank 5:** assign is an **row action** on unassigned jobs (`שייך טכנאי`) only if `jobs.assign` — not a third primary.

**Empty:** `אין עבודות שדורשות שיבוץ` when there are jobs but none unassigned. If there are no jobs at all and create exists: `צרו עבודה ראשונה`.

**Forbidden:** company-wide finance, inventory stock, “everyone’s quotes” framed as personal pipeline (manager may see them; they are attention, not a sales funnel widget).

---

### 7.4 Sales — `sales`

**Goal:** move **their** quotes and leads. Scope `owned`.

**Rank 1:** owned `quote_awaiting_customer`, `quote_expiring`, drafts sitting too long (`draft` updated >3 days — kind `quote_stale_draft`, only owned).  
**Rank 2:** owned quotes in motion (sent/viewed), not a Kanban of the whole company.  
**Rank 4:** `הצעת מחיר` (`quotes.create`) when the route exists.  
**Rank 5:** `לקוח חדש` if `crm.create`.

**Do not show:** unassigned jobs, open service calls (sales has `service.view` — still **omit** from sales home; it is not their next action), cost/margin, other people’s owned quotes.

**Empty:** `אין הצעות פתוחות` + `צרו הצעת מחיר` when allowed. If they have no customers: same customer gradient as Owner, still owned-scope after create.

**Viewer-like trap:** never show `שלח הצעת מחיר` if `quotes.send` is false (sales has send). If send fails, Hebrew envelope, not 403 raw.

---

### 7.5 Technician — `today`

**Goal:** the next assigned job. Not the company’s attention list.

Web **Today-lite** (this is still not the field product):

```
היום                              [התחל עבודה]   ← only for the current job’s next verb

09:00
לקוח X
אתר Y
● ממתינה
[פתח עבודה]

14:00
לקוח Z
אתר A
● ממתינה
[פתח עבודה]
```

**Rank 1:** current/next job (customer, site, time). Address/phone when site payload includes them.  
**Rank 4:** exactly one of `נווט` / `התחל עבודה` / `סיים עבודה` according to `job.status` (`scheduled` → start or navigate; `en_route`/`in_progress` → continue/complete).  
**Rank 2:** remaining assigned jobs today.  
**Supporting:** overdue assigned jobs as a short warning list (real `scheduled_for`).  
**Empty:** `אין עבודות להיום` + who to contact (workspace name / “פנו למנהל”). No map. No “browse all company jobs”.

**Forbidden on technician home:** quotes to approve, unassigned pool, billing, quick action `לקוח חדש`, margins, charts.

`jobs.create` is granted to technicians (catalog). That does **not** promote `+ עבודה חדשה` to the Today primary. If we later allow field-created jobs, it sits as a secondary in overflow (`עוד פעולות`), not as a competing FAB.

Navigate: deep link to Waze/Google Maps from site address. Do not build a map product.

---

### 7.6 Founding Technician — `today`

**Goal:** same field gradient as technician. Extra: limited CRM/quotes **in assigned context** (catalog: `crm.create/edit`, `quotes.edit`, not `quotes.send` / `quotes.approve` / `quotes.create`).

Home = Today (identical structure to technician).

**Do not** give FT the Owner ops dashboard.  
**Do not** put `הצעת מחיר` as Today primary (`quotes.create` is **denied**).  
Assigned-site quote peek belongs on the **job / site**, not as a second home.

If FT opens `/app/dashboard` by URL: redirect to `/app/today`.

---

### 7.7 Viewer — `observe`

**Goal:** understand what is going on without pretending they can act.

**Rank 1:** same *kinds* they can `view` (quotes, jobs, service when live), as **read-only rows**.  
**Rank 4:** **none.** Opening a row is the interaction (the object’s view page). A primary `לקוח חדש` that 403s is a failed screen.  
**Rank 5:** none.

Status text still Hebrew. Rows still look clickable if a view route exists; if the viewer lacks a detail route, the row is text-only (no chevron).

**Empty:** `אין פריטים להצגה` without a create button.

**Forbidden:** any mutation verb, any quick action, any “ask an admin” upsell card.

---

## 8. Activity (“מה קרה?”)

Short, reverse-chronological, **already-happened** facts. Not a second attention list.

Sources (when queryable under RLS):

- `quote_events` (sent, viewed, approved, rejected)
- job status transitions (`started_at` / `completed_at` as proxy until a job_events table is used)
- later: notification inserts for this user

Copy: `הלקוח אישר הצעה Q-00012`, `עבודה J-00004 נסגרה`. Never `QUOTE_APPROVED`.

Cap: 8 rows. Click → object if route exists, else non-clickable text.

If empty: omit the section (do not show `אין פעילות` under a loud header unless the whole page is empty).

Realtime (architecture): invalidate this query on job/quote notification events when Phase 12 exists. Until then, TanStack Query refetch on focus is enough. Do not poll every 2s.

---

## 9. Data requirements

All numbers and rows come from **Postgres via FastAPI**, scoped by the caller JWT (RLS) after `authorize('dashboard.view')`. The SPA must **not** page through `/customers`, `/jobs`, `/quotes` to compute home.

### 9.1 Server computes

Per attention kind: count + top N rows with enough fields to render a sentence:

- entity id, type, number/code  
- Hebrew status label (API may send `status` enum **and** `status_label_he`; UI shows only Hebrew)  
- customer display name, site name (join; do not send raw UUIDs as the title)  
- `scheduled_for` / `valid_until` when relevant  
- `href` only if the server knows the web route is enabled (or omit href and let the client map known routes)

Today jobs: assigned to the caller (field) or workspace-visible scheduled today (ops), ordered by `scheduled_for`.

Activity: last events the caller is allowed to see.

Quick actions: **not** from the server as security; the client lists from catalog + route registry. Server may optionally return `allowed_actions[]` as a convenience; the client still uses `can()`.

### 9.2 What exists today (honest)

| Need | Today |
|------|--------|
| Quotes by status | Table + FastAPI list/get |
| Jobs by status, `scheduled_for` | Table + FastAPI list/get |
| Job assignees | `assignments` table; list jobs API does not yet expose “unassigned” filter — dashboard query must join |
| Customers / sites names | Tables + FastAPI |
| Service calls | **Table only** — no FastAPI router |
| Leads | Table only — no FastAPI router |
| Notifications | Table only — no list API |
| Quote events | Table; not necessarily exposed as a list API yet |
| Billing past_due | `subscriptions` — no billing UI |

Dashboard SQL must use the **user JWT** client so RLS applies. Service role is not allowed for this read.

---

## 10. API endpoints required

### 10.1 New (required for any real Dashboard)

```
GET /api/v1/workspaces/{workspace_id}/dashboard
```

- Auth: Bearer JWT  
- Authz: `authorize(dashboard.view)`  
- 404 if workspace not visible (do not leak)  
- Query: none required; optional `?activity_limit=` capped  

**Response shape (illustrative):**

```json
{
  "home_variant": "ops",
  "generated_at": "2026-08-14T10:00:00+00:00",
  "attention": [
    {
      "kind": "quote_awaiting_customer",
      "label_he": "ממתינות לאישור הלקוח",
      "count": 2,
      "items": [
        {
          "entity_type": "quote",
          "entity_id": "…",
          "number": "Q-00012",
          "title_he": "ממתין לאישור הלקוח",
          "customer_name": "לקוח א",
          "site_name": "אתר ב",
          "severity": "next"
        }
      ]
    }
  ],
  "today": {
    "label_he": "היום",
    "items": []
  },
  "activity": []
}
```

Omit empty `attention` groups. Omit `today.items` empty → client hides section unless variant is `today` (then empty state is required).

**Do not** return vanity: `kpis: { customers: 12, revenue: 80000 }`.

### 10.2 Supporting (existing or soon)

| Endpoint | Dashboard use |
|----------|----------------|
| `GET /api/v1/auth/session` | role, features, workspace |
| `GET .../quotes/:id` | click-through |
| `GET .../jobs/:id` | click-through |
| `POST .../jobs/:id/start` | Today primary |
| Assign job | when `jobs.assign` UI exists |
| Service / leads / notifications | later phases; do not stub 200s |

### 10.3 Explicitly not a Dashboard API

- Client-side PostgREST to `quotes?status=eq.sent`  
- A “analytics” endpoint that returns chart series  
- Aggregates that ignore RLS (counts via service role)

---

## 11. Empty, loading, error

Use Phase 5 primitives. Skeletons **match** the section layout (header + 3 rows), not a generic gray block.

| State | Behavior |
|-------|----------|
| Loading | Skeleton of Attention + Today. No spinner-only blank main. |
| Error | `ErrorState` + `נסו שוב`. Hebrew from envelope. No partial fake zeros. |
| Empty (ops, no objects) | Goal gradient: next **real** business object if the route exists; otherwise honest “יתווסף בהמשך”. |
| Empty (today, no jobs) | `אין עבודות להיום` |
| Empty (viewer) | `אין פריטים להצגה` |
| Permission deny on route | existing session/403 pattern; Hebrew `אין הרשאה` — should be rare if nav is filtered |
| Partial group failure | fail the page or that section with retry; never fill with `0` as if all-clear |

Never a blank white main. Never checkmarks on steps that did not happen.

---

## 12. UX Psychology per section

Cascade: Principle → this screen.

| Section | Principle | Design / screen rule |
|---------|-----------|----------------------|
| Whole page | Decision fatigue | One primary. Quick actions are not six filled buttons. |
| Attention | Loss aversion (ethical) | Only real loss: expired quote, overdue job, unassigned visit. No fake urgency. |
| Group counts | Evaluative ease | `2 הצעות ממתינות לאישור` is a sentence, not `PENDING: 2`. |
| Rows | Affordances | Row looks clickable (hover, focus ring, chevron or title link). Disabled assign looks disabled. |
| Today | Goal gradient | Job sequence is the gradient (Navigate → Start → …). Home does not show a fake % complete for the company. |
| Quick actions | Progressive disclosure | Creates are visible; Advanced (timezone, VAT, margin) never lives here. |
| Activity | Feedback | Confirms the world moved. It is not a notification inbox. |
| Empty | Reciprocity / endowment | Next object in *their* business, not a feature tour. |
| Field vs ops | Role-specific next action | Different home. Same tokens. |
| Color | Color theory | One semantic besides primary (warning on overdue). Rainbow = fail. |
| Motion | Micro-interactions | No dashboard choreography. 150–200ms row hover at most. |

---

## 13. Visual hierarchy (five ranks)

Declare before layout (OS §6).

**Ops / sales / viewer**

1. Attention (or empty sentence)  
2. Today / pipeline list  
3. Activity  
4. Header primary create (ops/sales only, if live)  
5. Quick actions + “הצג הכל”

**Today (field)**

1. Next job identity (who, where, when)  
2. Rest of today’s jobs  
3. Overdue assigned (if any)  
4. Next verb on the current job  
5. Overflow (`עוד פעולות`) — never three FABs

Type: one page title. Section titles 16–18/600. Row body 14. Status 13 + marker. Tabular time (`09:00`) LTR in `.ltr-meta` if needed; Hebrew labels stay RTL.

---

## 14. Mobile vs web

| | Web | Mobile |
|--|-----|--------|
| Primary user | Owner, admin, manager, sales, viewer | Technician, FT |
| Home | `/app/dashboard` or `/app/today` | Tab **היום** |
| Density | Comfortable-dense lists | Larger targets ≥44px, more air |
| Primary action | Header button | In-flow / thumb-zone verb |
| Maps | Not on dashboard | External nav from the job |
| KPIs | None | None |
| Offline | Online-first | Today must tolerate offline **after** sync phase; until then, honest error, not silent success |
| Notifications | Bell later (top bar) | Tab later; Today does not fake a badge count |

Shrinking the Owner dashboard onto a phone is a failed mobile screen. Managers who open mobile see Today/jobs check-in, not finance.

Phase 6A does **not** implement Expo. This section is so web implementation does not paint the field out of the product.

---

## 15. Notifications vs attention

Two different systems:

| | Attention (this spec) | Notifications (later) |
|--|----------------------|------------------------|
| What | Pull: current objects in a bad/waiting state | Push: an event happened |
| Where | Home body | Bell / tab / OS push |
| Example | Quote still `viewed` for 5 days | `QUOTE_APPROVED` at 14:03 |
| API | `GET .../dashboard` | `GET .../notifications` |
| Until it exists | — | **No bell, no red `3`, no fake unread** |

Do not merge them into one “alerts” card with mixed meanings.

---

## 16. Quick actions

Labeled with verbs. Secondary/ghost. Never equal-weight primaries.

| Action | Hebrew | Permission | Feature | Route (when built) |
|--------|--------|------------|---------|---------------------|
| Create customer | לקוח חדש | `crm.create` | crm | `/app/customers/new` |
| Create quote | הצעת מחיר | `quotes.create` | quotes | `/app/quotes/new` |
| Create job | עבודה חדשה | `jobs.create` | (core/jobs) | `/app/jobs/new` |
| Create service call | קריאת שירות | `service.create` | service | `/app/service/new` |

**Absent if** permission, feature, or route is missing.  
**Absent for** viewer.  
**Not on** technician Today as the page primary.

Invite user, branding, catalog, inventory, reports: **not** quick actions on home.

---

## 17. What not to display

Hard fail if any of these ship on home:

- Vanity KPIs (customers, revenue, “health”, conversion, utilization %)  
- Charts without a decision  
- Decorative maps / weather / clocks / greetings (`שלום, אור!`) as rank 1  
- Emoji, gradient blobs, glass, confetti, AI-looking card walls  
- Duplicate widgets (same 2 quotes as a number tile **and** a list)  
- Placeholder nav or buttons to unbuilt modules  
- Raw enums (`IN_PROGRESS`, `Action`, `Submit`)  
- Cost, margin, VAT breakdown  
- Other tenants’ data; other workspaces’ counts  
- Aegis branding  
- Dark-pattern urgency  
- `0` attention groups that imply “all clear” when the query failed  
- Technician pool of **unassigned** company jobs  
- Billing upsell (`קנו PRO עכשיו`)  
- Fake progress / onboarding percent  
- Notification badge without a notifications API  

---

## 18. Acceptance criteria

Phase 6B (implementation) is **COMPLETE** only when all of the following are true. This Phase 6A document is complete when the human approves it — no code required.

### Product

- [ ] Home answers the four questions in §1  
- [ ] Owner/Admin/Manager share ops structure with permission-gated CTAs — not three unrelated visual themes  
- [ ] Sales home is owned pipeline, not ops  
- [ ] Technician/FT home is Today, not ops  
- [ ] Viewer has no mutating primary  
- [ ] `/app` redirects to the correct variant  
- [ ] Attention click opens the object  
- [ ] Empty states are honest; unbuilt modules are absent, not greyed-fake  

### UX Psychology (OS §25)

- [ ] Primary identifiable in two seconds  
- [ ] Disabled ≠ enabled  
- [ ] No fake progress  
- [ ] Copy is Hebrew verbs/sentences, not enums  
- [ ] Selection/error not color-only  
- [ ] One primary per view  
- [ ] Does not look like generic AI SaaS  

### Engineering

- [ ] `GET .../dashboard` uses caller JWT; no service role  
- [ ] `authorize('dashboard.view')` on the endpoint  
- [ ] Client does not aggregate via unbounded list crawls  
- [ ] `<Can>` hides; API still denies  
- [ ] Tokens/primitives only (no one-off dashboard palette)  
- [ ] RTL + responsive: sidebar collapse unchanged; home stacks; no 3-column KPI row  
- [ ] a11y: list semantics, focus rings, named buttons, `dir="rtl"`  
- [ ] Typecheck, lint, tests (attention kinds, role variant, empty, viewer has no CTA), build  
- [ ] Tests: viewer cannot get assign/create verbs; technician dashboard JSON/variant is `today`; cross-workspace 404  

### Stop

- [ ] No CRM/Quotes/Jobs **module screens** sneaked in “to make click-through work” beyond the minimum destination the human already approved  
- [ ] No notification bell  
- [ ] No dark mode toggle project  
- [ ] No mobile app work unless explicitly in scope  

Then **STOP**.

---

## 19. Backlog (explicitly not this spec’s implementation)

Carried from Phase 5 + architecture, unchanged:

- Bundle splitting (do not download quote builder on dashboard — [V2-WEB.md](../architecture/V2-WEB.md) §11)  
- Toast wiring when a home mutation exists  
- Tooltip RTL  
- Dark mode as a product switch  
- Email verification config  
- `npm audit` before production  
- Idempotency before offline sync  
- In-app notifications + realtime invalidation  
- Overloaded-technician rule  
- Service-call and lead attention kinds until those APIs/UI exist  

---

## 20. Implementation order (Phase 6B only)

When the human says **Proceed to Phase 6B — Dashboard Implementation**, not before:

1. `GET /api/v1/workspaces/{id}/dashboard` + tests (role variant, RLS, no vanity fields)  
2. `packages/api-client` method  
3. Route `/app/dashboard` + `/app/today` + `/app` redirect  
4. Presentational sections: AttentionList, TodayList, ActivityList, QuickActions — logic stays out of dumb components  
5. Wire `can()` / `<Can>`  
6. Empty/loading/error  
7. Nav label `סקירה` / `היום`  
8. Typecheck, lint, tests, build  
9. **STOP** — do not start Customer 360, quote builder, or mobile Today beyond what was approved  

Replace the Phase 5 SuccessState placeholder only when the new home can render empty **honestly**.

---

This spec is the first product screen where RBAC, FastAPI, Postgres+RLS, UX Psychology, and the Design System meet. If a proposed widget cannot name its permission, its source row, and its destination, it does not belong on the Dashboard.
