# DURABLE SYSTEM DESIGN MODEL

**Date:** 2026-09-22  
**Mode:** PRODUCT + DATA CONTRACT PLANNING — ZERO IMPLEMENTATION  
**Prerequisite:** `Docs/SYSTEM-DESIGN-ENGINE-PLATFORM-DISCOVERY.md`  
**Product code changed:** NONE  
**Allowed artifact:** this document only

---

## 1. Executive decision model

SITE SECURE keeps **one commercial Quote** and introduces (conceptually) a durable **System Design** as a first-class technical object that can contribute composition to that Quote.

Locked decisions:

| Decision | Rule |
|---|---|
| Design must be durable | Applied/associated designs are persistable and reopenable with fidelity |
| Quote remains commercial | Quote is not the engineering database |
| Pricing stays outside Design | Design never owns subtotal / VAT / gross / cost / margin |
| User overrides survive | Engine recommendation ≠ user selection |
| Reopen must not reverse-engineer lines | Persist design state; do not invent requirements from SKUs |
| Multi-engine | Quote → zero-to-many Designs; one composition; one pricing authority |
| CCTV intact | Persistence wraps existing CCTV flow; no math rewrite |

Pipeline of truth layers:

```text
Requirements → Design → Recommendation → Selection → Quote Lines → Pricing
```

---

## 2. Requirements vs Design vs Recommendation vs Selection vs Quote

| Layer | Meaning | Authority |
|---|---|---|
| **Requirements** | What the installation must accomplish (counts, retention, optional scopes, constraints the user asserts) | User / confirmed inputs (possibly AI-drafted, then confirmed) |
| **Design** | Engineering interpretation of requirements: normalized inputs, derived values, role quantities, assumptions, unresolved engineering gaps | Domain engine calculation |
| **Recommendation** | For each role: technical requirements, ranked catalog candidates, preferred pick, warnings, blocking flags | Domain engine + live catalog at calculation time |
| **Selection** | User’s accepted / replaced / removed choices relative to recommendation | User (durable) |
| **Quote lines** | Commercial expression: catalog/labor/free/note items with qty, discounts, prices | Quote APIs + server pricing |
| **Pricing** | Subtotal, discounts, VAT, gross, cost/margin gates | Existing `pricing.py` / quote totals — **never Design** |

**System Design (object)** = durable container for Requirements + Design calculation artifacts + Recommendation snapshot + Selection + linkage metadata to Quote (and optionally Site). It is **not** a second Quote.

---

## 3. Why Quote lines cannot be engineering source of truth

Verified CCTV Apply today writes only:

`product_id`, `item_type: catalog`, `qty`, `section_id`

Lost after Apply:

- role identity  
- technical requirements  
- engine inputs / derived engineering  
- candidate alternatives  
- resolution status / unresolved / warnings  
- optional vs required intent  
- user override vs engine pick  
- engine type / version  
- “why this quantity”

Also: users freely edit qty/price/discount, delete lines, add unrelated lines, move sections. Reconstructing “12 cameras at 4MP continuous 14-day” from commercial rows is lossy and unsafe.

**Therefore:** Quote lines are commercial projection. Engineering source of truth must be the durable System Design.

---

## 4. Minimum durable Design contract

Conceptual fields (not a schema migration):

### Identity & tenancy

- `design_id` (stable)  
- `workspace_id`  
- `quote_id` (nullable until associated / first persist-with-quote)  
- `site_id` (nullable; optional future; unused by CCTV today)  
- `engine_type` (e.g. `cctv`)  
- `engine_version` / `ruleset_version`  
- `created_at` / `updated_at` / `calculated_at` / `applied_at` (as needed)

### Requirements (MUST persist)

- Structured requirements payload as accepted by the domain engine input contract (for CCTV: equivalent of normalized recommend input / form model)  
- Explicit markers for AI-suggested vs user-confirmed fields (see §23)

### Design / engineering result (MUST persist sufficient reopen)

