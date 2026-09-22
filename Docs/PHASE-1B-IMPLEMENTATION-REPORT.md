# Phase 1B — Implementation Report

**Date:** 2026-09-21  
**Scope:** Authenticated AppShell presentation + Dashboard + Today + shared ActivityRow  
**Status:** Implementation complete + Visual QA completion pass done. Stopped. No Phase 2.

This was a presentation-layer change only. SITE SECURE remains React 19 / TypeScript / Vite / TanStack Router / TanStack Query / FastAPI / Supabase.

The Flutter fintech project was used as a visual reference only. It was not imported, and no second frontend was created.

---

## FILES CHANGED

| File | Why |
|---|---|
| `packages/ui/src/ActivityRow.tsx` | **Added.** Presentational list row (slots only; no domain logic). |
| `packages/ui/src/index.ts` | Export `ActivityRow`. |
| `packages/ui/src/TabsHeader.tsx` | Opt-in `PageHeader appearance="display"` (1.75rem mobile). Default title size unchanged. |
| `packages/ui/tests/primitives.test.tsx` | Hebrew title/subtitle/trailing coverage for `ActivityRow`. |
| `apps/web/src/styles.css` | Authenticated shell, sidebar, dashboard cards, Today rows, ActivityRow, motion, RTL urgency bars, reduced-motion. |
| `apps/web/src/components/dashboard/DashboardSignalStrip.tsx` | Existing attention KPI marked `is-hero` (presentation class only). |
| `apps/web/src/components/dashboard/AttentionList.tsx` | Existing attention items rendered with `ActivityRow`. Links/buttons unchanged. |
| `apps/web/src/components/dashboard/ActiveWork.tsx` | Existing today jobs rendered with `ActivityRow`. Open-job `Link` unchanged. |
| `apps/web/src/components/dashboard/TodayHome.tsx` | Stronger display hierarchy using existing `data.today.items.length`. |
| `apps/web/src/components/dashboard/TodayList.tsx` | Existing job cards restyled with `ActivityRow`. Actions/navigation unchanged. |
| `apps/web/src/components/dashboard/ActivityList.tsx` | Existing activity titles/timestamps in `ActivityRow`. **Still not mounted on OpsDashboard** (IA unchanged). |
| `apps/web/src/components/dashboard/RecentQuotes.tsx` | Mobile quote rows use `ActivityRow` with real number/status/`total_gross`. Desktop table unchanged. |
| `Docs/PHASE-1B-IMPLEMENTATION-REPORT.md` | This report. |

**Not modified in this phase (logic preserved; visual via CSS):**

| File | Notes |
|---|---|
| `apps/web/src/components/AppShell.tsx` | Outlet, RBAC nav, sheets, theme selector, collapse, command palette unchanged. |
| `apps/web/src/components/AppSidebar.tsx` | Groups, `isNavSelected`, collapse, account menu unchanged. |
| `apps/web/src/components/AppBottomNav.tsx` | Phase 1A floating capsule + puck retained. Dark authenticated graphite surface via CSS only. |
| `apps/web/src/routes/app/dashboard.tsx` | Queries, redirects, `homeVariant` unchanged. |
| `apps/web/src/routes/app/today.tsx` | Queries, mutations, technician-only `homeVariant === "today"` gate unchanged. |
| `apps/web/src/components/dashboard/OpsDashboard.tsx` | Widget composition, `can()` gates, activation, commercial isolation unchanged. |
| `packages/design-system/src/tokens.json` / `tokens.css` | No new tokens in 1B. Phase 1A tokens reused. |

---

## COMPONENTS ADDED

### ActivityRow (`packages/ui`)

Layout-only primitive:

- Slots: `leading`, `title`, `subtitle`, `meta`, `trailing`
- Spreads `div` attributes except HTML `title` (omitted so the slot can be `ReactNode`)
- Does **not** route, authorize, calculate quote totals, derive job status, or know SITE SECURE entities
- Consumers wrap with existing `<Link>` / `<button>`

Visual pattern (CSS `.ss-activity-row`): 44px circular leading, hairline separators via `.ss-activity-list`, logical `text-align: start` / trailing `end`.

---

