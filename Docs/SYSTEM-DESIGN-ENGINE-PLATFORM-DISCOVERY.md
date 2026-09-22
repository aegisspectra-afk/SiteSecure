# SYSTEM DESIGN ENGINE PLATFORM — DISCOVERY

**Date:** 2026-09-22  
**Mode:** RESEARCH / ARCHITECTURE ONLY — ZERO IMPLEMENTATION  
**Scope:** Reverse-engineer production CCTV System Builder; derive shared vs domain-specific platform concepts  
**Quote Builder status:** CLOSED as unified commercial destination (A1–A3 verified)

**Product code changed:** NONE  
**Allowed artifact:** this document only

---

## 1. Executive product model

SITE SECURE must support two natural work modes against **one** Quote:

| Mode | User intent | System role |
|---|---|---|
| **DIRECT** | “I already know what I am selling.” | Manual Quote composition (catalog / free / labor / note / section / template) |
| **GUIDED** | “Help me determine what this installation requires.” | Domain engine → design → catalog resolve → **Apply into the same Quote** |

These are not separate quote products. The Quote Builder remains the sole commercial destination.

Guided design must keep distinct layers (do not collapse into “AI quote”):

1. **Customer requirement** — what the customer wants  
2. **Site / installation context** — where/how it will be installed  
3. **Engineering requirement** — what the system must technically satisfy  
4. **System design** — components and quantities  
5. **Catalog resolution** — which products fulfill roles  
6. **Commercial quote** — what is sold and for how much (existing Quote + server pricing)  
7. **Project delivery** — what technicians install (existing project-from-quote; out of engine scope here)

**CCTV is the only production System Builder engine today.** Alarm / Access / Intercom / Network remain enum placeholders, not engines.

---

## 2. CCTV current end-to-end architecture

### Exact verified pipeline

```text
[UI] SystemBuilderDrawer (requirements form)
        │  validateCctvBuildRequirements (client, presentational gate)
        │  requirementsToRecommendBody → CctvRecommendIn
        ▼
[API] POST /api/v1/workspaces/{id}/cctv/recommend
        │  authz: catalog.view + (quotes.create | quotes.edit)
        │  load category-scoped active products (CCTV leaf keys)
        │  strip cost from catalog for recommend response
        ▼
[PY] build_system_recommendation(raw_input, catalog_products)
        │
        ├─► [PY] build_cctv_requirements (cctv_sizing)     ← DOMAIN engineering
        │     validate → normalize → storage / recorder / PoE / cable / services
        │
        ├─► resolve_cameras / resolve_recorders / resolve_hdds /
        │   resolve_switches / resolve_cable / resolve_service  ← DOMAIN catalog match
        │
        └─► SystemRecommendation JSON
              system_type, engine_version, input, engineering,
              components[], warnings, assumptions, unresolved, blocking, status
        ▼
[UI] RecommendationReview
        │  ReviewSelectionState: selectedByRole, removedRoles
        │  candidate swap; optional role remove
        │  canAddRecommendationToQuote → CctvBuildQuoteLine[]
        ▼
[UI] QuoteBuilder.applyCctvBuildLines
        │  createOnce (ensure quote exists)
        │  createQuoteSection (“CCTV system” section name)
        │  for each line: addQuoteItem({ product_id, item_type:"catalog", qty, section_id })
        ▼
[API] quote item create + server _persist_totals / pricing.py
        ▼
[UI] Same Quote composition surface — further DIRECT edits allowed
```

### Boundary contracts (current)

| Boundary | Input | Output | Owner | Authority |
|---|---|---|---|---|
| Requirements form → API body | `CctvBuildRequirements` | `CctvRecommendIn` | Web `cctv-build-requirements.ts` | Presentational mapping |
| Client validation | Form state | ok / field error | Web | Presentational only (server re-validates) |
| Recommend HTTP | `CctvRecommendIn` | `SystemRecommendation` | `routers/cctv.py` + `cctv_recommend` | **Authoritative** |
| Sizing | Normalized input | engineering dict | `cctv_sizing` | **Authoritative** (TS twin for parity tests only) |
| Catalog resolve | Engineering + products | role components | `cctv_recommend` resolvers | **Authoritative** |
| Review / override | Recommendation + selection | `CctvBuildQuoteLine[]` | Web projection | Presentational selection; does not price |
| Apply | Lines | Quote items via API | QuoteBuilder + quotes API | Commercial **authoritative** on server |
| Pricing | Quote items | totals / VAT / cost gates | `pricing.py` + quotes router | **Authoritative** — never from recommendation `list_price` |

