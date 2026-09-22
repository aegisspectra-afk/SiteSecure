# DURABLE SYSTEM DESIGN — R3 ATOMIC OWNED APPLY + REPLACE PREFLIGHT

**Date:** 2026-09-22  
**Mode:** RESEARCH / TRANSACTION DESIGN ONLY — ZERO PRODUCT CODE  
**Depends on:** R1 persistence, R2 CCTV hydration, readiness Option B linkage  
**Allowed artifact:** this document only

---

## 1. Executive finding

R3 must replace the **legacy sequential `addQuoteItem` Apply** with a **server-owned atomic mutation** that:

1. Creates or replaces **only** Quote lines owned by **this** Design.  
2. Records Design-side linkage (`quote_item_id`, applied fingerprint, `apply_id`).  
3. Detects **Quote-output divergence** (product/qty/missing) and refuses destructive replace without **bound confirmation**.  
4. Distinguishes **Design-changed / unapplied** (`calculated_at > last_applied_at`) from Quote divergence.  
5. Keeps **Python `pricing.recalculate` / `_persist_totals`** as commercial authority — **not** SQL formulas.  
6. Resolves **unit_price / cost** from live catalog in FastAPI (same as `_insert_line`) — **never** from Design candidate JSON.

**Recommended V1 mutation shape:** DELETE owned items + INSERT new owned items (no clever line-level reconcile).

**Pricing-after-RPC:** Not a hard architecture blocker. Existing `POST …/recalculate` and every item mutation path already tolerate “items first, totals follow.” R3 must always follow RPC with `_persist_totals` (and document stale-total window + recovery).

**Highest risk:** SECURITY DEFINER RPC that can delete/insert `quote_items` if authorization or ID scoping is wrong.

---

## 2. Current legacy Apply trace

Verified path (R2 unchanged Apply):

```text
SystemBuilderDrawer.handleAdd
  → canAddRecommendationToQuote → CctvBuildQuoteLine[] { role, productId, qty, optional }
  → QuoteBuilder.applyCctvBuildLines
  → createOnce()
  → createQuoteSection (“מערכת CCTV” uniqueness helper)   [once per apply session]
  → for each line: api.addQuoteItem({ product_id, item_type:"catalog", qty, section_id })
  → POST /quotes/{id}/items
  → require quotes.edit (draft-only via QUOTE_EDITABLE)
  → _insert_line (catalog load → list_price/cost → catalog_snapshot → insert)
  → _persist_totals (pricing.recalculate → patch line_net + quote totals)
  → return QuoteOut
```

| Step | Input | Output | Authz | Validation | Price source | Cost source | Section | Failure |
|---|---|---|---|---|---|---|---|---|
| Drawer gate | recommendation + selection | lines[] or empty/block | UI only | TEXT_ASSISTED / blocking rules | n/a | n/a | n/a | no Apply |
| `applyCctvBuildLines` | lines | session fingerprint / partial recovery | UI lock | duplicate fingerprint (session) | n/a | n/a | create section if needed | partial lines already inserted |
| `addQuoteItem` client | product_id, qty, section_id | QuoteOut | bearer | HTTP | n/a | n/a | pass-through | throws; UI recovery |
| `add_item` API | QuoteItemIn | Quote + items | `quotes.edit` | draft state; product exists | catalog `list_price` if unit_price null | catalog `cost` | `section_id` optional FK | 403/404; no rollback of prior lines |
| `_insert_line` | body + ctx | insert row | override_price if unit_price ≠ list | product workspace match | **server catalog** | **server catalog** | stored on item | False → 404 |
| `_persist_totals` | quote + items | totals | same session | zip items | pricing.py | pricing.py cost_total | section discounts | non-atomic vs prior inserts |

**Commercial semantics R3 must preserve:** draft-only edit; catalog-authoritative money; no client price/cost; section membership optional; events optional.

---

## 3. Ownership invariant

**Owned** iff a live `system_design_components` row has `quote_item_id = item.id` for `design_id = D` (and Design not soft-deleted).

Design-side linkage remains **sufficient** for V1 (partial UNIQUE on `quote_item_id`, `ON DELETE SET NULL`).

