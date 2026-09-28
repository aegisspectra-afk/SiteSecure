# SITE SECURE — Product Completion Plan

**Role:** Execution priorities from Master Baseline → coherent V1  
**Mode:** Product planning only — no implementation in this document  
**Source of truth:** `Docs/SITE-SECURE-MASTER-PROJECT-BASELINE.md` (updated post-deploy)  
**Deploy evidence:** `Docs/SUPABASE-MIGRATION-DEPLOYMENT-2026-09-24.md`  
**Generated:** 2026-09-24  

---

## 1. Executive decision summary

SITE SECURE’s commercial core (Customer → Quote Stages 1–4 → Share/Send → Approve → PDF/Revise) is **KEEP**. CCTV engineering + Durable Design **R1/R2/R3** and Equipment Intent **E2** are **PRODUCTION VERIFIED** on SiteSecureV1. Migrations **0052–0056 are no longer blockers**.

The product is **not** V1-complete yet because **Service continuity** (reactive Service Call → Job → resolution → history) and thin Warranty/Site polish still leave gaps after the installation spine.

**Installation / operations spine (Project → Job → Today → FieldJob):** functionally coherent and **V1 COMPLETE** for Project→Job (2026-09-24). Evidence: `Docs/PROJECT-JOB-HANDOFF-DISCOVERY.md`, Project workspace PASS, Jobs list PASS, production browser VERIFY PASS.

**Primary completion strategy:** close **Service Call V1 loop** next (see `Docs/SERVICE-CALL-V1-DISCOVERY.md`), then commercial honesty edges, then System Design expansion (E3).

**E3 is not the next implementation priority.** Catalog-backed CCTV Design→Apply is already live. E3 helps empty-catalog / intent-only sales — valuable later, not required for a first coherent daily product.

**Small VERIFY items (P0) — CLOSED 2026-09-24:** browser E2E for System Builder reopen and Technician Today → FieldJob both **PASS**. Evidence: `Docs/PRODUCTION-BROWSER-VERIFICATION-2026-09-24.md`.

---

## 2. What “SITE SECURE V1 complete” means

V1 is **not** “every idea built.” It is true when all of the following hold:

1. A workspace can invite/onboard users with roles that enforce commercial vs field permissions.  
2. A salesperson can create/manage **Customer** and **Site**.  
3. A salesperson can build a professional **Quote** (manual and/or catalog; optional CCTV Design).  
4. Quote can be **Previewed**, **Shared**, **Sent**, customer **Approve/Reject**, staff **PDF** and **Revise**.  
5. An **approved Quote with Site** becomes a usable **Project** without leaving the product.  
6. A manager can see **active Projects/Jobs** and assign work.  
7. A technician can open **Today**, enter an assigned **Job**, run lifecycle to **Complete**.  
8. A **Service Call** can be created against Customer/Site, become a Job, and leave readable history.  
9. Simple **Warranty** records can be attached to Customer/Site (not full warranty ops).  
10. Tenant isolation / RLS / quotes.view|edit|view_cost hold under normal use.  
11. Critical migrations **0052–0056** remain verified (already true on SiteSecureV1).  
12. Product language matches capability (Tasks ≠ Calendar; Intent-only ≠ Apply until E3).  
13. Commercial fields do not imply behavior they do not implement (`vat_eligible`).  
14. Single-workspace (or explicit switcher) assumption is **documented and safe**.  
15. Protected money/lifecycle systems are not casually redesigned.

---

## 3. Stable / protected core (KEEP)

Do **not** broadly redesign these unless a concrete defect is found:

| Area | Action | Note |
|------|--------|------|
| Authentication / session | KEEP | |
| AppShell / nav spine | KEEP | |
| Customers | KEEP | Strongest CRM surface |
| Catalog (+ import, cost gate) | KEEP | |
| Quote Builder Stages 1–4 | KEEP / **FREEZE** | Guided + structural separation recently completed |
| Server pricing | KEEP / PROTECTED | |
| Preview / Share / Send / Public approve | KEEP / PROTECTED | |
| Quote Revise / versioning / PDF snapshot (A3) | KEEP / PROTECTED | |
| CCTV sizing + recommend math | KEEP / PROTECTED | |
| Durable Design R1/R2/R3 (catalog Apply) | KEEP | Production verified |
| Equipment Intent E1/E2 | KEEP | E2 production verified; Apply still catalog-only |
| Company settings | KEEP | |
| Quote mobile dock architecture | KEEP / PROTECTED | |