## COMPONENTS RESTYLED

| Component | What changed | What did not |
|---|---|---|
| Ops shell canvas | `.ops-content` uses `--color-bg-0`; sidebar `--color-bg`; 15rem sidebar | Collapse, sticky sidebar, mobile sheets |
| Sidebar nav | 8px item radius, 9% action wash on active, inline-start accent | Destinations, filtering, `aria-current` |
| Topbar | 12px padding, hairline | Search, workspace status, account menu |
| Signal strip | 14px cards; attention value 1.75rem (`is-hero`) | Counts, hrefs, quote/today visibility flags |
| Command header | Existing greeting remains the display title (~28–32px mobile; denser ≥768) | Greeting, create menu, search |
| Attention / Active work / Recent / Commercial cards | 14px radius, hairline, `--color-bg-1` | Queries, grouping, CTAs |
| Today hero | 1.75rem title + existing job count | `he.fieldOpsKicker`, empty state, offline banner |
| Today job card | ActivityRow + 14px card + pill nav links | Maps URL, open job, `en_route`/`arrived`/`start`/`complete` |
| Floating nav (auth dark) | Capsule `#171c22` when `html.dark` | Geometry, puck, More/Work, RBAC items |
| PageHeader | Optional `appearance="display"`; default still `text-2xl` | Dashboard/Today do not use PageHeader (own headers) |

---

## TOKENS ADDED / CHANGED

**None.** Phase 1B reuses Phase 1A motion/radius language in CSS:

- Dashboard/Today cards: **14px** radius (not the engineering 3px `--radius-panel` inside `.ops-shell`)
- Entrance: `ss-ops-enter` **420ms** `--ease-out-cubic`, only under `prefers-reduced-motion: no-preference`
- Action blue remains **`#0b6bcb`**
- Heebo unchanged. Plus Jakarta Sans was not introduced.

`.ops-shell` still sets `--radius-control` / `--radius-panel` to 3px for operational density outside these restyled widgets.

---

## APPSHELL CHANGES

- Desktop: productivity sidebar retained. Not replaced by the floating nav.
- Canvas vs chrome: page canvas `--color-bg-0`, sidebar/topbar `--color-bg`.
- Mobile: Phase 1A floating nav kept; `.ops-main` still clears `--ops-bottom-nav-offset` (5.35rem + safe-area).
- **Unchanged:** route `Outlet`, permission filtering, More/Work sheets, technician vs manager destinations, command palette, sidebar collapse, theme selector ownership.

---

## SIDEBAR CHANGES

- Width 15rem; collapsed 3.75rem
- Nav items: 8px radius, muted default, action-tinted active, icon recolor on active
- Active accent uses **logical** `border-inline-start` (RTL-safe)
- Reduced motion: width/color transitions disabled
- **Unchanged:** `appNav()` groups, keyboard arrow move, account block

---

## DASHBOARD CHANGES

Hero KPI = **existing attention count** (already the first signal). Class `is-hero` enlarges that number only. No new calculation.

Supporting signals remain the existing today count, open quotes, and pipeline value — each still gated by the same `can()` / `hasFeature` flags.

Activity rows on Dashboard:

- Attention queue → `ActivityRow` (real number, customer/site, age/reason, existing action label)
- Active work → `ActivityRow` (real title, site/customer, status label, time, existing “פתח עבודה”)
- Recent quotes (mobile) → `ActivityRow` (real customer, number, `formatMoney(total_gross)`, existing status)

`ActivityList` was restyled but **not remounted** on OpsDashboard (it was not in the V3 composition).

CommercialPulse / UsageSnapshot / ActivationCard keep existing data and ApexCharts **only where the chart already existed**.

---

## TODAY CHANGES

- Greeting/context: existing `he.fieldOpsKicker` + `he.todayTitle` + `he.fieldTodayLead`
- Workload number: `data.today.items.length` (already on the payload)
- Job row: site title, job title, customer, `number`, scheduled window, **address text if `site_address` is already present**, status via existing `Status` + `he.jobStatuses`
- Actions: same maps link, same open-job link, same primary lifecycle button (`he.startRoute` etc.)
- Buckets: existing now/next/later/done from existing `severity`/`status`
- **Unchanged:** `queryKey: ["dashboard", workspaceId]`, `enRouteJob` / `arrivedJob` / `startJob` / complete→navigate, technician `homeVariant === "today"` redirect