- Normalized engineering input echo  
- Derived engineering summary needed for reopen display and for “stale vs recompute” (storage TB, channel tier, PoE architecture decision, service role list, etc.)  
- Assumptions, engineering warnings, engineering unresolved codes  
- Calculation status (`valid` / invalid input)

### Recommendation (MUST persist)

- Component/role list with: role key, quantity, optional, blocking, technical_requirements  
- For each role: ranked candidates (product ids + confidence + compatibility + reason codes) at calculation time  
- Engine-preferred product id per role (if any)  
- Top-level recommendation status / blocking / unresolved aggregate

### Selection (MUST persist)

- Per role: `selected_product_id` | null  
- Per role: `selection_origin` = `ENGINE_PREFERRED` | `USER_OVERRIDE` | `UNSELECTED`  
- Set of `removed_optional_roles`  
- Optional: user notes per role (not required for MVP contract)

### Application linkage (MUST persist once Apply exists)

- Last successful `apply_id` (or sequence)  
- Map: component/role instance → `quote_item_id` (and optionally `section_id`) for owned outputs  
- Apply fingerprint / content hash of projected commercial intent (for duplicate detection)

### Explicitly excluded from Design

- Money totals, VAT, cost, margin  
- Customer-facing Share/Send lifecycle  
- PDF snapshot authority  

---

## 5. Persist / derive / recompute matrix

| Data | Classification | Rationale |
|---|---|---|
| Requirements form / engine input | **MUST PERSIST** | Reopen fidelity |
| User selection / overrides / removals | **MUST PERSIST** | Intentional decisions |
| Engine-preferred picks at calculate time | **MUST PERSIST** | Distinguish from user override |
| Role list + technical_requirements + qty | **MUST PERSIST** | Design truth |
| Candidates list (ids + confidence + checks) | **MUST PERSIST** (at least last calculation) | Reopen review without silent live drift |
| Reason codes / warnings / unresolved | **MUST PERSIST** | Explainability on reopen |
| `engine_type` + `engine_version` + `calculated_at` | **MUST PERSIST** | Historical honesty |
| Design↔quote_item linkage | **MUST PERSIST** after Apply | Re-Apply ownership |
| Product display name/SKU at recommend time | **DERIVABLE SAFELY** from product id *if still exists*; else keep thin denormalized label for display | Avoid full catalog clone |
| Live list_price / cost | **SHOULD RECOMPUTE** via Quote/catalog at commercial time | Pricing not Design’s job |
| Engineering derived scalars (storage TB, PoE watts) | **MUST PERSIST** last result **and** **SHOULD RECOMPUTE** on explicit recalculate | Persist for history; recompute when user asks |
| Compatibility against *today’s* catalog attrs | **SHOULD RECOMPUTE** when refreshing resolution | Catalog may change |
| UI step (“requirements” vs “review”), toast copy, loading stages | **PRESENTATIONAL ONLY** | Do not persist |
| Quote section sort order aesthetics | **PRESENTATIONAL / commercial** | Owned by Quote |
| Fingerprint for same-session duplicate block | Ephemeral today → becomes **MUST PERSIST** content hash on Design after durability | |

---

## 6. User override semantics

Durable model must store **two product references per role** (conceptually):

| Field | Meaning |
|---|---|
| `engine_preferred_product_id` | What the engine selected at last successful calculation |
| `user_selected_product_id` | What the user accepted (may equal preferred) |
| `selection_origin` | `ENGINE_PREFERRED` if user never changed; `USER_OVERRIDE` if user chose another candidate (or explicit keep of non-preferred); `UNSELECTED` if removed/empty |

Rules:

1. Recalculate **updates** `engine_preferred_*` and candidate sets.  
2. Recalculate **must not silently wipe** `USER_OVERRIDE` without an explicit policy (see §13 / §32).  
3. Apply uses **effective selection** = user selection if set, else engine preferred, else skip unresolved.  
4. Optional role in `removed_optional_roles` stays removed across reopen until user restores.

No UI design here — contract only.

---

## 7. Design identity

**Yes — each Design needs a stable `design_id`.**

