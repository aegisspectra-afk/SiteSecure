# DASHBOARD-2 ROLE TUNING REPORT

**Date:** 2026-09-28  
**Scope:** Audit + small role-specific adjustments only  
**Constraint:** Approved `/app/dashboard` architecture preserved; analytics stays on `/app/analytics`

---

## 1. Existing architecture verdict

**PASS — keep as approved.**

Order remains:

1. Hero (greeting · signals · open value · quick actions)  
2. Attention  
3. Today  
4. Quote cycle (`מחזור הצעות`)  
5. Recent Quotes  
6. Activity (when API rows exist)  
7. Setup / usage notices when relevant  
8. Updated timestamp  

No redesign. No CommercialPulse restored into dashboard. No charts added to Hero.

---

## 2. Owner findings

**PASS.**

- `homeVariant` → `ops` → `OpsDashboard`
- Attention: jobs (unassigned + overdue) + quotes + leads (frontend merge)
- Today: jobs when `jobs.view`
- Commercial: pipeline + recent quotes + activity
- Quick actions: quote · customer · site · lead · task · project · job · catalog (permission-gated)
- Open value + analytics deep-link when `quotes.view` + quotes feature
- Activation / setup for fresh workspaces; usage banner when near quota

No vanity KPIs.

---

## 3. Manager findings

**PASS — no layout fork needed.**

- Same Ops shell as Owner; narrower grants via catalog (`packages/authz/catalog.json`)
- API already biases ops: `job_unassigned` (ops only), `job_overdue`, full today jobs
- Quotes remain available (manager has quotes.*) — correct for operational managers; not over-weighted beyond Owner
- Quick actions include task / project / job / site where permitted

**No structural rebalance** — existing API + permission gates already bias Manager more operationally than Sales.

---

## 4. Sales findings

**PASS after small fixes.**

| Surface | Before | After |
|---------|--------|-------|
| Today empty tile | Shown via `jobs.view` while API always returns `[]` → CTA to `/app/today` which redirects back to dashboard | **Hidden** when `homeVariant === "sales"` |
| Quick actions | Included Task shortcut | **Task removed** for Sales; commercial set: quote · customer · lead · catalog |
| Site create | Not in catalog (`sites.view` only) | Unchanged — **remaining gap** (see §17) |
| Attention | Quotes (owned) + stale drafts + leads | Unchanged — correct commercial bias |
| Usage banner | Already suppressed for sales | Unchanged |

---

## 5. Attention findings

**PASS for jobs / quotes / leads. No tasks / service without backend work.**

| Source | Where | Roles |
|--------|-------|-------|
| Quote groups | API `dashboard.py` | ops / sales / observe |
| `quote_stale_draft` | API | sales only |
| `job_unassigned` | API | ops only |
| `job_overdue` | API | ops / observe / today |
| `lead_follow_up` | Frontend merge from `listLeads` | Ops (+ Observe after fix) |

**Tasks / service calls:** Not in dashboard payload. No cheap existing field. **Did not** invent backend architecture.

**Viewer fix:** ObserveDashboard now receives `leadAttentionItems` and merges lead follow-ups (read-only).

---

## 6. Today findings

**PASS — keep jobs-only.**

- API `_today_jobs` only (`entity_type: "job"`)
- Tasks / service “today” not exposed on dashboard API → **no merge**
- Sales: empty Today section suppressed (see §4)
- Owner / Manager / Viewer: unchanged job Today

---

## 7. Hero / value security

**PASS.**

- Open value shown only when `summary` + `quotes.view` + quotes feature
- Balance fields: `quotes_open_value`, `quotes_open`, `quotes_approved_value` — **no cost / margin**
- API strips cost/margin from quote rows; vanity keys forbidden
- Balance links to `/app/analytics` (permission-gated page)
- No charts added to Hero

---

## 8. Quick action findings

**PASS after Sales task trim.**