Today remains `max-width: 40rem` (task-focused, not a stretched dashboard clone).

---

## ACTIVITYROW / LIST CHANGES

Reusable CSS:

- `.ss-activity-row` / leading 44×44 circle / trailing column
- `.ss-activity-list` hairline separators
- `.ss-activity-row-address` for wrapping Hebrew/English addresses

Urgency ticks on attention rows changed from physical `box-shadow: inset 3px 0` to **`border-inline-start`** so RTL places the bar on the correct side.

---

## MOBILE FINDINGS

**CSS review (not a live authenticated device session):**

- Signal strip: 2 columns below 768px; 4 columns from 768px
- Ops grid: stacked until 1024px, then main + secondary
- Job cards: `overflow-wrap: anywhere`; actions stacked; nav links and primary button `min-height: 2.75rem` (≥44px)
- Bottom nav clearance unchanged via `--ops-bottom-nav-offset`
- `.field-today` / `.field-job`: `overflow-x: hidden`
- Floating nav remains hidden at ≥1024px

**Live authenticated 360 / 390 / 430 review:** not performed (browser session was logged out). See Visual QA.

---

## DESKTOP FINDINGS

**CSS review:**

- Sidebar remains the desktop IA
- Dashboard uses existing `ops-v3-ops-grid` (attention + today) and `ops-v3-secondary-grid` (recent quotes + usage)
- Greeting/hero metric is denser from 768px (`ops-cmd-hello` and signal hero drop from 1.75rem toward ~1.5rem)
- Recent quotes keep the desktop `<table>`; ActivityRow is mobile-only there

**Live 1024 / 1280 / 1440 authenticated review:** not performed (no session).

---

## RTL FINDINGS

- Shell/sidebar/rows use logical properties (`inline-start`/`end`, `text-align: start`)
- Job numbers, times, money, quote numbers keep `dir="ltr"` + `.ltr-meta`
- MapPin / Clock / FileText are universal icons (not mirrored)
- Attention high-urgency bar is logical (`border-inline-start`)
- Today open-job and maps remain text links (no assumed chevron flip)

**Live RTL screenshot of Dashboard/Today:** not performed (no session).

---

## LIGHT MODE FINDINGS

Authenticated light tokens (unchanged architecture):

- Canvas `--color-bg-0: #eef1f5`
- Surfaces `--color-bg` / `--color-bg-1: #ffffff`
- Muted text `--color-fg-muted: #475569`
- Hairline `--color-border: #d8dee8`

Dashboard cards sit on `bg-1` against `bg-0` canvas rather than inverting the public/auth dark brand.

**Live Light Dashboard/Today:** not performed (no session).

---

## DARK MODE FINDINGS

Authenticated dark (`.dark`, not `ss-brand-dark`):

- Canvas `#0b0d10`, sidebar `#11151a`, cards `#171c22`
- Action blue kept; status tokens unchanged
- Floating nav graphite `#171c22` with white puck (active item ink `#0b0d10`)
- No extra glow / neon treatment added in this phase

Public/auth remains path-scoped `html.ss-brand-dark` and does **not** set `html.dark`.

**Live confirmation (login, this session):**

| Probe | Result |
|---|---|
| Path | `/login` |
| `html.ss-brand-dark` | `true` |
| `html.dark` | `false` (user `themeMode=system`, resolved dataset theme `light`) |
| `color-scheme` | `dark` |
| `body` background | `rgb(7, 11, 18)` (`#070b12`) |

That is the Phase 1A correction still holding: public/auth is brand-dark even when the stored/OS theme is light.

---

## ACCESSIBILITY FINDINGS

- Attention/job/quote rows remain `<Link>` or `<button>`, not clickable divs
- Status still has a text label plus tone (not color-only)
- Focus-visible outlines on signals, attention rows, nav links retained
- Sidebar `aria-current` / bottom-nav `aria-current` not rewritten
- Today/Dashboard headings remain `h1`/`h2`
- Reduced motion: page entrance, nav puck, press, sidebar width, signal hover transitions disabled or not applied
- 44px floors on ActivityRow, attention CTA, today actions, bottom-nav items

