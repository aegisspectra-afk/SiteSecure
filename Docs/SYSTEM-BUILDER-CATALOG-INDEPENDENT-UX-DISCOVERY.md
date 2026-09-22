# SYSTEM BUILDER — CATALOG-INDEPENDENT EQUIPMENT SELECTION + WIZARD UX

**Date:** 2026-09-22  
**Mode:** PRODUCT / ARCHITECTURE DISCOVERY ONLY — ZERO IMPLEMENTATION  
**Scope:** Existing CCTV System Builder only  
**Constraints:** Do not modify R1–R3 architecture; do not start another domain engine  

**Product code changed:** NONE  
**Allowed artifact:** this document only  

---

## 1. Executive product problem

CCTV engineering can already succeed with an empty catalog:

```text
requirements → build_cctv_requirements → valid engineering
  (cameras, NVR channel tier, storage TB, PoE, services…)
```

Catalog matching then runs. With zero matching products, core roles become
`resolution_status=UNRESOLVED` + `blocking=true`, recommendation
`status=BLOCKED`, and Apply gate returns empty / blocked.

**The seller experiences “system cannot be completed” even though engineering completed.**

That conflates four different ideas:

| Layer | Question |
|---|---|
| Engineering | What must the installation satisfy? |
| Equipment intent | What does the seller intend to offer? |
| Catalog resolution | Is there a structured workspace product? |
| Commercial Quote | What line is sold, at what price? |

**Principle:** Catalog improves automation. Catalog must not be mandatory to use System Builder.

---

## 2. Engineering vs equipment vs catalog vs commercial model

Proposed conceptual pipeline (aligns with existing platform discovery; adds Equipment Intent):

```text
Requirements (seller/customer answers)
    → Engineering Design (deterministic sizing + roles + qty/specs)
    → Equipment Intent (brand / characteristics / model text / later)
    → Catalog Product (OPTIONAL structured link)
    → Quote Composition (catalog OR free/labor line)
    → Pricing (server-authoritative Quote rules)
```

| Concept | Lives today | Owner of truth |
|---|---|---|
| Requirements | `CctvBuildRequirements` / Design `requirements` | Seller input |
| Engineering | `engineering` on recommend + Design | Server sizing (`cctv_sizing`) |
| Catalog candidates | `components[].candidates` / selected product | Workspace catalog |
| Commercial line | `quote_items` | Quote + `pricing.py` |
| **Equipment Intent** | **Mostly missing** | Proposed Design-side (not fake catalog) |

Do **not** invent SKU, catalog product id, catalog verification, cost, or authoritative catalog price when no product exists.

---

## 3. Current empty-catalog failure mode

Verified behavior:

1. `build_cctv_requirements` can return `valid: true` with empty catalog.  
2. `resolve_*` returns `UNRESOLVED` + `blocking: true` for camera / recorder / storage (and PoE switch when required).  
3. Recommendation `blocking=true` → `status: "BLOCKED"`.  
4. Warning `CATALOG_EMPTY` + UI banner (`cpqCctvCatalogEmptyTitle`) correctly says engineering was calculated.  
5. `canAddRecommendationToQuote` with no pickable products → `{ ok: false, reason: "empty" }`.  
6. UI then shows **“לא ניתן להשלים את המערכת”** (`cpqCctvCannotComplete`) when Apply is blocked.  
7. R3 Apply only proposes lines with a selected `product_id` (`effective_product_id`); no catalog → no Apply lines.

**Failure mode:** Engineering success is visually acknowledged, then commercial/equipment UX treats missing catalog as system incompleteness.

---

## 4. Current CCTV state model

### Recommendation / component (API)

| Field | Values (observed) | Meaning today |
|---|---|---|
| `status` (recommendation) | `OK` / `BLOCKED` / `INVALID_INPUT` | Catalog-blocking conflated with engineering invalid |
| `resolution_status` | `RESOLVED` / `PARTIAL` / `UNRESOLVED` (+ UI `MANUAL_REVIEW` type) | Mostly **catalog match** status |
| `selected_confidence` | `STRUCTURED` / `PARTIAL` / `TEXT_ASSISTED` / `UNRESOLVED` | Catalog confidence |
| `blocking` (component) | bool | Required role without catalog match → true |
| `optional` | bool | Can remove in UI |
| Design `selection_origin` | `ENGINE_PREFERRED` / `USER_OVERRIDE` / `UNSELECTED` | Selection source for Apply |
| Design `needs_review` | bool | Stale selection after recalc |

