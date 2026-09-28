# SERVICE CALL V1 LOOP — Discovery / Preflight

**Date:** 2026-09-24  
**Mode:** DISCOVERY ONLY — no product code, no migrations, no DB behavior changes  
**CODE WINS** over stale baseline / completion-plan language  

**Prior closed spine (do not re-open as blockers):**
- Production browser VERIFY: PASS  
- Project Minimum Workspace: PASS  
- Global Jobs List: PASS  
- Project → Job create path: COMPLETE  
- Project → Job handoff: functionally closed for V1 (`Docs/PROJECT-JOB-HANDOFF-DISCOVERY.md`)  

---

## 1. Executive Summary

SITE SECURE already has a **real Service Call domain**, not a greenfield scaffold:

| Layer | Evidence |
|-------|----------|
| Schema | `service_calls` (0018) + `number` SR-##### (0053, deployed) |
| API | list / create / get / patch / `create-job` in `ops_modules.py` |
| UI | `/app/service` master–detail; Customer + Site dossier tabs |
| Job link | `jobs.service_call_id` + `kind=service`; **Job without Project is supported** |
| Technician | Existing assign → Today → FieldJob → lifecycle; FieldJob shows SR number |

**Verdict: PARTIAL — coherent spine exists; V1 loop is incomplete mainly in operational control, resolution truthfulness, history navigability, and post-create Job continuity.**

What already works end-to-end in principle:

Customer/Site → create Service Call → create Job (no Project) → assign → Today → FieldJob → complete  

What breaks product truthfulness:

1. **No Service Call edit / status UI** (`patchServiceCall` unused in web).  
2. **Job complete auto-closes Service Call** with no resolution summary.  
3. **Customer/Site history is thin** (no SR number, no deep link, client-side filter of global list).  
4. **Create Job from Service does not navigate** to FieldJob (unlike Project→Job).  
5. **Catalog keys `service.close` / `service.assign` unused** by API (patch uses `service.edit`).

**Migration for minimum V1: NONE.** Existing schema can represent the loop if resolution is defined as `status=closed` + problem in `description` / Job `completion_notes`, and auto-close is treated as product policy (KEEP, soften, or replace with manual close — API/UI only).

**Contracts / warranties:** not required for reactive Service V1. `service_contracts` remains BACKEND-ONLY → **DEFER**.

---

## 2. Current Service architecture

Truthful model in code:

```
Customer (required) + Site (required, must belong to Customer)
    → Service Call (number SR-#####, status, priority, title, description)
        → zero..many Jobs (service_call_id, kind=service, project_id NULL OK)
            → assignment → Today → FieldJob → job_lifecycle
        → status may become in_progress on create-job
        → status may become closed when linked Job completes
```

This is **not** forced through Project. Installation remains Quote→Project→Job (`kind=installation`, `project_id` set). Service reuses the same Job domain with different provenance fields.

Supporting tables:

| Object | Role in V1 |
|--------|------------|
| `service_calls` | Primary reactive ticket |
| `jobs.service_call_id` | Provenance / link |
| `service_contracts` | Unused product surface — DEFER |
| `warranties` | Parallel thin CRUD — optional context, not Service dependency |

---

## 3. Routes / UI inventory

| Surface | Path / component | Classification |
|---------|------------------|----------------|
| Global Service Calls | `/app/service` → `routes/app/service/index.tsx` | **PARTIAL** — list + inline detail |
| Dedicated `/app/service/$id` route | — | **NOT STARTED** (not required if master–detail hardened) |
| Customer dossier Service tab | `CustomerProfile.tsx` `ServicePanel` | **PARTIAL** — create + static list |
| Site dossier Service tab | `SiteDossier.tsx` | **PARTIAL** — list + related Jobs; weak labels/links |
| FieldJob Service context | `FieldJob.tsx` loads `getServiceCall` when `service_call_id` | **PARTIAL** — shows SR number only |
| Nav | `app-nav.ts` live `/app/service` gated by `service.view` + feature `service` | **COMPLETE** |
| Contracts UI | — | **NOT STARTED** / DEFER |
| Warranty UI | API client exists; dossier lists warranties | **PARTIAL** (separate completion item) |

**Legacy / dead UI:** none found targeting retired Service Call flows. Quote “service” product kind is catalog/labor — unrelated.

---

## 4. API inventory

Router: `apps/api/app/routers/ops_modules.py`

