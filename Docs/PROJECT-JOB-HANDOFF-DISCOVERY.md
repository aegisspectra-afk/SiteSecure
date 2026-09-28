# PROJECT → JOB HANDOFF — Discovery / Preflight

**Date:** 2026-09-24  
**Mode:** DISCOVERY ONLY — no implementation  
**CODE WINS** over stale completion-plan language  

**Verified prior state:**
- Project Minimum Workspace: PASS  
- Project → Job existing creation path: COMPLETE  
- Global Jobs List `/app/jobs`: PASS  

---

## 1. Current journey

Manager path as implemented in code:

| Step | Behavior | Status |
|------|----------|--------|
| 1. Open Project | `/app/projects/$projectId` → `ProjectWorkspace` | **WORKS** |
| 2. Review customer / site / source Quote | Header + details rail; Quote gated by `quotes.view` | **WORKS** |
| 3. Create Job | One-click **התחלת התקנה** (header + empty state). No dialog. | **WORKS** |
| 4. Submit | `api.createJob(...)` via `useMutation` | **WORKS** |
| 5. Success feedback | Immediate navigate to `/app/jobs/$jobId` (no toast) | **WORKS** (pattern C) |
| 6. Identify new Job | User lands on FieldJob for that id | **WORKS** |
| 7. Open Job | Already open; Project rows also have **פתח עבודה** | **WORKS** |
| 8. Return to Project | FieldJob primary back → **היום** (`/app/today`); Project available under More → **פתיחת הפרויקט** when `project_id` set | **PARTIAL** |
| 9. Find Job in `/app/jobs` | Job has `project_id`; list hydrates context. Create does **not** invalidate `jobs-list` query key | **PARTIAL** (appears after natural refetch; cache may be stale briefly) |
| 10. Technician path | Create leaves Job **unassigned**; Today/scope unchanged; assign on FieldJob with `jobs.assign` | **WORKS** / **NOT APPLICABLE** to create |

**Conclusion:** Creation and open path are complete. Remaining friction is continuity UX (back navigation, list cache), not missing create capability.

---

## 2. Existing createJob contract

### API (`POST /jobs`, `JobCreate`)

| Field | Required | Used by Project create? | Source |
|-------|----------|-------------------------|--------|
| `title` | yes | yes | Derived: `התקנה — {project\|site name}` |
| `customer_id` | yes | yes | Inherited from Project |
| `site_id` | yes | yes | Inherited from Project (CTA hidden if no site) |
| `kind` | default `service` | yes → `"installation"` | Explicit |
| `project_id` | optional | yes | Explicit Project id |
| `scheduled_for` / `scheduled_end` | optional | **no** | Not collected |
| `service_call_id` | optional | no | — |
| `priority` | optional | no | Server/DB default `normal` |

### Server-derived / side effects

- `workspace_id`, `created_by`, Job `number`
- Initial lifecycle status from DB default (typically `scheduled` — not set in payload)
- Installation checklist seeded when `kind=installation`
- Audit + site timeline event
- Authz: `jobs.create` with site resource

### Client gates

- `can(jobs.create)` + Project has `customer_id` + `site_id`
- Pending disables button (duplicate submit prevented)

**No form fields. No assignee at create. No schedule at create.**

---

## 3. Post-create behavior

Implemented pattern: **C — Create Job → navigate directly to Job.**

| Check | Finding |
|-------|---------|
| Success feedback | Navigation to FieldJob; no toast / inline success on Project |
| Modal/form closes | **N/A** — no modal |
| Project Jobs list refresh | `invalidateQueries(["project-jobs", ...])` then navigate away |
| New Job appears on Project immediately | User leaves Project; on return, list refetches — **WORKS** |
| Identity obvious | FieldJob shows `number` + title | **WORKS** |
| Can open | Already on Job | **WORKS** |
| Duplicate submit | `loading` + `disabled` while pending | **WORKS** |
| Failed create | Error alert under header; stay on Project; no phantom Job | **WORKS** |
| Clear next action | Opening Job **is** the next action | **WORKS** |