### UI projection

`componentKindLabel`: UNRESOLVED or TEXT_ASSISTED → **“MANUAL”** — again catalog/verification language, not “engineering incomplete.”

### Apply gate (`canAddRecommendationToQuote`)

- `INVALID_INPUT` → hard block  
- Missing catalog picks on required roles → `incomplete` (if some lines exist) or `empty` (zero lines)  
- TEXT_ASSISTED never auto-satisfies required core  

---

## 5. Proposed resolution-state model

Do **not** force one enum for everything. Prefer **orthogonal dimensions**:

### A. Engineering completeness (role / system)

| State | Meaning |
|---|---|
| `ENGINEERING_INCOMPLETE` | Engine cannot determine requirement (invalid input, unresolved bitrate, etc.) |
| `ENGINEERING_COMPLETE` | Spec/qty/role known from sizing |

### B. Equipment decision (seller)

| State | Meaning |
|---|---|
| `EQUIPMENT_UNSELECTED` | Engineering known; seller has not chosen intent |
| `EQUIPMENT_SPECIFIED` | Brand/spec/model intent without catalog link |
| `CATALOG_RESOLVED` | Linked structured `product_id` |
| `NEEDS_REVIEW` | Prior selection incompatible after recalc (existing) |

### C. Commercial readiness (Quote / Send)

Separate from A/B: price present?, draft vs send gates, etc.

**Mapping from today:**

| Today | Split into |
|---|---|
| `INVALID_INPUT` | Engineering incomplete |
| `UNRESOLVED` + empty candidates + valid engineering | Engineering complete + equipment unselected / no catalog |
| `RESOLVED` / STRUCTURED product | Catalog resolved |
| `TEXT_ASSISTED` | Weak catalog candidate — still not Equipment Intent |
| `needs_review` | Needs review (keep) |
| Recommendation `BLOCKED` solely from catalog gaps | **Should not equal engineering failure** |

Minimum V1 vocabulary for UX copy: Engineering complete / Equipment pending / Catalog linked / Needs review.

---

## 6. Equipment Intent concept

**Equipment Intent** = seller’s commercial/technical offer for a role **without** requiring a catalog product.

Example:

```text
role: camera
quantity: 4
engineering: 8MP, outdoor, turret, PoE
preferred_manufacturer: Hikvision
model_reference: (optional)
catalog_product_id: null
equipment_state: SPECIFIED / NOT_CATALOG_LINKED
```

**Not** the same as engineering unresolved.

**Not** a fake catalog row (no invented SKU/id/list_price/cost).

**Persistence (concept):** Design-side fields on `system_design_components` (or nested JSON on technical/selection docs) — **PO + schema decision**. Must not add provenance columns to `quote_items` (R3 invariant).

---

## 7. Brand / manufacturer model

### What exists

- Product field: `products.manufacturer` (free text per catalog row)  
- Requirement: `manufacturerPreference` (free text, advanced form) used as soft match bias in resolve  
- No workspace brand registry, no hardcoded global CCTV brand list in code  

### V1 recommendation (smallest)

1. **Free-text manufacturer preference** on Equipment Intent (and keep requirements preference as soft bias).  
2. **Suggest** manufacturers from distinct `products.manufacturer` in workspace catalog when non-empty.  
3. Do **not** hardcode Hikvision/Dahua/… as product truth.  
4. Optional later: workspace-configured brand list — only if sellers need consistency across empty catalogs.

“Other / manual” = empty or free text, not a special enum unless UX needs it.

---

## 8. Manual equipment specification

When no catalog product:

| Allowed (concept) | Class |
|---|---|
| manufacturer | Equipment intent |
| model / reference text | Equipment intent |
| role-relevant engineering attrs (display from Design) | Engineering (read-mostly) |
| quantity | Engineering (engine) / confirm in UI |
| commercial description (for Quote line) | Commercial presentation |
| unit price (seller-entered via Quote rules) | Commercial — server persists |

| Forbidden | Why |
|---|---|
| Invented catalog `product_id` / SKU identity | Catalog integrity |
| Invented cost / list_price as catalog authority | Money authority |
| Generic arbitrary technical schema platform | Out of scope |