### Authoritative vs non-authoritative

- **Authoritative CCTV path:** `SystemBuilderDrawer` → `POST /cctv/recommend` → projection → quote APIs.  
- **Deprecated / non-authoritative:** `system-builder.ts` `buildCctvRecommendation` keyword matcher — must not drive production UI (file header documents this).  
- **TS `cctv-sizing`:** parity / tests only; production UI does not call it for recommend.

---

## 3. CCTV requirements model

### What the UI captures (`CctvBuildRequirements`)

| Field group | Examples | Conceptual layer |
|---|---|---|
| Count / environment / form | `cameraCount`, `environment`, `formFactor` | Mix of customer want + engineering input |
| Recording policy | `retentionDays`, `recordingMode`, hours, duty | Engineering input (customer-facing retention may be commercial promise) |
| Power / network intent | `poeRequired`, `architectureIntent`, `cameraMaxPowerW` | Engineering input |
| Advanced overrides | fps, codec, bitrate override, headroom | User override of engineering defaults |
| Optional scopes | remote, UPS, commissioning, installation | Customer / commercial scope flags → service roles |
| Prefill | Lead `camera_count`, `recording`, `remote_viewing`, `infrastructure`, `location` | Soft customer/lead facts — heuristic only |

### Distinction evidence (today)

| Desired layer | Exists distinctly? | Evidence |
|---|---|---|
| Customer requirements | **Partial** | Lead prefill + optional flags; no separate “customer requirements” entity |
| Site facts | **No for CCTV** | Quote may have `site_id`; CCTV recommend never reads Site |
| Engineering inputs | **Yes** | Normalized `input` inside recommendation |
| Derived engineering values | **Yes** | `engineering.storage`, `poe`, `recorder`, `hdd`, etc. |
| User overrides | **Partial** | Form advanced fields + review candidate swap; not persisted as design overrides |

**Finding:** Layers are partially encoded in one flat form + one recommend request. Architecture *should* keep them distinguishable in future contracts, but CCTV today collapses customer/lead/engineering into `CctvRecommendIn`.

---

## 4. CCTV calculation model

**Module:** `apps/api/app/cctv_sizing/__init__.py` (`build_cctv_requirements`)  
**Parity twin:** `apps/web/src/lib/cctv-sizing/*` (tests only)

### What it computes (CCTV-specific — do not generalize)

- Camera count validation / indoor+outdoor consistency  
- Recorder channel tier selection (`4/8/16/32/64`)  
- Bitrate resolution: USER_INPUT → STRUCTURED_CATALOG → ENGINEERING_DEFAULT → UNRESOLVED  
- Storage TB from bitrate × retention × recording mode × overhead  
- HDD packing (`pack_hdds`) against available capacities / bays  
- PoE ports + budget with headroom; engineering default camera watts (8W) when allowed  
- PoE architecture intent (integrated NVR vs external switch)  
- Cable meters from distance (or UNRESOLVED)  
- Service requirement list (install, setup, remote, testing, commissioning, UPS)

### Provenance (sizing)

```text
USER_INPUT | STRUCTURED_CATALOG | ENGINEERING_DEFAULT | DERIVED | UNRESOLVED
```

**Where:** `cctv_sizing` + TS twin (`ProvenanceSource`).  
**Meaning:** Tracks *how an engineering scalar was obtained* (e.g. bitrate source, PoE power source).  
**Reusable?** The *enum idea* is reusable; the *values and codes* (STORAGE_UNRESOLVED_BITRATE, POE_POWER_*) are domain-specific.  
**Additional abstraction?** Not justified yet beyond documenting the enum as a shared vocabulary candidate.

**Separate catalog-import provenance** (`DIRECT` / `NORMALIZED` / `UNKNOWN`) exists for import mapping — different concern; do not merge.