Reasons:

- Reopen target  
- Multi-engine coexistence on one Quote  
- Ownership of generated quote lines  
- Audit / apply history  
- Future Site association without merging Designs

Cardinality (conceptual):

- One Quote → **0..N** Designs  
- One Design → **at most one** Quote (for v1; avoid design shared across quotes unless PO later expands)  
- Design may exist briefly unbound, then attach on first save/Apply with Quote

---

## 8. Component / role identity

Two levels:

| Identity | Purpose |
|---|---|
| `role_key` (domain-stable, e.g. `cctv.camera`) | Semantic role type |
| `component_id` (stable instance within a Design) | Instance identity for linkage when a Design has one row per role (CCTV today is 1:1 role→component) |

For CCTV’s current model (one component per role key), `component_id` may equal a deterministic id derived from `design_id + role_key` **or** a UUID created at first calculation. Future engines with multiple instances of the same role (e.g. multiple door controllers) **will need** true instance ids — plan for `component_id` even if CCTV starts 1:1.

Quantity lives on the component instance, not only on the quote line.

---

## 9. Design ↔ Quote line provenance

Minimum linkage after Apply:

```text
design_id + component_id  →  quote_item_id
design_id                 →  optional primary section_id(s) created by Apply
apply_id                  →  set of quote_item_ids written in that operation
```

Conceptual requirements (no migrations yet):

1. Quote items that originated from Design Apply should be able to declare provenance: `source_design_id`, `source_component_id`, `source_apply_id` (or an equivalent join table owned by Design).  
2. Manually added Quote lines have **null** design provenance.  
3. Provenance answers: “which lines came from which Design?” without scanning section names.  
4. Deleting a Quote line **does not delete** the Design; it marks commercial divergence / breaks ownership link (see §13).  
5. Project handoff may later *read* design provenance; it must not become a second pricing system.

**When does a line stop being design-owned?**

| Event | Ownership effect (recommended policy) |
|---|---|
| Created by Apply with linkage | **Owned** |
| User changes product_id on owned line | Still linked but **diverged** (selection vs commercial mismatch) — or PO may choose “detach on product change” |
| User changes qty / discount / unit_price | Still owned; commercial fields are Quote-owned; Design qty may diverge |
| User deletes line | Link cleared; Design component becomes **unapplied / missing output** |
| User moves line to another section | Remain owned unless PO says section is part of ownership contract |
| Re-Apply REPLACE removes old owned lines | Old links cleared; new links written |

---

## 10. Apply identity

**Yes — each Apply operation should have an `apply_id`.**

Needed for:

- Partial apply resume (already exists in-session)  
- Audit: what was written when  
- REPLACE OWNED OUTPUT scoped to last apply or to cumulative ownership set  
- Distinguishing “first apply” vs “re-apply”

Apply record (conceptual): timestamp, actor, projected lines fingerprint, resulting quote_item_ids, success/partial/failure.

---

## 11. Re-Apply policy analysis

| Option | Behavior | Pros | Cons |
|---|---|---|---|
| **A. APPEND** | Every Apply adds new lines | Simple; never deletes | Duplicates (current pain); unsafe |
| **B. REPLACE OWNED OUTPUT** | Delete/replace only lines still design-owned | Stops duplicates; respects manual unrelated lines | Needs linkage; must define conflict with edited owned lines |
| **C. RECONCILE** | Diff desired vs owned; add/update/remove | Powerful | Complex; easy to surprise users; high risk |
| **D. USER-CONFIRM DIFF** | Show proposed mutations before write | Safest UX for destructive changes | More product work; still needs B or C underneath |

Analysis against real cases:

- Manually edited generated lines → C/D need conflict rules; B needs “detach or overwrite?”  
- Unrelated manual lines → A/B/C/D all OK if ownership exists; A fails without ownership  
- Deleted generated lines → B/C can recreate; A always recreates (duplicate risk if others remain)  
- User product replacements in Design selection → B/C update commercial product  
- Qty overrides on Quote → B overwrite may clobber; D can warn  
- Discounts / price overrides → must **never** be owned by Design; REPLACE should preserve commercial price fields where possible or re-price via Quote APIs carefully  
- Sections → ownership should track section created by Design Apply without deleting user sections

