# Phase 1B.4 — Adaptive Daily Command Center

**Date:** 2026-09-21  
**Scope:** Authenticated `/app/dashboard` (+ ObserveDashboard) presentation only  
**Status:** Complete. **Stopped.** Awaiting visual approval. No Phase 2.x / Phase 3 / AppShell / Settings / Payment Card.

Authority: [`Docs/DASHBOARD-CAPABILITY-AUDIT.md`](./DASHBOARD-CAPABILITY-AUDIT.md)

SITE SECURE remains React 19 / TypeScript / Vite / TanStack Router / TanStack Query / FastAPI / Supabase.

---

## 1. Capability audit used

| Class | Used in 1B.4? |
|---|---|
| **AVAILABLE NOW** (`GET /dashboard` attention/today/summary/recent/activity/commercial + existing lead/usage probes) | **Yes — primary** |
| **FRONTEND QUERY ONLY** (tasks/service/projects/warranties) | **No — out of scope** |
| **BACKEND CAPABILITY REQUIRED** (cross-domain activity) | **No** |
| **BUSINESS DEFINITION REQUIRED** | **No new definitions** |
| **NOT APPROPRIATE** (audit logs, fake activity, catalog) | **Excluded** |

---

## 2. Components changed

| Path | Change |
|---|---|
| `apps/web/src/components/dashboard/OpsDashboard.tsx` | Adaptive `ops-command-primary` / `ops-command-secondary` / utility; Quick Actions during activation; omit empty Attention; no reserved blank slots |
| `apps/web/src/components/dashboard/DashboardCommandHero.tsx` | `is-dense` proportions; time-aware Hero preserved |
| `apps/web/src/components/dashboard/DashboardActivity.tsx` | Truthful limited-activity title + lead copy |
| `apps/web/src/components/dashboard/DashboardQuickActions.tsx` | Unchanged logic (`buildCreateActions`); denser CSS |
| `apps/web/src/i18n/he.ts` | `activityTitleLimited`, `activityLeadLimited` |
| `apps/web/src/styles.css` | Adaptive grids, controlled empty Today, denser Hero/QA chips, max-width command canvas |
| `apps/web/tests/dashboard.test.tsx` | Low-data expectations updated for Today empty + Quick Actions |
| `apps/web/scripts/phase_1b4_adaptive_qa.mjs` | Authenticated visual QA |
| `Docs/phase-1b4-qa/*` | Screenshots + `report.json` |

---

## 3. Data sources used

**Unchanged Dashboard route queries:**

- `api.getDashboard` → `["dashboard", workspaceId]`
- `api.getUsage` (team perms) → `["usage", workspaceId]`
- `api.listLeads` (existing secondary) → `["dashboard-lead-next", workspaceId]`
- customer probe fallback (activation only)

**Confirmed NOT added:** Tasks, Service, Projects, Warranties list queries.

---

## 4. Quick Actions behavior

- Source: `buildCreateActions` / `DashboardQuickActions` (permission + feature gated).
- Primary keys: quote, customer, job (≤3); overflow under **עוד**.
- **Restored for low-data / activation** — actionability is required to start using SITE SECURE.
- Graceful omit when no create permissions (viewer ObserveDashboard: `showCreate={false}`).
- No Search / Today chrome duplication (Shell + Today section route remain owners).

---

## 5. Attention behavior

- Existing server groups + optional lead follow-up slice.
- Rendered **only when** `attentionTotal > 0` (and not during activation suppress of lead noise).
- Quiet workspace: Hero calm line only — **no** large empty Attention card / no duplicate “everything is fine”.

---

## 6. Today behavior

- Existing `data.today` via `ActiveWork`.
- With rows: dense list + **הצג את היום**.
- Empty: Phase 1B.3.1 compact tile preserved; **desktop width controlled** when solo; fills column when paired with Attention.
- Visible whenever `jobs.view` — including low-data workspaces.

---

## 7. Recent / activity semantics

