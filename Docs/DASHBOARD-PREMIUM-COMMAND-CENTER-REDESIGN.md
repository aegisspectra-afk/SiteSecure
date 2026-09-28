# DASHBOARD — Premium Operational Command Center Redesign

**Date:** 2026-09-23  
**Scope:** Presentation / UX only — AppShell chrome + Dashboard sections  
**Constraint:** No new APIs, no business-logic changes, no migrations

---

## 1. Previous UX problems

- Busy topbar: workspace ID strings, heavy Search, persistent «מוכן לפעולה», email/debug identity  
- Oversized hero card, equal-weight quick-action tiles  
- Attention treated like system failure (aggressive red)  
- Sparse Today empty card; Recent Quotes as admin table  
- Low information density; identical bordered cards; feedback FAB too loud  
- Desktop felt like stretched mobile in places  

---

## 2. New information hierarchy

```
AppShell topbar → compact Search · status dot · account (mobile)
Sidebar → brand · nav · human account trigger

Dashboard
  → Compact operational overview (greeting · signals · hierarchical actions)
  → Needs attention
  → Today (incl. compact empty)
  → Recent Quotes / activity / commercial (existing data only)
```

---

## 3. Header redesign

- Desktop: workspace title removed from topbar (sidebar owns brand)  
- Mobile: short workspace title remains  
- Tools cluster: Search + system status + account  

---

## 4. Search redesign

Pill control: icon + `Ctrl K` (md+). Opens existing command palette. Hotkey unchanged (`useCommandPaletteHotkey` + `site-secure:open-command-palette`).

---

## 5. System Status behavior

- Removed header sentence «מוכן לפעולה»  
- Compact green/amber/red dot only  
- Click → popover **מצב המערכת** with real checks:

| Label | Ready value |
|---|---|
| סביבת עבודה | פעילה |
| פלטפורמה | מחוברת |
| רשת | מחוברת |
| אימות | מחובר |

Source: `workspaceSystemChecks` (session / workspace_status / navigator.onLine / auth) — no fake infrastructure monitoring. Escape + outside click close via `HeaderPopover`.

---

## 6. Identity cleanup

- Account trigger prefers profile full name, else email local-part  
- Full email stays inside account menu  
- Greeting drops email-looking names  

---

## 7. Overview / quick actions

- Compact hero (`is-compact-cc`)  
- Signals: attention · today · open quotes  
- Actions: one primary (Quote) + quiet secondary links + More overflow  

---

## 8. Attention treatment

- Softened red/high borders (attention ≠ critical failure)  
- Quieter row CTAs (`is-quiet`)  
- Row remains the interactive control (existing Link/button pattern)  

---

## 9. Today treatment

Compact empty: title · one-line empty · «תזמן עבודה» inline — no giant empty tile.

---

## 10. Recent Quotes treatment

List rows: number · customer · status · age · amount. Removed admin table. «צפה בכל ההצעות» retained.

---

## 11. Desktop architecture

- Wide primary/secondary grids when paired sections exist  
- Main content max-width ~72rem at 1280+  
- Floating bottom nav remains AppShell-owned (not rewritten); visual weight deferred if still dominant  

---

## 12. Mobile architecture

- Compact topbar tools  
- Overview → attention → today → quotes  
- Bottom nav clearance preserved; quieter feedback FAB  

---

## 13. Light / Dark

Hero surfaces + tokens unchanged; both themes verified in QA shots.

---

## 14. RTL

Hebrew-first; `ltr-meta` / `dir="ltr"` on Quote/Job IDs and shortcut kbd.

---

## 15. Accessibility

- Status button `aria-label=מצב המערכת`  
- Popover dialog + Escape / outside close  
- Search `aria-label` + keyboard shortcut  
- Focus rings on new controls  

---

## 16. Role behavior

Unchanged: `can()` / features gate dashboard, creates, quotes, jobs. Observe vs Ops variants preserved. Technician home still routes to `/app/today`.

---

## 17. Files changed