### Quote Builder freeze

Guided Workspace, German-grade quality, and structural Stage 2≠3 separation are done. Further Quote Builder work only for:

- specific bugs  
- specific workflow gaps (e.g. Stage 4 defaults hydration)  
- Design/E3 integration when chosen  

**Not** another visual polish pass.

---

## 4. Current blockers

| ID | Type | Status | Notes |
|----|------|--------|-------|
| ~~Undeployed 0052/0054/0055/0056~~ | Historical | **RESOLVED 2026-09-24** | Do not list as current |
| ~~Browser E2E: System Builder reopen~~ | Verification | **CLOSED / PASS 2026-09-24** | `PRODUCTION-BROWSER-VERIFICATION-2026-09-24.md` |
| ~~Browser E2E: Technician Today → FieldJob~~ | Verification | **CLOSED / PASS 2026-09-24** | Same report; 0052 assignment regression green |
| Ops continuity after Approve | Product gap | Open | Project/Field/Service depth |
| E3 Intent-only Apply | Capability gap | **NOT STARTED** | Not a V1 ops blocker |
| Multi-workspace switcher | Ambiguity | Open | Must decide: document single-active **or** finish switcher |
| `vat_eligible` commercial honesty | Ambiguity | Open | Field implies VAT behavior pricing does not use |

No production migration access is required for the next completion wave on this target.

---

## 5. Product completion matrix (planning table)

| Capability | Current | Action | Priority | Missing | Done when |
|------------|---------|--------|----------|---------|-----------|
| Auth / AppShell / Customers / Catalog | COMPLETE | KEEP | — | — | Remains stable |
| Quote Stages 1–4 + lifecycle + PDF | COMPLETE | KEEP | — | Edge hydration only | Freeze holds |
| Pricing / Share / Send / Public | COMPLETE | KEEP | — | — | Protected |
| CCTV math + catalog Design Apply | COMPLETE + PROD VERIFIED | KEEP | — | — | J3 browser reopen PASS 2026-09-24 |
| R2 Design reopen (browser) | **PASS** | KEEP | — | — | Closed 2026-09-24 browser VERIFY |
| Technician Today → FieldJob (browser) | **PASS** | KEEP | — | — | Closed 2026-09-24 browser VERIFY |
| Project workspace (min) | **PASS** | KEEP | — | — | Closed 2026-09-24; Jobs primary; open FieldJob |
| Jobs list / manager visibility | **PASS** | KEEP | — | — | Closed 2026-09-24; `/app/jobs` operational list |
| Project → Job handoff | **V1 COMPLETE** | **KEEP** | — | — | Create→open Job works; authz PASS; assignment/schedule-at-create NOT required. Evidence: `PROJECT-JOB-HANDOFF-DISCOVERY.md` |
| Project / Job UX continuity (optional) | OPTIONAL BACKLOG | DEFER | — | Cache invalidate after Project Job create; FieldJob→Project contextual link | **Not** P0/P1 completion blockers |
| Field lifecycle (code) | PARTIAL but real + browser PASS | KEEP | — | — | Protected transitions; VERIFY closed |
| Service Call V1 loop | **PARTIAL** (spine real) | **FINISH** | **P0** | Status/close UI; create-job→FieldJob nav; Customer/Site history links | J2 coherent; evidence: `SERVICE-CALL-V1-DISCOVERY.md` |
| Site dossier V1 | PARTIAL | FINISH | P1 | Delete UX; related quotes/projects/jobs/service | Site is operational hub |
| Warranties (simple) | PARTIAL thin | FINISH | P1 | Honest simple CRUD + site/customer link | Record exists; no ops fantasy |
| Leads funnel | PARTIAL | KEEP | P2 | Deeper CRM | Lead→Customer→Quote remains usable; no Salesforce |
| Tasks | PARTIAL (misnamed calendar) | FIX | P1 | Honest naming / copy | UI says Tasks; Calendar deferred |
| Stage 4 company defaults | PARTIAL | FINISH | P1 | Hydrate payment/warranty/general from settings | New quote shows company defaults when set |
| `vat_eligible` | PARTIAL dangerous | FIX | P1 | Semantics or remove from meaning | Field matches pricing or is non-commercial metadata |
| Multi-workspace | NOT STARTED switcher | FIX/DEFER | P1 | Explicit product rule | Documented single-active **or** switcher shipped |
| Profile display name | PARTIAL | FINISH | P2 | Reliable `patchMe` name | Name saves/displays |
| Avatar upload | UI-ONLY | DEFER | P3 | Upload | Static OK for V1 |
| Equipment Intent E3 | NOT STARTED | DEFER | P2 | Product rules then Apply | Catalog path remains default |
| Alarm/Access/Intercom engines | SCAFFOLDED | DEFER | P3 | Engines | CCTV-only market OK |
| `service_contracts` table | BACKEND-ONLY | DEFER | P3 | Product surface | No UI until contracts product decided |
| Procurement / inventory / Stripe / maps / AI / native | NOT STARTED | DEFER | P3 | — | Out of V1 |
| Notifications bell | DEFERRED | DEFER | P3 | — | — |

