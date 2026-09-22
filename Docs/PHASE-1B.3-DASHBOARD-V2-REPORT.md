# Phase 1B.3 — SITE SECURE Dashboard V2 / Daily Command Center

**Date:** 2026-09-21  
**Scope:** Authenticated `/app/dashboard` + light AppShell chrome de-duplication (presentation only)  
**Status:** Implementation complete + authenticated visual QA performed. **Stopped.** No Phase 3.

SITE SECURE remains React 19 / TypeScript / Vite / TanStack Router / TanStack Query / FastAPI / Supabase.

Kai/Flutter was used as a **restraint / composition reference only**. No fintech semantics.

---

## 1. CURRENT UX PROBLEMS (post–1B.2 review)

| Problem | Evidence |
|---|---|
| Duplicate Search | AppShell Ctrl K + Hero search field + Quick-action Search |
| Duplicate Today | Hero Today link + Quick-action Today + section CTA + bottom nav Work |
| Administrative noise | Full `שימוש בחשבון` meters on Dashboard (desktop) after an actionable seat warning |
| Weak daily utility | Setup + quotas competed with Attention / Today |
| Zero wall risk | Giant calm “0” + supporting zeros + empty modules |
| Repeated healthy status | Topbar “סביבת העבודה פעילה” + system “מוכן לפעולה” |

---

## 2. SHELL + DASHBOARD DUPLICATION AUDIT

| Capability | Shell | Dashboard (before) | Decision (1B.3) |
|---|---|---|---|
| Search / Ctrl K | Topbar button (icon mobile, labeled ≥sm) | Hero field + QA Search tile | **Shell owns search.** Removed Hero search field and QA Search tile. Event + palette unchanged. |
| Today | Bottom nav Work sheet → Today routes | Hero Today link + QA Today + section link | **Today section owns “הצג את היום”.** Removed Hero Today + QA Today. |
| Healthy workspace | Topbar meta + system status popover | Hero calm / attention | Topbar meta **only when inactive**; healthy state via system status alone. |
| Quotas | Settings/users | Threshold banner + UsageSnapshot | **Banner only when near/at limit.** UsageSnapshot **removed** from Dashboard. |

---

## 3. INFORMATION HIERARCHY

1. **COMMAND** — time-aware Hero (greeting, state, ≤2 signals, ≤3 creates)  
2. **ATTENTION** — list only when items exist (calm lives once in Hero)  
3. **TODAY** — summary list or one compact empty + schedule CTA  
4. **ACTIVITY** — `data.activity` when present; else real `recent_quotes`  
5. **SETUP** — compact strip when activation incomplete  
6. **QUOTA WARNING** — actionable meters only  

---

## 4. TIME-AWARE HERO

Reuses `lib/greeting.ts` (`dayPeriod` / `heroSurface` / local browser time).

| Theme | Period | Surface |
|---|---|---|
| Light | morning/afternoon | `light-day` |
| Light | evening/night | `dark-evening` / `dark-night` |
| Dark | any | `dark-day` / `dark-evening` / `dark-night` |

System → existing `useTheme()` resolve, then same matrix.

Greeting: `לילה טוב, Name` (given name / email local-part). No competing dual headings.

Quiet attention: text state **הכול שקט כרגע** — no giant `0` KPI.

---

## 5. SEARCH DECISION

**One global search:** AppShell topbar → Command Palette (`Ctrl/Cmd+K`).

Dashboard no longer renders a search field or Search quick action.

---

## 6. TODAY DECISION

Dashboard Today = **summary** (`ActiveWork` on `data.today.items`).

Single route affordance: **הצג את היום** (`he.dashViewToday` → `/app/today`).

Empty: one compact row + permitted schedule CTA.

---

## 7. ATTENTION TREATMENT

Items → `CommandStatus` list (existing rows).

Empty → **omit section** (Hero already calm). No triple “0 attention”.

---

## 8. ACTIVITY TREATMENT

New `DashboardActivity` consumes existing `data.activity` (unchanged query).

If empty activity but `recent_quotes` exist → `RecentQuotes`.

If neither → omit (no invented feed, no GettingStarted tutorial card).

---

## 9. SETUP TREATMENT

Unchanged logic (`deriveActivation` / `workspaceSetup`). Compact strip only.

---

## 10. QUOTA TREATMENT

`UsageThresholdBanner` when meters are warning/danger.