| Method | Endpoint | Authz | Classification |
|--------|----------|-------|----------------|
| GET | `/service-calls` | `service.view` | **COMPLETE** (q=title ilike; status filter; **no** customer_id/site_id/number search) |
| POST | `/service-calls` | `service.create` + site belongs to customer | **COMPLETE** |
| GET | `/service-calls/{id}` | `service.view` + linked_jobs | **COMPLETE** |
| PATCH | `/service-calls/{id}` | `service.edit` | **BACKEND-ONLY from UI** — client method exists, **zero web callers** |
| POST | `/service-calls/{id}/create-job` | `jobs.create` | **COMPLETE** — seeds checklist, may set call `in_progress`, audit + site timeline |

Warranties: list/create in same router (`warranties.view` / `warranties.issue`).

**service_contracts:** **no FastAPI surface** (backup scripts only).

Tests: `test_dispatch_ops.py` asserts create-job preserves `service_call_id` / customer / site / priority / title. Domain route list in `test_domain_api.py`.

---

## 5. Database / schema inventory

### CURRENT SCHEMA — `service_calls` (0018 + 0053)

| Column | Notes |
|--------|-------|
| `id` | uuid PK |
| `workspace_id` | NOT NULL, CASCADE |
| `number` | NOT NULL text, unique per workspace (`SR-#####`) |
| `status` | enum `open` \| `in_progress` \| `waiting` \| `closed` (default `open`) |
| `priority` | enum `low` \| `normal` \| `high` \| `critical` (default `normal`) |
| `customer_id` | NOT NULL, RESTRICT |
| `site_id` | NOT NULL, RESTRICT |
| `system_id` | nullable → systems |
| `title` | NOT NULL |
| `description` | nullable |
| `created_by` | nullable profile |
| `created_at` / `updated_at` | timestamps + trigger |

**Not present:** resolution_summary, resolved_at, resolved_by, warranty_id, project_id, assigned_to on the call itself.

### Jobs relationship

- `jobs.service_call_id` nullable FK (SET NULL on delete) — added in 0018  
- `jobs.project_id` nullable  
- `jobs.kind` includes `service` (and `installation`, `maintenance`, …)  
- No UNIQUE on `service_call_id` → **many Jobs per Call allowed**

### POSSIBLE V1 GAP (schema)

Dedicated resolution audit fields would improve “what was fixed?” but are **not required** if V1 accepts:

- problem = `title` + `description`  
- visit result = Job `completion_notes` + checklist  
- closed = `status=closed`  

---

## 6. Service Call numbering

Migration **0053** deployed and previously production-verified.

| Check | Result |
|-------|--------|
| Column `service_calls.number` | Present, NOT NULL |
| Generation | BEFORE INSERT trigger → `SR-` + `next_code(workspace, 'service_call')` padded 5 |
| Uniqueness | UNIQUE `(workspace_id, number)` |
| UI list/detail | Displays `number` (ltr) on `/app/service` |
| Search by number | **MISSING** — list `q` filters `title` only |
| Customer/Site history | **Usually omits number** |
| UUID as user identity | Not primary in Service UI; links use id in routes/params only |

**Classification: PASS** for generation/display on primary surface; **PARTIAL** for search/history identity.

---

## 7. Current lifecycle / status semantics

### Exact statuses

`open` → `in_progress` → `waiting` → `closed` (enum only; **no ordered FSM service**).

### Behavior

| Mechanism | Behavior |
|-----------|----------|
| Create | Always `open` |
| create-job | If call was `open`, best-effort PATCH → `in_progress` |
| Job `complete` | If Job has `service_call_id`, best-effort PATCH call → `closed` |
| PATCH API | Accepts any enum value via `ServiceCallPatch.status` — **CRUD, not transition-guarded** |
| Reopen | Possible via PATCH to non-closed status; **no dedicated reopen** |
| Frontend | **No status controls** on `/app/service` |

### Sufficient for V1?

**Yes, with minimal hardening** — do **not** invent a Job-like FSM. Need:

- Visible status change / close action (`service.edit` or honor `service.close`)  
- Product decision on auto-close (see §14)  

---

## 8. Customer / Site integrity

