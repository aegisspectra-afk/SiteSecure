# Phase 1B.2 — Dashboard Recomposition / Executive Quality Pass

**Date:** 2026-09-21  
**Scope:** Authenticated `/app/dashboard` information architecture + presentation only  
**Status:** Implementation complete + authenticated visual QA performed. **Stopped.** No Phase 3. No other modules.

SITE SECURE remains React 19 / TypeScript / Vite / TanStack Router / TanStack Query / FastAPI / Supabase.

Flutter Kai was used as a **restraint / composition reference only**. No Flutter code, no fintech semantics, no second frontend.

---

## 1. ROOT UX PROBLEMS IDENTIFIED (Phase 1B.1 mobile)

1. **Information density** — environment chrome + OPERATIONS OVERVIEW + greeting + KPIs + FIRST VALUE + quota rings + empty Active Work + empty Recent Quotes competed in one scroll.
2. **Weak prioritization** — setup/admin (FIRST VALUE, WORKSPACE quotas) visually equaled or outranked operational decision signals.
3. **Zero-state noise** — walls of `0` / `0%` looked broken rather than calm.
4. **Duplicate empty messaging** — “no work today” + “no active work” + “create first quote” + tutorial path repeated the same next step.
5. **English SaaS template labels** — OPERATIONS OVERVIEW / FIRST VALUE / WORKSPACE on a Hebrew-first product.
6. **Quota report on the home screen** — five healthy progress meters after an actionable 1/1 warning.
7. **First viewport** — spent on setup copy instead of “what needs attention / what today / next action.”

---

## 2. CURRENT BLOCK PRIORITY MAP (pre → post)

| Current block | Priority | Keep prominent? | Compact? | Move lower? | Collapse / demote? | Remove duplicate presentation? | Data source | Permission |
|---|---|---|---|---|---|---|---|---|
| Environment / shell chrome | P3 (shell) | Shell only | — | — | — | — | AppShell | session |
| OPERATIONS OVERVIEW kicker | P3 | **No** | Removed from hero | — | Demoted (label → unused on home) | Yes | i18n | — |
| Greeting + name + date | P0 | Yes | Compact identity | — | — | — | `dayGreeting`, session | — |
| Attention KPI | P0 | Yes | Calm zero; link when >0 | — | Pipeline removed | — | `attentionEntityCount` | existing |
| Today / open quotes chips | P1 | Supporting only | Compact signals | — | Hidden in activation | Yes vs later empties | `today.items`, `quotes_open` | jobs/quotes |
| Pipeline value | P2 | **No** | — | Off hero | Removed from hero | — | summary | quotes |
| Search / quick creates | P0 | Yes | ≤2 creates + More | — | Overflow secondary | — | `buildCreateActions` | RBAC |
| FIRST VALUE tutorial | P1 setup | **No as wall** | Setup strip | Below ops | Compact progress + 1 CTA | Yes vs recent empty CTA | `deriveActivation` | create gates |
| Onboarding progress | P1 setup | Compact only | % + bar | Below ops | Hide when complete | — | `workspaceSetup` | existing |
| Quote creation CTA (duplicate) | P1 | One only | In strip | — | Hero creates off in activation | Yes | `NewQuoteButton` | quotes.create |
| Active work / Today empty | P0/P1 | When useful | One empty row | — | Hidden during activation if empty | Yes | `data.today` | jobs.view |
| Usage-limit warning | P1 actionable | When near/at | One row | — | No full report after | Yes vs UsageSnapshot | meters | users.view |
| Recent quotes empty | P2 | Only if rows | — | — | Hidden when empty | Yes | `recent_quotes` | quotes.view |
| WORKSPACE quota panel | P3 | Desktop secondary | — | Desktop only | Hidden on mobile | Yes | `getUsage` | manage team |
| Office/field/storage/quote/customer meters | P3 | Desktop only | — | Desktop | Healthy off mobile | — | usage meters | manage team |
| Commercial pulse | P2 | When quotes exist | Secondary | Lower | — | — | summary/chart | quotes |
| Activity summary feed | P3 | Not mounted | — | — | Still unused | — | `data.activity` | — |
| Bottom nav | P0 chrome | Keep approved | — | — | — | — | AppBottomNav | — |