**Removed** `UsageSnapshot` from OpsDashboard (mobile and desktop).

Enforcement / meters / settings routes unchanged.

---

## 11. MOBILE COMPOSITION (390)

Hero → creates → Attention (if any) → Today → Activity/Recent → Setup → Quota warn → optional commercial.

First viewport target: greeting/state, signals, actions, start of Attention/Today.

---

## 12. DESKTOP COMPOSITION (1440)

Same hierarchy; Hero may show create menu in tools. No quota wall restored for width.

---

## 13. KAI PRINCIPLES TRANSLATED

| Kai discipline | SITE SECURE |
|---|---|
| Few focal points | One hero anchors; open sections below |
| Little explanatory copy | Labels + actions, not paragraphs |
| Quiet secondary | Setup/quota demoted or conditional |
| Shared row grammar | ActivityRow / Attention / Today |
| Restraint | Removed duplicate Search/Today/usage wall |

Not fintech: no balance, card, transaction language.

---

## 14. LIGHT / DARK

Light day Hero: premium off-white + blue atmosphere.  
Light night / all Dark: graphite Hero. Scoped to `.ops-command-hero[data-hero-surface]`.

---

## 15. RTL / A11Y

Hebrew-first; `dir="auto"` on names; `ltr-meta` on times/Ctrl K; real buttons/links; focus-visible; reduced-motion on surface transitions.

---

## 16. PERFORMANCE

No new queries. Boundary timeout for day period (not per-minute polling). Presentation-only.

---

## 17. BEFORE / AFTER vs 1B.2

| Dimension | 1B.2 | 1B.3 |
|---|---|---|
| Search instances in viewport | Shell + Hero + QA | Shell only |
| Today CTAs | Hero + QA + section | Section (+ bottom nav Work) |
| Usage wall | Desktop UsageSnapshot | Removed from Dashboard |
| Calm attention | Hero 0 KPI + calm Attention | Hero text once |
| Page length (admin) | Longer | Shorter |
| Activity | Recent quotes only | `activity` preferred, else recent quotes |

---

## 18. TESTS

| Suite | Result |
|---|---|
| `@site-secure/ui` vitest | Pass (9) |
| `@site-secure/web` vitest | Pass (354) |
| Changed-file eslint | Pass |
| `web:typecheck` | Pass |
| `web:build` | Pass |

---

## 19. VISUAL QA

**Auth:** `phase1b.owner.1790012816@sitesecure.test` password grant. No fake rows.

**Captured** under `Docs/phase-1b3-qa/`:

| Shot | Notes |
|---|---|
| `dash-390-light-live.png` | Live clock (night → dark Hero on Light app) |
| `dash-390-light-day.png` | Forced `light-day` surface |
| `dash-390-light-night.png` | Forced `dark-night` |
| `dash-390-dark.png` | Dark theme |
| `dash-1440-light-live/day/night.png` | Desktop |
| `dash-1440-dark.png` | Desktop dark |
| Also | 360 / 430 / 768 / 1280 |

Script: `apps/web/scripts/phase_1b3_dashboard_qa.mjs`

### First-viewport review (390)

| Question | Answer |
|---|---|
| First focal point | Command Hero (greeting + state) |
| Second | Attention list or Today |
| Actions visible | ≤3 create tiles (no Search/Today dupes) |
| Repeated concepts | Reduced (search/today/status) |
| Administrative info | Quota only if actionable; no usage wall |
| ~3s understandability | Operational state + next creates |

---

## 20. FILES TOUCHED

| File | Why |
|---|---|
| `OpsDashboard.tsx` | Daily stack; drop UsageSnapshot; activity |
| `DashboardCommandHero.tsx` | Calm state; no search/Today tools |
| `DashboardQuickActions.tsx` | Creates only (no Search/Today) |
| `DashboardActivity.tsx` | Compact real activity |
| `ActiveWork.tsx` | היום + הצג את היום |
| `AppShell.tsx` | Hide active meta when healthy |
| `he.ts` | `dashViewToday` |
| `styles.css` | Daily/activity/calm hero |
| `tests/dashboard.test.tsx` | Expectations |
| `scripts/phase_1b3_dashboard_qa.mjs` | QA |
| `Docs/PHASE-1B.3-DASHBOARD-V2-REPORT.md` | This report |
| `Docs/phase-1b3-qa/*` | Screenshots |

