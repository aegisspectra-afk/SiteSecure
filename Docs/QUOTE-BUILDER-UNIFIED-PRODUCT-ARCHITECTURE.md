# Quote Builder — Unified Product Architecture

**Date:** 2026-09-22  
**Type:** Product architecture / planning only  
**Sources:**  
- [`Docs/QUOTE-BUILDER-CAPABILITY-AUDIT.md`](./QUOTE-BUILDER-CAPABILITY-AUDIT.md)  
- [`Docs/QUOTE-BUILDER-PRODUCT-DECISIONS.md`](./QUOTE-BUILDER-PRODUCT-DECISIONS.md)  

**Scope:** **Zero implementation.** No product code, UI, API, pricing, authz, PDF, CCTV engines, or tests.

---

## 1. Product thesis

SITE SECURE Quote Builder exists so a security company can produce **one accurate professional proposal** for a customer.

That proposal may be composed by different **input methods**:

| Input method | Intent |
|---|---|
| Manual / free lines | “I know exactly what I sell.” |
| Catalog selection | “Pick commercial equipment from our catalog.” |
| Templates / packages | “Start from a known kit / proposal pattern.” |
| System Builder (CCTV today) | “Help me determine what the system needs.” |

These are **not separate quote products**.

They are **contributors into one Quote**, which then uses **one pricing authority**, **one customer proposal**, **one approval path**, and **one handoff into delivery**.

### Core principle

> The user has ONE goal: build the best accurate professional proposal.  
> Multiple ways in. One quote out.

### Working decisions incorporated (from Product Decision Pass)

| Decision | Architectural implication |
|---|---|
| Customer approval remains the approval model | No parallel staff-approve product |
| “שליחה לאישור” should eventually say customer | Terminology aligns to one proposal lifecycle |
| Site optional early; required for project-from-quote | Site is lifecycle connector, not quote prerequisite |
| Site does not drive pricing/CCTV today | Do not invent site-calc coupling without domain design |
| Section discounts / notes / clearer labor | Belong to **unified composition**, not new products |
| VAT / totals / cost / override protected | System Builder never becomes a second money engine |
| Hide fake System Builder breadth | Only real engines appear as engines |
| Future engines must be real domain engines | Same contract as CCTV; no stub parity |
| Sent customer versions = immutable customer truth | Snapshot is customer-facing source of truth |
| Share ≠ Send | Explicit product semantics |
| Send idempotency | Hardening, not architecture change |
| Unsaved terminology = actual persistence | Local draft vs server draft must stay honest |

---

## 2. Current architecture (reality)

### Canonical object today

One **Quote** (`quotes` + `quote_items` + optional `quote_sections`) owned by a workspace, optionally linked to customer/site/lead.

| Layer | Current owner |
|---|---|
| Composition UI | `QuoteBuilder` (+ lines panel, drawers, modals) |
| Persistence | FastAPI quote/CPQ routers via `createOnce` / item APIs |
| Engineering recommendation | CCTV only (`cctv_sizing` + `cctv_recommend`) |
| Money | FastAPI `pricing.recalculate` → stored totals |
| Customer proposal | Document / public snapshot / PDF |
| Approval | Public customer portal |
| Delivery | Project-from-quote (needs site) |

### How content enters a quote today

```
Manual free lines ──┐
Catalog picks ──────┤
Templates/packages ─┼──► quote_items (+ sections) ──► pricing.recalculate ──► totals
CCTV System Builder ┘         (same tables / same APIs)
```

**Fact:** Convergence already happens at **quote lines + server pricing**. The fragmentation is mostly **product/UX framing**, not separate databases.

---

## 3. Current fragmentation

The implementation is closer to unified than the UI sometimes feels.

| Fragmentation signal | Why it feels like multiple tools |
|---|---|
| System Builder drawer with Alarm/Access/… options | Suggests many engines; only CCTV works |
| Stepper labels (פרטים / פריטים / תמחור / בדיקה) | Can feel like a wizard; actually scroll navigation |
| Separate mobile dock vs desktop sidebar | Two presentation shells; same quote |
| “שליחה לאישור” | Sounds like internal workflow; is customer send |
| CCTV apply vs manual add | Same lines after apply; origin may feel special |
| Site soft at send / hard at project | Two lifecycle meanings without clear product story |
| Staff PDF vs public snapshot | Two document truths after send |
| Share vs Send | Two outbound actions without sharp semantics |
| Hidden backend composition tools | Section discounts / notes under-exposed |

