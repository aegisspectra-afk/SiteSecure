# SITE SECURE — Quote / Sales / Proposal Platform  
## Master Product Architecture & Competitive Roadmap

**Date:** 2026-09-22  
**Mode:** DISCOVERY / PRODUCT SPECIFICATION ONLY — **ZERO IMPLEMENTATION**  
**Product code changed:** NONE (`apps/**`, `packages/**`, `supabase/**`, `tests/**` untouched)  
**Allowed artifact:** this document only  

**Primary evidence:** repository audit (Quote CPQ, lifecycle, System Design R1–R3, ops shells) + current public competitor materials (D-Tools SI, QuoteWerks/QuoteValet, Jetbuilt, Conest IntelliBid, LVDeploy, Qwilr/PandaDoc/Proposify).

**Related docs (do not duplicate):**
- [`QUOTE-BUILDER-GUIDED-WORKSPACE-DISCOVERY.md`](./QUOTE-BUILDER-GUIDED-WORKSPACE-DISCOVERY.md) / [`QUOTE-BUILDER-GUIDED-WORKSPACE-P0.md`](./QUOTE-BUILDER-GUIDED-WORKSPACE-P0.md)
- [`SYSTEM-BUILDER-CATALOG-INDEPENDENT-UX-DISCOVERY.md`](./SYSTEM-BUILDER-CATALOG-INDEPENDENT-UX-DISCOVERY.md)
- [`DURABLE-SYSTEM-DESIGN-MODEL.md`](./DURABLE-SYSTEM-DESIGN-MODEL.md) / R1–R3 docs
- [`QUOTE-BUILDER-CAPABILITY-AUDIT.md`](./QUOTE-BUILDER-CAPABILITY-AUDIT.md) / [`QUOTE-BUILDER-PRODUCT-DECISIONS.md`](./QUOTE-BUILDER-PRODUCT-DECISIONS.md)

**In-flight (do not interfere):** Guided Quote Workspace P0 · Equipment Intent PO next in System Builder stream · R1–R3 production DB verification deferred (credentials).

---

## 1. Executive vision

SITE SECURE should not merely help a company “create a quote.”

It should help security / CCTV / low-voltage / field-service companies move from **customer need** through **design**, **commercial proposal**, **customer decision**, **project delivery**, **commissioning**, and **warranty/service** — with the Quote as the **commercial bridge**, not the whole product.

**Competitive thesis:** Generic CPQ wins on products, prices, PDFs, signatures, and payments. Vertical tools win on BOM, design sync, procurement, and install. SITE SECURE wins by combining both into a **simpler, modern, Hebrew-first** workflow with **engineering-aware selling** and **end-to-end traceability** — not by matching D-Tools feature count.

**North-star lifecycle:**

```text
CUSTOMER NEED
  → SITE / REQUIREMENTS
  → SYSTEM DESIGN
  → EQUIPMENT INTENT
  → COMMERCIAL PROPOSAL
  → CUSTOMER DECISION
  → PROJECT
  → PROCUREMENT
  → INSTALLATION
  → COMMISSIONING
  → WARRANTY / SERVICE
```

**Core differentiator:** durable relationships among:

| Question | Layer |
|---|---|
| What does the customer need? | Requirements |
| What does engineering require? | System Design |
| What equipment is intended? | Equipment Intent |
| What product was selected? | Catalog (optional) |
| What is priced / sold? | Quote lines |
| What did the customer approve? | Immutable snapshot / version |
| What must be purchased? | Procurement from approved scope |
| What did the technician install? | Installed assets / commissioning |

---

## 2. Market / competitive landscape

### Vertical integrator platforms