Keyboard/focus of authenticated Dashboard/Today was not exercised in a live session.

---

## PERFORMANCE CONSIDERATIONS

- No Framer Motion / Lottie / Rive / new chart library
- CSS entrance only (420ms, non-blocking, reduced-motion off)
- No duplicated React Query state for visuals
- `ActivityRow` is a stateless layout wrapper
- Production JS chunk size warning is pre-existing (not introduced here)

---

## TESTS RUN

```bash
npm run test -w @site-secure/ui
npm run test -w @site-secure/web -- tests/dashboard.test.tsx tests/theme.test.tsx
npm run test -w @site-secure/web
npm run typecheck -w @site-secure/ui && npm run typecheck -w @site-secure/web
npx eslint <Phase 1B TS files>
npm run lint -w @site-secure/ui
npm run lint -w @site-secure/web
npm run build -w @site-secure/web
```

---

## TEST RESULTS

| Command | Result |
|---|---|
| `@site-secure/ui` vitest | **PASS** 9/9 (includes new ActivityRow case) |
| web `dashboard` + `theme` | **PASS** 56/56 |
| full `@site-secure/web` vitest | **PASS** 51 files, **353** tests |
| UI + web typecheck | **PASS** (after omitting HTML `title` on ActivityRow so the slot can be `ReactNode`) |
| eslint on Phase 1B files | **PASS** (0 errors) |
| UI package lint | **PASS** |
| `web:lint` (entire web package) | **FAIL** — pre-existing, not in Phase 1B files: `CatalogImportWizard.tsx`, `QuoteBuilder.tsx`, `QuoteMobileSheet.tsx`, `cctv-sizing/hdd.ts`, three quote test files. Not fixed (out of scope). |
| `web:build` | **PASS** (chunk-size warning pre-existing) |

Dashboard tests still cover: activation empty (no invented KPIs), usage, TodayHome `he.fieldOpsKicker` / `he.startRoute` / `he.todayOpenJob` / `J-00005`, attention quote route, commercial values from real summary, technician `homeVariant === "today"`. Theme tests still distinguish brand-dark public/auth vs selectable `/app`.

---

## SCREENSHOT / VISUAL QA OUTPUT

See **PHASE 1B — VISUAL QA COMPLETION** below for the authenticated capture set.

| Surface | Viewport | Status |
|---|---|---|
| Public Login (theme regression) | Default IDE browser | **Captured** earlier + architecture still holds. |
| Dashboard Light — 390px | Emulated 390×844 | **Captured** (`phase-1b-dashboard-390-light.png`) |
| Dashboard Dark — 390px | Emulated 390×844 | **Captured** (`phase-1b-dashboard-390-dark.png`) |
| Today Light — 390px | Emulated 390×844 | **Captured** (`phase-1b-today-390-light.png`) — empty state (see limitations) |
| Today Dark — 390px | Emulated 390×844 | **Captured** (`phase-1b-today-390-dark.png`) — empty state |
| Dashboard Light — 1440px | Emulated 1440×900 | **Captured** (`phase-1b-dashboard-1440-light.png`) |
| Dashboard Dark — 1440px | Emulated 1440×900 | **Captured** (`phase-1b-dashboard-1440-dark.png`) |
| Today Light — 1440px | Emulated 1440×900 | **Captured** (`phase-1b-today-1440-light.png`) — empty state |
| Today Dark — 1440px | Emulated 1440×900 | **Captured** (`phase-1b-today-1440-dark.png`) — empty state |
| 360 / 430 / 768 / 1280 | Authenticated Dashboard | **Layout metrics inspected** (no separate screenshot files) |

---

## KNOWN LIMITATIONS