---

## 5. CCTV role / component model

### Roles produced today

| Role | Typical qty source | Optional? | Blocking if unresolved? |
|---|---|---|---|
| `camera` | `cameraCount` | No | Yes |
| `recorder` | 1 | No | Yes |
| `storage` | HDD pack qty | No | Yes |
| `poe_switch` | 1 when external architecture required | No (when present) | Yes when required |
| `cable` | meters | Yes | No |
| `camera_install` | service qty | From flags | No |
| `recorder_setup` | service qty | From flags | No |
| `remote_viewing_setup` | 1 | Yes | No |
| `testing` | 1 | From flags | No |
| `commissioning` | 1 | Yes | No |
| `ups` | 1 | Yes | No |

### Representation

Each component in `SystemRecommendation.components[]`:

- `role`, `label`, `quantity`  
- `technical_requirements` (role-specific dict)  
- `selected_product`, `selected_confidence`, `selected_compatibility`  
- `candidates[]` (max 3)  
- `resolution_status`: RESOLVED | PARTIAL | UNRESOLVED | MANUAL_REVIEW  
- `reason_codes[]`  
- `optional`, `editable`, `blocking`

### Candidate attachment

- Candidates carry `confidence`: STRUCTURED | PARTIAL | TEXT_ASSISTED | UNRESOLVED  
- Compatibility map: PASS | FAIL | UNKNOWN per constraint key  
- FAIL candidates not selectable in UI (`isCandidateSelectable`)  
- TEXT_ASSISTED never auto-satisfies required core roles on Apply

### Minimum conceptual role contract for a future engine

A future engine would need **at least**:

1. Stable `role` id (domain-scoped namespace, e.g. `cctv.camera`)  
2. `quantity`  
3. `optional` / `blocking`  
4. `technical_requirements` opaque to shared infra  
5. Ordered `candidates` + preferred selection  
6. `resolution_status` + reason codes  
7. Apply projection: `{ role, productId, qty, optional }`

**Do not invent Alarm/Access roles in this discovery.**

---

## 6. CCTV catalog-resolution model

### Intended separation (target mental model)

```text
ENGINE:   “12 camera roles with constraints X”
RESOLVER: “These products satisfy X”
QUOTE:    “Selected products at qty Y commercially”
```

### How close is CCTV today?

| Concern | Separation quality |
|---|---|
| Sizing vs resolve | **Good** — `cctv_sizing` then role resolvers |
| Category leaf keys | **Coupled to CCTV** — hardcoded frozensets in `cctv_recommend` |
| Attribute parsers | **CCTV-specific** — `catalog_attrs.parse_*` |
| Product fetch | **Shared pattern** — category-scoped workspace products |
| Pricing | **Correctly decoupled** — recommend may expose `list_price` for display; Apply uses quote APIs; pricing.py authoritative |
| Architecture decision (integrated PoE vs switch) | **Coupled** — lives inside recommend orchestration, not pure sizing |

### Coupling hotspots (document only — do not change)

1. `build_system_recommendation` orchestrates sizing + multi-pass recorder/switch decisions + HDD re-pack using selected NVR bays.  
2. Resolvers know CCTV category keys and attribute schemas.  
3. Service roles map to labor category keys.  
4. Legacy keyword matcher still exists in repo but is non-authoritative.

---

## 7. CCTV user override model

| Capability | Current behavior |
|---|---|
| Alternatives | Up to 3 candidates per role; user swap via `selectedByRole` |
| Optional removal | `removedRoles` — optional roles can be dropped before Apply |
| Unresolved required | Apply may proceed for resolved products with `incomplete` warning; TEXT_ASSISTED does not satisfy core |
| Manual after Apply | Full Quote Builder add/edit/remove — **yes** |
| Qty / price after Apply | Normal quote item edit; override_price permission unchanged |
| Re-run engine | “Adjust plan” returns to requirements; recalculate replaces recommendation in drawer memory |

Engine assists; it does not lock the Quote after Apply.

---

## 8. CCTV Apply-to-Quote boundary

### Exact Apply contract today

```text
CctvBuildQuoteLine = { role, productId, qty, optional }
```

Then:

1. `createOnce()` — ensure draft quote row  
2. `createQuoteSection` — dedicated system section (name from i18n / uniqueness helper)  
3. Sequential `addQuoteItem` with `{ product_id, item_type: "catalog", qty, section_id }`  
4. **Role is NOT stored on the quote item** — used only for partial-apply resume bookkeeping  
5. Session fingerprint (`role:productId:qty`) blocks identical re-Apply in same builder session  
6. Partial failure → recovery object (sectionId, addedRoles, remaining)

### Future shared apply reuse (conceptual)

Reusable without touching pricing:

- Projection of “selected resolved roles → catalog quote lines”  
- Section grouping convention (optional)  
- Partial-apply / fingerprint guards  
- Explicit rule: **never write unit_price from engine**

Domain-specific: which roles exist, quantities, section naming, incomplete gates.

---

## 9. CCTV persistence / reopen behavior

| Artifact | Persisted? | Where |
|---|---|---|
| Requirements form | **No** | React state; reset when drawer opens |
| Recommendation JSON | **No** | React state |
| Review selection / removals | **No** | React state |
| Engineering design entity | **No** | Does not exist |
| Provenance on quote lines | **No** | Quote items: product_id, qty, prices, discounts, section — no role/engine metadata |
| Applied commercial lines | **Yes** | Quote items + section |
| Apply fingerprint / recovery | **Session only** | QuoteBuilder local state |

**Lead prefill** re-applies soft defaults from `lead.requirements` on each open — not a saved CCTV design.

**Reconstruct design from quote lines?** **No.** Lines are ordinary catalog rows; role and engineering inputs are lost.

---

## 10. Shared concepts discovered

Derived from CCTV (candidates for platform vocabulary — not implemented):

| Concept | Evidence in CCTV | Safe to share? |
|---|---|---|
| Engine identity (`system_type`, `engine_version`) | Recommendation envelope | Yes |
| Requirements → validate → calculate → resolve → review → apply pipeline shape | Full path | Yes (shape only) |
| Component / role requirement | `components[]` | Yes (structure) |
| Required vs optional / blocking | Flags on components | Yes |
| Quantity | Per component / candidate | Yes |
| Reason codes / warnings / unresolved / assumptions | Recommendation top-level + per role | Yes (envelope) |
| Catalog candidate + confidence + compatibility | Candidate model | Yes (structure) |
| Preferred vs alternative | selected + candidates | Yes |
| Unresolved role | status + blocking | Yes |
| User overrides (selection/removal) | ReviewSelectionState | Yes (UI pattern) |
| Apply-to-Quote result lines | CctvBuildQuoteLine | Yes (minimal DTO) |
| Catalog readiness summary | `catalog_readiness` | Pattern yes; metrics domain |
| Provenance enum for scalars | Sizing sources | Vocabulary yes; codes domain |
| Category-scoped product load | Router helper | Infra pattern yes |

---

## 11. Domain-specific concepts

Must remain CCTV-owned:

- Camera count, MP, form factor, environment matching  
- Bitrate tables, retention, recording modes, storage TB math  
- NVR channel tiers, drive bays, max HDD TB, incoming bandwidth  
- PoE ports/budget, integrated vs external architecture  
- HDD packing algorithm  
- Cable distance → meters  
- CCTV leaf category keys and attribute parsers  
- Role taxonomy (`camera`, `recorder`, `storage`, `poe_switch`, …)  
- Service role → labor category mapping for CCTV install flow  
- All CCTV reason codes  
- Legacy keyword matcher (deprecated)

**Alarm zone math, door counts, badge readers, etc.:** do not invent — DOMAIN RESEARCH REQUIRED.

---

## 12. Shared vs domain matrix

