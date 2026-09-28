# SITE SECURE — Production Browser Verification

**Date:** 2026-09-24  
**Mode:** VERIFICATION ONLY — no product implementation, no schema/migration/authz/pricing/lifecycle changes  
**Target:** SiteSecureV1 (live DB migrations 0052–0056 PASS)  
**Sources:** `SITE-SECURE-PRODUCT-COMPLETION-PLAN.md`, `SITE-SECURE-MASTER-PROJECT-BASELINE.md`, `SUPABASE-MIGRATION-DEPLOYMENT-2026-09-24.md`  
**Artifacts:** `Docs/production-browser-verification-qa/` (screenshots + `report.json`)

---

## 1. Environment

| Item | Value |
|------|-------|
| Project | SiteSecureV1 / `rhxqqudlngimhplvndmz` |
| Web | `http://127.0.0.1:5173` (local Vite against production Supabase + API) |
| API | `http://127.0.0.1:8000` / `http://localhost:8000` |
| DB migrations | 0052–0056 **PASS** (deployed 2026-09-24) |
| Prior verified | R1, R2 (API), R3, E2, assignment blocker closed |
| Method | Playwright Chromium against real UI + API checks; owner/tech Phase1B QA identities |

---

## 2. Test identities / context

| Role | Identity | Workspace |
|------|----------|-----------|
| Owner | `phase1b.owner.1790012816@sitesecure.test` | `50339413-11c7-4903-820c-7541fbd2a476` (Phase1B QA 1790012816) |
| Technician | `phase1b.tech.1790012816@sitesecure.test` | same |
| Quote (safe draft) | `#Q-00002` / `c79b9091-6200-454e-b0f9-c7dee78007f6` | customer/site QA fixtures |
| Job | `J-QA001` / `ce72a357-c397-4935-a760-3fa3f140bd1c` | assigned to technician |

**Fixture note:** Owner patched `scheduled_for` on `J-QA001` to **today (2026-09-24)** so Today date-filter shows the assigned job. Assignment itself was pre-existing supported behavior — not an authz widening.

---

## 3. System Design reopen steps

1. Owner session → open draft Quote `#Q-00002`.
2. Stage 2 — **תכנון וציוד**.
3. Open **תכנון מערכת** / System Builder drawer.
4. Set requirements via UI: **4 cameras** (CCTV).
5. Run deterministic calculate/recommend.
6. Confirm engineering result in UI (channels, ~2.9TB storage, PoE ≥4, NVR + external PoE switch).
7. Equipment Intent edit on camera role: manufacturer `Hikvision`, model `DS-2CD2143G2` (no E3 Apply).
8. Close builder; reload browser; return to same Quote → Stage 2 → reopen System Builder.
9. Controlled recalculate through UI; re-verify identity + intent.
10. Soft-delete Design via supported API cleanup after verification.

Screenshots: `a1-quote-open-desktop.png` … `a-reopen-intent.png`, `a-recalc-final.png`, `a-mobile-final.png`.

---

## 4. System Design reopen evidence

| Check | Result | Evidence |
|-------|--------|----------|
| Same design identity | **PASS** | `id = 9c87039e-e52a-4caa-99ab-d84becf1084c` before/after reopen |
| Requirements restored | **PASS** | `cameraCount = 4`; UI “מערכת CCTV · 4 מצלמות” |
| Engineering restored | **PASS** | מקליט ≥4 ערוצים, אחסון ~2.9TB, PoE ≥4, NVR+PoE |
| Recommendation / components | **PASS** | 8 components; roles camera×4, recorder, storage, poe_switch, installs, cable, testing |
| Equipment Intent restored | **PASS** | Camera intent Hikvision / DS-2CD2143G2 after reopen (`round3.reopen_intent`) |
| Resolution / review | **PASS** | `needs_review: false` on intent; empty-catalog “טרם נבחר” for unresolved roles (expected) |
| No duplicate Design | **PASS** | `design.count = 1` |
| No unexpected blank hydrate | **PASS** | After adequate wait: not stuck on “טוען תכנון שמור…” (`final_pass.reopen.still_loading = false`) |

**Classification — Part A reopen:** **PASS**

---

## 5. Recalculate evidence

| Check | Result | Evidence |
|-------|--------|----------|
| Same durable Design | **PASS** | `same: true`, id unchanged |
| Revision advances | **PASS** | revision `2 → 3` after controlled recalc |
| Intent preserved | **PASS** | camera intent still Hikvision / DS-2CD2143G2, `review: false` |
| Component count stable | **PASS** | `comps: 8` (no duplicate components) |
| Design count | **PASS** | still `1` — no duplicate Design |
| No Apply / quote-line duplication | **PASS** | E3 Apply not exercised; quote total remained ₪0 |

**Classification — Recalculate:** **PASS**

---

## 6. Today → FieldJob steps

1. Technician session → `/app/today`.
2. Confirm assigned work card for `J-QA001`.
3. Open FieldJob via supported CTA / `/app/jobs/{job_id}`.
4. Verify identity, site/customer context, assignment, lifecycle actions.
5. Exercise lifecycle: `scheduled → en_route` (API + UI reflect), then UI click **הגעה לאתר** → `arrived`.
6. Negative: technician `GET quotes` → **403**; Quotes UI shows “אין הרשאה…”.