| Vendor | Positioning (current public materials) | Sources |
|---|---|---|
| **D-Tools System Integrator (SI)** | End-to-end AV/security/low-voltage: catalog library (1.6M+ products), Visio/AutoCAD BOM sync, packages (incl. Good/Better/Best patterns), proposals, eSign, purchasing, change orders, project/service. SI v24 emphasizes collab BOM, change-order controls. | [d-tools.com/system-integrator-features](https://www.d-tools.com/system-integrator-features), [docs.d-tools.com](https://docs.d-tools.com/en/articles/9207945-system-integrator-overview) |
| **Jetbuilt** | Cloud project platform for AV/IT/security/cabling: dealer pricing, proposals/eSign, options & change orders, purchasing/POs, stock (warehouse/van/site), install tasks, client engagement. | [jetbuilt.com](https://jetbuilt.com/), [help.jetbuilt.com](https://help.jetbuilt.com/) |
| **QuoteWerks + QuoteValet** | CPQ for security/alarm: equipment + labor + **recurring** monitoring/service, distributor pricing, interactive web quotes, eSign, payments, internal approvals, PO generation; PSA/Sedona-style integrations. | [quotewerks.com/solutions/quoting-software-security-alarm](https://quotewerks.com/solutions/quoting-software-security-alarm/), [QuoteValet](https://quotewerks.com/quotevalet/) |
| **Conest IntelliBid** | Deep estimating/takeoff for electrical + low-voltage (security, CCTV, access, fire, cabling); labor units & assemblies — estimate-first, not modern proposal UX. | [conest.com/low-voltage-estimating-software](https://conest.com/low-voltage-estimating-software/) |
| **LVDeploy** | Floor-plan-centric LV tools (survey, cabling, camera placement, BOM → quote); lightweight vs enterprise ERP. | [lvdeploy.com](https://lvdeploy.com/) |

### Proposal / CPQ generalists (customer experience bar)

| Vendor | Relevance | Sources |
|---|---|---|
| **Qwilr** | Interactive web proposals, tiers, add-ons, live pricing UX | [qwilr.com/product/quotes](https://qwilr.com/product/quotes/) |
| **PandaDoc / Proposify** | Document + eSign + governance/analytics; lighter vertical engineering | Industry comparisons 2025–2026 |

### How SITE SECURE should compete

| Compete on | Do **not** compete primarily on |
|---|---|
| Workflow intelligence & clarity | Raw catalog size vs D-Tools library |
| Vertical CCTV/engineering continuity | Visio/AutoCAD parity |
| Hebrew-first field UX | Feature-count parity |
| Traceability design → install | Autonomous AI pricing/engineering |
| Speed without catalog | Desktop-era ERP density |

---

## 3. Existing SITE SECURE strengths

Evidence-backed (HAS):

| Strength | Evidence |
|---|---|
| **Server-authoritative CPQ** | `pricing.py` + `_persist_totals`; client never owns money |
| **Full Quote lifecycle** | draft → sent → viewed → approved/rejected/expired; revise → new version + draft |
| **Immutable sent snapshots** | `quote_versions` + `quote_snapshot.public_payload`; public reads frozen public snapshot |
| **Share ≠ Send** | Share mints link; Send is formal publication |
| **Public interactive approval** | `/public/quotes/$token` + signature — not PDF-only |
| **Commercial isolation** | `quotes.view_cost` strip; public/PDF ban cost/margin |
| **CCTV Durable System Design R1–R3** | Design SoT, owned Apply, divergence, commercial strip from Design |
| **Composition richness** | sections, catalog/free/labor/note, packages, quote templates |
| **Project handoff** | 1:1 `projects.source_quote_id` from approved Quote |
| **Quote events** | `quote_events` (sent, viewed, approved, rejected, revised, shared…) |
| **Unified readiness** | server send gaps + client UnifiedReadiness |
| **Guided Workspace P0** | four focused stages; presentation-only navigation |
| **Hebrew / RTL product** | first-class UI language |
| **Ops shells** | jobs/dispatch, site systems/equipment (serial/IP), thin warranties, tasks FK |

---

## 4. Existing gaps

| Gap | Verdict | Notes |
|---|---|---|
| Equipment Intent (persisted) | **MISSING** | Docs complete; soft manufacturer preference only |
| Catalog-independent Apply path | **MISSING** | R3 catalog-only; empty catalog blocks commercial completion UX |
| Proposal alternatives (Good/Better/Best) | **MISSING** | |
| Optional customer-selectable add-ons | **MISSING** | CCTV “optional” ≠ commercial customer option |
| Premium customer proposal narrative | **PARTIAL** | Functional portal; not productized proposal experience |
| Structured system explanation | **MISSING** | |
| Customer option selection before approve | **MISSING** | Approve/reject entire proposal only |
| Activity → CRM follow-up | **PARTIAL** | Events exist; task↔quote API incomplete |
| Revision commercial/equipment diff UX | **PARTIAL** | Versions strong; comparison UX weak |
| Internal discount/margin approval policies | **MISSING** | Margin override exists; no policy engine |
| Structured payment schedules | **PARTIAL** | Free-text `payment_terms` only |
| Recurring revenue on Quote lines | **MISSING** | Tenant SaaS subscriptions ≠ customer MRR |
| Procurement / inventory / PO | **MISSING** | Authz stubs only |
| Change Orders (post-approval) | **MISSING** | |
| Site visual planning / markers | **MISSING** | Zones partial |
| Design → installed asset bridge | **MISSING** | Equipment manual on site |
| Commissioning as acceptance domain | **PARTIAL** | Job checklists coarse |
| Warranty ↔ installed assets | **PARTIAL** | Warranties thin |
| Playbooks (requirements+design+commercial) | **PARTIAL** | Packages/templates ≠ full playbooks |
| Quote analytics | **PARTIAL** | Events exist; product analytics missing |
| Alarm/Access/Intercom engines | **OUT OF SCOPE** | Explicitly deferred |

---

## 5. Defensible product pillars

Refined pillars (3–5). These are what SITE SECURE should be **uniquely excellent** at:

### 1. Engineering-aware selling
Deterministic System Design informs composition and upsell **without** inventing engineering via AI. Seller speed + engineering honesty.

### 2. Catalog-independent speed
Complete a valid commercial path with Equipment Intent when catalog is empty or incomplete. Catalog accelerates; it never blocks engineering truth.

### 3. Premium customer decision experience
Hebrew-first interactive proposal where the customer understands the system, options, and commercial total — and decides with clear binding semantics.

### 4. Quote-to-install traceability
Minimum durable links from requirement → design → intent → sold line → approved snapshot → procured → installed — answerable without event-sourcing theater.

### 5. Hebrew-first field continuity
Same lifecycle language from guided seller workspace through mobile field jobs, commissioning, and site dossier — not an English desktop ERP with a Hebrew skin.

**Rejected as pillars:** “more features,” “biggest catalog,” “CAD replacement,” “autonomous pricing AI.”

---

## 6. End-to-end target lifecycle

```text
Lead / Customer / Site
        │
        ▼
┌─────────────────── SELLER WORKSPACE (Guided Quote) ───────────────────┐
│ 1 פרטי ההצעה → 2 תכנון וציוד → 3 הצעה ומחיר → 4 תנאים ושליחה          │
│        │              │                                                  │
│        │         System Design (CCTV+)                                   │
│        │              │                                                  │
│        │         Equipment Intent ──optional──► Catalog                  │
│        │              │                                                  │
│        └──────── Quote lines / sections / options / add-ons              │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │ Send (immutable snapshot)
                                    ▼
                         Customer Proposal Experience
                         (options / add-ons / decision)
                                    │ Approve (binding)
                                    ▼
                              Project (1:1 today)
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
              Procurement     Installation    Change Orders
                    │               │               │
                    └───────► Commissioning ◄───────┘
                                    │
                                    ▼
                         Warranty / Service / Site assets
```

**Invariant:** One commercial Quote identity per sales opportunity; versions = negotiation history; Change Orders = post-approval Project scope changes (not silent mutation of approved Quote).

---

## 7. Guided Quote Workspace

**Approved model (Hybrid):** One Quote · One state · Four focused workspaces.

| Stage | Hebrew | Job |
|---|---|---|
| `details` | פרטי ההצעה | To whom / what context |
| `items` | תכנון וציוד | What is included (composition + System Builder) |
| `pricing` | הצעה ומחיר | How it is commercially presented |
| `review` | תנאים ושליחה | Terms, readiness, Preview/Send |

**Map future capabilities into stages (not new apps):**

| Capability | Primary stage |
|---|---|
| Customer/site/lead/template | 1 |
| System Design, Equipment Intent, packages, playbooks | 2 |
| Alternatives presentation, commercial editing, margin (authz) | 3 |
| Options finalization for send, terms, payment schedule, Send | 4 |
| Add-ons composition | 2 + commercial flags in 3 |
| Internal approval before send | 4 gate |
| Health / readiness | evolve Stage 4 (+ light indicators) |

**P0 status:** presentation-only navigation shipped/in flight — do not block with new domains.

**Deferred on workspace itself:** `?stage=` deep link, richer Stage 2/3 field split, Stage 4 restructuring (P1–P5).

---

## 8. Equipment Intent

### Definition
Seller’s commercial/technical offer for an engineering **role** without requiring a catalog product. **No fake SKU, product_id, cost, or catalog price.**

### Pipeline (from catalog-independent discovery)

```text
Requirements → Engineering Design → Equipment Intent
  → optional Catalog Resolution → Quote Line → pricing.py
```

### Architecture recommendation

| Layer | Owner | Notes |
|---|---|---|
| Intent fields | `system_design_components` (extend) | manufacturer/model/spec text, qty alignment, resolution state orthogonal to catalog |
| Catalog | Optional link | Accelerates Apply + pricing defaults |
| Quote line | Existing `catalog \| free \| labor` | Free/labor represent unresolved intent commercially |
| R3 | Extend carefully **or** parallel explicit Apply path | Must preserve owned Apply, fingerprint, divergence, draft-only |

### Safe sequencing (from discovery)

1. **Phase 1:** Persist Intent on Design; Apply still catalog-only.  
2. **Phase 2:** Explicit free-line Apply ownership (extend R3 or parallel) — highest risk.  
3. **Phase 3:** Intent → catalog replace without losing commercial preserve rules.

**Do not:** invent products; put money on Design; reverse-engineer SKUs on Design reopen.

---

## 9. Proposal alternatives

### Critical question — recommended domain model

| Candidate | Verdict |
|---|---|
| Multiple Quotes | **No** for alternatives — fragments CRM, events, project handoff |
| Immutable Quote versions | **No** for alternatives — versions = negotiation history after send/revise, not parallel offers |
| Option groups inside one Quote | **Yes (primary)** — pre-send commercial scenarios |
| “Proposal scenarios” as separate product | Unnecessary name; same as option groups |
| Separate Project (Jetbuilt-style) | Wrong stage — SITE SECURE Quote is the commercial object |

**Recommendation: `ProposalOptionGroup` + `ProposalOption` as first-class children of a Quote (draft-editable).**

Semantics:

- Exactly one group “active for presentation” or customer must pick one option before approve (product policy).  
- Each option contains a **subset or overlay** of lines/sections (or line membership flags) — **same Quote**, shared customer/site.  
- Labels are **workspace-configurable** (בסיסי / מומלץ / פרימיום are examples, not schema enums).  
- On **Send**, freeze **all presented options** into the version snapshot (or freeze selected-default + alternatives metadata).  
- On **Approve**, binding scope = **chosen option** (+ selected add-ons).  
- **Revise** creates new version; do not rewrite prior public option set.

**Alternatives vs packages:** Packages accelerate composition; option groups present mutually exclusive commercial scenarios to the customer.

---

## 10. Optional add-ons

### Semantics (explicit)

| State | Meaning |
|---|---|
| `included` | In base option; not removable by customer |
| `optional` | Customer may select before approval |
| `recommended` | Optional + seller emphasis (not engineering-required unless Design says so) |
| `customer_selected` | Chosen on public proposal (pre-binding) |
| `customer_declined` | Explicitly declined (auditable) |

### Pricing / snapshot

- Draft: seller marks lines/sections as add-ons; server prices always.  
- Sent snapshot: include add-on catalog of choices + default selection state.  
- Customer selection **updates a decision record**, not the immutable snapshot blob silently.  
- Binding approval captures **final selected set**; totals recalculated server-side into approval freeze / next binding document.  
- If selection changes after view but before approve: allowed within sent version rules **only if** product treats selections as decision inputs, not line mutations. Prefer: **decision payload** attached at approve time; staff revise if commercial rules require new version.

**Never:** mutate `quote_versions.snapshot` in place after send; never invent engineering necessity for optional add-ons.

---

## 11. Customer Proposal Experience

Treat the public surface as a **product**, not a PDF viewer.

### Target structure (Hebrew/RTL first)

1. Company / salesperson  
2. Proposal title  
3. Customer / site  
4. Executive summary  
5. System overview (structured)  
6. What is included  
7. Equipment  
8. Services  
9. System explanation (derived)  
10. Alternatives / options  
11. Add-ons  
12. Commercial totals (incl. recurring if present)  
13. Payment terms / schedule  
14. Warranty  
15. Documents  
16. Timeline (if captured)  
17. Decision / signature  

**Today:** functional `QuoteDocument` + approve/reject + PDF secondary.  
**Gap:** narrative hierarchy, options UX, explanation, premium responsive storytelling (Qwilr-class bar without losing vertical truth).

**PDF remains:** printable artifact of the same truth — not the primary experience.

---

## 12. System explanation

**Goal:** Customer-friendly clarity derived from **structured Design**, e.g.:

```text
4 cameras → PoE → NVR → storage (30 days) → remote viewing
```

**Rules:**

- Deterministic templates from Design roles/qty/architecture.  
- Optional AI **phrasing only** — never invent cameras, storage, or necessity.  
- Future: lightweight diagram (not CAD/Visio replacement).  
- Lives in Stage 4 preview + customer proposal; sourced from Design SoT.

---

## 13. Customer decision model

| Decision | Binding? | Notes |
|---|---|---|
| Approve entire proposal | Yes | Today’s path |
| Reject | Yes (terminal for that version) | Today |
| Select proposal option | Becomes binding on approve | New |
| Select / decline add-ons | Binding on approve | New |
| Comment / request change | Non-binding | May create task / revise request |

### Version rules

- Pre-approve option/add-on selection: **decision state**, not silent snapshot rewrite.  
- Formal approve freezes signature + chosen option + add-ons onto version (extend existing freeze).  
- Material commercial change after send → **Revise** (existing) → new version.  
- Do not weaken: public truth = version-bound snapshot; superseded tokens cannot approve old truth as if current.

---

## 14. Quote activity

### Factual activity (HAS foundation)

Extend `quote_events`: sent, first_viewed, viewed_again, option_viewed, option_selected, addon_toggled, approved, rejected, revised_sent, share_*, pdf_*.

### Inferred intent

**Never** claim “highly interested” from view counts. Surface facts:

> נצפתה 3 פעמים

Then actions: **צור משימת מעקב** (complete `tasks.quote_id` API + UI).

Separate **FACTUAL ACTIVITY** UI from **SUGGESTED ACTIONS**.

---

## 15. Revision / negotiation

**Foundation:** existing revise → `version++`, draft, clear outbound timestamps, event `revised`, prior snapshots retained.

**Build on top (do not rewrite):**

- Version timeline UI  
- Commercial diff (qty, prices, discounts, totals)  
- Equipment / Design divergence summary  
- Seller reason for revision  
- Customer-visible revision summary (“הוסר UPS · אחסון שונה · הנחה +5% · סה״כ −₪1,400”)

---

## 16. Internal approvals

Future policy engine (design only now):

| Trigger examples | Action |
|---|---|
| Discount > X | Require approver |
| Margin < Y | Require approver |
| Total > X | Require approver |
| Manual price override | Already permissioned; may add approval |
| Special payment terms | Policy flag |

Objects: `policy` → `approval_request` → `approver` → `decision` → `audit_event`.

Respect `quotes.view_cost`, existing authz, server pricing. **No policy engine implementation in near-term PO.**

---

## 17. Margin intelligence

Management-only, authz-gated:

- Gross profit / margin, target margin, low-margin warning, discount impact, labor profitability  

**Never leak** to customer proposal, public endpoints, unauthorized staff, or System Design candidates (already stripped).

Evolve existing margin override / readiness margin noise — do not invent a second cost engine.

---

## 18. Payment structure

### Separate

| Concept | Scope |
|---|---|
| **Payment terms** | Commercial agreement language + optional structured schedule |
| **Payment collection** | Gateways, invoices, receipts — later |

### V1-worthy without processors

- Structured schedule lines: % or amount × milestone (approval / installation / handover / net days)  
- Display on Stage 4 + customer proposal  
- Still stored as structured JSON + human-readable terms text for PDF  
- Keep free-text compatibility  

**Out of V1:** card capture, payment links (QuoteWerks-class) unless explicitly scoped later.

---

## 19. Recurring revenue

Security sells monitoring, maintenance, cloud, SIM, extended warranty, service plans.

### Line model recommendation

| Field concept | Notes |
|---|---|
| `billing_mode`: `one_time` \| `recurring` | On quote item (or linked service plan) |
| `recurring_interval`: month/year | |
| `recurring_amount` | Server-priced; VAT policy must be explicit before ship |
| Proposal totals | Show **התקנה** + **שירות / חודש** separately |

### Handoff

- Approval may create/activate `service_contracts` (schema exists, unused)  
- Do **not** implement full accounting without VAT/revenue recognition design  

**CCTV `retentionDays` ≠ recurring billing.**

---

## 20. Procurement

**Audit:** no inventory/PO/stock tables; authz feature stubs only.

### Conceptual flow

```text
Approved Quote (chosen option + add-ons)
  → required equipment list (from approved lines / Design ownership)
  → inventory availability (future)
  → purchase requirement
  → supplier order
  → receiving
  → allocation to Project
```

**Rules:** selling price ≠ purchasing cost; cost only under authz; Design provides engineering context; Quote provides approved commercial scope.

**New domain** when built — do not hide inside Design Apply.

---

## 21. Change Orders

**Do not mutate** the original approved Quote.

### Recommended model

```text
Project Change Order (first-class)
  → priced change proposal (may reuse Quote versioning patterns OR dedicated CO document)
  → customer approval
  → Project scope update + optional Design amendment
```

| Reuse Quote versions? | When |
|---|---|
| Possible for **commercial presentation** of a change | If CO is literally a new Quote linked to Project |
| Prefer first-class CO | When ops needs install/procurement delta independent of sales pipeline |

Preserve original commercial history forever.

---

## 22. Site visual planning

Lightweight future:

- Upload floor plan / site image  
- Place equipment markers (camera positions, device labels)  
- Link markers → Site / Design component / Project equipment  

Customer-facing visualization optional.

**Not:** CAD/Visio replacement. Extend `site_zones` only if soft placement suffices for V1 experiments.

---

## 23. Commissioning

Vertical differentiator: engineering intent survives into install.

Technician should know:

| Designed | Sold | Must install | Actually installed |
|---|---|---|---|

Capture: expected equipment, installed equipment, serial, IP/address, location, config notes, test result, photos, checklist.

**Extend:** jobs + checklists + site `equipment`.  
**New if needed:** commissioning run / acceptance certificate for audit-grade handover.

---

## 24. Warranty / Service handoff

After commissioning:

- Installed assets → warranty dates → service eligibility → maintenance plan → site dossier  

**Extend existing** `equipment` / `systems` / thin `warranties` / unused `service_contracts`.  
**Avoid** duplicate asset records. Wire Quote warranty text → structured asset warranties carefully.

---

## 25. Proposal Intelligence

Safe, non-authoritative assistance:

- Missing commercial elements  
- Suggest optional services  
- Explain design choices (from structure)  
- Completeness improvements  
- Compare alternatives  
- Draft customer-friendly copy  

**Authoritative forever:** engineering engines, compatibility, `pricing.py`, permissions, lifecycle.

Label AI clearly as assistive.

---

## 26. Engineering-aware upsell

Derived from **valid structured Design**, e.g.:

- 30-day → 60-day retention (engine recalculates storage impact)  
- No UPS → offer UPS protection  

Classify:

| Class | Source |
|---|---|
| REQUIRED | Deterministic engine |
| RECOMMENDED | Engine advisory / best practice flag |
| OPTIONAL | Commercial only |

Never claim necessity unless the engine does. Seller commercializes after engineering impact is known.

---

## 27. End-to-end traceability

### Minimum durable model (prefer links over event-sourcing)

```text
requirement_key
  → system_design_component_id
  → equipment_intent (on component)
  → product_id? (optional)
  → quote_item_id (Design ownership today)
  → quote_version snapshot item identity
  → procurement_line_id (future)
  → equipment.id (installed asset)
```

**Answerable questions:** Why in Quote? Which requirement? Did sold item diverge from recommendation? What approved? Purchased? Installed?

**Today’s foothold:** Design component `quote_item_id` ownership + divergence fingerprints — extend, don’t replace.

---

## 28. Quote Health

Seller-facing, factual/computable — evolve UnifiedReadiness, not a fake AI score.

Signals:

- Customer selected  
- Engineering complete (Design valid)  
- Required equipment resolved (catalog **or** Intent + priced line)  
- Pricing complete  
- Terms complete  
- Margin approval required (future)  
- Proposal ready to send  

Avoid arbitrary % unless mathematically meaningful (e.g., critical gaps count).

---

## 29. Playbooks / templates

Beyond line templates:

**Playbook** = reusable sales starting point:

- Requirements defaults  
- Recommended Design seed  
- Commercial sections  
- Terms  
- Suggested add-ons / option group seeds  

**Must not** bypass engineering validation or invent catalog products.

Today’s packages/quote templates are **composition accelerators** — keep distinct from quote-level PDF templates and from future playbooks.

---

## 30. Analytics

Factual metrics only:

- Created / sent / viewed / approved / rejected  
- Revision count, time-to-approval  
- Average discount; average margin **where authorized**  
- Option selection rates  
- Conversion by salesperson / system type  

No invented attribution causality.

Foundation: `quote_events` + dashboard feeds already exist — productize reporting carefully with authz.

---

## 31. Competitive capability matrix

Legend: **HAS** / **PARTIAL** / **MISSING** for SITE SECURE · Market: **COMMON** / **ADVANCED** · **DIFF** = potential SITE SECURE differentiator

| Capability | SITE SECURE | Market | Notes |
|---|---|---|---|
| Server-side pricing / VAT | HAS | COMMON | Strong isolation story |
| Quote lifecycle + eSign approve | HAS | COMMON | Share≠Send is mature |
| Immutable snapshots | HAS | ADVANCED | Keep |
| Interactive public proposal | PARTIAL | COMMON→ADVANCED | Functional; needs narrative/options |
| Guided seller workspace | HAS (P0) | PARTIAL elsewhere | Clarity differentiator if deepened |
| Catalog library scale | PARTIAL | ADVANCED (D-Tools/Jetbuilt) | Don’t compete on size |
| Catalog-independent Intent | MISSING | RARE | **DIFF** |
| Deterministic CCTV Design→Apply | HAS | ADVANCED vertical | **DIFF** (depth over CAD) |
| Visio/AutoCAD sync | MISSING | ADVANCED (D-Tools) | Explicit non-goal near-term |
| Good/Better/Best options | MISSING | COMMON–ADVANCED | Needed |
| Customer add-ons | MISSING | COMMON (QuoteValet/Qwilr) | Needed |
| Recurring monitoring lines | MISSING | COMMON (QuoteWerks) | High vertical value |
| Internal approval policies | MISSING | ADVANCED | Q3 |
| Margin intelligence | PARTIAL | COMMON | Authz already strong |
| Procurement / stock / PO | MISSING | ADVANCED (D-Tools/Jetbuilt) | Q4 |
| Change orders | MISSING | ADVANCED | Q4 |
| Floor-plan markers | MISSING | ADVANCED (LVDeploy/D-Tools) | Q5 lightweight |
| Commissioning traceability | PARTIAL | RARE as productized | **DIFF** |
| Hebrew-first RTL field UX | HAS | RARE | **DIFF** |
| AI autonomous engineering | MISSING | MARKETING CLAIMS | Non-goal; assistive only |

---

## 32. Domain-model implications

### Extend existing

| Object | Extensions |
|---|---|
| Quote | Health, payment schedule structure, option groups, recurring line fields |
| Quote version / snapshot | Freeze options + add-on decision metadata |
| `quote_items` / sections | Commercial flags: included/optional/recommended; option membership |
| System Design components | Equipment Intent fields; orthogonal resolution states |
| `quote_events` | Richer factual telemetry |
| Project | Handoff refs; CO parent |
| Jobs / checklists | Commissioning depth |
| Equipment / warranties / service_contracts | Post-install continuity |
| Tasks | Complete quote_id API |

### New first-class (only when semantics require)

| Object | Why |
|---|---|
| `ProposalOptionGroup` / `ProposalOption` | Mutually exclusive scenarios ≠ versions |
| `CustomerDecision` (or approve payload extension) | Binding choice set |
| `ChangeOrder` | Post-approval scope ≠ sales revise |
| `PurchaseOrder` / stock entities | Ops procurement |
| `CommissioningRun` (optional) | Audit-grade acceptance |
| `SalesPlaybook` | More than BOM template |
| Marker / floor-plan entities | Visual planning |

### Do **not** invent

Second Quote state machine · second pricing engine · Design-owned money · fake catalog products · CAD platform · Alarm/Access/Intercom engines (deferred).

---

## 33. Authorization / security implications

- Cost/margin: `quotes.view_cost` forever; public strip forever.  
- Option/add-on decisions: public token path only; no staff cost leakage.  
- Internal approvals: separate grants; auditors see decisions.  
- Analytics margins: same cost gate.  
- Design strip commercial keys: maintain on Intent fields (no unit_price/cost on Design).  
- RLS/workspace isolation unchanged.  
- Inventory/cost features: technician commercial isolation patterns apply.

---

## 34. Pricing implications

- **Only** `pricing.py` / `_persist_totals` own money.  
- Options/add-ons/recurring: server recalculation rules must be specified before UI.  
- Recurring VAT: explicit Israeli commercial policy before ship.  
- Intent free lines: seller-responsible price; never invent list_price from nowhere.  
- Upsell retention: engine changes Design → commercial reprice via existing path.  
- Customer selection must not trust browser totals.

---

## 35. Snapshot / version implications

| Event | Snapshot behavior |
|---|---|
| Share | Non-sent rules unchanged |
| Send | Freeze public commercial truth including presented options/add-ons |
| View / select options | Decision telemetry; no silent snapshot rewrite |
| Approve | Freeze signature + binding selection onto version |
| Revise | New version; old public tokens superseded |
| Change Order | New commercial artifact; original approved Quote untouched |

---

## 36. Mobile implications

- Guided stages already reduce cognitive load; preserve **closed dock** architecture.  
- Options/add-ons: mobile-friendly selection on customer proposal.  
- Seller Intent editors: progressive disclosure in System Builder drawer.  
- Field commissioning: FieldJob + site dossier — not a second Quote mobile app.  
- Do not add competing CTA bars.

---

## 37. Customer-facing implications

- Hebrew/RTL premium proposal is a **growth surface**.  
- Clarity > dense BOM dumps (with optional detail expand).  
- Facts over hype; system explanation must be structurally true.  
- Decision UX must make binding consequences obvious.  
- PDF download remains secondary.

---

## 38. Dependencies

```text
Guided Workspace P0 (UI attention)
        │
        ▼
Equipment Intent + catalog-independent commercial path
        │
        ├──────────────► Engineering-aware upsell (needs Design + Intent)
        │
        ▼
Proposal options + add-ons (domain + snapshot)
        │
        ▼
Customer Proposal Experience redesign
        │
        ▼
Decision model + activity/tasks
        │
        ▼
Revision diff UX (versions already exist)
        │
        ▼
Internal approvals + margin intelligence + payment schedule + recurring
        │
        ▼
Project procurement + Change Orders
        │
        ▼
Commissioning bridge → warranty/service
        │
        ▼
Visual planning + Proposal Intelligence + analytics productization
```

**Parallelizable after Intent foundation:** recurring line model design, payment schedule schema, playbook concept — but customer options UX should land with snapshot/decision design together.

**Blocked externally:** R1–R3 production DB verification (credentials) — do not block product design; block only live Apply confidence.

---

## 39. Risks

| Risk | Why it matters | Mitigation |
|---|---|---|
| Misusing versions for alternatives | Corrupts negotiation semantics | Option groups on Quote |
| Silent snapshot mutation for add-ons | Breaks immutability trust | Decision payload + approve freeze |
| Fake catalog / invented prices | Destroys commercial trust | Equipment Intent rules |
| Weakening R3 ownership on free Apply | Divergence/orphan lines | Explicit design + tests before ship |
| Competing with D-Tools on CAD/library | Infinite scope | Pillars discipline |
| AI presented as engineering authority | Liability | Assistive labeling |
| Premature procurement/accounting | Distracts from sales win | Sequence Q4 after options/proposal |
| Dual asset records | Site dossier chaos | Extend equipment |
| Mobile dock regressions | Field UX debt | Architecture freeze |
| Overbuilding policy engine early | Complexity tax | Design-only until margin pain proven |

---

## 40. Recommended release sequence

Improved dependency order (product groups, **not** calendar commitments):

### Q1 — Guided selling foundation
- Finish Guided Quote Workspace (P0 → P1 polish as needed)  
- Equipment Intent on Design  
- Catalog-independent CCTV commercial path (safe Apply strategy)  
- Quote Health evolution (factual)  
- Orthogonal engineering/equipment/catalog completeness UX  

### Q2 — Premium proposal & choice
- Proposal option groups  
- Optional add-ons + customer decision semantics  
- Customer Proposal Experience redesign  
- System explanation (deterministic)  
- Activity facts + task follow-up  
- Revision timeline + commercial/equipment diff  

### Q3 — Commercial control
- Internal approval policies  
- Margin intelligence (authz)  
- Structured payment schedules (no processor required)  
- Recurring revenue lines + proposal presentation  
- Service contract activation handoff (thin)  

### Q4 — Approval to delivery
- Approved scope → procurement requirements  
- Inventory/PO MVP (if market demands)  
- Change Orders  
- Commissioning traceability bridge (Design/sold → installed)  
- Warranty/service handoff wiring  

### Q5 — Visual / intelligence
- Lightweight site visual planning  
- Diagrammatic system explanation  
- Proposal Intelligence (assistive)  
- Engineering-aware upsell productization  
- Analytics productization  

**Rationale vs original sketch:** Options/add-ons and customer proposal move **before** heavy commercial control — conversion experience is higher competitive leverage once Intent unblocks selling without catalog. Procurement remains after binding commercial truth is rich enough.

---

## 41. What NOT to build yet

- Alarm / Access / Intercom engines  
- CAD/Visio replacement  
- Payment processing / collections platform  
- Full accounting / revenue recognition  
- Autonomous AI pricing or engineering  
- Giant event-sourcing platform  
- Inventory mega-module before Intent + options  
- Policy engine before real margin-governance pain  
- `?stage=` / router fragmentation during P0 stabilization  
- Duplicate asset systems  
- English-only proposal experiments that break RTL  

---

## 42. PO decisions

Explicit product-owner decisions required before major build:

1. **Alternatives model:** Confirm **option groups inside one Quote** (recommended) vs multi-Quote.  
2. **Customer selection before approve:** Decision payload vs forced revise-for-any-change.  
3. **Equipment Intent Apply:** Extend R3 ownership for free lines vs parallel Apply path.  
4. **Must Intent exist before Apply for required roles?** (discovery open question)  
5. **Recurring VAT & totals presentation** rules for Israel.  
6. **Change Order:** first-class CO vs Quote-linked amendment.  
7. **Procurement priority:** build vs integrate external purchasing later.  
8. **Customer proposal investment level:** narrative redesign now (Q2) vs incremental polish.  
9. **Playbooks vs packages:** when to introduce playbook object.  
10. **Commissioning legal bar:** checklist-only vs signed acceptance certificate.  

---

## 43. Definition of long-term success

SITE SECURE succeeds when a typical integrator can:

1. Capture need and site context quickly (Hebrew).  
2. Produce a **valid engineered CCTV design** even with a thin catalog.  
3. Express Equipment Intent and price honestly without fake SKUs.  
4. Present a **premium customer proposal** with clear options/add-ons.  
5. Obtain a **binding decision** with immutable commercial history.  
6. Hand off to Project knowing exactly what was approved.  
7. Procure and install with lineage to design and sale.  
8. Commission with serial/IP/location proof.  
9. Enter warranty/service without re-typing the asset universe.  
10. Improve sales using **facts** (views, revisions, conversions) — not vanity AI scores.

**Unique excellence test:** If a competitor has more catalog SKUs or Visio shapes, SITE SECURE still wins when the seller is faster to a trustworthy, customer-clear, install-traceable proposal.

---

## Appendix A — Evidence index (repository)

| Area | Paths |
|---|---|
| Quotes schema / lifecycle | `supabase/migrations/0016_quotes.sql`, `apps/api/app/routers/quotes.py`, `public_quotes.py` |
| Snapshot | `apps/api/app/quote_snapshot.py` |
| Pricing | `apps/api/app/pricing.py` |
| CPQ | `quote_cpq.py`, migrations `0034`, `20260816125639_*` |
| Design R1–R3 | `0054_system_designs.sql`, `0055_system_design_apply_owned.sql`, `apps/api/app/system_designs/` |
| Project handoff | `project_from_quote.py`, `0032_projects_source_quote_unique.sql` |
| Events | `quote_events` in `0016` |
| Tasks | `0020_tasks_ops.sql` (quote_id FK partial API) |
| Equipment / warranty / service | `0012_systems.sql`, `0018_service.sql`, `0019_warranties.sql` |
| Guided P0 | `QuoteStagePanel.tsx`, `workspace/types.ts`, P0 doc |
| Equipment Intent discovery | `Docs/SYSTEM-BUILDER-CATALOG-INDEPENDENT-UX-DISCOVERY.md` |

## Appendix B — Competitor sources (retrieved 2026-09-22)

- https://www.d-tools.com/system-integrator-features  
- https://www.d-tools.com/system-integrator  
- https://docs.d-tools.com/en/articles/9207945-system-integrator-overview  
- https://docs.d-tools.com/en/articles/9216103-packages  
- https://quotewerks.com/solutions/quoting-software-security-alarm/  
- https://quotewerks.com/quotevalet/  
- https://quotewerks.com/features/  
- https://jetbuilt.com/  
- https://help.jetbuilt.com/  
- https://conest.com/low-voltage-estimating-software/  
- https://lvdeploy.com/  
- https://qwilr.com/product/quotes/  

---

**End of master plan. ZERO product implementation performed.**