| Invariant | V1 rule (CCTV-shaped) |
|---|---|
| Components → Quote items | **1 component → 0..1 item** (CCTV roles today) |
| Multiple components → one item | **Forbidden** (unique `quote_item_id`) |
| One item → multiple Designs | **Forbidden** |
| Quote item deleted | FK nulls `quote_item_id` → **MISSING_OUTPUT** divergence |
| Design deleted | Hard-delete Design/components; **leave Quote lines** (unowned). Linkage rows gone |
| Component removed after recalc | On next Apply: old owned item for removed role is **eligible for delete** under REPLACE (still “owned” until Apply); until Apply, line remains commercial |

Prefer **strict simple ownership**. No multi-line-per-role without evidence.

---

## 4. Fingerprint contract

**Question answered:** “Does the Quote still contain the engineering output this Design last applied?”

Canonical applied fingerprint per component (and aggregate Design `apply_fingerprint`):

```text
applied_product_id + applied_qty  (+ implied item_type=catalog)
canonical string e.g. "{product_id}|{qty}"
aggregate: sort role_key → join "role:product:qty"
```

| Field | Class | In fingerprint? |
|---|---|---|
| `product_id` | ENGINEERING IDENTITY | **Yes** |
| `qty` | ENGINEERING IDENTITY | **Yes** |
| `item_type` | ENGINEERING IDENTITY (expect catalog) | **Yes** if ≠ catalog → diverge |
| SKU / name / description | PRESENTATIONAL / catalog snapshot | **No** |
| `section_id` | PRESENTATIONAL layout | **No** (V1) |
| `unit_price` | COMMERCIAL-ONLY | **No** |
| `discount` / discount_type | COMMERCIAL-ONLY | **No** |
| `cost` | COMMERCIAL-ONLY / restricted | **No** |
| `sort_order` | PRESENTATIONAL | **No** |
| Missing item | ENGINEERING | **MISSING_OUTPUT** |

Price/discount changes **do not** create engineering divergence.

Stored already on R1: `applied_product_id`, `applied_qty`, `applied_output_fingerprint`, header `apply_fingerprint`.

---

## 5. Divergence classification

| Event | Class |
|---|---|
| qty edit on owned line | ENGINEERING DIVERGENCE |
| product_id change | ENGINEERING DIVERGENCE |
| owned item deleted | ENGINEERING DIVERGENCE (MISSING) |
| unit_price / discount / override | COMMERCIAL-ONLY (aligned for Apply) |
| description / SKU text | NO RELEVANT (engineering) |
| section move | NO RELEVANT (V1) |
| remove owned line | DIVERGENCE |

Policy: linkage **remains**; no silent detach.

---

## 6. Design-changed vs Quote-diverged

| Condition | Meaning | Apply behavior |
|---|---|---|
| `calculated_at > last_applied_at` (or null last_applied) with **aligned** owned fingerprints | Design has **unapplied** engineering changes | Clean REPLACE owned output (no confirm) |
| Owned fingerprints mismatch / missing | **Quote-diverged** | No mutation; return diff; require confirmation |
| Both | Treat as diverged first (safer) | Confirm bound to current Quote fingerprints + Design revision |

**Schema:** Prefer existing `calculated_at` / `last_applied_at` / applied_* — **no migration required** for this distinction. Optional later: `last_applied_design_revision` for clarity (not required if revision CAS + timestamps used carefully).

---

## 7. Divergence response DTO

Smallest server payload (no cost/margin/list_price):

```text
{
  code: "DESIGN_APPLY_DIVERGED",
  design_id, revision,
  confirmation_required: true,
  confirmation_token,          // bound token (see §8)
  confirmation_expires_at,
  diverged: [
    {
      component_id, role_key,
      kind: "CHANGED" | "MISSING" | "UNEXPECTED",
      applied: { product_id, qty },
      current: { quote_item_id?, product_id?, qty? } | null
    }
  ],
  proposed: [
    { component_id, role_key, product_id, qty, optional }
  ],
  untouched_manual_item_count?: number
}
```

HTTP: **409** with `code=DESIGN_APPLY_DIVERGED` (repository already uses 409 for conflicts / RESOURCE_STATE).

---

## 8. Confirmation binding

Do **not** accept unbound `force=true`.

Confirmation must bind:

| Bind | Why |
|---|---|
| `design_id` + expected `design.revision` | Design CAS |
| `quote_id` + quote `status=draft` | Lifecycle |
| Hash of **current diverged set** (component_id + applied + current fingerprints) | Consent is for **this** diff |
| Hash of **proposed output** (role/product/qty) | Same Apply intent |
| Optional short TTL | Stale consent |