---

## 4. Project refresh behavior

- On success: invalidates `project-jobs` and `site-jobs`.
- Does **not** invalidate `["jobs-list", ...]`.
- Because navigation leaves Project, Project refresh is not user-visible until return — then OK.

**Verdict:** Project refresh contract is correct for pattern C; global list cache is the weaker link.

---

## 5. Job Detail continuity

`/app/jobs/$jobId` → `FieldJob` (same surface for manager and technician).

| Continuity need | Status |
|-----------------|--------|
| Customer / site shown | **PASS** (loaded via ids) |
| Project link | **PARTIAL** — under More sheet / overflow, not primary chrome |
| Primary back | **PARTIAL** for manager handoff — always **היום**, not Project |
| Openability | **PASS** |
| Lifecycle display | **PASS** (authoritative) |
| Assign technician | **PASS** if `jobs.assign` (separate from create) |

Handoff-critical (not broader FieldJob redesign): manager exit path after Project-originated create is Today-centric.

---

## 6. Global Jobs continuity

| Check | Status |
|-------|--------|
| New Job has `project_id` | **PASS** |
| Appears in `/app/jobs` with Project / Customer / Site / status / assignment | **PASS** after fetch with `include_context` |
| Immediate cache update after create | **PARTIAL** — `jobs-list` not invalidated |
| Conflicting Job card semantics | **PASS** — shared `JobWorkCard` |

---

## 7. Assignment continuity

| Question | Answer |
|----------|--------|
| Can Job be created unassigned? | **Yes** — Project create never assigns |
| Intentional? | **Yes** — create ≠ dispatch |
| Where is assignment performed? | FieldJob (`assignJob`) when `jobs.assign` |
| Manager assign on Project? | **No** — and should not expand into Dispatch here |
| Required before technician execution? | Yes for Today/assigned-scope tech visibility |
| `/app/jobs` unassigned truth? | **PASS** |
| Today only assigned? | **PASS** (existing scope) |

**Assignment is NOT part of Project → Job create handoff.** It is a separate capability already available on Job detail.

---

## 8. Scheduling continuity

| Question | Answer |
|----------|--------|
| Does Project create set schedule? | **No** |
| Does API support schedule on create? | **Yes** (`scheduled_for` / `scheduled_end`) |
| Blocker for handoff? | **No** — Job is executable; schedule is optional enrichment / future scheduling product |

Absence of schedule-at-create is **not** a handoff blocker; do not add scheduling architecture under this label.

---

## 9. Technician continuity

- New install Job starts unassigned → technician does not see it on Today until assigned.
- Assigned-scope list filters unchanged by Project create.
- Creating Job does not broaden technician workspace visibility.

**PASS.**

---

## 10. Desktop findings

- One-click create + navigate is clear on desktop Project header.
- Empty state duplicates CTA — coherent.
- After create, manager on FieldJob may feel “stranded” relative to Project (back → Today).
- Opening Project from More works when `project_id` present.

---

## 11. Mobile findings

- Create is a single full-width-capable button (no form) — **usable** at 390/360 within existing Project workspace layout.
- Success = navigation to FieldJob (mobile FieldJob already verified in prior QA).
- No Project-specific bottom dock; AppShell unchanged.
- Same back-to-Today continuity gap as desktop.

**PASS** for create usability; **PARTIAL** for return-to-Project continuity.

*(Code/CSS inspection; no new browser session in this discovery task.)*

---

## 12. Authz findings

| Check | Status |
|-------|--------|
| `projects.view` for Project | **PASS** |
| `jobs.create` for CTA | **PASS** |
| `jobs.view` for Job / list | **PASS** |
| Quote / CRM / sites links gated | **PASS** |
| Technician scope unchanged by create | **PASS** |
| No role-name security in create path | **PASS** |

---

## 13. Actual gaps