---

## 21. KNOWN LIMITATIONS

1. `data.activity` may be empty in some workspaces — Recent Quotes used as fallback when present.  
2. Display name may still be email local-part when profile name absent.  
3. Shell system status popover still available for detail; only redundant “active” meta line was quieted.  
4. Pre-existing remote assignment schema issues remain out of scope.

---

## 22. SAFETY CONFIRMATION

- No backend / database / API contract changes  
- No query / mutation behavior changes  
- No RBAC / RLS / entitlement / workspace isolation / technician scope changes  
- No quote/pricing / job lifecycle / CCTV / PDF / auth changes  
- No navigation architecture changes (routes unchanged; presentation CTAs only)  
- No fake business data  
- No new runtime dependency  

---

## 23. STOP

Phase 1B.3 complete. **Awaiting visual approval.**  
Do not touch another module. Do not start Phase 3.

---

# PHASE 1B.3.1 — EMPTY / NEW-WORKSPACE PREMIUM PASS

**Date:** 2026-09-21  
**Scope:** Presentation polish for sparse Dashboard only — **IA from 1B.3 unchanged**  
**Status:** Complete. **Stopped.**

## Goals

Make low-data / new-workspace Dashboard feel intentionally designed without restoring clutter (no usage wall, no duplicate Search/Today, no FIRST VALUE tutorial).

## Hero signal changes

- Primary quiet message remains **הכול שקט כרגע** (no giant `0` KPI).
- Added one compact **signal row** using existing counts only:  
  `N היום · N דורשים טיפול · N הצעות פתוחות` (permission-gated).
- Not KPI cards / not separate surfaces.
- When attention &gt; 0, primary attention control remains; attention is omitted from the signal row to avoid duplication.

## Time-aware Hero verification

Confirmed still active via `data-hero-surface` / `data-time-period` / `useTheme` + `dayPeriod` (local browser time, shared greeting boundaries).  
Light+day → `light-day`; Light+night → `dark-night`; Dark → dark surfaces.

## Greeting bidi fix

- Non-breaking space after Hebrew comma.
- Name wrapped in `<bdi>` + `unicode-bidi: isolate`.
- Presentation: `לילה טוב, Name` (given name / email local-part). Profile data unchanged.

## Today empty-state treatment

Premium operational empty tile (TransactionTile discipline):

- Section title **היום** (primary visual weight)
- Calendar icon container
- Primary line: אין עבודות מתוזמנות להיום
- Trailing compact CTA: תזמן עבודה → `/app/today`

Populated Today unchanged structurally (same list + הצג את היום).

## Setup hierarchy

- Grouped with quota under `.ops-home-utility` (quiet secondary region, no WORKSPACE label).
- Strip visually compressed (`is-utility`): smaller title, subtle progress bar, lead + המשך.
- Completion logic unchanged.

## Quota hierarchy

- Remains actionable-only.
- Compact warning row: icon + `usageThresholdMeterFull(label)` when at limit + meter line + ניהול.
- Warning tone (not aggressive danger unless meter tone is danger).

## Mobile vertical rhythm (390)

Hero → Today (primary) → utility group (setup / quota) → nav clearance.  
Gaps tightened; Today title stronger than utility titles.

## Desktop

Same hierarchy; utility group full-width under ops stack. No quota wall restored.

## Light / Dark / time QA

Captured under `Docs/phase-1b31-qa/`:

| Shot |
|---|
| `empty-390-light-live.png` |
| `empty-390-light-day.png` |
| `empty-390-light-night.png` |
| `empty-390-dark.png` |
| `empty-1440-light-live/day/night.png` |
| `empty-1440-dark.png` |

Script: `apps/web/scripts/phase_1b31_empty_qa.mjs`  

Note: current QA workspace is **operationally populated** (attention + today jobs). Empty Today/Setup paths are covered by unit tests + CSS; live shots still validate Hero signals, greeting, time surfaces, and hierarchy.

## Tests

- web vitest 354 pass; UI 9 pass  
- typecheck; changed-file lint; production build — pass  

## Safety

No query/API/backend/RBAC/RLS/entitlement/auth/nav/onboarding/quota-logic/global-theme changes. No fake data. No new dependency. Phase 1B.3 IA preserved.

## STOP

Phase 1B.3.1 complete. **Awaiting visual approval.** Do not start Phase 3.
