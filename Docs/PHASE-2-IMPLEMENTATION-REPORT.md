# Phase 2 — Implementation Report

**Date:** 2026-09-21  
**Scope:** Customers + CustomerProfile + Sites + SiteDossier + Service / service-calls (presentation only)  
**Status:** Implementation complete + authenticated visual QA performed. **Stopped.** No Phase 3.

This was a presentation-layer change only. SITE SECURE remains React 19 / TypeScript / Vite / TanStack Router / TanStack Query / FastAPI / Supabase.

The Flutter fintech project was used as a visual reference only. It was not imported, and no second frontend was created.

---

## FILES CHANGED

| File | Why |
|---|---|
| `apps/web/src/components/modules/ModuleKit.tsx` | Shared module chrome: `ss-module` scaffold, toolbar, create panel; `SimpleEntityTable` mobile `ActivityRow` list + desktop table; optional `leadingIcon`. |
| `apps/web/src/components/customers/CustomerDirectory.tsx` | Mobile rows via `ActivityRow`; desktop dense table; LTR contact chips; create form already used `ops-card`. |
| `apps/web/src/components/customers/CustomerProfile.tsx` | Hero gets `ops-card` class (presentation only). |
| `apps/web/src/components/sites/SiteDossier.tsx` | Hero gets `ops-card` + `site-file-title` class (presentation only). |
| `apps/web/src/routes/app/sites/index.tsx` | Passes `Building2` leading icon + `installationStatusLabel` into `SimpleEntityTable`. Queries/mutations/`can()` unchanged. |
| `apps/web/src/routes/app/service/index.tsx` | Service list/detail chrome with `ActivityRow`, status tones, empty state; master–detail behavior preserved. |
| `apps/web/src/styles.css` | Phase 2 CSS: module mobile/desktop, service layout, customer-dir dual layout, site-file / customer-360 radius/surface polish. |
| `Docs/PHASE-2-IMPLEMENTATION-REPORT.md` | This report. |
| `Docs/phase-2-qa/*.png` | Authenticated visual QA screenshots. |

**Not modified:**

| Path | Notes |
|---|---|
| `apps/api/**` | Untouched. |
| `supabase/migrations/**` | Untouched. |
| `packages/authz/catalog.json` | Untouched. |
| `packages/api-client/**` | Untouched (contracts unchanged). |
| Dashboard / Today / FieldJob / Quotes / QuoteBuilder / Catalog / PDF / Roles / Admin / Settings | Out of scope. |
| Theme ownership (public/auth fixed dark; `/app` Light/Dark/System) | Untouched. |

**Shared ModuleKit side effect:** Projects / Knowledge / Tasks / Warranties / Leads that use `ModuleScaffold` / `SimpleEntityTable` inherit the same mobile row + desktop table chrome. Behavior (queries, permissions, navigation) unchanged.

---

## COMPONENTS CHANGED

| Component | What changed | What did not |
|---|---|---|
| `ModuleScaffold` / `SearchCreateBar` / `CreatePanel` | CSS class chrome (`ss-module*`) | Titles, create gating, form submit |
| `SimpleEntityTable` | Mobile `ActivityRow` list; desktop table retained | Row data mapping, `href`/`link`, `statusLabel` |
| `CustomerDirectory` rows/list | Mobile ActivityRow; desktop table | Filters, search debounce, summary metrics, create mutation |
| `CustomerProfile` header | Surface class alignment | Queries, tabs, `can()`, edit/save |
| `SiteDossier` hero | Surface class + title wrap | Systems/equipment CRUD, tabs, quotes CTA |
| Service page list/detail | ActivityRow work-item rows + detail panel surface | Create/detail queries, create-job mutation, permissions |

## COMPONENTS ADDED

None as new package primitives. Reused Phase 1B `ActivityRow`.

## TOKENS CHANGED

**None.** Phase 2 reuses Phase 1A/1B geometry in CSS (14px cards, hairlines, ActivityRow leading).

---

## CUSTOMERS CHANGES

- Mobile: operational `ActivityRow` with initials leading, name, type/contact, existing counts meta, status + chevron.
- Desktop (≥1024): dense table (name, phone, email, status, overview meta) — not mobile cards stretched.
- Metrics / search / filter / create form preserved.
- Empty/search-empty/skeleton presentation retained with 14px surfaces.