| Question | Answer |
|----------|--------|
| Customer required? | **Yes** (DB NOT NULL + API) |
| Site required? | **Yes** (DB NOT NULL + API) |
| Call without Site? | **No** |
| Site must belong to Customer? | **Yes on create** — API queries `sites` with `id` + `workspace_id` + `customer_id` |
| Validated server-side? | **Yes** for create (and warranties create same pattern) |
| UI-only assumption? | UI also scopes sites by customer; **server is authoritative** |
| Patch can swap Customer/Site? | **No** — patch body forbids those fields |
| Archived/deleted Site | ON DELETE **RESTRICT** — cannot delete Site with calls |
| Open from Customer dossier? | Create yes; list rows **static** (no navigate to Service detail) |
| Open from Site dossier? | List only; CTA to `/app/service` exists elsewhere in Field tab |

**Customer A + Site of Customer B via API create:** blocked → **PASS**.

**Integrity residual:** list has no server `customer_id`/`site_id` filter (dossier client-filters up to 100) — scalability/consistency gap, not cross-tenant integrity. Cross-workspace denied by workspace_id + RLS.

**CUSTOMER/SITE INTEGRITY: PASS** (create path). Soft FIX later: server-side list filters.

---

## 9. Service Call → Job

| Aspect | Finding |
|--------|---------|
| API | `POST .../service-calls/{id}/create-job` |
| Frontend | Button `he.createFieldJob` on detail pane |
| DB | `jobs.service_call_id` |
| Reuse | Same `jobs` table / FieldJob / lifecycle — **no second Job system** |
| Project | **Not set** — intentional |
| Inheritance | customer_id, site_id, priority from call; title default = call title; `kind=service` |
| Side effects | Default Hebrew checklist; optional schedule on body; timeline `service` event |

**Classification: PARTIAL** — backend complete; UI create works but **does not navigate** to Job and does not invalidate global jobs-list cache.

---

## 10. Job-without-Project finding

**JOB WITHOUT PROJECT: SUPPORTED**

Evidence:

1. Schema: `jobs.project_id` nullable (0017).  
2. `create_job_from_service_call` omits `project_id`.  
3. Jobs list / FieldJob tolerate null project (Project link only when present).  
4. Installation path sets `project_id` + `kind=installation` separately.

**Do not force Service through fake Projects.**

---

## 11. Job provenance

| Field | Installation Job | Service Job |
|-------|------------------|-------------|
| `project_id` | set | usually null |
| `service_call_id` | null | set |
| `kind` | `installation` | `service` |
| `customer_id` / `site_id` | set | set |

**JOB PROVENANCE: SUFFICIENT** to distinguish install vs service without a parallel workflow.

Optional clarity (not V1 blocker): surface `kind` + SR number more strongly on Jobs list.

---

## 12. Service Call → Job cardinality

**Actual: one Service Call → zero or many Jobs**

- No unique constraint on `jobs.service_call_id`  
- GET returns `linked_jobs` (up to 20, newest first)  
- UI always offers create-job; “open linked” uses `linked[0]`  

**Flag:** schema/API are many; UI soft-assumes “primary = newest” without preventing multiples. Acceptable for V1 (return visits). Document as **many**.

---

## 13. Technician workflow

| Step | Status |
|------|--------|
| Service Job created | WORKS |
| Assign via existing Job assign | WORKS (not Service-assign) |
| Appears in Today when assigned | WORKS (same Today query) |
| FieldJob opens | WORKS |
| Lifecycle | WORKS (PROTECTED — do not change) |
| Context: Customer/Site | WORKS (existing FieldJob) |
| Context: SR number | WORKS |
| Context: reported problem text | **PARTIAL** — Job title copies call title; call `description` not shown on FieldJob |
| Project context | Only if `project_id` — N/A for service jobs |

**TECHNICIAN SERVICE CONTINUITY: PARTIAL** (usable; missing problem description on FieldJob is small UX gap).

Assigned-scope list filter on GET `/service-calls` reuses `apply_assigned_job_list_filter` (id/site_id in assignment set). Technicians with only Job assignments may see empty global Service list — usually OK if they work from Today/FieldJob, but **VERIFY** if managers expect techs to browse Service.

---

## 14. Job completion vs Service resolution

### CURRENT BEHAVIOR

**A — automatic resolve:** On Job `complete`, if `service_call_id` set, API best-effort PATCHes Service Call `status=closed` (`jobs.py`). Exceptions swallowed.

Implications:

- Completed visit **closes** the customer issue ticket even if issue persists.  
- Multiple Jobs: completing **any** linked Job can close the Call.  
- No resolution narrative written to Service Call.