Server regenerates token when issuing 409. Confirmed Apply sends `confirmation_token` + same `revision`. If Quote/Design/diff changed → **409 CONFIRMATION_STALE** / `CONFLICT_REVISION` — no mutation.

---

## 9. Initial Apply contract

Same endpoint as Re-Apply when no owned `quote_item_id`s exist.

| Aspect | Contract |
|---|---|
| Input | design_id, expected revision, optional selection already persisted (R2) |
| Validation | draft Quote; quotes.edit; components with effective selection; products active in workspace |
| Mapping | 1 selected non-removed component → 1 catalog line |
| Section | **Create or reuse** CCTV system section by name heuristic **outside** ownership; do not delete sections on Apply |
| Pricing | FastAPI resolves list_price/cost → RPC inserts those values → `_persist_totals` |
| Linkage | set quote_item_id, applied_*, last_apply_id, current_apply_id, last_applied_at, apply_fingerprint; revision++ |
| Return | QuoteOut + Design (or Design summary) |

Prefer **one path** for initial + re-apply (branch inside RPC).

---

## 10. Clean Re-Apply contract

Preconditions: owned set empty fingerprints match OR no owned rows; Design revision matches.

1. Lock Design row (`FOR UPDATE`) + check revision.  
2. Load owned item ids; verify fingerprints vs live items.  
3. If clean: DELETE owned items only; INSERT proposed; rewrite linkage; new `apply_id`; bump revision.  
4. FastAPI `_persist_totals`.

**Replacement model:** **DELETE + INSERT** (safest V1). No UPDATE-in-place reconcile.

---

## 11. Diverged Re-Apply contract

1. Request without token → detect diverge → **no commercial mutation** → 409 + DTO + token.  
2. UI confirm.  
3. Request with token → verify binds → atomic REPLACE as clean path.  
4. If bind fails → 409 stale.

---

## 12. Transaction boundary

**Must be inside Postgres SECURITY DEFINER RPC (single transaction):**

1. Validate workspace / quote_id / design_id consistency  
2. Assert Quote `deleted_at IS NULL` and `status = draft`  
3. Assert Design `deleted_at IS NULL`, revision match → lock Design  
4. Load components; compute owned set  
5. Divergence check vs live `quote_items`  
6. If diverged and confirmation invalid → RAISE (rollback)  
7. Validate proposed lines payload (ids belong to workspace/design; products exist)  
8. DELETE FROM quote_items WHERE id IN owned_ids **and** quote_id/workspace match  
9. INSERT quote_items from **server-prepared** commercial rows  
10. UPDATE components linkage + applied_* + last_apply_id  
11. UPDATE design current_apply_id, apply_fingerprint, last_applied_at, revision+1  

**Outside SQL (FastAPI):**

- authorize(`quotes.edit`)  
- load Design/selection; build proposed engineering lines  
- **resolve catalog list_price/cost/snapshot** (mirror `_insert_line`)  
- call RPC with prepared rows  
- `_persist_totals` / events / audit  
- return response  

Do **not** put `pricing.py` math in SQL.

---

## 13. Pricing boundary

| Case | Outcome | Mitigation |
|---|---|---|
| A RPC + totals OK | Consistent | Happy path |
| B RPC OK, totals fail | Items new; totals stale | Return 503/`API_UNAVAILABLE` with design applied; client/retry `POST …/recalculate`; same class as multi-item template apply risk today |
| C crash after RPC | Stale totals | `recalculate` endpoint exists |
| D concurrent read mid-window | May see stale totals briefly | Acceptable; document |
| E pricing invalid state | Raise after RPC | Rare; recalculate/fix |

**Finding:** Not a **blocker** for R3 if follow-up recalculate is mandatory and tested. Moving pricing into SQL **is** out of scope / forbidden.

**Not hidden:** there is a **short consistency window**; operationally identical class to today’s non-atomic multi-`addQuoteItem`.

---

## 14. Catalog commercial authority

`_insert_line` today:

- Loads `products` by id + workspace  
- `unit_price ← list_price` (unless override_price)  
- `cost ← product.cost`  
- `catalog_snapshot ← catalog_line_snapshot(product)`  
- Computes `line_net` via `pricing.line_net`

**R3 design:**