| File | Role |
|---|---|
| `apps/web/src/components/AppShell.tsx` | Topbar / search / identity |
| `apps/web/src/components/WorkspaceSystemStatus.tsx` | Dot + popover |
| `apps/web/src/lib/workspace-header.ts` | Aria labels; no ready sentence |
| `apps/web/src/i18n/he.ts` | Status copy |
| `apps/web/src/components/dashboard/DashboardCommandHero.tsx` | Compact overview |
| `apps/web/src/components/dashboard/DashboardQuickActions.tsx` | Action hierarchy |
| `apps/web/src/components/dashboard/AttentionList.tsx` | Quiet CTAs |
| `apps/web/src/components/dashboard/ActiveWork.tsx` | Compact empty |
| `apps/web/src/components/dashboard/RecentQuotes.tsx` | List presentation |
| `apps/web/src/styles.css` | Command-center styles |
| `apps/web/tests/workspace-header.test.tsx` | Status acceptance |
| `apps/web/tests/dashboard-command-center.test.tsx` | New focused tests |
| `apps/web/scripts/dashboard_premium_command_center_qa.mjs` | Visual QA |
| `Docs/DASHBOARD-PREMIUM-COMMAND-CENTER-REDESIGN.md` | This doc |
| `Docs/dashboard-premium-command-center-qa/*` | Screenshots |

---

## 18. Screenshots

`Docs/dashboard-premium-command-center-qa/`:

- desktop-dark-1440 / 1280 / 1100  
- desktop-light-1440  
- desktop-dark-status-popover  
- mobile-dark-390 / 360  
- mobile-light-390  

---

## 19. Tests / build

```text
vitest: workspace-header, dashboard-command-center, dashboard → pass
tsc --noEmit → pass
vite build → pass
```

---

## 20. Deferred issues

- AppShell floating bottom nav still present on large desktops — intentional architecture; separate nav redesign if needed  
- Long real workspace names (e.g. QA fixture strings) still appear in sidebar brand — data truth, not invented abbreviator  
- Known DB `assignments.unassigned_at` — untouched  
- Analytics charts — not added  

---

## 21. Protected systems unchanged

Quote pricing/lifecycle · Share/Send · System Design / CCTV / R1–R3 · jobs lifecycle · assignment semantics · customers · authz · RLS · API contracts · no migrations.

---

## 22. CORRECTIVE PASS — MOBILE / HIERARCHY / GREETING

**Date:** 2026-09-23 (same day follow-up)

### Screenshot problems found

- Oversized bordered overview “hero card” with content clustered to inline-start and large unused surface beside it  
- Greeting without human first name (and risk of technical identity leakage)  
- Topbar tools felt ungrouped; QA workspace title headline-weight  
- Avatar initials fallback (“PH”) when image failed; status dot looked decorative  
- Primary Quote CTA extreme vs disabled-looking secondary actions  
- Attention: giant ActivityRow leading circles + red/orange vertical stripe + alarming red  
- Today empty still card-like; Recent Quotes ID/₪0/status-dot hierarchy weak  
- Floating bottom nav + white active puck + feedback FAB competed with content  

### Greeting identity resolution

| Priority | Source |
|---|---|
| 1 | `session.profile.full_name` first whitespace token via `greetingFirstName()` |
| 2 | If missing / technical → greeting only (e.g. `ערב טוב`) |

**Never used:** email local-part, workspace slug, account ID, QA identifiers, `he.accountShortLabel`.

Helpers: `isTechnicalIdentity`, `greetingFirstName`, `greetingLine` in `workspace-header.ts`.  
Dashboard route now passes **only** `profile.full_name` (not email) into the hero.

### Empty-space root cause

1. **Tablet (768–1023):** `.ops-command-hero.is-composed .ops-command-hero-compose` used `flex-direction: row` + `justify-content: space-between`, splitting identity vs signals with a dead middle.  
2. **Desktop (≥1100):** `.ops-command-hero.is-compact-cc` used `justify-content: space-between`, stretching compose vs actions across the full width.  
3. **Desktop primary:** `has-pair` placed empty Today beside Attention, reserving a sparse sibling column.

**Fixes:** compose always column (no space-between); compact-cc `justify-content: flex-start`; pair Today only when `todayItems.length > 0`; overview border/background removed so unused surface is page background, not a dead card.

### Topbar / overview / actions

- Tools cluster chip; mobile search icon-button; desktop shows label + `Ctrl K`  
- System status: `is-control` chip + tooltip/aria (no «מוכן לפעולה»)  
- Technical workspace titles: `is-technical` (topbar + sidebar) — muted, smaller  
- Avatar: `avatar-man.png`, restrained crop  
- Overview flush (no hero card); greeting ~1rem contextual  
- Quick actions: primary still Quote; secondary bordered interactive; tertiary dashed More  