1. Technician **Today with live job cards** could not be populated in this environment: remote `assignments.unassigned_at` column is missing, so assigned-scope authz returns empty and technician Today stays empty. Job-row presentation was inspected live on **owner Dashboard → Active Work** (same `ActivityRow` primitive). `TodayList` / field-job-card presentation remains covered by unit tests + CSS review.
2. `PageHeader appearance="display"` is available but unused by Dashboard/Today (they have dedicated headers).
3. `ActivityList` is restyled for consistency but remains unused on OpsDashboard V3 (by design).
4. Desktop sidebar still uses 3px engineering radii for non-dashboard chrome; Dashboard/Today widgets use 14px.
5. Today stays `max-width: 40rem` on desktop (intentional task focus; not a stretched mobile clone).
6. IDE screenshots may show device frame letterboxing; layout probes used CSS viewport width from `Emulation.setDeviceMetricsOverride`.

---

## DEFERRED WORK

- Optional: human re-check of Today **with assigned jobs** once the remote DB has `assignments.unassigned_at` (or a local seed that matches current schema)
- Customers, Sites, Service, FieldJob, Projects, Quotes/QuoteBuilder, Catalog, PDF Studio, Roles, Admin, Settings — **not started**
- Phase 2 — **not started**
- Pre-existing Quote/Catalog/CCTV lint failures — **not repaired**

---

## EXPLICIT SAFETY CONFIRMATION

| Statement | Confirmed? |
|---|---|
| No backend product changes | **Yes.** No FastAPI routers/business modules changed for presentation. |
| QA seed script touch | **Yes, documented.** `apps/api/scripts/beta_technician_qa_seed.py` only: removed forbidden `status` from job create body so the existing disposable QA seed matches current `JobCreate` validation. Not runtime auth. |
| No API contract changes | **Yes.** `packages/api-client/**` not modified. |
| No RBAC changes | **Yes.** `packages/authz/catalog.json` not modified. |
| No RLS changes | **Yes.** `supabase/migrations/**` not modified. |
| No entitlement changes | **Yes.** |
| No workspace isolation changes | **Yes.** |
| No technician scope changes | **Yes.** Route/`homeVariant` behavior unchanged. |
| No pricing / quote calc / job lifecycle / CCTV / PDF changes | **Yes.** |
| No auth behavior changes | **Yes.** Login used normal password grant for disposable `@sitesecure.test` QA users. |
| No public/auth theme regression | **Yes.** Public login remains brand-dark; `/app` themes independently. |
| No new runtime dependencies | **Yes.** |

---

## PHASE 1B — VISUAL QA COMPLETION

**Date:** 2026-09-21  
**Auth method:** existing disposable QA path — Supabase password grant for `@sitesecure.test` users created via the same pattern as `beta_technician_qa_seed.py` (no route-guard bypass, no product auth changes).

### AUTOMATED TESTED (not visual proof)

| Check | Result |
|---|---|
| UI vitest | PASS 9/9 |
| web dashboard + theme | PASS 56/56 |
| typecheck UI + web | PASS |
| Phase 1B eslint | PASS |
| production build | PASS |

### VISUALLY INSPECTED

| Viewport | Themes | Surfaces |
|---|---|---|
| **390×844** | Light + Dark | Dashboard (owner), Today (technician) |
| **1440×900** | Light + Dark | Dashboard (owner), Today (technician) |
| **360×800** | Light metrics | Dashboard — no H-scroll; nav visible; CTA 44px; hero present |
| **430×932** | Light metrics | Dashboard — no H-scroll; 4 signals; CTA 44px |
| **768×1024** | Light metrics | Dashboard — 4-col signals; denser hello; bottom nav still shown; sidebar hidden |
| **1280×800** | Light metrics | Dashboard — sidebar 240px (15rem); bottom nav hidden; 2-col ops grid; hero 24px |

### Screenshots actually captured

1. `phase-1b-dashboard-390-light.png`
2. `phase-1b-dashboard-390-dark.png`
3. `phase-1b-today-390-light.png`
4. `phase-1b-today-390-dark.png`
5. `phase-1b-dashboard-1440-light.png`
6. `phase-1b-dashboard-1440-dark.png`
7. `phase-1b-today-1440-light.png`
8. `phase-1b-today-1440-dark.png`

(Saved under the IDE screenshots temp directory for this session.)

### Visual issues discovered