### MINIMUM V1 RECOMMENDATION

Prefer **D — manual manager close** (or confirm) for truthful ops:

- Job complete = visit done  
- Service Call close = customer issue resolved (manager sets status + optional note in `description` or a future field)

If keeping auto-close for V1 speed: document it as known policy and ensure managers can reopen via status PATCH UI.

**Do not change `job_lifecycle.py` transition rules** — only the side-effect PATCH (or UI around it) is in scope for a future FINISH package.

---

## 15. Resolution / closure

| Capability | Classification |
|------------|----------------|
| resolved/closed status | **PARTIAL** — `closed` exists; set auto or via unused PATCH |
| resolution summary | **MISSING** (schema + UI) |
| resolved_at / resolved_by | **MISSING** |
| notes/history | **PARTIAL** — `description`, site timeline events, Job completion_notes |
| reopen | **PARTIAL** — PATCH possible; no UI |

**Can a manager answer “what was the issue and how was it resolved?”**

Today: **weakly** — title/description + open FieldJob completion notes. Not one coherent Service resolution record.

**Smallest missing capability:** manager-visible **close action** + place to read visit outcome (link Job notes is enough for V1 without migration).

**SERVICE RESOLUTION: PARTIAL / NOT STARTED on UI**

---

## 16. Global Service Calls list

`/app/service` list panel:

| Aspect | Status |
|--------|--------|
| Number | Yes |
| Status | Yes (Hebrew labels) |
| Priority | Yes |
| Customer / Site | Yes (enriched names) |
| Opened date / age | **No** |
| Linked Job state | **Only in detail**, not list row |
| Search | Title only |
| Status filters | API supports; **UI no filter chips** |
| Open action | Select row → detail pane |
| Empty / loading / error | Present |
| Permissions | `RequirePermission service.view` + create gated |
| Responsive | Stacked layout &lt;1024; detail below list |

**SERVICE CALL LIST: PARTIAL**

---

## 17. Service Call detail / workspace

Inline aside on `/app/service` (not a separate route):

Supports: number, title, status, priority, customer/site, description, linked Jobs links, create Job.

Missing: edit fields, status transitions, close, navigate-after-create-job, assignment of Job from this pane, age, warranty chip.

**V1 does not need a large Project-like workspace** — harden this pane.

**SERVICE CALL DETAIL: PARTIAL**

---

## 18. Customer service history

`CustomerProfile` Service tab:

- Client-filters `listServiceCalls` by `customer_id`  
- Shows title + status  
- Create sheet (title + site)  
- Rows `is-static` — **no link**, **no SR number**, **no linked Jobs**, **no resolution**

**CUSTOMER SERVICE HISTORY: PARTIAL**

---

## 19. Site service history

`SiteDossier` Service tab:

- Client-filters by `site_id`  
- Title + priority + date; Status component with **raw status string** (weaker i18n than Service page)  
- Related site Jobs listed with FieldJob links  
- No SR number / no link to Service detail / no resolution text  

History tab also merges service events chronologically (thin).

**SITE SERVICE HISTORY: PARTIAL**

Minimum V1 gap: show **number + status + open deep-link** (query/select on `/app/service` or future `$id`).

---

## 20. Warranty relationship

| Check | Finding |
|-------|---------|
| Service Call → Warranty FK | **None** |
| Warranty on Customer/Site | Listed separately |
| Automatic coverage decision | **None** |
| Service V1 depends on Warranty? | **No** |

**WARRANTY DEPENDENCY: NONE** (Warranty remains its own Product Completion item — OPTIONAL context later).

---

## 21. `service_contracts` status

| Layer | Present? |
|-------|----------|
| Schema + enums + RLS | Yes (0018) |
| API | **No** |
| UI | **No** |
| Service Call dependency | **No** |
| Business logic usage | Backup/inventory only |

**SERVICE CONTRACTS: DEFER** (BACKEND-ONLY / unused product). Do not build UI.

---

## 22. Authz

Catalog permissions: `service.view`, `service.create`, `service.edit`, `service.close`, `service.assign`.

| Action | Server |
|--------|--------|
| List / get | `service.view` |
| Create | `service.create` |
| Patch | `service.edit` |
| Create Job | `jobs.create` (not a service.* key) |
| Close | **No `service.close` check** — edit or Job-complete side effect |
| Assign Service Call | **`service.assign` unused** — Job assign uses `jobs.assign` |