**Not fragmentation (already unified):**

- One quote ID / version  
- One item table and recalculate path  
- One public approval portal  
- Catalog as shared product source for catalog lines and CCTV resolution  

---

## 4. Unified Quote model

### Canonical Quote (target = current core)

A Quote is the commercial offer object containing:

| Concern | Belongs on Quote |
|---|---|
| Who | Customer (required to send) |
| Where (when known) | Site (optional early; required for project) |
| Offer metadata | Title, validity, terms, notes, discounts, VAT rate |
| Structure | Sections |
| Composition | Lines (catalog / free / labor / note) |
| Authority totals | Server subtotal / VAT / gross / cost / margin |
| Lifecycle | Status + version |
| Customer truth | Version snapshot after send |
| Provenance (optional internal) | Template/package/system/manual origin — must not split UX |

### Conceptual lifecycle

```
CUSTOMER / SITE
        ↓
NEEDS / SYSTEM DESIGN          ← guided engineering inputs (optional)
        ↓
QUOTE COMPOSITION              ← ONE surface for all sources
        ↓
PRICING                        ← ONE server authority
        ↓
CUSTOMER PROPOSAL              ← preview / PDF / public version
        ↓
CUSTOMER APPROVAL
        ↓
PROJECT / DELIVERY
```

---

## 5. Quote composition sources

| Source | Role | Converges into |
|---|---|---|
| **Manual** | Direct authoring of free/custom lines | `quote_items` |
| **Catalog** | Select commercial products | `quote_items` (catalog type + snapshot) |
| **Template / package** | Seed structured content | Sections + items via apply APIs |
| **System Builder** | Requirements → recommend → resolve → apply | Items (typically catalog) + section |

All sources must leave the user on the **same composition surface** with the **same edit/delete/discount/price-override rules** (subject to permissions and draft state).

---

## 6. Direct / manual path

**Intent:** Experienced installer knows the bill of materials.

```
Customer (+ optional Site)
  → Quote Builder composition
  → Add catalog / free / labor-as-service / notes (when exposed)
  → Adjust qty/price/discount
  → Server pricing
  → Preview → Send → Customer approval
```

**Architecture rule:** Direct Mode is an **interaction approach**, not a separate app. No forced wizard.

---

## 7. Guided / System Builder path

**Intent:** User wants SITE SECURE to help determine what is needed.

```
Customer (+ optional Site)
  → Open System Builder (CCTV today)
  → Enter requirements
  → Domain calculation + recommendation
  → Catalog candidate resolution
  → User review / alternatives / remove optional
  → Apply into Quote Composition
  → Continue on same Quote (edit, add manual lines, price)
  → Server pricing → proposal → approval
```

**Architecture rule:** Guided Mode contributes composition; it does **not** own commercial totals or customer approval.

---

## 8. Hybrid composition

Hybrid is a first-class expectation, not an edge case.

**Example (supported by current CCTV path + manual lines):**

1. CCTV engine recommends 12 cameras + NVR + HDD + switch + cable  
2. User swaps an NVR candidate  
3. User removes optional UPS  
4. User manually adds installation labor, monitor, cabinet, custom free line, note  
5. User applies quote-level or line discounts  
6. One proposal goes to the customer  

**Rules:**

- After apply, engine lines are normal quote lines (editable under draft rules).  
- Provenance may exist internally (package id, system apply fingerprint, catalog snapshot) for audit/re-apply guards — **not** a second workflow lane.  
- Do not create “engine items” vs “manual quote” products.

---

## 9. Customer relationship

| Question | Architectural answer |
|---|---|
| Who is buying? | Customer |
| Across lifecycle | Same `customer_id` from draft → send → public proposal → project |
| Required when? | Required to **send**; draft may start unassigned |
| Clear / switch | Switch exists; clear-UI is a deliberate open decision — not a separate quote type |

Customer does not change pricing formulas; customer changes **who receives the proposal** and CRM linkage.

---

