# PROJECT MINIMUM WORKSPACE — Implementation Report

**Date:** 2026-09-24  
**Mode:** Implementation + focused QA  
**Prior gate:** Production browser verification CLOSED/PASS (`Docs/PRODUCTION-BROWSER-VERIFICATION-2026-09-24.md`)

---

## 1. What existed before

- `/app/projects` list with create.
- `/app/projects/$projectId` thin detail: customer/site cards, source-quote button, metadata dl, and **התחלת התקנה** calling existing `createJob({ project_id, kind: "installation" })`.
- **No Project Jobs list**, no derived operational summary, no reusable Job card, no mobile-primary hierarchy.
- Jobs API supported list filters for `site_id` / `service_call_id` but **not** `project_id`; list responses skipped assignee enrichment.

---

## 2. What was implemented

Project detail is now an **operational workspace**:

- Header: identity, customer · site context, existing project status, derived job summary, safe actions.
- Primary column: **עבודות** via reusable `ProjectJobCard` (identity, lifecycle status, assignee/unassigned, schedule, **פתח עבודה** → `/app/jobs/$jobId`).
- Secondary column: compact **פרטי הפרויקט** (customer, site, source quote when permitted, status, created/updated).
- Empty jobs state with truthful copy; reuses existing installation-job create when `jobs.create` + customer + site.
- No Project lifecycle, no Job lifecycle buttons on Project, no Quote pricing, no migrations.

---

## 3. Exact files changed

| Path | Change |
|------|--------|
| `apps/web/src/routes/app/projects/$projectId.tsx` | Thin route → `ProjectWorkspace` |
| `apps/web/src/components/projects/ProjectWorkspace.tsx` | **New** workspace composition |
| `apps/web/src/components/projects/ProjectJobCard.tsx` | **New** reusable Job row |
| `apps/web/src/lib/project-workspace.ts` | **New** derived summary helpers |
| `apps/web/src/i18n/he.ts` | Workspace copy |
| `apps/web/src/styles.css` | Scoped `.project-workspace*` / `.project-job-*` |
| `packages/api-client/src/index.ts` | `listJobs({ project_id })` |
| `apps/api/app/routers/jobs.py` | `project_id` filter; assignees when filtering by project |
| `apps/api/tests/test_dispatch_ops.py` | List-by-project tests |
| `apps/web/tests/project-workspace.test.tsx` | **New** UI tests |
| `apps/web/tests/project-workspace-lib.test.ts` | **New** helper tests |
| `apps/web/scripts/project_minimum_workspace_qa.mjs` | Visual QA capture |
| `Docs/project-minimum-workspace-qa/*` | Screenshots + report |
| `Docs/SITE-SECURE-PRODUCT-COMPLETION-PLAN.md` | Status update (this task) |

---

## 4. Existing APIs reused

- `getProject` / `getCustomer` / `getSite` / `getQuote` (gated by `quotes.view`)
- `listJobs` (extended filter)
- `createJob` (existing installation path with `project_id`)
- Authz presentation via `can()`; server `authorize()` unchanged
- Job lifecycle labels from existing `he.jobStatuses` (display only)

---

## 5. Any API additions

**Minimal extension only (no aggregate workspace endpoint):**

- `GET /jobs?project_id=` filter on existing `jobs.project_id` column
- When `project_id` is present, list responses include **current** assignees (`unassigned_at IS NULL`) so the workspace can show assignee truthfully without N+1 client `getJob` calls

No `GET /projects/{id}/workspace` endpoint.

---

## 6. Migrations

**ZERO.**

---

## 7. Project → Job existing-path finding

**COMPLETE** (safe to reuse)

Evidence: existing `POST /jobs` with `project_id` + `kind: "installation"` already used by Project detail; workspace reuses the same mutation behind `jobs.create` and requires customer + site. Pending state disables duplicate clicks; success invalidates `project-jobs` and navigates to FieldJob.

Still **not** a full “handoff product” (scheduling, assignment UI, post-approve automation) — that remains the next dedicated handoff/list work.

---

## 8. Authz behavior

- Page gated by `projects.view`
- Jobs section gated by `jobs.view`
- Create install gated by `jobs.create` (+ customer & site)
- Source Quote fetch/nav only when `quotes.view`; 403 hides quote identity (no totals/cost/margin)
- Customer link: `crm.view`; Site link: `sites.view`
- Technician assigned-scope still enforced by existing jobs list filter
- No role-name branching

---

## 9. Desktop behavior

- ≥1100px: Jobs ~primary / Details secondary (~65–70% / ~30–35%)
- Narrower desktop: stacks details below jobs
- Jobs visually dominate; no equal dashboard card grid
- Lifecycle actions remain off Project header

---

## 10. Mobile behavior

- 390 / 360: identity → context → summary → actions → jobs → details
- Touch-friendly job cards; full-width open CTA; no Project bottom dock; AppShell nav unchanged

---

## 11. Edge cases covered

Zero/multiple jobs; active/completed/blocked/unassigned; no site; no source quote; quote forbidden; loading; project error; read-only (no create); create pending; jobs query error.

---

## 12. Tests run + results

| Suite | Result |
|-------|--------|
| `project-workspace` + lib | **12 passed** |
| Focused web (workspace, field-job, dashboard, workflow) | **65 passed** |
| Full web `vitest run` | **451 passed** (61 files) |
| API: dispatch list-by-project + project_from_quote + job_lifecycle + authorize | **52 passed** (subset run) |

---

## 13. Build / typecheck

| Check | Result |
|-------|--------|
| `tsc -p tsconfig.json --noEmit` | **PASS** |
| `npm run build` (vite + tsc) | **PASS** |

---

## 14. QA artifact paths

`Docs/project-minimum-workspace-qa/`

- `1440-dark-empty.png`
- `1440-dark-populated.png`
- `1440-light-populated.png`
- `1100-dark-populated.png`
- `390-dark-empty.png`
- `390-dark-populated.png`
- `360-light-populated.png`
- `report.json`, `fixture.json`

Report checks: no horizontal overflow, no page errors, empty copy present, populated open-job CTA present.

---

## 15. Protected systems confirmation

**UNCHANGED:** pricing, Quote Send/Share/PDF/snapshot, CCTV/Design/E1–E2, authz engine, RLS, `job_lifecycle.py` semantics, assignment-history semantics, `project_from_quote.py` rules, Quote Builder / mobile dock.

---

## 16. Remaining gaps

- Global **Jobs list** still missing (next task can reuse `ProjectJobCard`).
- Project → Job **handoff productization** (scheduling defaults, assignment from Project, clearer post-Approve path) still separate.
- Assignee display_name may be empty for some profiles → shows **משובץ** (truthful assigned, no fake name).
- QA fixtures retained: empty project `0ef01288-…`, populated `fa155f31-…` with `J-00002`/`J-00003`.

---

## 17. Recommendation for next task

**FINISH Jobs List (manager visibility)** — reuse `ProjectJobCard` / list filters; do not expand into dispatch board.