### Attention / Today / Recent Quotes

- Removed leading circles; compact `ops-attention-mark` only  
- Removed vertical attention stripe  
- Overdue → amber/medium; red reserved for true critical (e.g. expiring)  
- Row hierarchy: customer/what → state + isolated LTR id → why/meta → quiet CTA  
- Today empty: `is-flush`, quiet schedule link  
- Recent: customer → id → status text (no Status dot) → age; `₪0` uses `is-quiet`  

### Bottom nav / FAB

- Nav height ~54px; softer translucent active puck (not giant white pill)  
- Lighter icons/labels; quieter FAB size/opacity/shadow; clearance coordinated  

### RTL

- Job/Quote ids in `<bdi class="ltr-meta" dir="ltr">`  
- Meta separators `unicode-bidi: isolate`  

### Light / Dark verification

QA script shots (notes empty = no empty-column / technical-greeting regressions):

- `mobile-dark-360`, `mobile-dark-390`, `mobile-light-390`  
- `desktop-dark-1100`, `1280`, `1440`, `desktop-light-1440`  
- `desktop-dark-status-popover`  

### Files changed (corrective)

| File | Change |
|---|---|
| `apps/web/src/lib/workspace-header.ts` | `greetingFirstName` / technical guards |
| `apps/web/src/lib/attention-queue.ts` | Calmer visual urgency |
| `apps/web/src/routes/app/dashboard.tsx` | full_name only for greeting |
| `apps/web/src/components/dashboard/DashboardCommandHero.tsx` | greetingFirstName |
| `apps/web/src/components/dashboard/AttentionList.tsx` | Row hierarchy, no circles |
| `apps/web/src/components/dashboard/RecentQuotes.tsx` | Hierarchy, quiet ₪0, no dots |
| `apps/web/src/components/dashboard/ActiveWork.tsx` | Flush empty |
| `apps/web/src/components/dashboard/OpsDashboard.tsx` | No empty Today pair column |
| `apps/web/src/components/dashboard/CommandStatus.tsx` | `is-calm` |
| `apps/web/src/components/AppShell.tsx` | Topbar tools / technical title |
| `apps/web/src/components/AppSidebar.tsx` | Technical workspace weight |
| `apps/web/src/components/WorkspaceSystemStatus.tsx` | Control affordance |
| `apps/web/src/components/AppBottomNav.tsx` | Smaller puck measure |
| `apps/web/src/styles.css` | Corrective pass CSS block |
| `apps/web/tests/workspace-header.test.tsx` | First-name cases A–D |
| `apps/web/tests/dashboard-command-center.test.tsx` | Technical greeting + compose |
| `apps/web/scripts/dashboard_premium_command_center_qa.mjs` | Empty-column checks |
| `Docs/dashboard-premium-command-center-qa/*` | Re-shot |

### Exact tests / build

```text
vitest run tests/workspace-header.test.tsx tests/dashboard-command-center.test.tsx → 18 passed
vite build && tsc -p tsconfig.json --noEmit → pass
node scripts/dashboard_premium_command_center_qa.mjs → 8 shots, notes: []
```

### Protected systems

Unchanged: pricing, Quote lifecycle, CCTV, R1–R3, jobs lifecycle, assignment semantics, authz, RLS, API contracts, Share/Send, PDF, migrations, `assignments.unassigned_at`.

---

## 23. DESKTOP COMPOSITION PASS

**Date:** 2026-09-23

### 1. Previous desktop problem

After the mobile corrective pass, 1440px still felt like a **mobile strip inside a desktop shell**:
- Dashboard `max-width` + centered margins left unused main canvas
- Overview hugged inline-start instead of forming a full-width command header
- Attention rows used `flex: 1` body → CTA parked at the far end of the track
- Empty Today either stacked (under-using width) or risked a dead twin column
- Recent Quotes capped at ~32rem (`is-compact`) even on wide desktops
- Sidebar active treatment competed with a visually underweighted main surface

### 2. Desktop grid strategy

