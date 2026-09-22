# Phase 3 — Field Operations / FieldJob Report

**Date:** 2026-09-22  
**Scope:** Technician-first Field Operations presentation (Today continuity + FieldJob mobile/desktop)  
**Status:** Audit → Safety gate → Safe presentation implemented → QA → **STOPPED.**

Closed modules **not touched:** Dashboard, Customers, Customer Profile, Sites, Site Dossier, Service, Payment Details, Public Landing, auth.

No backend / lifecycle / RLS / authz / assignment-scope / commercial-isolation changes.

---

## FIELD OPERATIONS CAPABILITY & SAFETY MATRIX

| CAPABILITY | CURRENT UI | BACKEND AUTHORITY | WHO CAN USE IT | TECHNICIAN ALLOWED? | PRESENTATION-ONLY CHANGE SAFE? | NOTES |
|---|---|---|---|---|---|---|
| view Today | `/app/today` → `TodayHome` / `TodayList` | Dashboard `today` items + assigned scope | Roles with Today home / `jobs.view` | Yes (home_variant=today) | **SAFE RESPONSIVE RECOMPOSITION** | Empty Today preserved; no scope broadening |
| view job | `/app/jobs/$jobId` → `FieldJob` | `GET …/jobs/{id}` + `jobs.view` + resource scope | Assigned tech; office roles | Assigned only | **SAFE PRESENTATION CHANGE** | Implemented |
| view customer | FieldJob customer name + phone | `getCustomer` | Via job.customer_id | Yes (operational) | Safe | Display only; no CRM redesign |
| view site | Job object + quick “אתר” + dossier link | `getSite` | Via job.site_id | Yes | Safe | |
| view address | Maps chip when site.address present | Existing `mapsSearchUrl` | Anyone who can see site | Yes | **SAFE EXISTING ACTION RE-PRESENTATION** | Already existed — not invented GPS |
| view schedule | Job object time range | `scheduled_for` / `scheduled_end` | Job viewers | Yes | Safe | |
| view equipment | Equipment rows | `listEquipment` + `systems.view` | Feature-gated | If grant | Safe | Rows, not card soup |
| view notes | Completion notes when completed | Job fields | Job viewers | Yes | Safe | |
| view documents/photos | Photos section + upload | `documents.view` / `documents.upload` | Feature-gated | If grant | Safe | Existing file input + `capture` |
| start work / en-route / arrived | Primary CTA | `jobs.start` + `job_lifecycle.assert_transition` | Field executors | If assigned + grant | **SAFE EXISTING ACTION RE-PRESENTATION** | Client gates mirror prior UI; server authoritative |
| complete work | Primary CTA → notes panel | `jobs.complete` from `in_progress` | Completers | If grant | Safe | Payload unchanged |
| change status (block/cancel) | Not exposed in FieldJob UI | Lifecycle matrix supports block/unblock/cancel | Office APIs | Not in FieldJob UI | **OUT OF SCOPE** | Do not invent UI |
| assignment / reassignment | Rail + “עוד” sheet | `jobs.assign` | Managers/owners | No (typical) | Safe re-presentation | Gated by `can(…, jobs.assign)` |
| commercial / cost / quotes | **Not rendered in FieldJob** | `quotes.view_cost` stripped for technicians | Commercial roles | **No** | Must stay absent | Verified: no cost/margin/₪ in FieldJob |
| service context | Service call number line | `getServiceCall` when linked | Job viewers | Yes | Safe | |
| pause / reopen | N/A in product UI | No pause; no reopen in matrix | — | — | **REQUIRES BUSINESS LOGIC** → skipped | |

### Proposed-work classification (executed)

| Class | Work |
|---|---|
| **SAFE PRESENTATION CHANGE** | Compact job object; status language; hierarchy; RTL/`bdi`; forms comfort |
| **SAFE RESPONSIVE RECOMPOSITION** | Mobile column + sticky primary CTA; desktop main + rail |
| **SAFE EXISTING ACTION RE-PRESENTATION** | Quick strip (maps/tel/site/photo); primary lifecycle buttons; More sheet |
| **REQUIRES BUSINESS LOGIC CHANGE** | Pause, reopen, block/cancel UI, Jobs index, invent GPS/camera beyond existing | **Skipped** |
| **OUT OF SCOPE** | Dashboard/Customers/Sites/Service/Payment/Landing; Flutter; new deps |