**Classification counts (matrix + explicit decisions below):**  
KEEP **19** · FINISH **5** · FIX **3** · VERIFY **0** · DEFER **13** · REMOVE/RETIRE **2** · INVESTIGATE **1**  
(VERIFY V-A/V-B + Project workspace + Jobs list + Project→Job V1 COMPLETE closed 2026-09-24. Service discovery: `SERVICE-CALL-V1-DISCOVERY.md`. Some rows share action classes; see §13–14 for retire/investigate.)

---

## 6. Core journey gap analysis

| Journey | Current state | Breakpoint | Missing | Priority | Done when |
|---------|---------------|------------|---------|----------|-----------|
| **J1** Lead→Customer→Site→Quote→Send→Approve→Project→Job→Complete | **Project→Job V1 COMPLETE** | Optional UX continuity only | Non-blocker polish | KEEP | Full install path without external tools |
| **J2** Customer→Service Call→Job→Tech→Resolution→History | **PARTIAL** (API+UI spine) | Status/close UI; create-job nav; history deep-links | Resolution policy + history | **P0** | Call→Job→history visible; see Service discovery |
| **J3** Customer→CCTV Design→Equipment→Quote→Send | **Works live** (catalog Apply + browser reopen PASS) | Intent-only cannot Apply | E3 later | KEEP / P2 E3 | Reopen PASS 2026-09-24; catalog Apply remains default |
| **J4** Manager→Dashboard→Attention→Project/Job→Assign | Jobs list PASS | Assignment-from-list still deferred | Assign UX polish | DEFER assign-from-list | Manager finds Jobs; assign remains existing FieldJob flows |
| **J5** Technician→Today→Job→Lifecycle→Complete | **Browser PASS** | — | — | KEEP | VERIFY closed 2026-09-24 |

**Biggest product-flow breakpoint today:**  
**Service Call V1 loop** (operational close + history), not System Design and not Project→Job install (closed).

---

## 7. Operations completion

### Can a company go from approved Quote → installation → service inside SITE SECURE?

**Mostly for install; partial for service.** Quote→Approve is strong. Project-from-quote rules exist (needs Site). Project→Job create/open is **V1 COMPLETE**. FieldJob lifecycle is real. Service Calls exist with numbers and create-job **without Project**.  
**Remaining ops fallout risk:** Service status/close UI, resolution honesty vs Job auto-close, and Customer/Site history deep-links — not install handoff.

### Projects — minimum professional V1 workspace

**KEEP / PASS (closed 2026-09-24).** Do **not** build full FSM/timeline/documents suite.

Minimum:

| Must have | Why |
|-----------|-----|
| Customer + Site + source Quote links | Context |
| Status (simple set already in domain) | Progress |
| List of related Jobs + **Start/open installation Job** | Continuity |
| Navigation to FieldJob | Handoff |
| Obvious empty states | Usability |