```text
FastAPI (user JWT / authorize)
  → for each proposed product_id: load product; build CommercialLine {product_id, qty, unit_price, cost, snapshot, description, sku, name, unit, section_id, item_type}
  → RPC receives CommercialLine[] only
  → RPC inserts exactly those fields; rejects extra money keys from client
```

Design candidates **must not** supply money. Strip already applies on Design JSON; Apply path ignores them.

---

## 15. SECURITY DEFINER security model

| Requirement | Approach |
|---|---|
| `search_path = public` | Fixed in function |
| Auth | `auth.uid()` not null |
| Workspace | all ids scoped; reject cross-workspace |
| Authorize | **FastAPI `quotes.edit` first**; RPC re-checks membership + draft Quote + Design belongs to Quote (defense in depth). Prefer **not** bypassing by trusting only API |
| Deletion scope | ONLY item ids currently linked on this Design’s components |
| Insert scope | ONLY prepared rows for this quote_id/workspace_id |
| No arbitrary price | Money fields only from FastAPI-prepared payload; RPC validates product_id ∈ workspace and matches prepared row |
| RLS | SECURITY DEFINER bypasses RLS — **must** duplicate tenancy checks inside function (same pattern as `catalog_import_commit`) |

---

## 16. Locking / concurrency

| Case | Mechanism |
|---|---|
| Two Re-Apply same Design | `SELECT … FOR UPDATE` Design + revision CAS → loser 409 |
| Edit owned item during Apply | Fingerprint check inside txn → diverge or confirm path |
| Delete owned item during Apply | MISSING → diverge |
| Recalc Design other tab | revision mismatch → 409 |
| Other Design Apply | Owned sets disjoint; no cross-delete |
| Manual unrelated item | Untouched |
| Discount edit | Commercial-only; clean Apply OK |
| Send while Apply | RPC requires `status=draft`; sent → fail; lifecycle unchanged |

Never mutate non-draft Quotes (`QUOTE_EDITABLE`).

---

## 17. Quote lifecycle interaction

| State | Apply |
|---|---|
| draft | Allowed |
| sent/viewed/approved/… | Denied |
| revise → draft N+1 | Same Design on quote_id; Apply affects **current draft items only**; `quote_versions` snapshots untouched |

Ownership operations must not write `quote_versions` / public tokens.

---

## 18. Section behavior

Current CCTV: creates a **named section**, puts items in it. Section is **not** uniquely owned in DB.

**V1:** R3 owns **items only**.  

- May create/reuse section for new inserts (FastAPI helper, like today).  
- **Must not** delete a section that still contains non-owned items.  
- Orphan empty CCTV sections: leave or optional cleanup only if empty — prefer leave in V1.

---

## 19. Delete Design behavior

**Recommend B:** Delete Design + components; **leave Quote lines** as manual/unowned.

- No surprise commercial deletion.  
- Optional later “remove owned lines” explicit action — not V1 default.  
- Do not block delete solely because owned output exists (would trap users).

---

## 20. Proposed RPC signature (conceptual)

```text
system_design_apply_owned(
  p_workspace_id uuid,
  p_quote_id uuid,
  p_design_id uuid,
  p_expected_revision int,
  p_actor_id uuid,
  p_apply_id uuid,
  p_section_id uuid,                 -- nullable; FastAPI-resolved
  p_lines jsonb,                     -- server-prepared commercial lines
  p_confirmation_token text,         -- nullable
  p_expected_divergence_hash text,   -- nullable; required if diverged path
  p_expected_proposed_hash text
) RETURNS jsonb
  -- { design_revision, apply_id, item_ids[], replaced_count, inserted_count }
```

`p_lines` element shape (no client trust):

```text
{ component_id, role_key, product_id, qty, item_type, unit_price, cost,
  description, sku, name, unit, catalog_snapshot, discount, discount_type, sort_order }
```

Errors (raise → API maps): `REVISION_CONFLICT`, `QUOTE_NOT_DRAFT`, `DIVERGED`, `CONFIRMATION_STALE`, `INVALID_PRODUCT`, `PERMISSION`/`NOT_MEMBER`.

---

## 21. FastAPI orchestration