| Role | Actions |
|------|---------|
| Owner / Manager / Administrator | quote · customer · site · lead · **task** · project · job · catalog (as permitted) |
| Sales | quote · customer · lead · catalog — **no** task / site / job / project |
| Viewer | none (`showCreate={false}`) |
| Technician | not on Ops dashboard home |

No actions without permission (task is office shortcut for roles that already manage work; Sales excluded per §7 of the brief).

---

## 9. Fresh workspace behavior

**PASS — keep.**

- `shouldShowActivationCard` when no quotes yet and create quote/customer allowed
- During activation: attention/leads suppressed; setup card guides first steps
- Not removed; still useful for beta Owner onboarding

---

## 10. Technician routing

**PASS — unchanged.**

- Home → `/app/today`
- `/app/dashboard` → `<Navigate to="/app/today" />` before fetch
- Field-scoped jobs + job actions on TodayHome

---

## 11. Viewer behavior

**PASS after lead merge.**

- `ObserveDashboard`: no create CTAs, no project-create from attention, pipeline unlinked
- Lead follow-ups now included when `leads.view` probe returns rows
- Gross quote values remain readable (by design with `quotes.view`)

---

## 12. Responsive result

**PASS — CSS coverage; Bottom Nav untouched.**

Known risk widths covered by existing dash12 / compact-cc media queries:

| Width | Coverage |
|------|----------|
| 1050 / 1032 / 1024 | `min-width: 1024px` dash12 hero + balance grid |
| 900 / 850 | `min-width: 900px` / `768–1023` tablet balance columns |
| 768 | tablet compose + zone grids |
| 430 / 390 / 360 | `max-width: 767` / `639` stack; full-width balance |

No Bottom Nav changes. No layout redesign in this pass.

---

## 13. Changes made

1. **Sales:** hide Today section when `homeVariant === "sales"` (`OpsDashboard.tsx`)
2. **Sales:** remove Task from `buildCreateActions` (Owner / Manager / Administrator only)
3. **Viewer:** pass `leadAttentionItems` into `ObserveDashboard` and merge into attention (`dashboard.tsx`, `OpsDashboard.tsx`)
4. **Tests:** align commercial assertions to Quote Pipeline / Command Balance; add Sales Today + Viewer lead coverage; fix ActiveWork empty-copy expectation

---

## 14. Tests

**PASS (focused):**

```
tests/dashboard.test.tsx
tests/dashboard-command-center.test.tsx
tests/dashboard-final-polish.test.tsx
tests/quick-actions-dash6.test.tsx
tests/quote-pipeline-dash5.test.tsx
→ 74 passed
```

**Pre-existing fail (out of scope):** `tests/today-routing.test.tsx` — imports non-exported page symbols (`DashboardPage`, `TodayPage`, `AppHome`).

---

## 15. Typecheck

**FAIL — pre-existing / unrelated:**

- `tests/work-navigation.test.ts` — missing `workNav` export + implicit `any`
- `tests/today-routing.test.tsx` — non-exported route components
- `tests/active-work-dash4.test.tsx` — missing `formatTodaySchedule` / `todayStatusTone` exports
- `src/components/dashboard/AnalyticsWorkspace.tsx` — `showExpandLink` prop mismatch on `CommercialPulseChart` (analytics page WIP; not dashboard shell)

**No new type errors in OpsDashboard / DashboardCreateMenu / dashboard route from this change.**

---

## 16. Build

**Vite production build: PASS** (`vite build` ✓ ~5.5s).

**Workspace `npm run build -w @site-secure/web`: FAIL** — script chains `vite build && tsc --noEmit`; tsc hits the pre-existing test/analytics issues above.

---

## 17. Remaining gaps

1. **Sales `sites.create`** — brief asks for site creation; catalog grants only `sites.view`. Expanding RBAC was out of scope for “small UI tuning.”
2. **Tasks / service in Attention or Today** — not in dashboard API; needs backend work later.
3. **AnalyticsWorkspace prop typing** — fix when polishing `/app/analytics`.
4. **Stale route/nav tests** — `today-routing`, `work-navigation`, `active-work-dash4` need export/API alignment (not role tuning).

---

**STOP.**