Use CCTV role `technical_requirements` already produced by the engine; do not invent a new attribute DSL.

---

## 9. Existing Quote free / manual-line capabilities

Verified Quote support:

| Capability | Status |
|---|---|
| `item_type: free` without `product_id` | Supported (`QuoteItemIn`) |
| `item_type: labor` | Supported |
| Description / name / sku (optional text) | Supported |
| `unit_price` seller-supplied | Supported; free lines default 0 if omitted |
| `cost` | Permission-gated (`quotes.view_cost` / cost write rules) |
| Catalog line | Requires product; list_price/cost from catalog |
| Override catalog price | Needs `quotes.override_price` when ≠ list |

**Conclusion:** Free/manual lines **can commercially represent**  
“4 × Hikvision 8MP Turret — model TBD” **without** creating a fake catalog product.

---

## 10. Price / cost authority without catalog

| Field | Non-catalog policy |
|---|---|
| Unit price | Seller enters on Apply or after on Quote; server stores via existing item APIs; **no invented catalog price** |
| Cost | Optional; only if permitted; never invent |
| Totals / VAT / margin | Always `_persist_totals` / `pricing.py` |
| Design JSON | Must not dictate money (already stripped on Design) |

Send remains subject to existing `validate_for_send` / QUOTE_INCOMPLETE rules — zero-price lines may be draft-OK but Send-blocked depending current rules (do not change pricing.py; PO decides draft vs Send policy for TBD pricing).

---

## 11. R3 Apply compatibility analysis

R3 today (locked):

- Atomic owned Apply  
- Design-side `quote_item_id` ownership  
- Engineering fingerprint = `product_id|qty` (+ expect catalog `item_type`)  
- Divergence confirmation  
- Commercial-edit preserve when same engineering identity  
- Server money authority  

**Gap:** Apply prepares **catalog-only** lines. Non-catalog components are skipped (`effective_product_id` null). Divergence treats non-`catalog` owned items as engineering CHANGED.

| Question | Answer |
|---|---|
| Can free items represent intent? | Yes commercially |
| Can R3 safely own free items today? | **Not without contract change** — fingerprint + RPC insert assume catalog |
| Can we weaken R3? | **No** — discovery only; any extension must preserve invariants |

**High-risk change (future, not now):** Extend owned Apply to allow `item_type=free|labor` with an **intent fingerprint** (not product_id), still server-prepared commercial fields, still bounded delete of owned ids only.

Alternative **safer V1 path:** Keep R3 catalog-only; allow Equipment Intent on Design; Apply only catalog-resolved roles; free lines for intent-only roles via a **separate, explicit** Apply path or post-Apply Quote composition — worse UX, lower risk to R3.

**PO must choose** risk appetite (see §27).

---

## 12. Fingerprint implications

Today:

```text
{product_id}|{qty}
```

Without `product_id`, product-based fingerprint is undefined.

**Candidates for intent fingerprint (if owned free lines later):**

```text
role_key|qty|manufacturer|model_ref|desc_hash
```

or stable Design `component_id` + qty + intent hash.

Must still:

- Ignore commercial unit_price / discount / section for engineering divergence  
- Detect qty / product / intent identity change  
- Treat missing owned item as MISSING  

**Do not** put price in fingerprint (existing R3 rule).

---

## 13. Re-Apply implications

| Scenario | Desired |
|---|---|
| Design engineering changed, Quote owned output still matches last applied fingerprint | Clean replace (today for catalog) |
| Seller edited owned free-line description/price only | Commercial preserve (extend preserve rules) |
| Seller changed qty / swapped catalog product / changed intent identity | Divergence → confirmation |
| Later catalog link replaces free line | See §14 |

Without R3 free ownership, Re-Apply cannot safely manage non-catalog lines atomically.

---

## 14. Later catalog-resolution flow

Desired product flow:

```text
Equipment Intent (no product_id)
  → user picks catalog product matching role
  → Design: CATALOG_RESOLVED
  → next Apply/Re-Apply: replace owned free line with catalog line
     OR update linkage in one atomic owned replace
```

Requirements for safety:

- Confirmation if commercial identity changes materially  
- Preserve unit_price/discount when engineering identity “same role+qty” and PO says so  
- Never invent cost from old free line as catalog cost — reload catalog cost  