UI `can()` gates create / create-job presentation only.

Technician: typically `service.view`; create/edit vary by role grants. Work happens via Job scope.

**AUTHZ: PASS** for authorize()-authoritative pattern on implemented endpoints. Soft gap: unused `service.close` / `service.assign` keys (catalog drift — FIX later or wire close to `service.close`).

---

## 23. RLS / tenancy

- `service_calls` FORCE RLS; select via membership + assigned scope / site visibility (includes assignment to `service_call` resource type).  
- Insert role allow-list includes technician roles.  
- Update managerial / assigned / site visible.  
- Delete privileged.  
- Workspace isolation via `workspace_id` in API params + RLS.  
- Create Job inherits same workspace customer/site.  
- Cross-workspace denial: standard pattern.

**RLS: PASS** for V1 (no redesign). Note: assignment resource type `service_call` exists in RLS helpers but product rarely assigns Service Calls directly.

---

## 24. Desktop / mobile / RTL

CSS: `.ss-service-layout` single column until 1024px; detail pane; 44px rows; RTL via app shell.

Usability notes (code review, not new visual polish cycle):

- Mobile: list then detail stacked — workable  
- Create panel uses ModuleKit — consistent  
- Detail actions may need scroll on 360px — acceptable  
- Hebrew copy present (`he.service*`)  

**No generic polish recommended** — only functional gaps in §25.

---

## 25. Current gaps

1. No Service Call edit/status/close UI (PATCH unused).  
2. Auto-close on Job complete without resolution narrative / multi-Job safety.  
3. Create-job does not navigate to FieldJob / refresh jobs list.  
4. History on Customer/Site lacks number + deep link.  
5. List search ignores `number`; no status filter UI; no customer/site server filters.  
6. FieldJob omits Service `description`.  
7. Catalog `service.close` / `service.assign` unused.  
8. Assigned-scope filter reuse may empty tech Service list (VERIFY).  

---

## 26. Non-gaps

- Job-without-Project for service — **already supported**  
- Service Call numbering — **works**  
- Customer/Site required + create integrity — **works**  
- create-job API + checklist + timeline — **works**  
- Reuse of Job lifecycle / Today / FieldJob — **works**  
- Separate Job system for service — **not needed**  
- Contracts / SLA / dispatch / calendar / maps — **out of scope**  
- Project→Job install path — **V1 COMPLETE** (separate)  

---

## 27. KEEP / FINISH / FIX / VERIFY / DEFER / REMOVE

| Item | Action |
|------|--------|
| Job lifecycle / assignment / Today / FieldJob | **KEEP** |
| `jobs.service_call_id` + create-job API | **KEEP** |
| Service numbering 0053 | **KEEP** |
| `/app/service` master–detail shell | **KEEP** / **FINISH** harden |
| Customer/Site Service tabs | **FINISH** (links + number) |
| Status/close UX + resolution policy | **FINISH** |
| Create-job → open FieldJob continuity | **FINISH** |
| Auto-close side effect | **VERIFY** product policy → keep or soften |
| List `customer_id`/`site_id`/number search | **FIX** (small API) |
| FieldJob show call description | **FIX** (optional small) |
| `service.close` catalog drift | **FIX** or ignore for V1 |
| Assigned filter on service list | **VERIFY** |
| `service_contracts` | **DEFER** |
| Warranties automation | **DEFER** / separate item |
| Dispatch / calendar / SLA / contracts UI | **DEFER** |
| Dead Service UI | **REMOVE/RETIRE** — none identified |

**Project → Job (install):** **KEEP / V1 COMPLETE**  
Optional polish (not Service, not P0): jobs-list invalidate after Project create; FieldJob→Project link clarity — **OPTIONAL BACKLOG**.

---

## 28. Minimum Service V1

Smallest coherent loop matching architecture:

1. Global Service Calls list (existing) with SR identity  
2. Create Call: Customer + Site + problem (title/description) + priority  
3. Operational detail: view + **change status / close**  
4. When field visit needed: **create Job** (no Project) → **open FieldJob**  
5. Assign with existing Job assignment  
6. Technician: Today → FieldJob → existing lifecycle  
7. Manager: confirm issue resolved (manual close preferred; auto-close documented if kept)  
8. History: Customer + Site show SR + status + link back to Call  

Out of V1: contracts, SLA, dispatch board, warranty automation, dedicated resolution schema, large Service workspace route.

---