Defer for post-V1: rich timeline, document vault, multi-phase Gantt, full project FSM UI.

### Field Operations — Jobs list decision

**Yes — V1 Jobs list is now LIVE (`/app/jobs`, CLOSED/PASS 2026-09-24).**

Evidence: `Docs/JOBS-LIST-MANAGER-VISIBILITY-IMPLEMENTATION.md`

Evidence: baseline — Job is deep-link only (`/app/jobs/$id`); managers cannot browse work; Today is tech-scoped. Without a list, assignment and recovery of lost deep links fail daily ops.

Keep:

- `/app/today` for technicians  
- FieldJob lifecycle (PROTECTED)  
- Assignments with `unassigned_at` (deployed)

**Jobs list:** LIVE / PASS (`/app/jobs`).  

**Optional Project/Job polish (BACKLOG — not V1 blockers):**

1. Invalidate canonical global Jobs-list query after Project Job creation  
2. Direct FieldJob → Project contextual navigation when `project_id` exists  

### Tasks decision

**C + honest A:** Keep as **Tasks** (lightweight to-do). **True Calendar = DEFER (P3).**  
**FIX (P1):** Ensure copy/nav never promises “calendar product.” Permission key may remain `calendar.*` internally — user-facing Hebrew should say משימות.

---

## 8. CRM / Sites completion

### Customers

**KEEP.** Strong enough for V1.

### Leads

**KEEP AS-IS (P2 deepen only if demanded).**  
Lead → Customer → Quote is enough. Do not expand into Salesforce. Avoid new CRM modules.

### Sites — minimum V1 dossier

**FINISH (P1):**

1. Delete/archive UX gap closed (API exists).  
2. Related Quotes / Projects / Jobs / Service Calls reachable from dossier.  
3. Keep Site optional on Send; required for Project-from-quote (confirm policy — already coherent).

Defer: full equipment registry, maps, as-built packs.

---

## 9. Service / warranty completion

### Service V1 meaning

**Authoritative discovery:** `Docs/SERVICE-CALL-V1-DISCOVERY.md` (2026-09-24). **CODE WINS.**

**Current state: PARTIAL** — schema/API/UI spine exists (list, create, number, create-job without Project, FieldJob SR context). Gaps: status/close UI, create-job→FieldJob navigation, history deep-links, resolution honesty (Job complete currently auto-closes Call).

**FINISH (P0) minimum loop** (no migration; no contracts):

- Create Service Call with Customer + Site (already works; integrity PASS on create)  
- Number visible (0053 PASS)  
- Operational detail: change status / close  
- Create Field Job when visit required → open FieldJob (reuse Job domain)  
- Manager resolution vs visit completion (policy: prefer manual close; auto-close is current code)  
- Site + Customer history: SR number + open Call  

Not required for V1: SLA engines, recurring contracts UI, parts consumption, warranty automation, Job-without-Project workarounds (already supported).

### Warranties

**FINISH (P1) = simple records only** (list/create/link Customer/Site).  
**Not** full warranty operations.

### `service_contracts`

**DEFER (P3).** Backend-only table with no product surface.  
Do not build UI “because the table exists.” Revisit only with a contracts product thesis. Optional later: RETIRE if unused permanently.

---

## 10. Commercial edge completion

| Item | Decision | Priority |
|------|----------|----------|
| Stage 4 company defaults hydration | **FINISH** — when company payment/warranty/general terms exist in settings, new/open draft Stage 4 shows them (not endless “לא הוגדר” when defaults exist) | P1 |
| `vat_eligible` | **FIX** — choose **B for V1 speed**: treat as catalog metadata / snapshot only; **do not imply line VAT exclusion** until pricing semantics are designed. Prefer hiding from commercial UX or labeling non-authoritative. **Do not change `pricing.py` casually.** Option A (real semantics) is a later priced project | P1 |
| Cost/margin visibility | KEEP (gated) | — |
| Templates / packages | KEEP | — |
| PDF branding | KEEP | — |
| Quote → Project requires Site | KEEP policy | Document in UI empty state if missing Site |

---

## 11. System Design strategy