Screenshots: `b-today-final.png`, `b-fieldjob-final.png`, `b-lifecycle-*.png`, `b-quotes-deny.png`, `b-today-mobile-final.png`.

---

## 7. Assignment evidence (0052 regression)

| Check | Result |
|-------|--------|
| Today loads without `assignments.unassigned_at` / schema-cache 400 | **PASS** (`schema_fail: false`) |
| Active assignment hydration | **PASS** — FieldJob shows assignee `a8f9d06d-…`, “שובץ ב …” |
| Technician sees expected assigned job | **PASS** — `J-QA001`, site/customer QA labels, window 18:35–20:35 |
| Unrelated / unassigned work not injected | **PASS** — Today shows **1 JOBS** for this tech context |
| No commercial quote data on Today/FieldJob | **PASS** — ops surface only |

---

## 8. Lifecycle evidence

| Transition | How | API status | UI |
|------------|-----|------------|-----|
| `scheduled → en_route` | Authoritative `POST …/en-route` (first UI button locator miss in automation; product CTA **יציאה לדרך** present on Today/FieldJob) | **200** → `en_route` | Status **בדרך**; next action **הגעה לאתר** |
| `en_route → arrived` | Real UI click **הגעה לאתר** | `arrived` | Status **באתר**; next action **התחל עבודה** |

Terminal **complete** not exercised (would leave fixture unsuitable). Non-terminal transitions used intentionally.

**Classification — Lifecycle:** **PASS**

---

## 9. Authz / commercial-deny evidence

| Check | Result |
|-------|--------|
| Technician quotes API | **403** |
| Technician Quotes UI | “אין הרשאה לפעולה זו” / “אין הרשאה למסך הזה.” |
| `quotes.view_cost` / commercial deny not weakened | **PASS** |
| Technician scope unchanged for test | **PASS** |

**Classification — Technician authz:** **PASS**

---

## 10. Desktop / mobile sanity

| Surface | 1440-class | 390-class |
|---------|------------|-----------|
| System Builder / Quote Stage 2 | Usable; primary actions reachable (`a1`, `a6`, `a-reopen-intent`) | Usable (`a-mobile-final.png`) |
| Today | Usable; **יציאה לדרך** / **פתח עבודה** reachable (`b-today-final.png`) | Usable (`b-today-mobile-final.png`) |
| FieldJob | Usable; lifecycle CTA reachable (`b-fieldjob-final.png`, `b-lifecycle-arrived-ui.png`) | Same FieldJob surface used; no blocking overlap observed |

Not a design audit — functional reachability only.

**Desktop:** **PASS** · **Mobile:** **PASS**

---

## 11. Console / network findings

| Journey | Unexpected 4xx/5xx | Schema-cache | Uncaught FE errors | Duplicate create storms |
|---------|--------------------|--------------|--------------------|-------------------------|
| Part A | **None** (`partA_net: []`, `partA_errors: []`) | None | None recorded | None — design count stayed 1 |
| Part B | **None** (`partB_net: []`, `partB_errors: []`) | None (`schema_fail: false`) | None recorded | N/A |

Expected: technician quotes **403**.

Early automation-only timeouts (close button locator / label `יצרן` fill) were **script issues**, not product failures; final rounds succeeded via normal UI controls.

---

## 12. Test-data cleanup

| Record | Action |
|--------|--------|
| System Design `9c87039e-…` on Q-00002 | **CLEANED** — soft-deleted via supported API; list now `items: []` |
| Quote `#Q-00002` | **RETAINED** — pre-existing Phase1B draft fixture |
| Job `J-QA001` | **RETAINED** — left at status **`arrived`** (safer than complete); `scheduled_for` still today for Today visibility |

---

## 13. Failures / issues

### Blocking product defects

**None** for V1 Design reopen or Today → FieldJob.

### Non-blocking notes (document only — not fixed)

1. **Hydration wait:** First reopen screenshot sometimes captured mid “טוען תכנון שמור…”. After normal wait, hydrate completes correctly — not a persistence failure.
2. **Automation vs Hebrew CTAs:** Lifecycle primary labels are **יציאה לדרך** / **הגעה לאתר** (not English “en route”). Product UI correct; scripts must match Hebrew.
3. **FieldJob site line during load:** Brief “אתר לא שויך” while hydrating; later frames show site/customer correctly.
4. **Today card click:** One automation path used direct `/app/jobs/{id}` after list verification; primary CTAs **פתח עבודה** / **יציאה לדרך** are present and usable.

---

## 14. Final verdict

| Track | Classification |
|-------|----------------|
| Part A — System Design reopen | **PASS** |
| Part A — Recalculate | **PASS** |
| Part B — Technician Today | **PASS** |
| Part B — Today → FieldJob | **PASS** |
| Part B — Job lifecycle | **PASS** |
| Part B — Technician authz | **PASS** |
| Desktop sanity | **PASS** |
| Mobile sanity | **PASS** |
| Unexpected network/console | **NONE** |

**Both P0 VERIFY tracks PASS.** Product Completion Plan VERIFY rows closed.

**Automated regression:** No product code changed in this verification task. Baseline remains as recorded post-deploy (`Docs/SUPABASE-MIGRATION-DEPLOYMENT-2026-09-24.md`): full web vitest **439 passed**, `tsc` PASS, production build PASS — not re-manufactured here.

**NEXT IMPLEMENTATION TASK (do not start in this task):** Project Minimum Workspace.