---

## 12. Recommended progressive Re-Apply model

**Progressive path (safest for SITE SECURE):**

### Phase R1 — Ownership + APPEND blocked for same Design

- Persist Design + linkage on first Apply  
- Second Apply on same Design **refuses blind append**  
- User must choose: Update owned outputs | Cancel  

### Phase R2 — REPLACE OWNED OUTPUT (default)

- Re-Apply replaces **only** currently design-owned quote items for that `design_id`  
- Never touches lines without provenance  
- Creates missing owned outputs for newly selected roles  
- Removes owned outputs for roles now removed/unselected (optional roles)  
- **Does not** invent reconcile of discounts/price overrides: new/replaced catalog lines follow existing quote item create/update pricing rules; preserve `unit_price` override flags if Quote already supports them when updating in place  

### Phase R3 — USER-CONFIRM DIFF (when REPLACE would change product or qty on diverged lines)

- If owned line is **diverged** (manual product/qty change vs Design selection), show confirm diff before REPLACE  
- Default recommendation: do **not** jump to full automatic RECONCILE (Option C) until R2+R3 proven

**Not recommended as v1:** pure APPEND (A), full automatic RECONCILE (C).

---

## 13. Manual-edit conflict semantics

| Manual change | Design state | Commercial | Recommended conflict class |
|---|---|---|---|
| Edit qty on owned line | Design qty unchanged | Divergent output | `QUOTE_OUTPUT_DIVERGENT` |
| Edit product on owned line | Selection unchanged | Divergent / possible detach | `QUOTE_OUTPUT_DIVERGENT` (+ optional detach policy) |
| Edit discount / override price | Unaffected | Quote-owned | No Design stale; pricing only |
| Delete owned line | Component unapplied | Missing output | `QUOTE_OUTPUT_DIVERGENT` |
| Add unrelated line | Unaffected | Unrelated | None |
| Edit Design selection, not yet Re-Apply | Selection newer than Apply | Stale apply | `APPLY_STALE` |
| Recalculate engine, selection preserved | Recommendation may change | Apply may be stale | `RECOMMENDATION_STALE` / `APPLY_STALE` |

**Deletion of a Quote line changes commercial composition only** — Design remains; component marked not currently applied.

**Product change policy (PO choice, see §32):**  
- **Soft diverge:** keep link, flag divergent  
- **Hard detach:** clear provenance (line becomes manual)

Recommended default for progressive model: **soft diverge + confirm on REPLACE**.

---

## 14. Design lifecycle

Derive from real actions — avoid decorative states.

### Minimal necessary states

| State | Meaning | Entered when |
|---|---|---|
| `DRAFT` | Requirements exist; not successfully calculated (or cleared) | Create / edit requirements invalidating calc |
| `CALCULATED` | Engineering + recommendation present; selection may be defaulted | Successful calculate |
| `APPLIED` | At least one successful Apply linked to Quote lines | Successful Apply |
| `STALE` | Flag **or** orthogonal staleness dimensions (preferred) rather than single mega-state | See §15 |

### Do we need REVIEWED?

**Not as a hard state.** Review is implied by Selection edits while `CALCULATED`/`APPLIED`. Tracking `selection_updated_at` is enough.

### Do we need explicit STALE state?

Prefer **staleness flags/dimensions** over replacing `APPLIED` with `STALE`, so an applied design can be “applied but recommendation-stale.”

### Action matrix (conceptual)

| Action | Effect |
|---|---|
| create | `DRAFT` |
| edit requirements | Invalidate calculation → `DRAFT` (or keep last calc as historical snapshot — PO) |
| calculate | Write engineering + recommendation; reset or preserve overrides per policy → `CALCULATED` |
| choose alternatives | Update Selection only |
| apply | Write quote lines + linkage → `APPLIED` |
| edit quote manually | May set output divergent; Design state stays `APPLIED` |
| reopen | Load Design; do not invent from lines |
| recalculate | New recommendation; mark prior recommendation superseded |
| revise quote (commercial lifecycle) | Design remains associated; commercial revise rules unchanged |