| Track | Status | Action | Priority |
|-------|--------|--------|----------|
| **E1 CCTV current design** | Strong / PROTECTED | KEEP | — |
| **R1** | PRODUCTION VERIFIED | KEEP | — |
| **R2** | PRODUCTION VERIFIED (API + browser reopen PASS) | KEEP | — |
| **R3** | PRODUCTION VERIFIED | KEEP | — |
| **E1 Intent UX** | COMPLETE | KEEP | — |
| **E2 Intent persistence** | PRODUCTION VERIFIED | KEEP | — |
| **E3 Intent-only Apply** | NOT STARTED | DEFER | P2 |
| **E4 Other engines** | SCAFFOLDED | DEFER | P3 |

### Is E3 required before a real company can use SITE SECURE?

**No.** Catalog-backed Design→Apply is production-verified. Companies with a product catalog can sell CCTV systems today. Intent-only Apply matters when catalog is empty or SKU unknown — a **coherence upgrade**, not the path from “sales tool” to “operating system.”

### Other engines (Alarm / Access / Intercom)

**P3 DEFER.** CCTV is the beachhead. Stubs stay disabled.

---

## 12. Settings / profile / admin completion

| Item | Action | Priority |
|------|--------|----------|
| Company settings | KEEP | — |
| Users / roles / invites | KEEP | — |
| PDF templates | KEEP | — |
| Profile display name | FINISH | P2 |
| Avatar upload | DEFER | P3 |
| **Multi-workspace** | **Decision: V1 = single active workspace assumption** | P1 FIX (document) |

### Multi-workspace decision

**Supported V1 use case: one active workspace per session** (first membership), unless/until switcher ships.  
**Action:** document in product/settings copy + baseline; avoid silent wrong-tenant edits.  
**Switcher = P2/P3 FINISH** only when multi-membership is a sold use case. Do not leave ambiguous.

---

## 13. Legacy / dead-code decisions

| Item | Decision |
|------|----------|
| `/dev/ui` | REMOVE WHEN SAFE (dev only) |
| Legacy System Builder keyword recommend | KEEP TEMPORARILY; RETIRE AFTER Design path is universal default in UI |
| Legacy sequential `addQuoteItem` Apply | KEEP TEMPORARILY as fallback; RETIRE AFTER confirmed unused in prod paths |
| `LeadsAttention` deprecated | RETIRE AFTER unified attention sole path confirmed |
| `service_contracts` unused | DEFER product; RETIRE later if still unused |
| Founding technician role | Already retired in migrations — no action |
| ActivityList | INVESTIGATE (thin synthesis vs event stream) — P3 |
| Superseded Quote docs (PDF notes) | Editorial: mark superseded by baseline + A3 |

No deletions in this planning task.

---

## 14. Technical debt priorities

| Debt | Promote to P0/P1? | Why |
|------|-------------------|-----|
| `QuoteBuilder.tsx` size | No (P2) | Tests protect; freeze redesign |
| `styles.css` size | No (P3) | No giant refactor |
| Dirty state Stage 2↔3 | No unless bugs | Shared panel already mitigates |
| TS/Python CCTV parity | Keep tests green | Not a feature track |
| Migration drift | **Closed** on this target | Historical risk mitigated |

Do not start a refactor program for V1 completion.

---

## 15. Production verification track

### Resolved (historical — do not re-block)

| Migration | Enables | Status |
|-----------|---------|--------|
| 0052 | Assignment history / active filters | **PASS** |
| 0053 | Service call numbers | **PASS** |
| 0054 | Design tables + RLS | **PASS** |
| 0055 | Atomic owned Apply RPC | **PASS** |
| 0056 | `equipment_intent` jsonb | **PASS** |

### Remaining VERIFY (small — before heavy feature work)

| ID | What | Status |
|----|------|--------|
| V-A | Browser: System Builder → persist Design → close → reopen → restored | **CLOSED / PASS 2026-09-24** — `PRODUCTION-BROWSER-VERIFICATION-2026-09-24.md` |
| V-B | Browser: Technician Today → assigned job → FieldJob lifecycle step | **CLOSED / PASS 2026-09-24** — same report; assignment/0052 green |