```text
POST /workspaces/{ws}/system-designs/{id}/apply
  body: { revision, confirmation_token? }

1. load Design + Quote; require quotes.edit; status draft
2. build effective selection from components (R2 fields)
3. resolve each product → CommercialLine (reuse _insert_line logic extracted/shared)
4. ensure section_id (create/reuse helper; not RPC-owned)
5. compute divergence vs applied_*; if diverged && !token → 409 DTO
6. if token → verify hashes
7. RPC(...)
8. _persist_totals
9. return { quote, design }
```

Reuse: `_load_quote`, `_ref`/`require`, product select, `catalog_line_snapshot`, `pricing.line_net` / `recalculate`, soft-delete visibility patterns.

---

## 22. Frontend change surface

| Change | Scope |
|---|---|
| Drawer Apply → `api.applySystemDesign(designId, { revision, confirmation_token? })` | Small |
| On 409 DESIGN_APPLY_DIVERGED → confirm sheet listing diverged/proposed | Minimal sheet in existing QuoteFlowSheet |
| Confirmed Replace → same endpoint with token | |
| Remove legacy `applyCctvBuildLines` path when flag on | Feature gate |
| No QuoteBuilder redesign / no mobile stack / no wizard | |

---

## 23. Exact test plan

**INITIAL APPLY:** items + linkage + fingerprints + apply_id; pricing totals match legacy path for same products/qty.

**CLEAN RE-APPLY:** no duplicates; owned replaced; manual + other Design untouched.

**DIVERGENCE:** qty/product/missing detected; price/discount not engineering diverge; no mutation pre-confirm.

**CONFIRM:** known diff replace OK; mutated diff / stale revision rejected.

**CONCURRENCY:** double Apply; Apply vs item edit/delete; Apply vs Design patch; Apply vs Send; two Designs.

**SECURITY:** cross-workspace IDs; cannot delete non-owned items; cannot inject price via Design JSON; technician denied; sent Quote immutable.

**FAILURE:** RPC raise leaves old items; linkage/item atomic; totals failure → recalculate recovery test.

---

## 24. Risk map

| Area | Risk |
|---|---|
| RPC security (DEFINER delete/insert) | **CRITICAL** |
| Transaction correctness | **CRITICAL** |
| Catalog commercial resolution in FastAPI | **HIGH** |
| Pricing-after-RPC stale window | **MEDIUM** (mitigated by recalculate) |
| Divergence confirmation binding | **HIGH** |
| Concurrency / locks | **HIGH** |
| Section non-ownership mistakes | **MEDIUM** |
| Delete Design leaving lines | **LOW** |
| Frontend switch from legacy Apply | **MEDIUM** |

---

## 25. Migration / schema gaps

| Need | Gap? |
|---|---|
| Linkage / applied_* / apply_id / fingerprints | **Present (R1)** |
| Design-changed detection | **Present** (`calculated_at` / `last_applied_at`) |
| Confirmation token store | **Gap:** ephemeral HMAC/JWT signed by API **or** short-lived DB table — prefer **signed token** (no migration) |
| RPC function | **Gap:** new migration for function only |
| quote_items source columns | **Not required** |
| `last_applied_design_revision` | **Optional nicety**, not required |

---

## 26. Blockers

| Item | Blocker? |
|---|---|
| Must move pricing into SQL | **No** — forbidden and unnecessary |
| Design-side linkage insufficient | **No** — verified for V1 |
| Atomic item replace without DEFINER | **Practical blocker for true atomicity** — RPC required (known) |
| Stale totals window | **Not a blocker** if recalculate mandatory + tested |
| Unique CCTV Design per Quote | **Not required** for R3 |

No product-policy blockers for starting R3 implementation after contract review.

---

## 27. Recommended R3 implementation boundaries

**In scope:**

- `system_design_apply_owned` SECURITY DEFINER RPC  
- FastAPI `POST …/system-designs/{id}/apply` orchestration  
- Catalog commercial prep shared with `_insert_line`  
- Divergence 409 DTO + signed confirmation  
- Feature-flag switch drawer from legacy Apply  
- Tests in §23  

**Out of scope:**

- pricing.py changes / SQL pricing  
- QuoteBuilder redesign  
- full reconcile / force=true  
- quote_items provenance columns  
- section ownership lifecycle  
- CCTV math / R2 hydrate rewrite  
- Design deletion cascading commercial lines  
- history subsystem / apply audit table (header `current_apply_id` enough)  

---

**END R3 PREFLIGHT — STOP — NO IMPLEMENTATION**