## 10. Site relationship

| Concept | Answers |
|---|---|
| Customer | WHO is buying? |
| Site | WHERE will this system exist? |
| Requirements | WHAT must the installation accomplish? |
| System Builder | WHAT equipment/quantities satisfy requirements? |
| Quote | WHAT are we offering commercially? |
| Project | WHAT are we delivering operationally? |

### Current boundary (do not invent coupling)

- Site **optional** during early composition/send.  
- Site **required** for project-from-quote.  
- Site **does not** drive pricing today.  
- Site **does not** drive CCTV calculations today.  

### How to stay connected without premature dependencies

- Soft readiness can encourage site when known.  
- Selecting site may copy name/address into project fields (already).  
- Future site-aware engineering would be a **new domain design**, plugged as inputs to engines — not a silent pricing fork.

---

## 11. Catalog relationship

Catalog is the shared **commercial equipment source**.

| Path | Catalog role |
|---|---|
| Manual | User picks products |
| Templates/packages | Seed from packaged catalog content |
| System Builder | Resolves recommended roles to catalog candidates |

### Already fits

- Catalog add → quote line with `catalog_snapshot`  
- CCTV recommend → product ids → `addQuoteItem`  
- Kind map (`service`→`labor`, etc.)  

### Diverges / weak

- Labor clarity (catalog kind vs first-class composition action)  
- Note lines under-exposed  
- Non-catalog free lines remain necessary for true custom offers  

Architecture: free lines stay valid; catalog is preferred for standard equipment, not mandatory for every row.

---

## 12. Template / package relationship

Templates/packages are **composition accelerators**:

```
Template/Package apply → sections + lines → same Quote → same pricing
```

They must not create a parallel lifecycle. After apply, behavior equals manual/catalog composition (edit, discount, send).

---

## 13. Pricing boundary

### One pricing authority

| System Builder may decide | Pricing owns |
|---|---|
| WHAT is needed | Unit economics after lines exist |
| HOW MUCH (qty) | Line nets, discounts stack, VAT, gross |
| WHICH catalog candidates | Cost/margin under authz |
| — | Override rules, strip rules |

**Never:** React-owned final totals.  
**Never:** Engine-owned commercial gross as source of truth.  
**Preserve:** FastAPI `pricing.recalculate`, VAT rules, discounts, `view_cost`, `override_price`, technician restrictions.

Client helpers (`previewLineNet`, scope breakdown) remain **display-only**.

---

## 14. System Builder boundary

System Builder = **engineering contribution engine** into Quote Composition.

| In scope | Out of scope |
|---|---|
| Requirements capture | Becoming the Quote app |
| Domain calculation | Owning VAT/totals |
| Recommendation + catalog resolve | Separate customer approval |
| User review / alternatives | Separate PDF product |
| Apply to quote lines | Fake multi-domain breadth |

Today: **CCTV only** is a real engine.  
Alarm / Access / Intercom / Network / Low Voltage / Combined: **not engines** — must not be promoted as such.

---

## 15. CCTV as reference engine

CCTV is the factual reference implementation of the engine contract:

```
Requirements Input
  → Validation (client + server)
  → Engineering Calculation (Python cctv_sizing)
  → Required Roles/Components
  → Catalog Candidate Resolution (cctv_recommend)
  → User Review / Alternatives
  → Apply to Quote (section + addQuoteItem)
  → Existing Pricing (unchanged authority)
```

Use CCTV to define **shared stages**, not to copy CCTV formulas into other domains.

---

## 16. Future engine contract

Any future domain engine (if built) should satisfy:

### Shared infrastructure (platform)

| Stage | Shared? |
|---|---|
| Authz (catalog.view + quotes.create/edit) | Yes |
| Catalog product model / resolution helpers | Yes (domain filters differ) |
| Apply-to-quote APIs (items/sections) | Yes |
| Pricing recalculate | Yes (always) |
| Review UX patterns (candidates, optional roles) | Prefer shared patterns |
| Provenance / re-apply guards | Prefer shared patterns |

### Domain-specific (must not be fake-generalized)

| Stage | Domain-specific |
|---|---|
| Requirements schema | Yes (CCTV ≠ alarm ≠ access) |
| Engineering formulas | Yes |
| Role taxonomy | Yes |
| Catalog matching rules | Yes |
| Blocking vs optional roles | Yes |

