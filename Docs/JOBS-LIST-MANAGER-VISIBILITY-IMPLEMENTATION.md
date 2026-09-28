# JOBS LIST — Manager Operational Visibility

**Date:** 2026-09-24  
**Mode:** Implementation + focused QA  
**Prior gate:** Project Minimum Workspace CLOSED/PASS

---

## 1. What existed before

- `/app/jobs/$jobId` FieldJob surface only — **no** `/app/jobs` index.
- Jobs list API: filters for `q` (title), `status`, `site_id`, `service_call_id`, `project_id`; assignees only when `project_id` set.
- Project workspace introduced reusable Job row + derived summary helpers.
- Technician list scope already enforced via `apply_assigned_job_list_filter` / `empty_assigned_page`.
- AppShell ops nav had Projects / Sites / Service — no global Jobs entry.

---

## 2. What was implemented

- Route **`/app/jobs`** (Hebrew **עבודות**) — manager operational Jobs overview.
- Compact summary labeled **בתוצאות המוצגות** (truthful page-scoped counts — not fake globals).
- Filters: status (incl. authoritative `active` = `OPEN_JOB_STATUSES`), assignment (`מוקצות` / `ללא הקצאה`), search (number/title).
- Job rows via shared **`JobWorkCard`** (Project workspace wraps the same primitive).
- Context: customer / site / project names (hydrated), open Job primary action; contextual links when permitted.
- Empty vs filtered-empty states; loading/error; AppShell nav entry + mobile Work sheet entry.
- **No** lifecycle buttons, **no** create-job architecture, **no** commercial fields, **no** dispatch/scheduler.

---

## 3. Exact files changed

| Path | Change |
|------|--------|
| `apps/web/src/routes/app/jobs/index.tsx` | **New** route |
| `apps/web/src/components/jobs/JobsListPage.tsx` | **New** list page |
| `apps/web/src/components/jobs/JobWorkCard.tsx` | **New** shared Job row |
| `apps/web/src/components/projects/ProjectJobCard.tsx` | Thin wrapper → JobWorkCard |
| `apps/web/src/lib/app-nav.ts` | `/app/jobs` nav + TARGET_IA |
| `apps/web/src/components/NavIcon.tsx` | `jobs` icon |
| `apps/web/src/i18n/he.ts` | Jobs list copy |
| `apps/web/src/styles.css` | Scoped `.jobs-list-*` |
| `apps/web/src/routeTree.gen.ts` | Generated `/app/jobs/` |
| `packages/api-client/src/index.ts` | listJobs opts + JobOut context fields |
| `apps/api/app/routers/jobs.py` | assignment filter, batch assignees, context names, active status, number search |
| `apps/api/tests/test_dispatch_ops.py` | listJobs assignment/context tests |
| `apps/web/tests/jobs-list.test.tsx` | **New** UI tests |
| `apps/web/scripts/jobs_list_manager_visibility_qa.mjs` | Visual QA |
| `Docs/jobs-list-manager-visibility-qa/*` | Screenshots + report |
| `Docs/SITE-SECURE-PRODUCT-COMPLETION-PLAN.md` | Status update |

---

## 4. Existing components reused

- `JobWorkCard` shared with Project workspace (`ProjectJobCard` wrapper)
- `project-workspace.ts` summary / assignee / schedule helpers
- `RequirePermission` + `can()` presentation
- UI `Input` / `Select` / `ErrorState` / `Status` / `Button`

---

## 5. Existing API contracts reused

- `GET /api/v1/workspaces/{id}/jobs`
- Existing `jobs.view` + assigned-scope filters
- Assignment history: `unassigned_at IS NULL`

---

## 6. Any API changes

**Extended** existing list endpoint (no new aggregate route):

- `assignment=assigned|unassigned`
- `include_assignees=true` (batch hydrate)
- `include_context=true` → `customer_name`, `site_name`, `project_name`
- `status=active` → `status=in.(OPEN_JOB_STATUSES)`
- `q` matches `title` **or** `number`

---

## 7. Migrations

**ZERO.**

---

## 8. Job query / filter / order behavior

- Default order: existing `created_at.desc` (deterministic).
- Status / assignment / search applied server-side.
- Page limit 100 for the UI list; summary explicitly scoped to loaded results.

---

## 9. Assignment semantics

**PASS** — current assignees from active assignment rows (`unassigned_at IS NULL`); display name or **משובץ** / **לא הוקצה**.

---

## 10. Authz behavior

- Route: `jobs.view`
- Contextual links gated: `projects.view`, `crm.view`, `sites.view`
- No commercial Quote fetch

---

## 11. Technician behavior

**UNCHANGED** — list still uses `apply_assigned_job_list_filter` / empty assigned page. Technicians do not gain workspace-wide Job visibility by opening `/app/jobs`.

---

## 12. Desktop behavior

Scanable job cards with status, identity, context, assignee, schedule, open action; filters usable at 1100/1440.

---

## 13. Mobile behavior

Same cards stack; filters grid collapses; 390/360 no horizontal overflow; AppShell bottom nav unchanged (Jobs in Work sheet).

---

## 14. Empty / error / loading

- Product empty: אין עבודות להצגה + Projects link when permitted
- Filtered empty: לא נמצאו… + reset
- Loading text; ErrorState on API failure

---

## 15. Tests + results

| Suite | Result |
|-------|--------|
| jobs-list + project workspace + field-job | **14 passed** |
| Full web vitest | **456 passed** (62 files) |
| API dispatch/lifecycle/authorize/scope/project_from_quote | **69 passed** |

---

## 16. Typecheck

**PASS**

---

## 17. Build

**PASS**

---

## 18. QA artifacts

`Docs/jobs-list-manager-visibility-qa/`

- 1440-dark-populated / light-populated / 1100-dark-populated
- 1440-dark-filtered / 1440-dark-empty (filtered empty in QA WS)
- 390-dark-populated / 360-dark-populated / 390-light-empty
- `report.json`

---

## 19. Protected systems confirmation

**UNCHANGED** — pricing, Quote lifecycle/PDF/snapshot, CCTV/Design/E1–E2, authz engine, RLS, `job_lifecycle.py`, assignment-history semantics, `project_from_quote.py`, Quote Builder / dock, Project→Job create semantics.

---

## 20. Remaining gaps

- Global totals across all pages (would need count endpoint or full scan — intentionally not faked).
- Search does not yet search customer/site/project names (would need broader query).
- Dispatch / assignment mutation UI still out of scope.
- True workspace-empty screenshot depends on empty fixture WS.

---

## 21. One recommended next Product Completion task

**FINISH Project → Job handoff** — clearer post-Approve create/open installation path (scheduling defaults / assignment UX), without building a dispatch board.