No open P0 VERIFY items. Next implementation priority: **FINISH Service Call V1 loop** (`Docs/SERVICE-CALL-V1-DISCOVERY.md`). Project→Job is **V1 COMPLETE / KEEP**.

Rollback/backup: already gated by vault `20260924T160516Z` for the deploy that enabled this track.

---

## 16. Work possible now (DB deploy no longer waiting)

On SiteSecureV1, **almost all V1 completion work can proceed**:

- ~~Browser VERIFY V-A / V-B~~ (**PASS**)  
- ~~Project minimum workspace~~ (**PASS** 2026-09-24 — `Docs/PROJECT-MINIMUM-WORKSPACE-IMPLEMENTATION.md`)  
- ~~Jobs list~~ (**PASS** 2026-09-24 — `Docs/JOBS-LIST-MANAGER-VISIBILITY-IMPLEMENTATION.md`)  
- ~~Project → Job handoff~~ (**V1 COMPLETE / KEEP** — `Docs/PROJECT-JOB-HANDOFF-DISCOVERY.md`; optional polish backlog only)  
- **Service Call V1 loop FINISH** ← next (`Docs/SERVICE-CALL-V1-DISCOVERY.md`)  
- Site/Warranty FINISH (after Service package)  
- Tasks naming FIX  
- Stage 4 defaults FINISH  
- `vat_eligible` honesty FIX (without pricing rewrite)  
- Multi-workspace documentation  
- E3 **product rules workshop** (docs only) when ready  

---

## 17. Work that must wait

| Work | Wait on |
|------|---------|
| E3 implementation | Explicit product rules + approval (not migrations) |
| Alarm/Access/Intercom engines | Market decision |
| `service_contracts` UI | Contracts product thesis |
| Stripe / maps / patrol / native / AI | Explicit defer |
| Pricing changes for `vat_eligible` Option A | Dedicated money design + tests |
| Further Supabase migrations beyond 0056 | New explicit approval |

**Nothing critical waits on undeployed 0052–0056** — that wait is over.

---

## 18. Release groups

### RELEASE A — Confidence verification  
**Goal:** Prove live Design reopen + Field Today paths in browser.  
**Includes:** V-A, V-B.  
**Excludes:** Feature builds, E3.  
**Deps:** None (migrations live).  
**Risk:** LOW.  
**Gate:** Both browser scripts/manual checklists pass; defects filed or fixed.  
**Status:** **PASS 2026-09-24** — `Docs/PRODUCTION-BROWSER-VERIFICATION-2026-09-24.md`.

### RELEASE B — Operations continuity (V1 spine)  
**Goal:** Approved Quote → Project → Job → Complete inside the product.  
**Includes:** Project min workspace, Jobs list, Project→Job handoff.  
**Excludes:** Full project FSM, documents vault, calendar; optional Jobs-list cache / FieldJob→Project polish.  
**Deps:** Release A preferred.  
**Risk:** MEDIUM (touches jobs surfaces; protect `job_lifecycle.py`).  
**Gate:** J1 with Site present.  
**Status:** **Project workspace + Jobs list + Project→Job V1 COMPLETE** (2026-09-24). Optional UX continuity = backlog only.

### RELEASE C — Service continuity  
**Goal:** Service Call → Job (no Project required) → resolution → history on Site/Customer.  
**Includes:** Service status/close UI; create-job→FieldJob continuity; history links; simple Warranties after.  
**Excludes:** Contracts, SLAs, migrations unless proven necessary (discovery: NONE for min V1).  
**Deps:** B helpful (Jobs list).  
**Risk:** MEDIUM.  
**Gate:** J2 pass. Evidence baseline: `SERVICE-CALL-V1-DISCOVERY.md`.  
**Status:** **NEXT** — discovery complete; implementation not started.

### RELEASE D — Commercial honesty  
**Goal:** No misleading commercial/settings behavior.  
**Includes:** Stage 4 defaults; `vat_eligible` honesty; Tasks naming; multi-ws assumption copy.  
**Excludes:** Pricing engine rewrite; Quote Builder redesign.  
**Deps:** None.  
**Risk:** MEDIUM if touching pricing (avoid); LOW if copy/hydration only.  
**Gate:** No field implies unimplemented money rules; Stage 4 defaults demonstrable.