1. **Mobile greeting email wrap** — long `displayName` email competed with the 28px hello and broke hierarchy.
2. **Attention CTA under 44px on ≤430px** — legacy rule set `min-height: 2.5rem` (40px).
3. **Attention row + ActivityRow on narrow phones** — outer column stack no longer reached the CTA after ActivityRow wrap; CTA stayed cramped in the trailing column.
4. **Technician Today empty** — environment limitation (`assignments.unassigned_at` missing on remote DB), not a Phase 1B presentation bug.

### Visual fixes made (presentation-only, `apps/web/src/styles.css`)

1. Mobile `.ops-cmd-hello-name`: block + ellipsis + muted 15px under the greeting.
2. ≤430px `.ops-attention-cta` / `.ops-cmd-chip`: restore **2.75rem (44px)** min-height.
3. ≤430px attention rows: wrap ActivityRow; trailing full-width under body; CTA aligned for thumb reach.
4. ≤639px Active Work trailing: wrap time + open-job; keep CTA ≥44px.

Post-fix probe at 390 Light: CTA height **44px**, hello name `text-overflow: ellipsis`, no horizontal overflow.

### Mobile findings (VISUALLY INSPECTED)

- First viewport hierarchy is clear: eyebrow → greeting → date/status → signal strip (hero attention **2** at 28px) → command queue.
- Hero attention count reads as an operational KPI, not a bank balance (no currency metaphor; supporting signals remain secondary).
- Cards use consistent **14px** radius; hairlines visible on light canvas `#eef1f5` / white surfaces.
- Long Hebrew customer names wrap inside attention/active-work rows.
- Floating bottom nav: black/graphite capsule, white puck on Home, RTL order correct, labels readable; main scroll padding clears the bar.
- No horizontal scrolling at 360/390/430.
- Technician commercial isolation in **desktop sidebar** looks correct (no Quotes/Catalog). Bottom nav still shows Customers where existing RBAC allows — unchanged.

### Desktop findings (VISUALLY INSPECTED)

- Dashboard is a productivity SaaS layout: **15rem** sidebar, content uses width via signal strip + 2-column ops grid + recent quotes table — not a stretched phone.
- Hero metric densifies to **~24px** at desktop; greeting ~21–26px — not giant KPI typography.
- Today remains **max-width ~40rem** with deliberate empty side space; sidebar shows technician-safe destinations with **היום** active.

### Light mode findings

- Canvas `#eef1f5`, cards white, sidebar white/off-white, action blue `#0b6bcb`, warning wash on attention signal — coherent workspace, not old shell + random new cards.

### Dark mode findings

- Canvas `#0b0d10`, sidebar `#11151a`, cards/nav `#171c22` — surface hierarchy without pure-black flatness or neon glow.
- Calmer than public/auth brand-dark; same product blue and Heebo.

### RTL findings

- Sidebar on inline-start (right), attention urgency bars use `border-inline-start`, LTR meta on job/quote numbers and times, Hebrew titles right-aligned.
- Universal icons (clock/map/file) not mirrored — correct.

### Motion findings

- Dashboard mount uses `ss-ops-enter` when reduced-motion is off; does not block interaction.
- Nav puck / press feedback unchanged from Phase 1A.
- Reduced-motion OS preference was **not** active in the QA browser (`matchMedia` false); CSS rules for `prefers-reduced-motion: reduce` remain in place from 1A/1B.

### Accessibility findings (visual + measured)

- Links/buttons remain semantic (open job, attention rows, signals).
- Status text accompanies color (באיחור / Status component).
- Post-fix mobile CTAs measure **44px**.
- Focus-visible outlines not re-audited keystroke-by-keystroke in this pass.

### Remaining limitations after visual QA

- Today **populated job cards** not live-captured (technician assignment schema drift on remote Supabase).
- Prefer human glance at physical phone for safe-area / thumb feel beyond CSS emulation.

### Verdict

Dashboard + Today **do** read as the same premium SITE SECURE product as Login (blue, type, radius, motion language) while remaining a productivity `/app` experience with selectable Light/Dark. After the small CSS corrections above, no further Phase 1B redesign is warranted pending human approval.

---

## STOP

Phase 1B implementation + visual QA completion are done. Waiting for approval. Do not proceed to another module or Phase 2 without explicit authorization.