| Concern | Shared infrastructure | Domain-specific engineering |
|---|---|---|
| Engine registry / identity | ✓ | Domain registers itself |
| HTTP recommend envelope | ✓ pattern | Path + payload schema per domain |
| Input validation framework | ✓ pattern | Rules per domain |
| Sizing / formulas | | ✓ always |
| Role IDs & technical_requirements | Opaque bag shared | Contents domain |
| Catalog candidate ranking interface | ✓ pattern | Matchers domain |
| Compatibility PASS/FAIL/UNKNOWN | ✓ vocabulary | Keys domain |
| Apply → quote catalog lines | ✓ | Role set domain |
| Server pricing / VAT / authz | Existing Quote platform | Never in engines |
| Share/Send/PDF/lifecycle | Existing Quote platform | Never in engines |
| Site dossier fields | Existing CRM/site | Future site-aware engines (not CCTV today) |
| Storage calculation | | CCTV |
| Camera/NVR compatibility | | CCTV |
| Alarm zone calculation | | N/A — does not exist |

---

## 13. Proposed conceptual engine contract

Based **only** on verified CCTV behavior (planning model — not an implementation plan to code now):

```text
Domain Requirements
        ↓
Validate
        ↓
Engineering Calculate
        ↓
Component Requirements / Roles
        ↓
Catalog Resolve
        ↓
Candidate Set
        ↓
User Review / Override
        ↓
Apply
        ↓
Existing Quote Composition
        ↓
Existing Server Pricing
```

| Arrow | Input | Output | Owner | Shared vs domain | Authority |
|---|---|---|---|---|---|
| Requirements → Validate | Domain req DTO | ok / field errors | Domain (+ thin client mirror) | Domain rules; shared error shape | Server authoritative |
| Validate → Calculate | Normalized input | Engineering result | Domain sizing module | Domain | Authoritative |
| Calculate → Roles | Engineering | Role requirements + qty | Domain orchestrator | Domain | Authoritative |
| Roles → Catalog Resolve | Role reqs + products | Candidates / selected | Domain resolvers | Matchers domain; fetch pattern shared | Authoritative |
| Resolve → Candidate Set | Ranked matches | Component list | Domain | Domain | Authoritative |
| Candidate → Review | Recommendation | Selection state | Web UI | Shared UX pattern | Presentational |
| Review → Apply | Selection | Quote line DTOs | Projection helper | Shared DTO shape | Presentational |
| Apply → Quote | Line DTOs | Quote items | Quote APIs | Shared commercial boundary | Authoritative commercial |
| Quote → Pricing | Items | Totals | pricing.py | Shared platform | Authoritative |

**Do not create `system_engine.py` god module.** Prefer `cctv_sizing` + `cctv_recommend` today; future sibling packages per domain.

---

## 14. Catalog readiness

### Structured fields CCTV recommend actually uses

| Family | Structured attributes used | Category keys |
|---|---|---|
| Camera | `resolution_mp`, `environment`, `form_factor`, `poe`, (`max_power_w` for sizing path) | `cameras_ip`, `cameras_analog`, `cameras_ptz`, `cameras_thermal`, `cameras_special` |
| NVR | `channels`, `poe_ports`, `poe_budget_w`, `drive_bays`, `max_hdd_tb` | `nvr`, `dvr_xvr` |
| HDD | `capacity_tb`, `surveillance_grade` | `hdd_recorders` |
| Switch | `ports`, `poe_ports`, `poe_budget_w` | switch / poe leaf keys |
| Cable | mostly `unit` + category | cat5e/cat6/… |
| Labor / UPS | category key match | labor_* / ups keys |

Also used commercially (not for engineering match): `id`, `sku`, `name`, `manufacturer`, `model`, `list_price`, `unit`, `kind`.

### Classification

| Status | Items |
|---|---|
| **CURRENTLY STRUCTURED** | Camera/NVR/HDD/Switch core attrs above; category taxonomy; manufacturer/model fields |
| **FREE-TEXT ONLY** | Product `description`; lead `infrastructure` / `location` heuristics; legacy keyword needles |
| **MISSING FOR ENGINEERING** | Consistent cable pack size; many products lack core attrs → PARTIAL/UNRESOLVED; camera power often missing; NVR without channels → TEXT_ASSISTED only |
| **NOT APPLICABLE** | Quote discounts, VAT, payment details, Share/Send |

`catalog_readiness()` already reports empty catalog / missing structured families — good platform *signal* pattern.

---

## 15. Site boundary

### What Site stores today

From `sites` (+ related): `name`, `code`, `address` jsonb, `installation_status`, `access_notes`, `customer_id`, `public_token`, zones (`site_zones`), timeline events.