### RELEASE E — System Design expansion  
**Goal:** Intent-only Apply (E3) when catalog path is insufficient.  
**Includes:** E3 rules then implementation.  
**Excludes:** New engines.  
**Deps:** A–D stable; catalog Apply remains default.  
**Risk:** HIGH (Apply/fingerprint/pricing).  
**Gate:** Explicit E3 acceptance criteria met; R3 regressions green.

---

## 19. Dependency graph

```text
[0052–0056 DEPLOYED ✓]
        │
        ├─► VERIFY V-A (Design reopen browser)
        │         │
        │         └─► (optional) E3 rules → E3 impl   [RELEASE E]
        │
        └─► VERIFY V-B (Today → FieldJob browser)
                  │
                  ▼
         ~~FINISH Project min workspace~~ ──► ~~FINISH Jobs list~~
                  │                         │
                  └──────────┬──────────────┘
                             ▼
              ~~Project → Job handoff~~ (V1 COMPLETE / KEEP)
                             │
                             ▼
                    FINISH Service loop + Site/Customer history  ← NEXT
                             │
                             ▼
                    FINISH simple Warranties

Optional backlog (non-blocker):
  Jobs-list invalidate after Project Job create · FieldJob→Project link

Parallel (low coupling):
  Stage 4 defaults · vat_eligible honesty · Tasks naming · multi-ws docs
```

---

## 20. Strict DO NEXT queue (max 10)

| # | What exactly | Why now | What not to touch | Dependency | Done when |
|---|--------------|---------|-------------------|------------|-----------|
| **1** | ~~Browser VERIFY System Builder Design reopen~~ | **CLOSED / PASS 2026-09-24** | — | — | — |
| **2** | ~~Browser VERIFY Technician Today → FieldJob~~ | **CLOSED / PASS 2026-09-24** | — | — | — |
| **3** | ~~FINISH Project minimum workspace~~ | **CLOSED / PASS 2026-09-24** | — | — | Evidence: `PROJECT-MINIMUM-WORKSPACE-IMPLEMENTATION.md` |
| **4** | ~~FINISH Jobs list (manager)~~ | **CLOSED / PASS 2026-09-24** | — | — | Evidence: `JOBS-LIST-MANAGER-VISIBILITY-IMPLEMENTATION.md` |
| **5** | ~~FINISH Project → Job handoff~~ | **CLOSED / V1 COMPLETE** | — | — | Evidence: `PROJECT-JOB-HANDOFF-DISCOVERY.md` |
| **6** | FINISH Service Call V1 loop + Site/Customer history | Closes J2 | Contracts UI; FieldJob redesign; migrations | Jobs list helpful | Call→Job→resolve→history; `SERVICE-CALL-V1-DISCOVERY.md` |
| **7** | FINISH Site dossier delete UX + related links | Ops hub | Maps/equipment registry | Soft | Delete safe; related work linked |
| **8** | FIX Tasks naming + FINISH Stage 4 defaults | Honesty + sales polish | Quote Builder redesign | None | Copy honest; defaults hydrate |
| **9** | FIX `vat_eligible` honesty + document multi-ws assumption | Remove dangerous ambiguity | `pricing.py` semantics rewrite | None | No false VAT promise; WS rule explicit |
| **10** | E3 **product rules** doc (not code) | Prepares expansion after ops | Implementing Apply | Ops releases underway | Written decisions for identity/fingerprint/price |

---

## 21. DO NOT DO YET

| Item | Why deferred |
|------|--------------|
| E3 implementation | Catalog Apply sufficient for first V1; high risk to money/ownership |
| Alarm / Access / Intercom engines | CCTV beachhead; stubs only |
| Procurement / inventory / PO | Not required for sales→install→service loop |
| Stripe / payments / accounting | Explicitly deferred platform |
| Maps / patrol | Keys only; not V1 |
| Native mobile / offline | Web FieldJob enough for V1 |
| True Calendar product | Tasks suffice |
| AI-authoritative engineering | Conflicts with deterministic CCTV |
| Large CSS / QuoteBuilder refactor | Freeze; no V1 ROI |
| Quote Builder visual redesign | Recently completed; freeze |
| `service_contracts` UI | No product thesis |
| Avatar upload | Static OK |
| Notifications bell | Deferred |