Smallest model: **`DRAFT | CALCULATED | APPLIED`** + staleness dimensions.

---

## 15. Staleness model

Staleness is **not one bit**.

| Dimension | Trigger examples | Meaning |
|---|---|---|
| **DESIGN stale** (requirements vs last calc) | Requirements edited after `calculated_at` | Must recalculate for engineering trust |
| **RECOMMENDATION stale** | Engine/ruleset version changed; intentional recalc requested | Last recommendation may not match today’s engine |
| **CATALOG resolution stale** | Selected/preferred product inactive; attrs no longer satisfy technical_requirements; better candidates exist (optional soft) | Resolution vs live catalog drift |
| **QUOTE output divergent** | Owned line qty/product deleted/changed vs Selection | Commercial projection ≠ Selection |

| Change | DESIGN | RECOMMENDATION | CATALOG resolution | QUOTE output |
|---|---|---|---|---|
| Catalog product attrs change | no | maybe soft | **yes** | no (until reopen/reapply) |
| Product inactive | no | no | **yes** | maybe (line still sells historical SKU) |
| Engine algorithm/version bump | no | **yes** | maybe after recalc | no |
| Requirements change | **yes** | **yes** (after) | after recalc | apply stale |
| User changes Design selection | no | no | no | **apply stale / divergent if applied** |
| User changes Quote qty | no | no | no | **divergent** |

UI may surface these separately later; contract must allow independent flags.

---

## 16. Engine / ruleset versioning

Minimum metadata (justified by CCTV’s existing `engine_version` on recommendation):

| Field | Necessary? | Why |
|---|---|---|
| `engine_type` | **Yes** | Isolate CCTV vs future domains |
| `engine_version` (integer ruleset, as CCTV today) | **Yes** | Historical honesty; staleness when bump |
| `calculated_at` | **Yes** | Temporal audit |
| SemVer / changelog infra | **No** for v1 | Not justified |
| Full input+output content-addressed store forever | Optional later | Nice for audit; not minimum |

On reopen: show design as calculated with version N. Recalculate may warn if current engine version ≠ stored.

**Do not silently recompute on open.**

---

## 17. Catalog relationship

| Concept | Persist in Design? | Owned by |
|---|---|---|
| Engineering requirement (“camera satisfying X”) | **Yes** (`technical_requirements`) | Design |
| Candidate set at calculation time | **Yes** (product ids + confidence + checks) | Design snapshot of resolution |
| Live “what satisfies X now” | **No** as sole truth | Recompute via engine+catalog |
| User selection product id | **Yes** | Design Selection |
| Commercial name/price as offered to customer | **No** (except optional denormalized label) | Quote item + sent snapshot / PDF |
| Full product attribute clone | **Avoid** | Catalog; denormalize only ids + thin display fallback |

Design stores **references + resolution evidence**, not a second catalog database.

---

## 18. Quote relationship

```text
Quote (1) ──< owns commercial lines, discounts, lifecycle, pricing
   │
   └──< System Design (0..N)  contributes owned lines via Apply
```

Rules:

- Design does not replace Quote composition UI  
- Design Apply uses existing quote item APIs  
- Quote lifecycle (draft/sent/…) gates editability as today; Design edits follow same commercial editability (only when Quote editable)  
- Deleting Quote cascades or orphans Designs — **PO decision** (recommend cascade with Quote for v1)

---

## 19. Site relationship

Today: CCTV ignores Site. Do not change.

Future cardinality (extensible, no multi-site quoting invented):

```text
Quote.site_id     → 0..1 Site   (existing)
Design.site_id    → 0..1 Site   (optional; may mirror Quote.site or set later)
Design.quote_id   → 0..1 Quote
```

Cases:

| Case | Support |
|---|---|
| Quote for one site | Existing |
| Multiple Designs for one Quote/site | Yes via 0..N Designs |
| Design before Site selected | `site_id` null OK |
| Design later attached to Site | Allow patch when product approves site-aware |

No multi-site Quote model here.

---

## 20. Multi-engine relationship

```text
Quote
  ├─ System Design (engine_type=cctv)
  ├─ System Design (engine_type=access)   // future
  ├─ System Design (engine_type=alarm)    // future
  └─ Manual lines (no design provenance)
```

Coexistence rules:

1. Each Design isolated by `engine_type` + own components/selection/apply ownership set  
2. All Applies write into **same** Quote composition  
3. **One** pricing authority (Quote)  
4. No Combined God Engine  
5. Section strategy: prefer one section (or section group) per Design Apply for human clarity — commercial detail, not engine math  
6. Re-Apply REPLACE scoped by `design_id` only — never other engines’ owned lines  

---

## 21. Project handoff potential

| Class | Examples | Flow to Project? |
|---|---|---|
| **COMMERCIAL-ONLY** | unit prices, discounts, VAT, margins, payment terms | Via existing quote → project commercial path as today |
| **ENGINEERING useful to delivery** | role list, selected products, quantities, requirements, assumptions, unresolved warnings | **Potential later** read-only package — not now |
| **SHOULD NOT flow** | candidate rankings internal scores, cost, authz, AI drafts unconfirmed, staff-only notes unless product says so | Exclude |

Do not expand Project/FieldJob in this plan.

---

## 22. Partial / unresolved policy

Reusable vocabulary (domain decides membership):

| Completeness | Meaning |
|---|---|
| **COMPLETE** | All blocking roles resolved with acceptable selection; Apply can fully express Design |
| **PARTIAL** | Some optional unresolved and/or non-blocking gaps; Apply may proceed for resolved roles |
| **BLOCKED** | Invalid input or unresolved **blocking** roles such that domain forbids meaningful Apply |

Quote Builder must **not** invent engineering completeness — it consumes Design/`blocking` flags from the domain engine (as CCTV `blocking` / `optional` already do).

---

## 23. AI / text assistance boundary

AI may draft; it must not silently authorize.

| AI output | Before becoming engineering input |
|---|---|
| NL → structured requirements fields | **User confirm** (explicit accept) |
| Suggested missing questions | User answers |
| Catalog discovery hints | User/engine structured match still required |
| Explanation of recommendation | Presentational |

Store suggestion provenance on fields when present, e.g. `field_provenance: USER_CONFIRMED | AI_SUGGESTED_UNCONFIRMED | LEAD_PREFILL | …` — AI_SUGGESTED_UNCONFIRMED must not feed calculate until confirmed (or calculate may run only on confirmed subset — domain policy).

AI must never set pricing, permissions, or mandatory engineering quantities without deterministic engine rules.

---

## 24. Security / RLS / authz requirements

Conceptual (no grants yet):

| Concern | Requirement |
|---|---|
| Tenancy | `workspace_id` on Design; RLS workspace isolation |
| Quote binding | Design visible only if actor can view bound Quote (and customer/site as today) |
| Actions (conceptual) | `system_designs.view`, `system_designs.edit`, `system_designs.apply` **or** reuse `quotes.edit` + `catalog.view` as CCTV recommend does today |
| Technician | Commercial isolation preserved; Design must not leak cost; field roles follow existing quote/project rules |
| Mutate Quote via Apply | Requires quote edit authorization |
| Audit | apply_id + actor on Apply |

Do not add authz catalog entries in this phase.

---

## 25. Persistence Option A — `system_designs` row + structured JSON document

Single table/document holding requirements, engineering, recommendation, selection, linkage maps in JSON (plus indexed columns: workspace, quote, engine_type, status, versions, timestamps).