| Payload | UI |
|---|---|
| `data.activity` (quote_events + job completions) | **אירועי הצעות ועבודות** + lead explaining limited scope |
| else `recent_quotes` (deduped vs attention) | **הצעות אחרונות** |
| neither | section omitted |

No `updated_at` entity scrapes. No fake feed.

---

## 8. Commercial snapshot

- Existing `CommercialPulse` using server `summary` / `business_chart`.
- Shown only when `quotes.view` + feature `quotes` + meaningful open/approved value or open count (`hasQuoteRecords` gate).
- Omitted in empty/new commercial state — no ₪0 wall.
- Cost/margin isolation unchanged (never in dashboard payload).

---

## 9. Adaptive layout rules

```
Hero (dense, time-aware) + Quick Actions
→ Primary: Attention? + Today?   (pair grid ≥1024 when both)
→ Secondary: Activity|Recent? + Commercial?  (pair when both)
→ Utility: Setup? + actionable usage warning?
```

- No fixed blank slots.
- Canvas max-width ~`68rem`.
- Mobile: single vertical column.

---

## 10. New vs active workspace

| State | Composition |
|---|---|
| Low-data / activation | Hero + Quick Actions + Today empty + Setup (+ warning if any) |
| Active (QA fixture) | Hero + QA + Attention + Today + Recent quotes as available |

Same implementation adapts — no dual Dashboard.

**Note:** Phase1B QA owner workspace now has overdue jobs + a draft quote (legitimate fixture) — not a pure empty seed. Low-data unit tests cover the empty path.

---

## 11. Role behavior

| Role | Behavior |
|---|---|
| Owner/Admin | Full adaptive ops Dashboard |
| Sales | Own-quote scoped payload (server); no team usage banner |
| Technician | Still routed to `/app/today` — assignment scope untouched |
| Viewer | ObserveDashboard; no creates |

---

## 12. Kai principles translated

- Content density without clutter
- Compact pressable actions (row chips)
- Quiet secondary panels
- Progressive disclosure (omit empty)
- No fintech / Visa semantics

---

## 13. Light / Dark / time-aware

Preserved: `heroSurface(resolved, period)` — light-day / dark-evening / dark-night. System resolves theme first.

---

## 14. RTL / a11y / performance

- Greeting `bdi` name isolation retained
- Semantic headings; conditional sections skip empty headings
- No new network requests; no polling; existing Hero day-boundary timer only
- Mobile QA targets remain ≥44px via `min-height` on tiles

---

## 15. Tests

| Check | Result |
|---|---|
| `vitest` all web | **362 passed** |
| `dashboard.test.tsx` | **43 passed** |
| `tsc --noEmit` | Pass |
| eslint changed files | Clean |
| `vite build` | Pass |

---

## 16. Visual QA

Script: `apps/web/scripts/phase_1b4_adaptive_qa.mjs`  
Artifacts: `Docs/phase-1b4-qa/`

Captured: 390/1440 Light+Dark live; forced day/night; 360/430/768/1280.

Findings:

- Quick Actions present
- Desktop empty/solo Today not full-bleed (`todayWidth` ~448 vs 1440)
- Attention + Today pair when overdue jobs exist
- No commercial zero wall when no meaningful values
- Hero denser on desktop (`heroHeight` ~272 @1440)

### Before → after (vs 1B.3.1 sparse desktop)

| Issue | 1B.4 response |
|---|---|
| Giant full-width empty Today | Controlled max-width / pair fill |
| Missing actionability when quiet | Quick Actions restored in activation |
| Fixed full-span stack slots | Explicit primary/secondary reflow |
| Activity overclaiming | Limited Hebrew label + lead |
| Unused canvas | Narrower command max-width + omit empties |

---

## 17. Known limitations / AppShell notes (out of scope)

- No Tasks/Service/Projects/Warranties on Dashboard (per audit / phase rules).
- No truthful cross-domain activity feed (PARTIAL only).
- Populated commercial chart needs real quote value history in fixture.
- AppShell search + sidebar remain; document-only: future shell refinement could tighten topbar chrome — **not changed here**.