---

## 3. BLOCKS PROMOTED

- **Command hero** as single dominant surface (greeting, calm/attention state, ≤2 supporting signals, quick actions).
- **Needs attention** — strong when items exist; compact calm line when none.
- **Today / Active Work** — one coordinated section; compact empty outside activation.
- **Quick actions** — Search + ≤2 primary creates + More (no horizontal hunt for essentials).

---

## 4. BLOCKS DEMOTED

- English kickers (OPERATIONS OVERVIEW / FIRST VALUE / WORKSPACE wording).
- Full FIRST VALUE tutorial card → compact **השלמת ההקמה** strip.
- Full **UsageSnapshot** rings → **desktop-only** secondary panel.
- Healthy quota bars off mobile home.
- Pipeline metric out of hero.
- Empty Recent Quotes + empty Active Work during activation.
- **Commercial pulse** when quote records exist but open/approved signals are all zero (avoids zero-metric footer noise).

---

## 5. DUPLICATE PRESENTATION REMOVED

- Multiple “create first quote” CTAs → one strip CTA (`המשך`) during activation; hero create menu off.
- Empty today + empty active work + empty recent → suppressed while activation owns the next step.
- Near/at quota warning **without** repeating the full quota dashboard underneath on mobile.

---

## 6. ONBOARDING TREATMENT

- Logic / completion criteria **unchanged** (`deriveActivation`, `shouldShowActivationCard`, `workspaceSetup`).
- Presentation: compact strip — title **השלמת ההקמה**, percent, one lead line, one CTA.
- When activation complete (first quote exists): strip not shown (existing gate).

---

## 7. QUOTA TREATMENT

- Enforcement / meter data unchanged.
- Mobile: `UsageThresholdBanner` only when meter tone is warning/danger (near/at).
- Full `UsageSnapshot` wrapped in `.ops-home-usage-desktop` (hidden &lt;1024px).

---

## 8. ZERO-STATE TREATMENT

- Activation mode: hero drops KPI wall; quiet status line only.
- Quiet attention: calm primary (not a fake “tap the zero” CTA); body **אין כרגע פריטים שדורשים טיפול**.
- Supporting zeros stay compact chips, not four giant KPIs.
- No invented positive business claims.

---

## 9. KAI PRINCIPLES USED

- **Restraint** — fewer simultaneous focal points.
- Dark opening panel on lighter canvas.
- One primary operational state.
- Transaction-tile discipline on rows (existing ActivityRow).
- Staggered entrance (~320–360ms + short delays); reduced-motion respected.
- Floating nav clearance unchanged via `.ops-main` padding.

---

## 10. MOBILE COMPOSITION (390)

1. Command hero (greeting / date / calm or attention / ≤2 signals / 2×2 quick actions)  
2. Attention calm **or** attention list  
3. Today compact empty **or** work list (suppressed empty during activation)  
4. Setup strip (if incomplete)  
5. Quota warning row (if actionable)  
6. Recent / commercial only when real data  

---

## 11. DESKTOP COMPOSITION (1440)

- Same hero, denser tools visible (≥900px).
- Ops stack can place Attention + Today side-by-side when both are active cards.
- Usage snapshot available as secondary desktop panel.
- Still not a quota report as the page identity.

---

## 12. LIGHT / DARK

- Light: dark graphite hero remains the anchor on light canvas.
- Dark: hero elevated vs canvas (border / blue radial); not flattened to one graphite slab.

---

## 13. RTL

- Hebrew-first labels; date via `he-IL`; metrics `tabular-nums`; search kbd `dir="ltr"`.
- No English overview/workspace kickers on the decision surface.

---

## 14. ACCESSIBILITY

- Real buttons/links; calm attention uses `role="status"`.
- Headings preserved (`setupPendingLabel`, `commandTitle`, `todayTitle`).
- Focus-visible styles retained on hero controls.
- Touch targets ≥44px on quick actions.
- Reduced-motion path unchanged.