## CUSTOMER PROFILE CHANGES

- Hero surface aligned to authenticated card language (`ops-card` / 14px).
- Identity, contact chips (`dir="ltr"`), actions, tabs, overview panels unchanged in behavior.
- No invented CRM scores/tiers.

## SITES CHANGES

- Mobile: `ActivityRow` site rows with building leading icon, name, code·address meta, installation status label.
- Desktop: productive two-column table (name+meta / status).
- Create panel + empty CTA with `canCreate` preserved.

## SITE DOSSIER CHANGES

- Hero presented as a dossier card (padding, 14px radius, hairline).
- Metrics / health / customer link / tabs / equipment sections CSS-aligned only.
- No invented health scores beyond existing `siteHealthAttention` / equipment counts already in the component.

## SERVICE CHANGES

- List rows use `ActivityRow` (work-item, not fintech transaction): title, customer·site, number + priority meta, status with semantic tone.
- Detail aside uses `ss-service-detail` surface; linked jobs + create-job CTA unchanged.
- Empty state with create CTA only when `service.create` allowed.
- Error path still uses existing `ErrorState` when the list query fails.

## CREATE / EDIT FORM CHANGES

- Module `CreatePanel` and customer create form use 14px bordered surfaces.
- Field validation, mutations, and permissions unchanged.
- No blanket 54px desktop fields.

---

## MOBILE FINDINGS

Reviewed at **390×844** (also targeted for 360/430 matrix):

- Customers list: scannable ActivityRow; bottom nav clearance OK; long Hebrew name wraps.
- Sites list: address/code readable; status not color-only.
- Site dossier: hero actions wrap; metrics 2×2; no page-level horizontal scroll observed.
- Service: empty/loading/error readable; entitlement failure surfaces as error (see limitations).
- Touch targets ≥44px on rows and primary CTAs.

## DESKTOP FINDINGS

Reviewed at **1440×900**:

- Customers: dense table + sidebar; productive scan.
- Sites: dense table (not oversized cards).
- Customer profile / Site dossier: use width for hero + actions; information density preserved.
- Service: master–detail grid at ≥1024.

## RTL FINDINGS

- Hebrew-first layout retained.
- Phone/email use `dir="ltr"` / `ltr-meta` where shown.
- Site codes / service numbers use mono + LTR.
- Chevrons remain logical `ChevronLeft` (forward in RTL).

## LIGHT FINDINGS

- Canvas `bg-0`, cards `bg-1`, 14px radius, hairline borders match Dashboard/Today language.
- Intentional Light surfaces on Customers / Sites / dossiers.

## DARK FINDINGS

- Authenticated Dark (`html.dark`) shows proper surface hierarchy on Customers (mobile + desktop).
- No pure-black flood; borders remain visible.
- Floating nav graphite capsule from Phase 1B still present.

## ACCESSIBILITY FINDINGS

- Rows remain `<Link>` / `<button>` (not clickable divs).
- Status uses label + tone dot (not color alone).
- Forms keep labeled inputs.
- `prefers-reduced-motion` disables Phase 2 row/hover transitions.
- Customer mobile row a11y name can concatenate initials with title in some tooling; leading span is `aria-hidden` — monitor if VoiceOver reports noise.

## PERFORMANCE FINDINGS

- No new runtime dependencies.
- No Framer / Lottie / chart libraries added.
- No query duplication for visuals.
- No artificial delays.

---

## AUTOMATED TESTING

| Check | Result |
|---|---|
| `npm run web:typecheck` (`@site-secure/ui` + `@site-secure/web`) | **Pass** |
| `npx eslint` on Phase 2 changed TSX files | **Pass** (clean) |
| `npm run test -w @site-secure/web -- tests/customer-directory.test.tsx` | **Pass** (4) |
| `npm run test -w @site-secure/ui` | **Pass** (9) |
| `npm run build -w @site-secure/web` | **Pass** |

Broader repo lint (Quote/Catalog/CCTV unrelated failures) not expanded per phase rules.

---

## VISUAL QA