### What CCTV uses today

**Nothing from Site.** Recommend body is form/lead-derived only. Quote `site_id` is orthogonal commercial/CRM linkage.

### Disconnected today

Site address, zones, access notes, installation status ↔ CCTV environment, cable distance, outdoor counts.

### If site-aware design is ever approved (conceptual needs only)

- Stable “site facts” read model (no invented fields here)  
- Explicit mapping: which facts feed which engine inputs  
- Provenance: SITE_FACT vs USER_INPUT  
- Policy: Site remains optional at quote Send under current contract; engines must not suddenly require Site without Product Owner decision  

**Do not change Site or CCTV coupling in this phase.**

---

## 16. Guided + manual hybrid implications

Verified hybrid:

1. Guided Apply inserts normal catalog lines into a section.  
2. User continues DIRECT composition (catalog, free, labor, note, discounts).  
3. No separate “CCTV quote” lifecycle.  
4. Engine does not own pricing or permissions.

Product implication: engines are **contributors**, not containers. Quote remains source of commercial truth after Apply.

---

## 17. Re-run / overwrite / duplicate behavior

Documented **current reality** (do not change in this discovery):

| Scenario | Behavior |
|---|---|
| Engine recommends A; user picks B | Selection overrides preferred candidate in drawer; Apply uses B |
| Quote edited manually after Apply | Live quote items change; no link back to recommendation |
| Reopen System Builder | Drawer **resets** to defaults (+ lead prefill); **does not** load prior design or prior applied roles |
| Re-run Calculate | New recommendation in memory; does not auto-delete prior quote lines |
| Apply same fingerprint again (same session) | Blocked by `buildSystemLastFingerprint` |
| Apply again after reopen / different lines | Creates **another** system section + more lines — **can duplicate** commercially |
| Overwrite prior engine lines | **Does not** — no smart merge/replace |

This is a critical Product Owner decision area for future guided/manual hybrid (see §27).

---

## 18. Engineering-design persistence gap

**Biggest architectural gap:**

> The engineering design (requirements + engineering result + role selections) lives only in **transient drawer state**. After Apply, only commercial quote lines remain. The design cannot be reopened, audited, diffed, or re-run with fidelity.

Quote lines are **insufficient** to represent system design:

- No role  
- No technical_requirements  
- No provenance  
- No engine_version / input snapshot  
- No candidate alternatives  
- No optional-vs-required intent  

Any future “remember design / revise design / prevent duplicate Apply” feature needs an explicit design persistence decision — **not** inferred from items.

---

## 19. Future engine isolation model

Current repo can evolve **without rewriting CCTV math**:

```text
apps/api/app/cctv_sizing/          # keep
apps/api/app/cctv_recommend/       # keep
apps/api/app/routers/cctv.py       # keep CCTV route

# Future siblings (conceptual)
apps/api/app/alarm_*/ ...
apps/web/src/lib/alarm-*/ ...
```

Shared layer (if/when justified) should be **thin contracts + helpers**, not a mega-engine:

- Recommendation envelope types  
- Apply line DTO + partial apply helpers  
- Catalog product summary shape  
- Reason-code display helpers  

`SystemBuilderType` enum already lists future domains; A1 correctly hides non-CCTV from UI until real engines exist.

---

## 20. Alarm discovery checklist

| Area | Status |
|---|---|
| Customer questions needed | DOMAIN RESEARCH REQUIRED |
| Site facts needed | DOMAIN RESEARCH REQUIRED |
| Engineering standards/rules | DOMAIN RESEARCH REQUIRED (zones, sensors, panels, notification paths) |
| Component taxonomy | DOMAIN RESEARCH REQUIRED |
| Compatibility rules | DOMAIN RESEARCH REQUIRED |
| Catalog attributes needed | DOMAIN RESEARCH REQUIRED |
| Quantity calculations | DOMAIN RESEARCH REQUIRED — do not invent |
| Optional vs mandatory | DOMAIN RESEARCH REQUIRED |
| Commissioning/labor | DOMAIN RESEARCH REQUIRED |
| Validation/test fixtures | DOMAIN RESEARCH REQUIRED |