| Criterion | Assessment |
|---|---|
| Reopen fidelity | Excellent if document complete |
| Engine isolation | Good (`engine_type` + opaque JSON) |
| Queryability | Weak for per-role queries |
| Schema churn | Low (JSON evolves inside) |
| Versioning | Easy to snapshot whole document |
| Reconciliation | Linkage inside JSON OK; harder to join |
| Auditability | Whole-document versions possible |
| RLS | Straightforward row-level |
| Future domains | Strong |
| Complexity | Lowest |

---

## 26. Persistence Option B — `system_designs` + `system_design_components`

Header row + component rows (role, qty, technical_requirements, selection, engine preferred, linkage to quote_item). Recommendation candidates as JSON on component or child table.

| Criterion | Assessment |
|---|---|
| Reopen fidelity | Excellent |
| Engine isolation | Good |
| Queryability | Better (per-role, per-product joins) |
| Schema churn | Medium |
| Versioning | Header version + components |
| Reconciliation | Natural join to quote_items |
| Auditability | Good |
| RLS | Header + child policies |
| Future domains | Good (opaque tech_requirements) |
| Complexity | Medium — **best balance** |

---

## 27. Persistence Option C — Fully normalized requirements / components / selections / candidates / applies

Separate tables for requirements keys, candidates, selection events, apply operations, etc.

| Criterion | Assessment |
|---|---|
| Reopen fidelity | High if well designed |
| Engine isolation | Risk of over-normalizing domain fields into shared columns |
| Queryability | Highest |
| Schema churn | Highest across domains |
| Versioning | Complex |
| Reconciliation | Strong |
| Auditability | Strong event model |
| RLS | Many tables |
| Future domains | Painful early |
| Complexity | Highest — premature |

---

## 28. Persistence option comparison

| | A Document | B Header+Components | C Fully normalized |
|---|---|---|---|
| Fit for CCTV wrap | Excellent | Excellent | Overkill |
| Multi-engine | Excellent | Excellent | Risky shared columns |
| Re-Apply linkage | Adequate | **Best** | Best but costly |
| Speed to first durable reopen | **Fastest** | Fast | Slow |
| Long-term query | Weak | **Good enough** | Strong |

---

## 29. Recommended persistence direction

**Recommend Option B** (`system_designs` + `system_design_components`), with:

- Opaque JSON on header for domain `requirements` + `engineering` + top-level warnings/unresolved  
- Components as rows for selection, ownership (`quote_item_id`), role/qty  
- Candidates JSON on component (avoid candidate table until needed)  
- `system_design_applies` optional thin table when Apply history matters (can start as JSON on header for v1)

**Option A** is acceptable **interim** if implementation wants a thinner first slice — but B is the target direction because Re-Apply ownership and multi-role query need first-class components.

**Not recommended now:** Option C.

---

## 30. CCTV incremental integration seam

Do **not** rewrite `cctv_sizing` / `cctv_recommend` math.

Smallest future seams:

```text
1) AFTER build_system_recommendation(...)
   → persist/load Design document from SystemRecommendation + Selection

2) SystemBuilderDrawer open
   → if quote has Design(engine=cctv): load → hydrate requirements + review selection
   → else: current defaults/lead prefill

3) onApply (existing applyCctvBuildLines)
   → wrap: create/update Design, write quote lines WITH provenance/linkage
   → REPLACE owned outputs when Design already APPLIED (per §12)

4) Recalculate
   → POST /cctv/recommend unchanged
   → merge new recommendation into Design; preserve USER_OVERRIDE per policy
```

CCTV remains authority for calculate/resolve. Persistence is an outer shell.

---

## 31. Migration implications — planning only

When implementation is approved (not now):

1. New tables (B) + RLS policies mirroring quotes workspace isolation  
2. Optional nullable provenance columns on `quote_items` **or** linkage-only on design side (prefer design-owned map first to avoid Quote pollution; add item columns only if query needs)  
3. No change to `pricing.py`, lifecycle, Share/Send, PDF  
4. Backfill: **none required** — historical quotes simply have zero Designs  
5. Feature flag: durable reopen off until CCTV hydrate path ready  
6. Authz: start by piggybacking `quotes.edit` / `catalog.view`; dedicated actions later if needed  