---

## 18. Safety confirmation

- No backend / DB / migrations / API contract changes  
- No new Dashboard queries for Tasks / Service / Projects / Warranties  
- No RBAC / RLS / entitlement / isolation / technician scope / commercial isolation changes  
- No quote pricing / CCTV / PDF / job lifecycle / auth / nav architecture changes  
- No fake business data / fake activity / new runtime dependency  

---

## 19. STOP (superseded for composition)

Phase 1B.4 data behavior remains approved. Composition continued in **1B.4.1** below.

---

# PHASE 1B.4.1 — DESKTOP COMPOSITION CORRECTION

**Date:** 2026-09-21  
**Scope:** Desktop composition / CSS / Hero chrome only  
**Status:** Complete. **Stopped.**

### Failed screenshot diagnosis

Large desktop showed a mobile-like vertical stack with:

- oversized Hero + isolated **+ יצירה** competing with Quick Actions  
- Today / Setup / quota stacked in a narrow column  
- accidental empty sibling space  
- Hero and body widths not reading as one command system  

Whitespace **beside** the stack was the failure mode (not empty space below a finished composition).

### Corrections (composition only — data behavior unchanged)

| Fix | Implementation |
|---|---|
| Hero height | Composed denser Hero (`is-composed`); desktop live QA **~191px** @1440 |
| Remove isolated create | Removed `DashboardCreateMenu` from Hero; create remains via `DashboardQuickActions` / `buildCreateActions` |
| Low-data grid | `ops-command-workbench.is-low-data`: **Today \| Setup rail** (+ quota under rail) when no Attention/Recent/Commercial |
| Setup desktop | `ActivationCard` `panel` → `ops-setup-strip.is-panel` (same rules, stronger surface) |
| Quota placement | Stays compact alert; sits in `ops-command-rail` under setup in low-data |
| Active grid | Unchanged pairing: Attention\|Today then Recent\|Commercial; no fixed empty slots |
| Canvas | Hero + body share `max-width: 64rem` adaptive command system |
| RTL | Today/Attention/Setup order respects RTL grid start; QA row unchanged |

### Visual QA (1B.4.1 refresh)

`Docs/phase-1b4-qa/` via `scripts/phase_1b4_adaptive_qa.mjs`

| Check @1440 | Result |
|---|---|
| `heroHeight` | ~191 |
| `noIsolatedCreate` | true |
| `composedHero` | true |
| Attention\|Today fill command width | ~504 + ~504 within `dashWidth` ~1024 |
| Low-data workbench on live Phase1B fixture | **false** — fixture currently has Attention + recent quotes (active path). Low-data workbench covered by unit test. |

Mobile 390: stacked hierarchy preserved; no isolated create.

### Tests

- All web tests: **363 passed** (incl. new low-data workbench assertion)  
- typecheck / build / changed-file eslint: pass  

### Safety (1B.4.1)

No backend / API / query / RBAC / RLS / entitlement / scope / commercial / pricing / quote / job / auth changes. No fake data. No new dependency.

### STOP

Desktop composition correction complete. Composition continued in **1B.4.2** below.

---

# PHASE 1B.4.2 — MOBILE COMPOSITION CORRECTION

**Date:** 2026-09-21  
**Scope:** Mobile (and tablet intermediate) composition / CSS only  
**Status:** Complete. **Stopped.**

Desktop **1B.4.1** direction preserved. No Dashboard data / query / widget / API changes.

### Mobile screenshot diagnosis (pre-fix)

At CSS **390×844**, the post-1B.4.1 mobile Dashboard was a **stacked/shrunk desktop**:

- Hero too tall (attention primary + 2×2 Quick Actions + loose rhythm)
- Quick Actions as a large **2×2** pill grid (Phase 1B.2 rule)
- Today / Setup / quota as peer “giant rounded rectangles”
- Attention rows stacked at ≤430px (extra vertical mass + clipped CTAs)
- Useful Today content pushed near the bottom nav

### Corrections (composition only)