---

## 21. Access Control discovery checklist

| Area | Status |
|---|---|
| Customer questions (doors, users, schedules) | DOMAIN RESEARCH REQUIRED |
| Site facts (doors, ingress, existing wiring) | DOMAIN RESEARCH REQUIRED |
| Engineering rules (controller capacity, readers, locks, power) | DOMAIN RESEARCH REQUIRED |
| Component taxonomy | DOMAIN RESEARCH REQUIRED |
| Compatibility (protocol, PoE vs dry contact, etc.) | DOMAIN RESEARCH REQUIRED |
| Catalog attributes | DOMAIN RESEARCH REQUIRED |
| Quantity calculations | DOMAIN RESEARCH REQUIRED |
| Optional vs mandatory | DOMAIN RESEARCH REQUIRED |
| Commissioning/labor | DOMAIN RESEARCH REQUIRED |
| Fixtures/parity | DOMAIN RESEARCH REQUIRED |

---

## 22. Intercom discovery checklist

| Area | Status |
|---|---|
| Customer questions (panels, apartments, SIP/cloud) | DOMAIN RESEARCH REQUIRED |
| Site facts (entrances, floors, network) | DOMAIN RESEARCH REQUIRED |
| Engineering rules | DOMAIN RESEARCH REQUIRED |
| Component taxonomy | DOMAIN RESEARCH REQUIRED |
| Compatibility | DOMAIN RESEARCH REQUIRED |
| Catalog attributes | DOMAIN RESEARCH REQUIRED |
| Quantity calculations | DOMAIN RESEARCH REQUIRED |
| Optional vs mandatory | DOMAIN RESEARCH REQUIRED |
| Commissioning/labor | DOMAIN RESEARCH REQUIRED |
| Fixtures | DOMAIN RESEARCH REQUIRED |

---

## 23. Network / Low Voltage discovery checklist

| Area | Status |
|---|---|
| Customer questions (ports, Wi-Fi, racks, VLANs) | DOMAIN RESEARCH REQUIRED |
| Site facts (runs, closets, power) | DOMAIN RESEARCH REQUIRED |
| Engineering rules (not CCTV PoE math reused blindly) | DOMAIN RESEARCH REQUIRED |
| Component taxonomy | DOMAIN RESEARCH REQUIRED |
| Compatibility | DOMAIN RESEARCH REQUIRED |
| Catalog attributes | DOMAIN RESEARCH REQUIRED |
| Quantity calculations | DOMAIN RESEARCH REQUIRED |
| Optional vs mandatory | DOMAIN RESEARCH REQUIRED |
| Commissioning/labor | DOMAIN RESEARCH REQUIRED |
| Fixtures | DOMAIN RESEARCH REQUIRED |

**Note:** CCTV already covers *camera PoE* as CCTV domain logic. A Network engine must not silently reuse CCTV storage/NVR formulas.

---

## 24. AI assistance boundary

| AI may assist (non-authoritative) | Must remain deterministic / domain-authoritative |
|---|---|
| Natural-language requirement capture → draft form fields | Engineering calculations |
| Question suggestions / “what to ask next” | Required component rules |
| Explanations of reason codes / assumptions | Compatibility constraints |
| Catalog search assistance / ranking hints | Commercial pricing (`pricing.py`) |
| Summarizing a recommendation for staff | Permissions / authz / RLS |
| Drafting customer-facing narrative (with review) | Share/Send lifecycle, snapshots, PDF truth |

**Rule:** LLM must not be the engineering or pricing authority.

---

## 25. Testing / parity requirements

Existing CCTV quality bar to preserve / emulate for future engines:

| Suite | Role |
|---|---|
| `test_cctv_sizing_parity.py` | Python ↔ TS sizing parity |
| `cctv-sizing.test.ts` | Client sizing unit |
| `test_cctv_recommend.py` | Resolver + recommendation contracts |
| `test_cctv_hardening.py` | Edge / unresolved / safety |
| `cctv-build-system.test.ts` | Projection / apply gates / UI contracts |
| Catalog attr parsers + readiness | Structured matching prerequisites |

Future platform rule: **each domain owns parity tests for its math**; shared infra tests cover envelope/apply only.