**Do not** generalize CCTV bitrate/storage/PoE math into other systems.  
**Do not** ship UI selectors for engines that lack calculation + recommend + resolve + apply.

---

## 17. Customer proposal / version boundary

| Phase | Editable? | Customer-facing truth |
|---|---|---|
| Local unsaved (`טרם נשמרה`) | Yes locally | Nothing on server yet |
| Server draft | Yes (if `quotes.edit`) | Staff preview; not locked customer version |
| After Send | No (until revise) | **Version snapshot** = immutable customer truth |
| Public PDF/view | Read-only | Snapshot |
| Staff PDF after send (current) | Live lines + frozen company/template | Dual path — product policy still open |

Architecture target: customer must never need to know composition source. They receive **one coherent proposal**.

---

## 18. Approval / revision boundary

| Concept | Architecture |
|---|---|
| Send | Staff publishes draft → `sent` + token (**customer** audience) |
| Approve / reject | Customer on public portal |
| Staff internal approve | **Out of architecture for now** (do not build) |
| Revise | New draft version; prior customer tokens superseded by version |
| Share vs Send | Must remain explicit: Share ≠ locked Send (policy decision still open) |

---

## 19. Project handoff

```
Approved Quote (+ Site required under current rules)
  → project-from-quote
  → operational delivery (Site File / field work)
```

Quote answers commercial offer.  
Project answers delivery.  
Architecture keeps them connected via customer/site/quote identity — without merging into one muddled object.

---

## 20. Current reality vs target architecture

### Target diagram

```
                    CUSTOMER
                       │
                       ▼
                     SITE
                 (when relevant)
                       │
                       ▼
              REQUIREMENTS / DESIGN
                  (optional guided)
                       │
       ┌───────────────┼────────────────┐
       │               │                │
       ▼               ▼                ▼
    MANUAL          TEMPLATE       SYSTEM BUILDER
   + CATALOG         PACKAGE        (CCTV today)
       │               │                │
       └───────────────┼────────────────┘
                       ▼
                QUOTE COMPOSITION
                       │
                       ▼
               SERVER PRICING
                       │
                       ▼
              VERSION / SNAPSHOT
                       │
                       ▼
              CUSTOMER PROPOSAL
                       │
                 APPROVE / REJECT
                       │
                       ▼
                    PROJECT
```

### Current reality (same spine; imperfect edges)

| Node | Reality |
|---|---|
| Customer / Site | Exists; site optional early |
| Requirements / Design | CCTV drawer only; other types stubbed |
| Manual / Catalog / Template / Package | Exist and converge to lines |
| System Builder | CCTV real; others fake breadth |
| Quote Composition | One builder; some composition tools under-exposed |
| Server Pricing | Strong unified authority |
| Version / Snapshot | Strong for public; staff PDF dual-path |
| Customer Proposal | Exists |
| Approve / Reject | Customer-only |
| Project | Exists; site gate |

**Conclusion:** Target architecture is largely an **alignment and boundary sharpening** of current reality — not a greenfield rewrite — except for future non-CCTV engines (new domain work).

---

## 21. Architectural gaps

| Gap | Prevents unified model how? |
|---|---|
| Stub System Builder types visible | Users think multiple quote products exist |
| Guided vs Direct not named as modes of one builder | Feels like separate tools |
| Terminology (send / unsaved) | Misstates lifecycle |
| Weak exposure of notes / section discounts / labor | Composition feels incomplete or ad hoc |
| Site story soft→hard | Unclear connection to delivery |
| Share vs Send semantics | Fragmented outbound actions |
| Staff PDF vs public snapshot asymmetry | Unclear “customer truth” for staff |
| QuoteBuilder monolith | Makes safe product alignment harder (engineering risk, not model split) |
| No future-engine registry discipline | Risk of more fake breadth |

**Not gaps in the unified model itself:**

- Server pricing authority (already correct)  
- Convergence of CCTV apply into quote lines (already correct)  
- Customer approval portal (already correct for current decision)  

---

## 22. Protected source-of-truth areas