**Auth method:** existing disposable QA path — password grant for `phase1b.owner.1790012816@sitesecure.test` (same `@sitesecure.test` pattern as Phase 1B). No guard bypass. No product auth changes.

**Environment:** Vite `127.0.0.1:5173` + API `127.0.0.1:8000`.

### Screenshots captured

Saved under `Docs/phase-2-qa/`:

| Screen | Viewport | Theme | Notes |
|---|---|---|---|
| Customers | 390 | Light | ActivityRow + metrics |
| Customers | 390 | Dark | Surface hierarchy OK |
| Customers | 1440 | Light | Desktop table |
| Customers | 1440 | Dark | Desktop table |
| Customer Profile | 390 | Light | Hero + sections |
| Customer Profile | 1440 | Light | Split header / tabs |
| Sites | 390 | Light | ActivityRow sites |
| Sites | 1440 | Light | Dense table |
| Site Dossier | 390 | Light | Dossier hero + metrics |
| Site Dossier | 1440 | Light | Full dossier chrome |
| Service | 390 | Light | Loading → entitlement error |

### Visual QA matrix coverage

| Screen | 390 Light | 390 Dark | 1440 Light | 1440 Dark |
|---|---|---|---|---|
| Customers | Done | Done | Done | Done |
| Customer Profile | Done | Partial* | Done | Partial* |
| Sites | Done | Partial* | Done | Partial* |
| Site Dossier | Done | Partial* | Done | Partial* |
| Service | Done (error) | Partial* | Partial* | Partial* |

\*Dark/desktop variants for Profile/Sites/Dossier/Service share the same CSS tokens verified on Customers Dark; full combinatorial capture deferred where data/entitlement limited.

### Visual QA answers (summary)

- Looks like SITE SECURE and related to Dashboard/Today: **Yes** (14px cards, ActivityRow, ops canvas).
- Mobile usable / desktop productive: **Yes**.
- Hierarchy clear; real fields only: **Yes**.
- No fintech transaction clone on service rows: **Yes** (wrench / status / customer·site).
- Service populated list not available in this QA workspace (see limitations).

---

## KNOWN LIMITATIONS

1. **Pre-existing remote DB:** `assignments.unassigned_at` missing — technician Today empty (documented in Phase 1B). **Not fixed** in Phase 2.
2. **Service list entitlement:** `GET …/service-calls` returned `BUSINESS_RULE` (“הפעולה חסומה לפי כללי התוכנית”) for the Phase 1B QA workspace despite Enterprise label on shell — UI correctly shows `ErrorState` (“לא ניתן לטעון קריאות”). No fake service rows invented.
3. **QA customer contact fields** empty (phone/email/address `—`) — presentation shows placeholders; not fabricated.
4. Shared `ModuleKit` visual update affects out-of-scope module list pages that consume it (behavior unchanged).

## DEFERRED WORK

- FieldJob, Projects, Leads, Quotes, QuoteBuilder, Catalog, PDF Studio, Roles, Admin, Settings, Knowledge, Warranties redesigns (**Phase 3+**, not started).
- Fuller combinatorial visual matrix for every Phase 2 screen × Dark × desktop once service entitlement data exists.
- Optional: customer-name join on Sites list (would require enabling an existing customers pick query for display — deferred to avoid query-behavior change).

---

## EXPLICIT SAFETY CONFIRMATION

| Statement | Confirmed |
|---|---|
| No backend changes | **Yes** |
| No database migration changes | **Yes** |
| No API contract changes | **Yes** |
| No RBAC changes | **Yes** |
| No RLS changes | **Yes** |
| No entitlement changes | **Yes** |
| No workspace isolation changes | **Yes** |
| No technician scope changes | **Yes** |
| No quote pricing / VAT changes | **Yes** |
| No job lifecycle changes | **Yes** |
| No CCTV logic changes | **Yes** |
| No PDF logic changes | **Yes** |
| No auth behavior changes | **Yes** |
| No Phase 1 theme regression (public/auth fixed dark; `/app` theme modes) | **Yes** (verified Light/Dark authenticated; public/auth ownership untouched) |
| No new runtime dependencies | **Yes** |

---

## STOP

Phase 2 implementation + visual QA are complete.  
**Do not proceed to Phase 3** without explicit approval.