---

## Actual lifecycle discovered (`apps/api/app/job_lifecycle.py`)

**Statuses:** `scheduled`, `en_route`, `arrived`, `in_progress`, `completed`, `cancelled`, `blocked`

**Transitions (authoritative):**

| Action | From | To |
|---|---|---|
| `en_route` | `scheduled` | `en_route` |
| `arrived` | `en_route` | `arrived` |
| `start` | `arrived`, `en_route` (legacy) | `in_progress` |
| `complete` | `in_progress` | `completed` |
| `block` | `in_progress`, `arrived`, `en_route` | `blocked` |
| `unblock` | `blocked` | `in_progress` |
| `cancel` | open statuses | `cancelled` |

**UI presentation note (unchanged semantics):** FieldJob still offers **Start** only from `arrived` (stricter than server `en_route` legacy). En-route / Arrived / Complete remain the primary CTAs. No client-only transitions added.

**Completion:** `completeJob` with optional `completion_notes`. No invented signature/GPS requirements.

---

## Roles / permissions / technician scope

- Server `authorize()` remains authoritative; client `can()` presentation-only.
- Technician default scope = **assigned** (`authz/scope.py`). Direct route to unassigned job → `SCOPE_DENIED` / “אין גישה למשאב זה”.
- Field mutations use existing `jobs.start` / `jobs.complete` / `jobs.assign` gates.
- Commercial: FieldJob never queries or renders quote totals/cost. `quotes.view_cost` remains false for technicians in authz tests (backend unchanged).

---

## Kai files inspected

Under `Fintech App UI/card_app/lib/`:

- `screens/home_screen.dart`
- `widgets/app_bottom_nav.dart` (existing floating nav — **not redesigned**)
- `widgets/transaction_tile.dart`
- `widgets/pill_button.dart`
- Profile / KYC segmented-control patterns (form comfort)
- Bottom-sheet grammar (portal + handle + dim) via `FieldActionSheet` mirroring existing `MobileNavSheet` a11y

### KAI PATTERNS USED NOW

- Mobile rhythm / one dominant work object + supporting rows
- Compact quick-action strip
- Operational row hierarchy (checklist / equipment / photos)
- Progressive disclosure via **עוד** bottom sheet
- Pill / press feedback (CSS ~180–200ms)
- Sheet motion ~320ms; focus trap + Escape; safe-area
- Comfortable form controls for completion notes / assign select

### KAI PATTERNS NOT USED + WHY

| Pattern | Why not |
|---|---|
| Bank / metallic cards / balances | Wrong domain; commercial isolation |
| Expense charts / avatars as identity system | Not field ops |
| Purple Kai branding | SITE SECURE tokens only |
| Flutter widgets / new Lottie | Design reference only; CSS-only motion |
| Global bottom-nav redesign | Already shipped; local FieldJob padding only |
| Invented maps/GPS/camera beyond existing | Capability gate |

---

## Files changed

| Path | Change |
|---|---|
| `apps/web/src/components/field/FieldJob.tsx` | Technician-first hierarchy; job object; primary CTA; quick strip; desktop rail; More sheet; same queries/mutations/gating |
| `apps/web/src/components/field/FieldActionSheet.tsx` | **New** accessible bottom sheet (portal, focus trap, Escape, handle) |
| `apps/web/src/styles.css` | Field job/today layout, object, quick tiles, sticky CTA, sheet, rows, rail, bottom-nav clearance |
| `apps/web/src/i18n/he.ts` | `fieldMore`, `fieldMoreTitle`, `fieldQuickAria`, `fieldPrimaryAria`, `fieldWorkDetails`, `fieldAssignKicker` |
| `apps/web/tests/field-job.test.tsx` | Assert site name with `findAllByText` (object + desktop rail) |
| `apps/web/scripts/phase_3_field_qa.mjs` | **New** truthful visual QA |
| `Docs/phase-3-field-qa/*` | Screenshots + `report.json` |
| `Docs/PHASE-3-FIELD-OPERATIONS-REPORT.md` | This report |