1. **Docs / queue drift:** Completion Plan still lists “FINISH Project → Job handoff” with Done-when “one-click Project→FieldJob”, but that path **already ships**. Remaining doc bullets mix in scheduling defaults, assignment-from-Project, post-Approve automation — those are **not** the same as handoff.
2. **Manager return path:** FieldJob primary back is Today; Project is secondary. Mild **UX continuity** gap after Project-originated create.
3. **Global list cache:** create does not invalidate `jobs-list` query key — possible brief stale list if `/app/jobs` was already mounted.
4. **No toast** on create — acceptable given immediate navigation; optional polish only.

---

## 14. Non-gaps

- Missing createJob API / Project link — **not missing**  
- Missing open path to Job — **not missing**  
- Need Dispatch Board / calendar / assign-at-create — **out of scope**, not blockers  
- Need schedule-at-create for handoff to work — **false**  
- Need new migration / lifecycle / assignment model — **false**  
- Authz broken for handoff — **false**  

---

## 15. Recommended smallest implementation (if any)

**Optional, low-risk UX polish only** (not a new product module):

1. Invalidate `["jobs-list", workspaceId]` (and related) on successful Project create.  
2. When FieldJob is opened with `project_id`, offer primary/secondary back to Project for users who are not on a field-home variant — **or** preserve `from=project` search param from Project create navigation.

Do **not** implement: schedule picker, assign-on-create, post-Approve automation, Dispatch.

Alternatively: **treat handoff as COMPLETE for V1** and only update Product Completion Plan language; move next P0 to Service / Site continuity.

---

## 16. Files that would need changes (if polish chosen)

| File | Change |
|------|--------|
| `apps/web/src/components/projects/ProjectWorkspace.tsx` | Invalidate jobs-list; optional navigate search `from=project` |
| `apps/web/src/components/field/FieldJob.tsx` | Optional back-to-Project when `project_id` / search hint |
| `apps/web/tests/project-workspace.test.tsx` (+ FieldJob tests) | Assert invalidation / back link |
| `Docs/SITE-SECURE-PRODUCT-COMPLETION-PLAN.md` | Reclassify handoff vs schedule/assign scope |

No API/schema changes required for the polish above.

---

## 17. Migration requirement

**NONE.**

---

## 18. Risk level

| Path | Risk |
|------|------|
| Doc-only closure of “handoff” as COMPLETE | **LOW** |
| Cache invalidation + back-to-Project polish | **LOW** |
| Expanding into schedule/assign-at-create | **MEDIUM–HIGH** (scope creep / dispatch) |

---

## 19. Protected-system impact

Discovery touches none. Any polish above must **not** change:

`job_lifecycle.py`, assignment-history semantics, `project_from_quote.py`, authz engine, RLS, Quote/pricing/PDF/CCTV, or createJob request contract fields used today.

---

## 20. Recommendation

**Distinguish clearly:**

| Claim | Status |
|-------|--------|
| Project → Job **create path** | **COMPLETE** |
| Project → Job **handoff** (create → open Job → operable) | **Functionally COMPLETE**; residual **UX continuity** only |
| Completion Plan “FINISH handoff” as next big P0 | **Overstated / stale** relative to code |

**Primary classification:** `HANDOFF_UX_GAP`

**Implementation required:** **YES** only if choosing the small polish; **NO** if product accepts current pattern C and updates the plan.

**Preferred next product move:**  
1) Close or shrink “Project → Job handoff” in the Completion Plan to “optional UX polish”, then  
2) Proceed to the next real P0/P1 capability (**Service Call V1 loop** or explicit **assign-from-manager surfaces** as a *named* separate task — not disguised as handoff).

---

## Journey classification summary

| Dimension | Classification |
|-----------|----------------|
| Create capability | COMPLETE |
| Handoff experience | PARTIAL (UX continuity) |
| Primary gap class | HANDOFF_UX_GAP |
| Migrations | NONE |
| Dispatch/schedule expansion | NOT JUSTIFIED by this audit |