---

## 26. Technical risks

1. **Design amnesia** — reopen/re-run cannot restore prior engineering intent → duplicate lines risk.  
2. **Catalog sparsity** — structured attrs missing → UNRESOLVED / TEXT_ASSISTED / incomplete Apply.  
3. **Orchestration complexity in recommend** — sizing + architecture + resolve coupled; hard to extract shared infra without careful seams.  
4. **False generalization** — turning CCTV PoE/storage into “generic security formulas” would corrupt other domains.  
5. **Legacy keyword matcher** — confusion risk if ever reconnected to UI.  
6. **Site disconnection** — sales may expect Site to drive design; today it does not.  
7. **Authority drift** — if UI begins trusting recommend `list_price` or client sizing, commercial integrity breaks.  
8. **God-engine temptation** — single module for all domains would freeze CCTV evolution and invent Alarm math prematurely.

---

## 27. Product decisions required before platform implementation

1. **Design persistence:** Should engineering designs be first-class entities linked to quotes (or remain ephemeral)?  
2. **Re-Apply policy:** Replace prior engine section, merge, block duplicates, or always append?  
3. **Reopen fidelity:** Must System Builder restore last requirements/recommendation?  
4. **Site-aware design:** Approved later or explicitly out of Phase 1 platform?  
5. **Incomplete Apply:** Keep current “apply resolved + warn” or harden gates?  
6. **TEXT_ASSISTED products:** Stay manual-only or allow opt-in?  
7. **Engine versioning:** Require stored `engine_version` with designs when persistence exists?  
8. **Multi-engine quotes:** One section per engine apply vs shared composition only?  
9. **Customer vs engineering requirements UX:** Separate forms or keep flat CCTV-style form?  
10. **Catalog data quality bar:** Enforce structured attrs before recommending a family?

---

## 28. What should NOT be generalized

- Camera / bitrate / retention / storage TB math  
- NVR channel tiers and HDD packing  
- PoE port/budget and integrated-NVR architecture  
- CCTV category leaf keys and attribute schemas  
- CCTV role names as universal security roles  
- Alarm/Access/Intercom formulas (do not invent)  
- Quote pricing, lifecycle, Share/Send, PDF snapshots  
- Authz / RLS  
- Collapsing layers into one “AI generates quote” flow  
- A single `system_engine.py` containing all domains  

---

## 29. Minimum viable shared infrastructure

If/when a platform slice is justified (after Product Owner decisions), the **smallest** shared surface that CCTV already implies:

1. **Engine identity** — `system_type` + `engine_version`  
2. **Recommendation envelope** — `input`, `engineering` (opaque), `components[]`, `warnings`, `assumptions`, `unresolved`, `blocking`, `status`  
3. **Component contract** — role, qty, optional, blocking, candidates, resolution_status, reason_codes  
4. **Candidate contract** — product summary, confidence, compatibility  
5. **Apply DTO** — `{ role, productId, qty, optional }` + partial-apply/fingerprint helpers  
6. **Catalog load pattern** — workspace products by category key set (keys supplied by domain)  
7. **Display helpers** — reason-code copy mapping pattern (per-domain dictionaries)

**Explicitly not in MVP shared infra:** sizing formulas, matchers, role taxonomies, design persistence DB, Site→engine adapters, AI.

CCTV can keep current modules; shared types/helpers would be extracted later without rewriting math.

---

## 30. Recommended next research / planning step

**Do not implement yet.**

Next planning step (Phase 1.5 / Phase 2 research):

1. Product Owner workshop on §27 decisions — especially **design persistence** and **re-Apply/duplicate policy**.  
2. Produce a short **CCTV Design Persistence Options** memo (ephemeral vs quote-linked snapshot vs first-class `system_designs` table) with pros/cons — still no schema migration.  
3. Only after decisions: draft a thin **Engine Envelope ADR** (types + Apply DTO) that CCTV already satisfies, then map Alarm discovery research kickoff using §20 checklist with domain experts.

Until then: Quote Builder stays CLOSED; CCTV remains the sole production engine; no other System Builders.

---

## STOP

Research complete. No product code changes. No new engines. No Quote Builder work.