---

## 22. STOP POLISHING

These are **good enough** — no general visual passes:

- Quote Builder (guided + structural separation)  
- Dashboard premium command center (recent)  
- Public landing / legal  
- Auth screens  
- AppShell / sidebar / bottom nav  
- Topbar avatar presentation (static is acceptable for V1)

Polish only for **functional defects** filed against these surfaces.

---

## 23. Protected systems

Any work touching these is **HIGH/CRITICAL** risk — require tests + explicit scope:

| System | Path |
|--------|------|
| Pricing | `apps/api/app/pricing.py` |
| Quote lifecycle Send/Share | `routers/quotes.py` |
| Public decide | `routers/public_quotes.py` |
| Snapshot | `quote_snapshot.py` |
| PDF | `quote_pdf.py` |
| CCTV sizing/recommend | `cctv_sizing/`, `cctv_recommend/` |
| R3 Apply | `system_designs/apply.py`, `0055_*.sql` |
| Authz / RLS | `authz/engine.py`, `catalog.json`, Design FORCE RLS |
| Job lifecycle | `job_lifecycle.py` |
| Quote mobile dock | `QuoteMobileActionsBar` + AppShell clearance |
| API contracts | `packages/api-client` |

---

## 24. Final V1 exit criteria

Ship **SITE SECURE V1** when:

- [x] VERIFY V-A and V-B pass (2026-09-24 browser verification)  
- [x] Project minimum workspace operational (Jobs primary; open FieldJob)  
- [x] Manager Jobs list (`/app/jobs`) PASS 2026-09-24  
- [x] J1 works with Site: Approve → Project → Job → Complete (Project→Job V1 COMPLETE)  
- [x] J4: manager Jobs list visibility (assign UX still via existing Job flows)  
- [ ] J2: Service Call → Job → resolve → history on Site/Customer  
- [x] J3: catalog CCTV Design→Apply→Send remains green; reopen OK  
- [x] J5: technician Today path green  
- [ ] Commercial honesty: Stage 4 defaults + `vat_eligible` clarified; Tasks naming honest  
- [ ] Multi-workspace assumption documented (or switcher shipped)  
- [ ] Simple warranties usable  
- [ ] E3 still explicitly out of scope unless separately approved  
- [ ] Protected systems unchanged except intentional scoped fixes  
- [ ] Regression suites green at or above post-deploy baselines  

---

## Appendix — Priority rollup

### P0
1. ~~VERIFY Design reopen (browser)~~ **CLOSED / PASS 2026-09-24**  
2. ~~VERIFY Today → FieldJob (browser)~~ **CLOSED / PASS 2026-09-24**  
3. ~~FINISH Project minimum workspace~~ **CLOSED / PASS 2026-09-24**  
4. ~~FINISH Jobs list~~ **CLOSED / PASS 2026-09-24**  
5. ~~Project → Job handoff~~ **V1 COMPLETE / KEEP** (`PROJECT-JOB-HANDOFF-DISCOVERY.md`)  
6. FINISH Service Call V1 loop + Site/Customer history ← **NEXT** (`SERVICE-CALL-V1-DISCOVERY.md`)  

### Optional backlog (not blockers)
- Jobs-list post-create cache continuity (after Project Job create)  
- FieldJob → Project contextual link when `project_id` exists  

### P1
7. FINISH Site dossier gaps (beyond Service history links in Service package)  
8. FINISH simple Warranties  
9. FINISH Stage 4 company defaults  
10. FIX `vat_eligible` honesty  
11. FIX Tasks naming  
12. FIX/document multi-workspace assumption  

### P2
- E3 product rules → later implementation  
- Profile display name  
- Lead deepen only if demanded  

### P3 / DEFER
- Engines, contracts UI, avatar upload, calendar, Stripe, maps, AI, native, large refactors  

---

*End of plan. No product code, backend, migrations, pricing, lifecycle, authz, or database behavior was changed while authoring this document.*