| Breakpoint | Strategy |
|---|---|
| **1100** | Full-width workspace; Attention + Today stack when empty-rail would crush Hebrew; overview signals under greeting |
| **1200+** | Attention + compact Today **rail** (`has-pair is-today-rail` ≈ 1.85fr / 0.42fr) when Today empty |
| **1280 / 1440+** | Same rail; stronger overview type; Recent Quotes full workspace band |
| **Populated Today** | Balanced `has-pair` ≈ 1.2fr / 0.9fr (Attention \| Today) |

No fake KPIs/charts. Existing Dashboard data only.

### 3. Overview layout

Full-width command header (`is-compact-cc`):
- Identity + date
- Signals aligned on the trailing edge of the compose band (1200+)
- Quick actions on the next row, grouped — not stretched across the canvas

### 4. Attention / Today relationship

- `OpsDashboard` sets `has-pair` whenever both sections show
- Empty Today → `is-today-rail` (compact contextual panel with start border, not a giant empty column)
- Populated Today → balanced two-region grid
- 1024–1199 empty-Today stacks to avoid cramped Hebrew

### 5. Row-action association

Desktop Attention rows:

```css
grid-template-columns: auto auto minmax(0, 1fr);
```

Body + CTA occupy the first two tracks (clustered at inline-start). Remaining `1fr` absorbs leftover column width **without** separating the action from the job.

Measured at 1440: **assocGap ≈ 8px**, dashboard fill ≈ **95%** of `.ops-main`.

Today empty uses `ops-today-empty-stack` (title → message → CTA) — no `margin-inline-start: auto` stranding the schedule link.

### 6. Recent Quotes desktop

Row band: customer · id · status · age · amount (`is-desktop-band`).  
Overrides prior `max-width: 32rem` on `.is-compact` so the band uses the workspace width. `₪0` stays `is-quiet`. Mobile keeps wrapped flex stacking.

### 7. Topbar

Desktop: min-height ~3.25rem; larger search + avatar + status chip; tools cluster preserved.

### 8. Sidebar relationship

Slightly narrower sidebar (14.25rem); quieter active tint so the main workspace leads.

### 9. Feedback FAB

Desktop: inset near content edge, quieter opacity — no longer stranded as the only object in an empty void once the workspace fills.

### 10. Responsive breakpoints

- ≤1023: prior mobile/tablet rules protected  
- 1024–1199: full width; conservative pairing  
- 1200+: Today rail + compose signals beside identity  
- 1280 / 1440: density polish  

### 11. Light / Dark

Verified `desktop-light-1440` + dark 1100/1280/1440/1600.

### 12. RTL

Grid order is document order under `dir=rtl` (Attention first = inline-start). IDs remain `<bdi dir="ltr">`.

### 13. Mobile regression

360 / 390 dark + 390 light re-shot. Bottom nav architecture unchanged. Overview remains flush stacked.

### 14. Screenshots

`Docs/dashboard-premium-command-center-qa/`:

- desktop-dark-1100 / 1280 / 1440 / 1600  
- desktop-light-1440  
- desktop-dark-status-popover  
- mobile-dark-360 / 390, mobile-light-390  

### 15. Files changed

| File | Role |
|---|---|
| `apps/web/src/components/dashboard/OpsDashboard.tsx` | `has-pair` / `is-today-rail` |
| `apps/web/src/components/dashboard/ActiveWork.tsx` | `ops-today-empty-stack` |
| `apps/web/src/components/dashboard/RecentQuotes.tsx` | desktop band columns |
| `apps/web/src/styles.css` | DESKTOP COMPOSITION PASS block |
| `apps/web/scripts/dashboard_premium_command_center_qa.mjs` | +1600 shot |
| `Docs/DASHBOARD-PREMIUM-COMMAND-CENTER-REDESIGN.md` | this section |

### 16. Exact tests / build

```text
vitest dashboard-command-center + dashboard → 50 passed
tsc --noEmit → pass
QA script → 9 shots, notes: []
1440 metrics: assocGap≈8, dashW/mainW≈0.95, Attention|Today rail grid live
```

### 17. Protected systems unchanged

Pricing · Quote lifecycle · Share/Send · PDF · CCTV · R1–R3 · jobs · assignments · authz · RLS · API contracts · migrations · `assignments.unassigned_at` · greeting identity rules · mobile bottom nav.