This is a **new R3-compatible evolution**, not a silent merge engine.

---

## 15. Services / labor distinction

Current: installation / recorder config / testing / UPS / commissioning resolved via `resolve_service` against labor categories; often `SERVICE_UNRESOLVED`, **non-blocking**.

**Recommendation:** Do **not** force manufacturer/model Equipment Intent UX onto services.

| Kind | Model |
|---|---|
| Physical equipment (camera, NVR, HDD, switch, cable) | Engineering + Equipment Intent + optional catalog |
| Services / labor | Engineering service requirement + optional labor catalog OR free/labor Quote line |

Keep separate copy and UI section (“שירותים”) from (“ציוד”).

---

## 16. HDD / cable / unresolved classification

| Signal | Class | Notes |
|---|---|---|
| Invalid cameras/retention/resolution/hours | **ENGINEERING INPUT MISSING** | `INVALID_INPUT` |
| `STORAGE_UNRESOLVED_BITRATE` | **ENGINEERING INCOMPLETE** | Cannot size storage |
| `HDD_OPTIONS_EMPTY` (sizing pack) | Often **ENGINEERING CALCULATED TB + PRODUCT/CAPACITY MISSING** | TB known; pack needs capacities |
| Catalog empty / no structured HDD attrs | **CATALOG ATTRIBUTE / PRODUCT MISSING** | Engineering TB still valid |
| `CABLE_DISTANCE_UNRESOLVED` | **ENGINEERING INPUT MISSING** (optional) | Non-blocking; meters not entered |
| Cable meters set, no cable SKU | **CATALOG PRODUCT MISSING** / optional commercial | Cable optional |
| `SERVICE_UNRESOLVED` | **OPTIONAL COMMERCIAL / LABOR MISSING** | Non-blocking |
| Core role UNRESOLVED + empty candidates + valid engineering | **EQUIPMENT / CATALOG PENDING** | Not engineering failure |

UI must not present all as one “cannot complete” bucket.

---

## 17. Current Wizard UX audit

`SystemBuilderDrawer` is effectively **two steps**: Requirements → Review (calculate mixes engineering summary + catalog resolution + Apply).

Requirements form (basic + advanced already partially collapsed):

**Always visible:** camera count, environment, resolution, retention, recording mode, PoE, installation  

**Advanced toggle:** FPS, codec, bitrate, hours/duty, headroom, manufacturer preference, cable meters, camera wattage, architecture, remote viewing, UPS, commissioning, form factor  

Review: engineering summary card, empty-catalog CTAs, cannot-complete / incomplete banners, component groups with candidate swap / remove optional.

**Problem:** One “review” screen does both “show the plan” and “resolve catalog,” so empty catalog feels like plan failure.

---

## 18. Proposed Requirements stage — דרישות

Seller/customer questions only:

| Keep in basic | Rationale |
|---|---|
| Camera count | Core |
| Indoor/outdoor | Core |
| Resolution | Core |
| Retention days | Core |
| Recording behavior | Core |
| PoE needed | Common install |
| Installation requested | Service intent |

| Collapse under Advanced | Rationale |
|---|---|
| FPS, codec, bitrate override | Expert overrides |
| Headroom, camera wattage | Expert |
| Architecture intent | Expert |
| Cable meters | Optional infra (prompt when relevant) |
| Manufacturer preference | Move primarily to Equipment stage; optional soft bias may remain advanced |
| Form factor | Prefer Equipment stage |
| Remote / UPS / commissioning | Service toggles — keep simple or move to services subsection |

Feel: **“בנה מערכת”**, not an engineering database form.

---

## 19. Proposed Engineering Design stage — תכנון

Show deterministic engineering **before** catalog resolution:

- Role list + quantities  
- NVR ≥ N channels  
- Storage ≈ X TB  
- PoE ports / budget  
- Cabling requirement status  
- Services required  

Distinguish:

- **Engineering warnings** (input/sizing)  
- **Catalog availability** (separate, non-fatal banner)

Empty catalog: still show full תכנון with status “תכנון הושלם · ציוד ממתין.”

No Apply from this stage alone (unless PO wants draft engineering-only — not recommended).

---

## 20. Proposed Equipment stage — ציוד

Per engineering role (physical equipment):