---

## 32. Product Owner decisions still required

1. Soft diverge vs hard detach when user changes product on owned line  
2. On requirements edit: discard last calculation vs keep historical snapshot  
3. On recalculate: preserve all USER_OVERRIDE automatically vs confirm each  
4. Quote delete → cascade Designs?  
5. Allow Design unbound to Quote?  
6. When to introduce USER-CONFIRM DIFF UI (R3 timing)  
7. Whether provenance columns live on quote_items or only on Design  
8. Site on Design: unused null vs mirror Quote.site_id automatically  
9. Project handoff packaging of engineering data — later or never  
10. Completeness gate: allow PARTIAL Apply to sent Quotes or only COMPLETE  

---

## 33. Technical risks

1. Implementing REPLACE without linkage → data loss or duplicates  
2. Over-storing catalog snapshots → drift and PII/bloat  
3. Silently recalculating on open → dishonest history  
4. Putting money fields on Design → dual pricing authority  
5. Over-normalizing shared schema (Option C) before second engine exists  
6. Section-name heuristics as ownership proxy → fragile  
7. Ignoring divergent qty/price → angry users on Re-Apply  
8. Multi-engine Apply races without per-design locks  

---

## 34. What remains explicitly out of scope

- Implementation / migrations / authz grants  
- Quote Builder redesign  
- CCTV math changes  
- New Alarm/Access/Intercom engines  
- Combined mega-engine  
- Automatic RECONCILE v1  
- Site-aware CCTV calculations  
- Project/FieldJob expansion  
- AI as engineering authority  
- Pricing ownership in Design  

---

## 35. Recommended next step

1. Product Owner workshop on §32 (especially diverge/detach + recalculate override preservation + R2 REPLACE acceptance).  
2. Write a short **ADR: System Design Option B envelope** (field list locked to CCTV `SystemRecommendation` + Selection) — still no migration.  
3. Only then: implementation spike behind flag — save/load Design around existing `/cctv/recommend` + Apply seam (§30).

---

# Answers to final questions

### 1. What exactly is a System Design?

A durable, workspace-scoped technical object for one domain engine (`engine_type`) that stores Requirements, engineering Design results, Recommendation, and user Selection, and can Apply owned commercial lines into a Quote — without owning pricing.

### 2. What must survive closing/reopening the browser?

Requirements, engineering result (last calc), recommendation (roles/candidates/status/warnings), selection/overrides/removals, engine type/version/timestamps, and after Apply: design↔quote_item linkage / apply identity.

### 3. Source of truth for engineering?

The durable **System Design** (requirements + calculation + recommendation + selection). Not quote lines.

### 4. Source of truth for commercial pricing?

The **Quote** + existing server pricing. Design never stores authoritative money totals.

### 5. How do we know which Quote lines came from which Design?

Stable `design_id` + `component_id` (+ `apply_id`) linkage to `quote_item_id` (design-owned map and/or item provenance).

### 6. What happens when a user manually edits those lines?

Commercial composition changes; Design remains. Line becomes **divergent** (recommended) or **detached** (alternate PO policy). Deletion unapplies output only.

### 7. What should Re-Apply do?

Progressive: block blind append → **REPLACE OWNED OUTPUT** for that Design only → add **USER-CONFIRM DIFF** when diverged. Do not start with full automatic reconcile.

### 8. How can multiple engines coexist in one Quote?

Quote → 0..N Designs by `engine_type`; each owns its own components/linkage; all write into one composition; one pricing authority.

### 9. What should happen when engine/catalog data changes later?

Do not silently mutate. Mark recommendation/catalog-resolution staleness; recalculate only on explicit user action; preserve user overrides per policy; historical `engine_version` remains on stored Design.

### 10. Smallest persistence model that enables this safely?

**Option B:** `system_designs` + `system_design_components` (candidates JSON on component; engineering/requirements JSON on header; apply linkage on components), wrapping CCTV without rewriting math.

---

**END — DURABLE SYSTEM DESIGN MODEL — STOP**