| Area | Change |
|---|---|
| Hero mobile | Tighter `is-composed` padding/gaps; attention primary becomes an **inline chip** (duplicate status line hidden on mobile) |
| Quick Actions | Replaced 2×2 grid with **one equal flex row** (icon-above-label compact tiles + existing `עוד`) |
| Today | Quieter premium empty: smaller padding, operational row (~88px), not a giant card |
| Setup | `is-panel` styles **scoped to ≥1024px**; mobile/tablet keep compact utility strip |
| Quota | Denser utility row padding/icon (unchanged behavior) |
| Attention (mobile) | Denser card/rows; hide redundant trailing CTA chrome (row remains the hit target) — reclaim height so Today enters first viewport |
| Tablet 768 | Setup stays strip (no desktop panel); Hero uses ≥768 composed row layout |
| Desktop | Unchanged: Hero ~191px @1440; Attention\|Today side-by-side; panel Setup only on large low-data |

### 390 first-viewport result (live Phase1B fixture)

| Metric | Before 1B.4.2 | After |
|---|---|---|
| `heroHeight` | ~235+ (taller with 2×2) | **~179px** |
| `qaOneRow` | false (2×2) | **true** |
| `todayTop` | ~664 | **~470** |
| `todayVisibleInFirstViewport` | barely | **yes** (full Today empty + start of Recent) |
| `todayHeight` (empty) | large card | **~88px** |
| Desktop `heroHeight` @1440 | 191 | **191** (no regression) |

Bottom nav safe-area: existing `.ops-main` / `--ops-bottom-nav-offset` unchanged; no extra blank region.

### Visual QA screenshots

`Docs/phase-1b4-qa/` via `scripts/phase_1b4_adaptive_qa.mjs`

**Primary:** `adapt-390-light-day`, `adapt-390-light-night`, `adapt-390-dark`  
**Also:** 360, 375, 430, 768  
**Regression:** `adapt-1440-light-live`, `adapt-1440-dark`, `adapt-1440-light-day/night`, `adapt-1280-light`

### Acceptance (390×844)

| Question | Answer |
|---|---|
| Hero significantly shorter? | **Yes** (~179px, content-driven) |
| Quick Actions compact one-row (not 2×2)? | **Yes** |
| Beginning of Today in first viewport? | **Yes** (~470 top; full empty Today visible) |
| Today operational vs giant empty card? | **Yes** |
| Setup secondary (when present)? | Panel desktop-only; mobile strip CSS ready |
| Quota tertiary? | Compact row CSS; not on live fixture |
| Fewer giant equal surfaces? | **Yes** — Hero strong, Today quieter, Attention denser |
| Premium mobile app feel? | Directionally yes (shared data, divergent composition) |

### Tests

- Web tests: **363 passed**
- typecheck: pass
- production build: pass
- changed-file eslint: pass (CSS not in eslint project)

### Safety (1B.4.2)

No backend / database / API / query / mutation / RBAC / RLS / entitlement / technician scope / commercial isolation / quote / pricing / job lifecycle changes. No fake data. No new dependency. No AppShell redesign.

### STOP

Mobile composition correction complete. **Do not** start another Dashboard feature phase.

---

# FINAL DESKTOP DENSITY POLISH

**Date:** 2026-09-22  
**Scope:** Desktop composition / density only (≥1024). No new features, data, or queries.  
**Status:** Complete. **Stopped.**

Preserves 1B.4 adaptive behavior, 1B.4.1 desktop direction, and **1B.4.2 mobile** composition.

### Files changed

| File | Change |
|---|---|
| `apps/web/src/components/dashboard/DashboardCommandHero.tsx` | Attention always in compact signal row; remove floating `is-attention` primary KPI; calm status only when quiet/activation; name `bdi` + ellipsis |
| `apps/web/src/styles.css` | Desktop-only denser Hero/QA/Attention/Today; Recent Quotes card-soup reduction + `is-compact` max-width; mobile 1B.4.2 rules untouched |
| `apps/web/src/components/dashboard/RecentQuotes.tsx` | `is-compact` when ≤2 rows (adaptive width) |
| `apps/web/src/i18n/he.ts` | Presentation copy: `dashCommandQueue` → **דורשים טיפול** |
| `apps/web/scripts/phase_1b4_adaptive_qa.mjs` | Assert `noFloatingAttentionKpi`, denser QA/Attention metrics |