| Area | Authority | Must not casually move to React |
|---|---|---|
| Totals / VAT / line_net | FastAPI pricing | Yes |
| Lifecycle / send / public approve | FastAPI + authz states | Yes |
| Cost visibility / price override | Authz + API strip/enforce | Yes |
| CCTV sizing / recommend | Python domain | Yes (TS = parity only) |
| Catalog list price/cost at insert | DB via API | Yes |
| Public customer document | Snapshot | Yes |
| Workspace isolation | RLS + API filters | Yes |

---

## 23. Product-owner decisions still unresolved

Still open (architecture does not answer them):

1. Exact Hebrew for send-to-customer (when terminology is updated).  
2. Whether site should become send-critical later (currently optional).  
3. Whether site should ever feed engines/pricing (requires domain design first).  
4. Expose section discounts?  
5. First-class note lines?  
6. First-class labor concept vs clearer catalog labeling?  
7. Clear-customer UI?  
8. Customer dedupe (CRM-wide)?  
9. Hide non-CCTV engine options immediately vs later?  
10. Which future engines (if any) are real product bets?  
11. Staff PDF: align to full snapshot vs keep live lines + frozen company?  
12. Explicit Share vs Send policy text/behavior.  
13. Priority of send idempotency hardening.  
14. Authz grant cleanup (`quotes.approve` / `quotes.export` mismatches).  
15. VAT editable in Builder vs workspace-only.  
16. Unsaved-state copy refinements.

---

## 24. Recommended NEXT PLANNING STEP only

**Next planning step (still no implementation):**

Produce a short **Unified Quote Builder Interaction Architecture** note that defines — as product UX contracts only:

1. **Direct Mode** and **Guided Mode** as approaches on the **same** Quote Builder  
2. Entry points for Manual / Catalog / Template / Package / CCTV engine  
3. Hybrid rules (apply → continue editing)  
4. Terminology plan for Send and Unsaved  
5. Stub-engine visibility policy  
6. Explicit Share vs Send semantics  

…ordered as planning decisions, **without** UI mock implementation, API changes, Alarm/Access engines, or pricing work.

Then, only after PO sign-off on that interaction contract, sequence separate implementation passes (terminology/exposure vs hardening vs any future engine).

---

## Answers to the architecture questions (compact)

| # | Answer |
|---|---|
| 1 | Canonical Quote = workspace commercial offer (`quotes` + items/sections + server totals + version) |
| 2 | Manual, catalog, template/package, System Builder (CCTV) |
| 3 | Converge at Quote Composition (`quote_items` / sections) before pricing |
| 4 | Engineering/design = requirements + domain calc + recommend roles |
| 5 | Commercial pricing = qty/price/discount/VAT/totals/cost/margin under FastAPI |
| 6 | Customer presentation = document/preview/PDF/public snapshot |
| 7 | Operational delivery = project-from-quote (+ Site File / field) |
| 8 | Customer links who buys across draft→send→approve→project |
| 9 | Site links where; optional early; required for project; no calc today |
| 10 | Catalog is shared equipment source for picks + engine resolution |
| 11 | Templates/packages seed composition into the same quote |
| 12 | CCTV engine applies recommended catalog lines into the same quote |
| 13 | Future engines plug via same contract; domain-specific math stays separate |
| 14 | Totals, VAT math, lifecycle, authz commercial strip, snapshots, CCTV Python |
| 15 | Customer-facing version snapshot (public truth); company/template freeze |
| 16 | Draft composition + permitted commercial inputs until send |
| 17 | Hybrid: apply engine then keep editing same composition surface |
| 18 | Stub engines, send wording, soft/hard site, share/send, dual PDF truth |
| 19 | Single quote APIs, CCTV→lines, server pricing, public approval |
| 20 | Fake engine breadth, under-exposed composition tools, outbound semantics, PDF asymmetry |

---

## Explicit confirmation

This document only:

`Docs/QUOTE-BUILDER-UNIFIED-PRODUCT-ARCHITECTURE.md`

**No product code changed.**  
**No Guided/Direct Mode implementation.**  
**No Alarm/Access/… engines.**  
**No pricing/API/authz/PDF/snapshot changes.**

---

**END — UNIFIED PRODUCT ARCHITECTURE — STOP**