**Today / Jobs list:** No product redesign required for Today (continuity already correct). **No `/app/jobs` index exists** — office entry remains Dashboard attention / Service / Site links (documented; not invented).

---

## Implementation summary

### FieldJob mobile (primary)

1. **Job object** — number, title, status, site, customer, schedule/priority  
2. **Primary valid action** — single CTA (no duplicate sticky+inline DOM) sticky above floating nav on mobile  
3. **Quick strip** — existing maps / tel / site / photo only  
4. **עוד sheet** — overflow links + assign (if authorized)  
5. **Work details** — checklist rows → equipment rows → photos → completion / meta  
6. Bottom padding respects `--ops-bottom-nav-offset`

### FieldJob desktop

- CSS grid: main work column + secondary rail (assignment + where context)  
- Primary CTA static in flow (no mobile sticky chrome)  
- Not a centered mobile column

### Today

- Preserved empty/populated behavior and assignment scope  
- Continuity: back link FieldJob → היום

---

## Visual QA

Screenshots: `Docs/phase-3-field-qa/`

| Shot | State (truthful) |
|---|---|
| `today-390-light.png` / `today-390-dark.png` | Technician empty Today |
| `today-360/375/430/768/1440-*.png` | Same empty continuity |
| `fieldjob-390-light.png` / `fieldjob-390-dark.png` | Owner getJob → real **BUSINESS_RULE** error (assignee query / plan mapping under schema drift) |
| `fieldjob-360…1440-*.png` | Same route; error or settle variants |
| `security-tech-unassigned-390-light.png` | Technician direct route → **אין גישה למשאב זה**; no job object / CTA / cost |

Populated in-progress FieldJob **not** live-captured: remote DB blocks assignee hydration (see limitations). Unit test covers populated surface.

---

## Security QA

| Check | Result |
|---|---|
| Technician Today only assigned jobs | Empty list under current QA DB (scope intact; not broadened) |
| Technician → unassigned job URL | Denied; no job object; no lifecycle CTA; no cost text |
| FieldJob commercial leakage | No cost/quote/margin fields in component |
| UI hide ≠ security | Server returned SCOPE_DENIED / BUSINESS_RULE — ErrorState shown |

---

## Tests

| Suite | Result |
|---|---|
| `tests/field-job.test.tsx` | Pass |
| `tests/dashboard.test.tsx` | Pass (45 total with field-job) |
| ESLint (FieldJob, FieldActionSheet, field-job test) | Pass |
| `npm run typecheck` | Pass |
| `npm run build` | Pass |

---

## Known limitations

1. **Remote `assignments.unassigned_at` missing** — Supabase returns 400 on assignee filters. Effects: technician Today empty; `getJob` assignee hydration fails and surfaces as **BUSINESS_RULE** (“הפעולה חסומה לפי כללי התוכנית”) for owner; tech unassigned still correctly SCOPE_DENIED. **Documented only — no UI workaround** (per brief).  
2. **No dedicated Jobs list route** — out of Phase 3 invention scope.  
3. **Live populated FieldJob screenshots blocked** by (1); covered by unit test + CSS.  
4. **Block / cancel / pause / reopen** not added to UI (would require product/lifecycle presentation decisions beyond safe re-presentation).  
5. UI Start remains `arrived`-only (pre-existing stricter presentation vs server legacy `en_route` start).

---

## Acceptance

| Criterion | Status |
|---|---|
| Mobile hierarchy where / what / when / status / next action | **Implemented** in FieldJob presentation |
| Desktop not oversized mobile column | **Implemented** (main + rail) |
| No authz / scope / lifecycle / commercial changes | **Held** |
| Kai craft without fintech semantics | **Held** |
| Phase 4 not started | **Stopped** |

---

**STOP.** Awaiting approval before any Phase 4 or unrelated module work.