### Hero before / after (rendered @1440)

| Metric | Pre-polish (1B.4.1) | After |
|---|---|---|
| Hero height | ~191px | **~145px** (target 150–170 when content allows) |
| Floating Attention KPI | Detached brown/orange mini-card | **Removed** |
| Signal row | Partial / duplicated | Integrated: `2 דורשים טיפול · 0 היום · 0 הצעות פתוחות` |
| Feel | Marketing banner mass | Command header |

### Attention KPI treatment

- Metric retained as inline Hero signal with warn emphasis when count > 0 (links to `#command-attention`).
- No floating primary card; no large new warning surface.
- Section heading presentation: **דורשים טיפול · N** (`dashCommandQueueCount`).

### Quick Actions

- Same permission-aware `buildCreateActions` set.
- Desktop: pill commands (~40px tile height @1440), reduced padding/mass; primary quote keeps SITE SECURE blue.
- Mobile 1B.4.2 one-row tiles preserved (`qaOneRow: true`, ~53px @390).

### Attention row density

- Desktop rows ~71px (operational row language); tighter padding; quieter CTA (available, not dominant).
- Nested mini-card feel reduced inside shared Attention surface.

### Today

- Remains primary peer beside Attention (~60/40 grid intent via `1.45fr / 1fr`).
- Empty: compact operational empty (~96px @1440) — icon + copy + existing action; not inflated.

### Recent Quotes adaptive width

- ≤2 rows → `is-compact` → `max-width: min(32rem, 100%)` (~512px measured @1440).
- More rows → full secondary width.
- No blank sibling column; panel chrome flattened (heading + bordered table only).

### Surface / card reduction

- Recent Quotes: transparent panel, single table surface.
- Attention/Today: denser shared cards; fewer nested outlined boxes on desktop.

### RTL / Light / Dark

- Verified 1440 light + dark, 1280 light, 390 dark.
- Signal · separators, Attention CTAs, chevrons, long email-like name + Hebrew greeting stable via `bdi` / max-width / ellipsis.
- Time-aware Hero surfaces unchanged.

### Mobile regression (1B.4.2 protected)

| Viewport | heroH | qaOneRow | todayH | noFloatKpi |
|---|---|---|---|---|
| 390 | ~146 | true | ~88 | true |
| 360 / 375 / 430 | stable in `Docs/phase-1b4-qa/` | true | compact | true |

### Tablet regression

- 768: Hero ~149px; composed; no premature full desktop density assumptions; Setup remains strip (panel ≥1024 only).

### Desktop screenshots

`Docs/phase-1b4-qa/` — `adapt-1440-dark`, `adapt-1440-light-live`, `adapt-1440-light-day/night`, `adapt-1280-light` (+ mobile/tablet set). Metrics in `report.json`.

### Acceptance @1440

| Question | Answer |
|---|---|
| Mature daily ops console (quiet workspace)? | **Yes** — denser, not busier |
| Small data stretched across large cards? | **No** — Hero ~145; Recent controlled; rows operational |
| Floating Attention KPI gone? | **Yes** |
| Mobile 1B.4.2 intact? | **Yes** |

### Tests

- Dashboard-related vitest: **68 passed** (`dashboard`, `dashboard-kpi`, `theme`, `activation`)
- `web:typecheck`: pass
- changed-file lint: pass
- `web:build` (production): pass

### Safety

No backend / API / query / payload / RBAC / RLS / entitlement / auth / quote math / job lifecycle / Settings / Payment / Customers / Sites / Service changes. No fake data. No new dependency. No Phase 3.

### STOP

Final desktop density polish complete. **Do not** start Phase 3. **Do not** continue unrelated Dashboard polish.