## 29. Required frontend changes (future package — not now)

- Service detail: status select / close; optional edit description  
- create-job success → navigate `/app/jobs/$jobId` + invalidate jobs queries  
- Customer/Site Service rows: show `number`, navigate to Service (select id or `?call=` )  
- Optional: status filter chips; show age; FieldJob description line  

---

## 30. Required backend changes (future package — not now)

- Optional: `customer_id` / `site_id` query params on list; `q` match `number`  
- Optional: stop or gate auto-close on Job complete; or require `service.close` for status=closed  
- Do **not** change `job_lifecycle.py` transitions  
- Do **not** add contracts API  

---

## 31. Migration requirement

**MIGRATION REQUIRED: NONE**

Existing columns represent Customer/Site/problem/status/priority/number and Job provenance. UI/API-only work can close Minimum Service V1.

If a later iteration requires immutable resolution audit (`resolution_notes`, `resolved_at`, `resolved_by`), that would be a **separate** small migration — not needed to start V1 FINISH.

---

## 32. Risks

| Risk | Level | Note |
|------|-------|------|
| Auto-close hides unresolved issues | **MEDIUM** | Product policy |
| Multi-Job close race | **LOW–MEDIUM** | Any complete closes call |
| Touching Job complete side effect | **MEDIUM** | Near protected lifecycle; keep change minimal |
| Scope creep into contracts/dispatch | **HIGH if allowed** | Explicitly DEFER |
| Authz catalog drift | **LOW** | Unused keys |

**Overall package risk: MEDIUM** (ops honesty), not schema-hard.

---

## 33. Protected-system impact

| System | Impact |
|--------|--------|
| pricing / quote lifecycle / PDF / snapshot / public | **None** |
| CCTV / System Design / E1–E2 | **None** |
| authz engine / RLS redesign | **None** (maybe use existing `service.close`) |
| `job_lifecycle.py` transitions | **Do not modify** |
| assignment-history semantics | **Do not modify** |
| `project_from_quote` / Project→Job install | **Do not modify** |
| Job complete service_call side-effect | **Only place near Jobs** — treat carefully |

---

## 34. Recommended smallest implementation package

**One package: “Service Call operational close-loop”**

1. Harden `/app/service` detail: status/close (+ edit description if trivial)  
2. Service → Job handoff UX: navigate to FieldJob after create-job  
3. Customer + Site history: SR number + open Call  
4. Decide auto-close: keep documented **or** soft-disable in favor of manual close  
5. Small list API filters (customer/site/number) to make dossier truthful at scale  

No contracts. No new Job system. No migration. No FieldJob redesign.

---

## 35. Recommended implementation sequence

1. Product decision: auto-close vs manual close (1 decision)  
2. Service detail status/close UI + PATCH wiring  
3. create-job → navigate FieldJob + query invalidation  
4. Customer/Site history links + numbers  
5. List filters / number search  
6. Optional: FieldJob show call description; auto-close adjust  

**NEXT IMPLEMENTATION TASK (single):**  
`FINISH Service Call operational detail: status/close UI + create-job → FieldJob navigation`  
(history links can ship in same PR if small; do not expand to contracts/warranties.)

---

## Journey step matrix (code)

| # | Step | Status |
|---|------|--------|
| 1 | create Service Call | **WORKS** |
| 2 | associate Customer | **WORKS** |
| 3 | associate Site | **WORKS** |
| 4 | reported problem | **WORKS** (title/description) |
| 5 | priority | **WORKS** |
| 6 | see number | **WORKS** (primary UI) |
| 7 | view Call | **WORKS** (inline detail) |
| 8 | edit Call | **MISSING** (API only) |
| 9 | change operational state | **PARTIAL** (auto only / API) |
| 10 | create/link field Job | **WORKS** |
| 11 | open that Job | **PARTIAL** (link exists; create doesn’t navigate) |
| 12 | assign Job | **WORKS** (existing) |
| 13 | tech Today | **WORKS** |
| 14 | FieldJob | **WORKS** |
| 15 | Job lifecycle | **WORKS** |
| 16 | manager sees field result | **PARTIAL** (FieldJob/completion_notes; not on Call) |
| 17 | resolve/close Call | **PARTIAL** (auto-close / no UI) |
| 18 | Customer history | **PARTIAL** |
| 19 | Site history | **PARTIAL** |

---

*End of discovery. No product code, migrations, or database behavior were changed while authoring this document.*