- Use recommended catalog product (if any)  
- Choose another catalog product  
- Specify equipment without catalog (Equipment Intent)  
- Prefer manufacturer  
- Leave exact product for later (`EQUIPMENT_UNSELECTED`)  
- Remove **optional** only (existing semantics)  

Mandatory roles cannot be removed without existing domain rules.

Services: separate list — pick labor catalog or free labor line / leave later — not brand/model chrome.

Catalog CTAs remain accelerators: בחר מהקטלוג / הוסף מוצר / ייבא מחירון — not blockers.

---

## 21. Progressive disclosure / advanced settings

| Layer | Content |
|---|---|
| Requirements basic | §18 basic fields |
| Requirements advanced | Expert overrides only |
| Engineering stage | Read-only engineering result + warnings |
| Equipment advanced | Per-role model text, attribute tweaks display, catalog search |

Do not dump all fields on first viewport.

---

## 22. Empty-catalog UX

**Stop saying:** system cannot be completed (when engineering is valid).

**Direction (conceptual — not final copy):**

- התכנון ההנדסי הושלם  
- נותר לבחור ציוד עבור N רכיבים  
- אפשר: מהקטלוג / ציוד ללא קטלוג / להשאיר לאיחור  

**Supportable now without code change:** show engineering summary + catalog CTAs (partially exists).  

**Not supportable until Apply/intent work:** Apply meaningful non-catalog lines via R3; manufacturer selection persisted as Equipment Intent; three-stage wizard.

---

## 23. Apply eligibility

| Condition | Block Apply? |
|---|---|
| Engineering invalid / incomplete for core sizing | **Yes** |
| Equipment unselected on required physical roles | **PO decision** — recommend Yes for customer-facing completeness, or allow “requirement-only” draft lines (risky) |
| Equipment specified, no catalog | **No automatic block** *if* free-line Apply path exists safely |
| Catalog missing but some roles catalog-resolved | Allow partial Apply of resolved roles (today) with incomplete warning |
| TEXT_ASSISTED only on core | Keep non-auto (today) |
| Optional unresolved | No |

**Today:** No catalog → Apply empty → blocked. That must change for the product goal, but only with a safe commercial representation path.

---

## 24. Customer-facing Quote implications

| Pattern | Example | Allow into customer Quote? |
|---|---|---|
| **A. Catalog resolved** | 4 × Hikvision DS-XXXX @ list/override | **Yes** (today) |
| **B. Equipment specified, no catalog** | 4 × Hikvision 8MP Turret · Model TBD · seller price | **Yes for draft**; Send only if price/policy OK (**PO**) |
| **C. Engineering requirement only** | 4 × Outdoor 8MP PoE cameras · equipment not selected | **Draft maybe**; **Send generally No** — too vague for commitment (**PO**) |

Recommendation: Allow **B** into Quote when seller accepts price responsibility; keep **C** as Design-only until Equipment Intent or catalog exists.

---

## 25. Mobile implications

Do not alter closed Quote Builder bottom architecture / docks.

Wizard changes must fit existing `QuoteFlowSheet` sheet patterns:

- Progressive stages inside the same sheet  
- Equipment Intent editors as inline sections / secondary sheet  
- Confirmation stays drawer/modal (R3 pattern)  

No new persistent dock.

---

## 26. Schema / API gaps

| Gap | Layer |
|---|---|
| No Equipment Intent fields on components | Design schema / API |
| Recommend `BLOCKED` conflates catalog gaps | CCTV recommend status semantics |
| Apply catalog-only | R3 Apply + RPC |
| Fingerprint needs product_id | R3 |
| Free owned lines + item_type divergence | R3 detect_divergence |
| Wizard is 2-step not 3-step | Frontend only (possible without schema) |
| Brand registry | Not required for V1 |

**Protected:** Do not add `source_*` on `quote_items`; do not move pricing to SQL; do not rewrite sizing math.

---

## 27. Product Owner decisions required

1. May **B** (specified, no catalog) enter customer-facing Quote / Send? At what price rules?  
2. Is **C** (requirement-only) ever Apply-able?  
3. Extend **R3** to own free/labor lines vs keep R3 catalog-only + parallel composition?  
4. Must all required physical roles have Equipment Intent or catalog before Apply?  
5. Manufacturer: free text only vs workspace brand list?  
6. Partial Apply of catalog roles while others remain intent-only — allowed?  
7. Zero unit_price draft lines — allowed until Send?