---

## 15. TESTS

| Suite | Result |
|---|---|
| `@site-secure/ui` vitest | Pass (9) |
| `@site-secure/web` vitest | Pass (353) |
| Changed-file eslint | Pass |
| `npm run web:typecheck` | Pass |
| `npm run web:build` | Pass |

Dashboard tests updated for compact activation + calm hero (presentation only).

---

## 16. VISUAL QA

**Auth:** disposable Phase 1B QA owner `phase1b.owner.1790012816@sitesecure.test` (password grant). No guard bypass. No fake rows injected.

**Workspace state at capture:** this QA workspace now has **real operational data** (attention + today jobs + a draft quote) — valuable for the active-workspace composition. Empty/activation composition is covered by dashboard unit tests (`activationContinue` strip, suppressed empty today/recent).

**Captured** under `Docs/phase-1b2-qa/`:

| Shot | Viewport | Theme |
|---|---|---|
| `dashboard-390-light.png` | 390×844 | Light |
| `dashboard-390-dark.png` | 390×844 | Dark |
| `dashboard-1440-light.png` | 1440×900 | Light |
| `dashboard-1440-dark.png` | 1440×900 | Dark |
| Also | 360 / 430 / 768 / 1280 | Light |

Script: `apps/web/scripts/phase_1b2_dashboard_qa.mjs`

---

## 17. PHASE 1B.1 vs 1B.2 (MOBILE)

| Dimension | 1B.1 | 1B.2 |
|---|---|---|
| Immediate prominence removed | — | OPERATIONS OVERVIEW, FIRST VALUE wall, WORKSPACE rings, pipeline chip, empty recent/active duplicates |
| More prominent | Dark hero denser | Calm decision hierarchy: attention → today → one next step |
| Page length | Long empty scroll | Shorter activation home |
| First-viewport usefulness | Hero + still setup/admin gravity | Hero + actions + beginning of ops/setup-compact |
| Repeated empty CTAs | Multiple | Single setup CTA during activation |

---

## 18. SAFETY CONFIRMATION

**Unchanged:** queries, query keys, mutations, API contracts, RBAC, RLS, entitlements, workspace isolation, technician scope, pricing, quotes, job lifecycle, CCTV, PDF, auth.

**Changed:** Dashboard JSX/CSS composition, Hebrew product strings for presentation, dashboard vitest expectations, QA script/screenshots/report.

---

## 19. FILES TOUCHED

| File | Why |
|---|---|
| `OpsDashboard.tsx` | Reorder: Hero → Attention → Today → Setup → Quota warn → Recent → Commercial → Usage desktop |
| `DashboardCommandHero.tsx` | Simpler hero; activation quiet mode; no pipeline |
| `DashboardQuickActions.tsx` | Search + ≤2 creates + More |
| `ActivationCard.tsx` | Compact setup strip |
| `CommandStatus.tsx` | Calm empty attention |
| `UsageThresholdBanner.tsx` | Compact warning row |
| `ActiveWork.tsx` | Compact empty titled **היום** |
| `he.ts` | Hebrew-first labels |
| `styles.css` | v2 hero/stack/setup/usage/qa grid |
| `tests/dashboard.test.tsx` | Match new presentation |
| `scripts/phase_1b2_dashboard_qa.mjs` | Authenticated screenshots |
| `Docs/PHASE-1B.2-DASHBOARD-RECOMPOSITION-REPORT.md` | This report |
| `Docs/phase-1b2-qa/*.png` | Visual QA |

---

## 20. STOP

Phase 1B.2 complete. **Awaiting visual approval.**  
Do not start Phase 3. Do not continue Customers/Sites/Service in this pass.

---

# PHASE 1B.2.1 — TIME-AWARE COMMAND HERO

**Date:** 2026-09-21  
**Scope:** Dashboard Command Hero presentation only (theme × local time-of-day)  
**Status:** Complete. **Stopped.** No Dashboard IA changes. No Phase 3.

## Existing greeting logic discovered

`apps/web/src/lib/greeting.ts` already defined:

| Hour (local) | Greeting |
|---|---|
| 00–04 | לילה טוב |
| 05–11 | בוקר טוב |
| 12–16 | צהריים טובים |
| 17–20 | ערב טוב |
| 21–23 | לילה טוב |

Previously hours were read via `Asia/Jerusalem`. **1B.2.1** reuses the **same boundaries**, switches to **browser local time**, and centralizes `dayPeriod` / `dayGreeting` / `heroSurface` so greeting and Hero atmosphere cannot diverge.

Also reused: `givenName` / natural `greeting, Name` line from `workspace-header.ts`.

## Time boundaries used

Identical to prior greeting model (`DAY_PERIOD_BOUNDARIES`): morning 5, afternoon 12, evening 17, night 21.

## Theme / time matrix → `data-hero-surface`

| Effective theme | Period | Surface |
|---|---|---|
| Light | morning / afternoon | `light-day` |
| Light | evening | `dark-evening` |
| Light | night | `dark-night` |
| Dark | morning / afternoon | `dark-day` |
| Dark | evening | `dark-evening` |
| Dark | night | `dark-night` |

System theme: resolved via existing `useTheme()` → same matrix. No second theme system.

## Treatments

- **Light daytime (`light-day`):** cool off-white / blue-tinted gradient, hairline blue border, dark text, light search/actions, SITE SECURE blue primary CTA. Not a flat white box.
- **Light evening (`dark-evening`):** softer graphite (app stays Light; Hero only goes dark).
- **Light night (`dark-night`):** deepest graphite + restrained blue atmosphere (live QA state at capture ~22:30).
- **Dark + day (`dark-day`):** clean graphite, quieter glow.
- **Dark + evening/night:** same evening/night surfaces; never a light Hero.

Attributes on one component: `data-theme-tone`, `data-time-period`, `data-hero-surface`.

## Time update mechanism

`useDayPeriod` schedules `setTimeout` for `msUntilNextDayPeriod` only — no per-minute polling. CSS transitions ~320ms on background/border/color/shadow; disabled under `prefers-reduced-motion`.

## CSS scoping

All new rules under `.ops-command-hero[data-hero-surface="…"]`. No global `html.light morning` leakage. Public/auth `ss-brand-dark` untouched. Theme storage / Light·Dark·System unchanged.

## Greeting presentation

Single headline: `{greeting}, {givenName}` with `dir="auto"` on the name. Date remains secondary muted line.

## RTL / a11y

Hebrew greeting + LTR name/`Ctrl K`/`tabular-nums` inspected. Contrast checked on light-day (dark text on off-white) and dark surfaces (existing light-on-graphite). Focus-visible preserved. Time styling is decorative only.

## Tests

- `dayPeriodFromHour` / `dayGreeting` / `heroSurface` / `msUntilNextDayPeriod` in `tests/dashboard.test.tsx`
- Full `web:test` **354** pass; UI **9** pass; typecheck; changed-file lint; production build — pass

## Visual QA

Auth: same disposable QA owner password grant.

| Capture | Notes |
|---|---|
| `Docs/phase-1b2-qa/hero-live-390-light.png` | Live night → Light app + `dark-night` Hero |
| `Docs/phase-1b2-qa/hero-live-390-dark.png` | Live night → Dark app + `dark-night` Hero |
| `Docs/phase-1b2-qa/hero-live-1440-light.png` | Desktop live |
| `Docs/phase-1b2-qa/hero-live-1440-dark.png` | Desktop live |
| `hero-force-light-day.png` etc. | Presentation-only DOM surface force (not a user setting) |

Script: `apps/web/scripts/phase_1b21_hero_time_qa.mjs`

## Safety confirmation (1B.2.1)

No Dashboard query / API / backend / DB / RBAC / RLS / entitlement / workspace isolation / navigation / search behavior / Today behavior / auth / global theme architecture / public-auth theme changes. No new dependency. No fake data. IA from 1B.2 preserved.

## STOP

Phase 1B.2.1 complete. **Awaiting visual approval.** Do not modify another Dashboard section. Do not begin Phase 3.