---

## 28. Risks

| Risk | Severity |
|---|---|
| Weakening R3 ownership/fingerprint for free lines | High — cross-delete / silent commercial destroy |
| Fake catalog products to “unblock” UX | High — data pollution |
| Conflating service unresolved with equipment | Medium — UX noise |
| Allowing C into customer PDF | Medium — credibility |
| Wizard rewrite without state split | Medium — same empty-catalog trap |
| Hardcoded global brands | Low/Medium — wrong for multi-market |

---

## 29. Minimum safe implementation path

**Phase 0 — UX/copy only (lowest risk)**  
Separate banners: engineering complete vs catalog pending; stop “cannot complete” when engineering OK; keep Apply catalog-only.

**Phase 1 — Equipment Intent on Design (no Apply change)**  
Persist manufacturer/model/intent state; Equipment stage UI; still Apply only catalog-resolved.

**Phase 2 — Quote free lines for intent (explicit)**  
Either:  
(2a) Controlled extension of R3 owned free Apply + intent fingerprint, **or**  
(2b) Non-owned free lines inserted via existing item API (weaker ownership; document divergence limits).

**Phase 3 — Catalog resolution upgrade path**  
Intent → catalog link → atomic replace with confirmation/preserve rules.

**Never:** invent catalog rows; change pricing formulas; start Alarm/Access engines.

---

## 30. What must remain unchanged

- R1 Design persistence / tenancy / CAS  
- R2 hydrate-from-Design (not from Quote lines)  
- R3 atomic owned Apply invariants (until an explicit, tested extension)  
- `pricing.py` / server money authority  
- CCTV sizing math  
- Quote lifecycle Share/Send/PDF/snapshot  
- Quote Builder mobile bottom stack  
- No `quote_items` provenance columns  
- No new domain engines  

---

## Final questions — answers

1. **Can CCTV engineering be COMPLETE with zero catalog products?**  
   **Yes.** Sizing/`valid` engineering does not require catalog. Catalog matching is a separate layer that currently over-blocks UX/Apply.

2. **What exactly should “unresolved” mean?**  
   Split it: **engineering incomplete** vs **equipment unselected** vs **catalog not linked** vs **needs review**. Today `UNRESOLVED` mostly means “no catalog match.”

3. **What is Equipment Intent?**  
   Seller’s brand/spec/model/qty offer for a role without a catalog `product_id` — not fake catalog, not engineering failure.

4. **Can a user select a manufacturer without a catalog product?**  
   **Yes (product should allow).** Today preference is free text on requirements; not a full Equipment Intent model. V1: free text + optional suggestions from workspace manufacturers.

5. **Can existing Quote free/manual items safely represent non-catalog equipment?**  
   **Commercially yes** (description/name/qty/unit_price). **R3 ownership today: no** without contract extension.

6. **How should price work for that item?**  
   Seller-entered `unit_price` via existing Quote item rules; cost optional/permissioned; totals via Python recalculation; never invent catalog list_price/cost.

7. **How would R3 ownership/fingerprint work without product_id?**  
   Needs a new intent-based fingerprint and RPC support for free/labor inserts; high-risk; must keep bounded deletes + confirmation. Not implementable as a silent tweak.

8. **Can later catalog resolution replace manual intent safely?**  
   **Yes, conceptually**, via confirmed owned replace (intent → catalog), preserving commercial fields when identity rules say so. Not built today.

9. **Which fields belong in basic Requirements vs Advanced?**  
   Basic: count, environment, resolution, retention, recording, PoE, install. Advanced: bitrate/codec/FPS/headroom/wattage/architecture/cable meters; manufacturer/form factor prefer Equipment stage.

10. **What should the empty-catalog screen look like conceptually?**  
    Engineering success + “N equipment choices remaining” + catalog accelerators + specify-without-catalog / later — **not** “cannot complete the system.”

11. **What should block Apply?**  
    Engineering incomplete for core sizing. Catalog absence alone should not. Missing equipment decision on required roles — **PO**. Non-catalog Apply only if free-line path is safe.

12. **What requires a Product Owner decision before implementation?**  
    §27 — especially Quote pattern B/C, R3 free ownership vs not, Apply completeness rules, Send with TBD price.

---

## STOP

Discovery only. No product code, migrations, or tests modified. No next engine started.
