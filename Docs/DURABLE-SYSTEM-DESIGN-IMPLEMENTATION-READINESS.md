# DURABLE SYSTEM DESIGN — IMPLEMENTATION READINESS

**Date:** 2026-09-22  
**Mode:** SCHEMA + API + TRANSACTION PLAN — ZERO IMPLEMENTATION  
**Prerequisites:**  
- `Docs/SYSTEM-DESIGN-ENGINE-PLATFORM-DISCOVERY.md`  
- `Docs/DURABLE-SYSTEM-DESIGN-MODEL.md`  
**Product code / migrations changed:** NONE  
**Allowed artifact:** this document only

---

## 1. Executive implementation model

V1 introduces durable **System Designs** as Option B tables that wrap the existing CCTV recommend → selection → Apply path, without becoming a second Quote, pricing engine, or Design Studio.

| Rule | V1 lock |
|---|---|
| Ownership | Design **must** belong to one `quote_id` + `workspace_id` (no unbound Designs) |
| Persistence | `system_designs` + `system_design_components` |
| Domain JSON | requirements / engineering / candidates stay opaque JSONB |
| CCTV | Keep `POST /cctv/recommend` + sizing/recommend math unchanged |
| Pricing | Quote APIs + `pricing.py` only |
| Manual edit | Linkage remains; output may be **DIVERGED** |
| Recalculate | Preserve still-valid user overrides; invalid → needs review (no silent replace) |
| Re-Apply | No blind APPEND; REPLACE OWNED OUTPUT; DIVERGED → confirm |
| Site | Optional identity mirror of Quote only; no engineering authority |
| Partial | Does **not** change Send eligibility |
| Soft-delete Quote | Verified: Quotes are **soft-deleted** (`deleted_at`); Designs must follow visibility, not assume hard CASCADE |

---

## 2. Repository persistence conventions

Audited patterns to reuse:

| Convention | Evidence | Apply to Designs |
|---|---|---|
| UUID PK `gen_random_uuid()` | `quotes`, `quote_items`, … | Yes |
| `workspace_id` NOT NULL + FK workspaces `ON DELETE CASCADE` | All tenant tables | Yes |
| `created_at` / `updated_at` + `set_updated_at` trigger | Quotes, sites, products, sections | Yes |
| `created_by` optional → profiles `ON DELETE SET NULL` | Quotes, customers, sites | Yes on header |
| Soft delete via `deleted_at` | **Quotes** (API stamps `deleted_at`; SELECT RLS requires null) | Designs: filter via parent Quote **or** stamp `deleted_at` when Quote soft-deleted; do **not** rely on FK CASCADE for Quote delete |
| Hard CASCADE children with parent row | `quote_items.quote_id ON DELETE CASCADE` | Components CASCADE with Design row |
| JSONB documents | `quote_versions.snapshot`, product `attributes`, events metadata | Domain payloads |
| RLS FORCE + workspace membership | Quotes / items / sections | Same shape |
| Child RLS via EXISTS parent | `quote_items` policies | Components via parent Design |
| Authz in FastAPI `authorize`/`require` | Quotes router | Map to quotes.* (+ catalog.view for calculate) |
| Conditional PostgREST writes | Send: `status=eq.draft` + `version=eq.N` | Design `revision` conditional for Apply/save |
| True multi-write atomicity | `catalog_import_commit` SECURITY DEFINER RPC | **Required for REPLACE Apply** (see §11) |
| Quote item mutations | Sequential PostgREST create/patch/delete + `_persist_totals` | Commercial writes stay Quote-owned; Apply RPC may orchestrate |
| No general If-Match on quotes | N/A | Introduce Design `revision` only |

### Critical Quote deletion fact

`DELETE /quotes/{id}` is **soft delete** (`deleted_at`). The Quote row remains; `quote_items` remain. FK `ON DELETE CASCADE` from Designs → Quotes **does not run** on soft delete.

V1 must:

1. Hide Designs when parent Quote has `deleted_at IS NOT NULL` (API + RLS join), **and/or**  
2. On Quote soft-delete, service-role stamp Designs `deleted_at` (mirror Quote convention).

Workspace hard delete still cascades via `workspace_id`.

---

## 3. Proposed `system_designs` schema

Minimum V1 columns:

| Column | Type | Null | Default | FK | Index | Owner | Why |
|---|---|---|---|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` | PK | PK | Platform | Stable Design identity |
| `workspace_id` | uuid | NO | — | `workspaces(id) ON DELETE CASCADE` | `(workspace_id, quote_id)` | Platform | Tenancy |
| `quote_id` | uuid | NO | — | `quotes(id) ON DELETE CASCADE` | with workspace | Platform | V1 bound ownership; hard-delete safety if Quote ever hard-removed |
| `site_id` | uuid | YES | null | `sites(id) ON DELETE SET NULL` | optional | Platform | Optional identity only if Quote has site; **not** engineering input |
| `engine_type` | text | NO | — | — | `(workspace_id, quote_id, engine_type)` | Platform | Isolate CCTV vs future engines; CHECK `engine_type IN ('cctv')` for V1 expand later |
| `engine_version` | int | NO | — | — | — | Domain write | Ruleset honesty / recommendation staleness |
| `lifecycle_status` | text | NO | `'draft'` | — | — | Platform | Minimal: `draft` \| `calculated` \| `applied` only (see §8) |
| `requirements` | jsonb | NO | `'{}'` | — | — | Domain | MUST persist reopen inputs |
| `engineering_result` | jsonb | YES | null | — | — | Domain | Last calc engineering blob |
| `recommendation_meta` | jsonb | YES | null | — | — | Domain | Top-level warnings/assumptions/unresolved/status/blocking/catalog_stats — **not** full per-role candidate dump if stored on components |
| `calculated_at` | timestamptz | YES | null | — | — | Domain | When last successful calc written |
| `last_applied_at` | timestamptz | YES | null | — | — | Apply | When last successful Apply finished |
| `current_apply_id` | uuid | YES | null | — | — | Apply | Latest successful Apply event id (no history table required) |
| `apply_fingerprint` | text | YES | null | — | — | Apply | Hash of last applied commercial intent (roles×product×qty) |
| `revision` | int | NO | `1` | — | — | Concurrency | Optimistic concurrency for save/calc/Apply |
| `created_by` | uuid | YES | null | `profiles ON DELETE SET NULL` | — | Audit | Repo convention |
| `created_at` | timestamptz | NO | `now()` | — | — | Platform | Convention |
| `updated_at` | timestamptz | NO | `now()` | — | trigger | Platform | Convention |
| `deleted_at` | timestamptz | YES | null | — | partial where null | Soft-hide | Align with Quote soft-delete visibility |

### Explicitly omitted (and why)

| Omitted | Reason |
|---|---|
| Money columns | Pricing belongs to Quote |
| Full recommendation JSON duplicating all components | Prefer components table + thin meta |
| `updated_by` | Rarely used; `created_by` + audit events enough for V1 |
| SemVer string | Integer `engine_version` matches CCTV today |
| Unbound / library fields | Locked out of V1 |

### Recommended constraint

- UNIQUE optional later: at most one **active** CCTV Design per Quote is a **product** choice, not a schema requirement — allow 0..N; UI may create one CCTV Design per Quote in V1 practice.

---

## 4. Proposed `system_design_components` schema

| Column | Type | Null | Default | FK | Index | Why |
|---|---|---|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` | PK | PK | Stable `component_id` |
| `workspace_id` | uuid | NO | — | workspaces CASCADE | `(workspace_id, design_id)` | Tenancy denorm (RLS/query) |
| `design_id` | uuid | NO | — | `system_designs(id) ON DELETE CASCADE` | yes | Parent |
| `role_key` | text | NO | — | — | UNIQUE `(design_id, role_key)` for CCTV 1:1 | Stable role within Design |
| `label` | text | NO | `''` | — | — | Display |
| `quantity` | numeric(12,3) | NO | `1` | — | — | Engineering qty |
| `optional` | boolean | NO | `false` | — | — | Optional role |
| `blocking` | boolean | NO | `false` | — | — | Domain blocking if unresolved |
| `removed` | boolean | NO | `false` | — | — | User removed optional role |
| `resolution_status` | text | YES | null | — | — | RESOLVED/PARTIAL/UNRESOLVED/… |
| `technical_requirements` | jsonb | NO | `'{}'` | — | — | Opaque domain constraints |
| `candidates` | jsonb | NO | `'[]'` | — | — | Candidate array (product summaries **without cost**; see §17) |
| `engine_preferred_product_id` | uuid | YES | null | `products ON DELETE SET NULL` | — | Engine pick at last calc |
| `user_selected_product_id` | uuid | YES | null | `products ON DELETE SET NULL` | — | Effective user choice |
| `selection_origin` | text | NO | `'UNSELECTED'` | — | — | `ENGINE_PREFERRED` \| `USER_OVERRIDE` \| `UNSELECTED` |
| `reason_codes` | jsonb | NO | `'[]'` | — | — | Role-level reasons/warnings |
| `needs_review` | boolean | NO | `false` | — | — | Set when recalc invalidates override |
| `quote_item_id` | uuid | YES | null | `quote_items ON DELETE SET NULL` | unique partial where not null | Design-side linkage |
| `applied_product_id` | uuid | YES | null | — | — | Product id at last Apply |
| `applied_qty` | numeric(12,3) | YES | null | — | — | Qty at last Apply |
| `applied_output_fingerprint` | text | YES | null | — | — | Fingerprint of engineering commercial fields at Apply |
| `last_apply_id` | uuid | YES | null | — | — | Which Apply wrote linkage |
| `created_at` / `updated_at` | timestamptz | NO | now() | trigger | — | Convention |

### Where candidates live

**V1 choice:** `system_design_components.candidates` JSONB.

- Avoids duplicating full recommendation tree on header  
- Header `recommendation_meta` holds aggregate warnings/unresolved/status only  
- No `system_design_candidates` table in V1  

### Effective selection (derived, not a column)

```text
if removed → none
else if user_selected_product_id set → that id (origin may be OVERRIDE or PREFERRED)
else if engine_preferred and not needs_review → preferred
else → none / needs review
```

---

## 5. Linkage decision

### Recommendation: **Design-side linkage only** (no `quote_items` source columns in V1)

Store on each component:

- `quote_item_id`  
- `applied_product_id`, `applied_qty`, `applied_output_fingerprint`  
- `last_apply_id`  
- header `current_apply_id` / `apply_fingerprint`

### Can server meet invariants without item columns?

| Need | Design-side sufficient? | How |
|---|---|---|
| Which item from design/component/apply | **Yes** | Component columns |
| Replace only this Design’s output | **Yes** | All components where `design_id=X` and `quote_item_id` set |
| Detect deleted output | **Yes** | `quote_item_id` set but item GET empty / FK SET NULL on hard delete |
| Detect changed output (divergence) | **Yes** | Compare live item fields to `applied_*` / fingerprint (§6) |
| Preserve unrelated lines | **Yes** | Never touch items not in this Design’s id set |
| Preserve other Designs | **Yes** | Scope by `design_id` |
| Determine divergence | **Yes** | Compare or missing item |

### Invariant that would force quote_items columns

Only if we needed **O(1) reverse lookup from arbitrary item → design without scanning components**, or DB-enforced “item belongs to at most one Design” without app checks.

V1 can enforce uniqueness with:

`UNIQUE (quote_item_id) WHERE quote_item_id IS NOT NULL` on components.

**Do not add bidirectional metadata for convenience.** Revisit item columns only if query/perf evidence demands it.

---

## 6. Divergence model

### Preferred mechanism: **B + A** (compare live item to persisted applied snapshot/fingerprint)

**Not C** (explicit flag on every Quote mutation) — avoids teaching all Quote patch/delete paths about Designs.

**Not D** unless a native trigger is later justified.

### Engineering divergence fields (count)

| Field | Counts as engineering divergence? |
|---|---|
| `product_id` | **Yes** |
| `qty` | **Yes** |
| Line deleted / missing | **Yes** (missing output) |
| `description` | **No** for V1 (cosmetic / catalog snapshot text) |
| `section_id` | **No** for V1 (layout); optional later |
| `sku` | N/A as independent (follows product) |
| `unit_price` | **No** — commercial / override_price semantics |
| `discount` / discount_type | **No** — commercial |
| `cost` | **No** — never Design-owned |

### Detection algorithm (read-time)

For each component with `quote_item_id`:

1. Load quote item (same workspace/quote).  
2. If missing → `MISSING_OUTPUT` (diverged).  
3. Else if `product_id` or `qty` ≠ `applied_product_id` / `applied_qty` (or fingerprint mismatch) → `DIVERGED`.  
4. Else → `ALIGNED`.

No write to Designs required on ordinary Quote edits.

### Confirm gate

Re-Apply REPLACE when any owned component is `DIVERGED` or `MISSING_OUTPUT` requires `confirm_diverged=true` (or equivalent) in API body.

Price-only edits do **not** trip engineering confirm.

---

## 7. Apply identity

| Id | Lifetime | Purpose |
|---|---|---|
| `design_id` | Design lifetime | Container |
| `component_id` | Stable per role instance within Design (CCTV: one per `role_key`) | Linkage + override target |
| `apply_id` | One successful Apply event | Generation marker; stamped on components + header `current_apply_id` |

### Behavior across actions

| Action | Effect |
|---|---|
| Initial Apply | New `apply_id`; set linkages; `lifecycle_status=applied` |
| Reopen | Load Design + components; no new ids |
| Recalculate | Keep `design_id`/`component_id`; refresh candidates/engineering; may set `needs_review`; clear applied? **No** — keep linkage until Re-Apply; mark apply stale via `calculated_at > last_applied_at` |
| Re-Apply | New `apply_id`; REPLACE owned items; refresh applied_* |
| User override | Updates selection columns only |
| Quote revise | Same Quote id/version bump — Design ids unchanged (§13) |

**No apply-history table in V1** — only `current_apply_id` + per-component `last_apply_id`.

---

## 8. Design state model

### Persistent `lifecycle_status` (minimal)

| Value | Meaning |
|---|---|
| `draft` | Requirements only / calc invalid / cleared |
| `calculated` | Successful calc; may or may not have selection |
| `applied` | At least one successful Apply |

### Derived (do **not** store as single status)

| Condition | Derivation |
|---|---|
| Engineering completeness COMPLETE/PARTIAL/BLOCKED | From `recommendation_meta` + component `blocking`/`resolution_status`/`removed` |
| Catalog resolution stale | Live product inactive / attrs fail technical_requirements (on refresh check) |
| Apply stale | `calculated_at > last_applied_at` OR selection changed since apply (track `selection_revision` optional — or compare selection to applied_*) |
| Quote-output divergent | Read-time §6 |
| Soft-deleted | `deleted_at` or parent Quote `deleted_at` |

**Do not** overload one enum with partial/stale/diverged.

---

## 9. API surface

Smallest CCTV V1 surface — **prefer composing existing recommend**:

### Generic System Design (new)

| Op | Method (illustrative) | Notes |
|---|---|---|
| List Designs for Quote | `GET .../quotes/{quote_id}/system-designs` | |
| Get Design | `GET .../system-designs/{id}` | Include components |
| Create Design | `POST .../quotes/{quote_id}/system-designs` | Body: `engine_type`, initial `requirements` |
| Patch requirements / selection | `PATCH .../system-designs/{id}` | Conditional on `revision` |
| Delete Design | `DELETE .../system-designs/{id}` | **Does not** delete Quote lines (§14) |
| Apply / Re-Apply | `POST .../system-designs/{id}/apply` | Body: `confirm_diverged?`, `revision` → invokes atomic REPLACE |

### CCTV domain (keep)

| Op | Endpoint | Notes |
|---|---|---|
| Calculate / recommend | **Existing** `POST .../cctv/recommend` | Unchanged math |
| Persist calc into Design | `POST .../system-designs/{id}/ingest-recommendation` **or** apply-side helper after client calls recommend | Server validates shape; writes engineering + components; merge overrides |

**Avoid** inventing a second CCTV calculate API.

Optional consolidation later: `POST .../system-designs/{id}/calculate` that *internally* calls `build_system_recommendation` — still same Python functions, not a rewrite. V1 may keep client → `/cctv/recommend` → ingest for thinner risk.

### Not separate endpoints (fold into PATCH / ingest)

- save recommendation  
- save selection (PATCH)  

---

## 10. CCTV integration sequence

```text
R-enabled path:

1. Open Quote Builder System Builder
2. GET Designs for quote; if CCTV Design exists → hydrate requirements + selection
   else POST create Design (engine_type=cctv) with defaults/lead prefill
3. User edits requirements → PATCH Design (revision++)
4. Calculate → existing POST /cctv/recommend (unchanged)
5. Ingest recommendation into Design:
   - upsert components by role_key
   - set engine_preferred_*; refresh candidates
   - preserve USER_OVERRIDE if still in candidates and selectable; else needs_review=true
6. User swaps/removes → PATCH selection
7. Apply → POST apply (RPC):
   - createOnce already ensured Quote
   - REPLACE owned outputs only
   - existing quote item create/pricing paths inside transaction
   - write linkage / apply_id / fingerprints
8. Close drawer; Design remains durable
```

Feature flag off → today’s drawer-only flow unchanged.

---

## 11. Apply transaction design

### Fact

A sequence of independent PostgREST deletes/creates/patches from FastAPI is **not atomic**. Partial Apply already exists in UI for that reason.

Repository precedent for atomic multi-write: **`catalog_import_commit` SECURITY DEFINER RPC**.

### Recommendation

**V1 REPLACE Apply MUST use a Postgres RPC**, e.g. conceptual:

`system_design_apply_replace(p_workspace_id, p_design_id, p_revision, p_confirm_diverged, p_actor_id, p_lines jsonb)`

Single transaction boundary:

1. Lock/validate Design `revision` match; bump revision  
2. Load owned `quote_item_id`s for Design  
3. If diverged and not confirmed → raise  
4. Delete only owned quote items (or update in place where product/qty change — prefer delete+insert for simplicity **or** patch product/qty while preserving unit_price/discount when same item id — PO/tech choice; RPC must document)  
5. Insert/update items for effective selection lines  
6. Update component linkage + applied_* + apply_id  
7. Call same totals persistence logic as quotes (either invoke shared SQL helper or return enough for API to `_persist_totals` **inside** same txn if ported)

If totals must stay in Python `_persist_totals`:

**Minimum safe split:**

- RPC: item delete/create + linkage update (atomic commercial composition for owned set)  
- Then API: `_persist_totals`  
- If totals fail: Design linkage already matches items (consistent composition); totals retryable — **acceptable** if documented  
- Worse failure: totals succeed path without RPC → rejected  

**Prefer** moving owned-item mutations into RPC; totals immediately after in same request with retry.

### Failure scenarios

| Scenario | Mitigation |
|---|---|
| Delete ok / create fail | RPC abort → nothing committed |
| Create ok / linkage fail | Same txn → abort |
| Pricing/totals fail after RPC | Composition+linkage consistent; recompute totals |
| Two Re-Apply race | `revision` conditional; loser gets 409 |
| Quote edited during Apply | Divergence check inside RPC; or quote `updated_at` optional guard |
| Design edited during Apply | `revision` mismatch → 409 |

---

## 12. Concurrency model

| Resource | Mechanism |
|---|---|
| Design save / ingest / Apply | Integer `revision`; writes include `revision=eq.{n}` then `revision=n+1` (PostgREST conditional or RPC check) |
| Double Apply | Same revision gate + optional in-RPC advisory lock on `design_id` |
| Two tabs | Last writer wins only with matching revision; else 409 CONFLICT |
| Quote item races | Owned set replaced under Design revision; unrelated edits may cause divergence detect on next Apply |

`updated_at` alone is weaker (clock skew / equal stamps); prefer **`revision`**.

---

## 13. Quote revision semantics

Verified: `revise_quote` keeps **same `quote_id`**, increments `version`, resets status to `draft`, clears sent/viewed/approval timestamps. Items remain. Customer truth lives in `quote_versions` snapshots.

### V1 recommendation: **A — Designs remain attached to Quote identity**

| Option | Verdict |
|---|---|
| A continue on Quote | **Choose** — engineering working state for live draft |
| B clone Designs | Unnecessary; snapshots already protect sent truth |
| C quote_version on Design | Overkill for V1 |

After revise: Designs still editable with the draft; `lifecycle_status` stays `applied` if lines remain; may be apply-stale if user recalculates. No Design clone.

---

## 14. Delete semantics

| Delete | V1 rule |
|---|---|
| Soft-delete Quote | Hide/soft-delete Designs; **do not** auto-hard-delete commercial lines (already retained) |
| Hard workspace delete | CASCADE Designs |
| Delete Design | Delete Design + components rows; **leave Quote lines intact**; clear is N/A (linkage gone → lines become ordinary manual). Optionally null nothing on items (no item columns). |
| Delete component row | Discouraged as API; roles refreshed on ingest. If deleted, clear ownership conceptually |
| Delete linked Quote item | FK `ON DELETE SET NULL` on `quote_item_id` → component shows MISSING_OUTPUT |
| Delete/inactive catalog product | `ON DELETE SET NULL` on product FKs; selection may become invalid → `needs_review` on next calc/load check |

**Safest V1:** deleting a Design never deletes Quote lines (avoids surprising commercial loss). User can manually remove lines. Future “Delete Design and owned lines” can be explicit confirm action.

---

## 15. RLS design

Follow quotes child pattern:

### `system_designs`

- ENABLE + FORCE RLS  
- SELECT: `deleted_at IS NULL` AND `auth_is_member(workspace_id)` AND EXISTS quote with `quotes.id = quote_id AND quotes.deleted_at IS NULL` AND same visibility rules as quote select (managerial / owner / assigned site) — **mirror quotes_select as closely as practical**  
- INSERT/UPDATE/DELETE: member + role_in editable roles (align quote_items_write role list / or rely on API authz primarily with RLS as tenancy backstop)

### `system_design_components`

- SELECT/WRITE: EXISTS parent Design visible in workspace; `workspace_id` match  

Never trust frontend filtering alone.

---

## 16. Authz mapping

**No new grants in V1** unless forced.

| Operation | Map to |
|---|---|
| List/get Design | `quotes.view` on parent Quote |
| Create/patch/delete Design, ingest, selection | `quotes.edit` (create Design also ok with edit on existing Quote) |
| Calculate `/cctv/recommend` | Keep today’s `catalog.view` + quotes.create/edit |
| Apply | `quotes.edit` |

Viewer: read-only Designs if they can view Quote. Technician: same commercial isolation as Quote view; Design payloads must not add cost (§17).

---

## 17. Commercial-data isolation

| Persist? | Field |
|---|---|
| **Never** | `cost`, margin, cost_total |
| **Avoid in Design candidates** | `list_price` (commercial; Quote already prices on Apply) — strip on ingest like recommend strips cost |
| **OK** | product id, sku, name, manufacturer, model, category_key, unit, technical attributes needed for reopen |
| **OK** | engineering quantities, reason codes |

API responses for Design must respect `_strip_cost` / role gates identically to catalog recommend path.

---

## 18. Exact migration plan (shape only — no file yet)

1. `CREATE TABLE system_designs` (§3)  
2. `CREATE TABLE system_design_components` (§4)  
3. FKs as specified; partial UNIQUE on `quote_item_id`  
4. Indexes: `(workspace_id, quote_id)`, `(design_id)`, `(engine_type)`  
5. Triggers: `set_updated_at` on both  
6. CHECK constraints: `lifecycle_status`, `selection_origin`, `engine_type`  
7. RLS policies (§15)  
8. RPC `system_design_apply_replace` (§11) — can be same migration or follow-up migration in same release train  
9. **No backfill**  
10. Feature flag default **off**

Existing Quotes without Designs: unchanged.

---

## 19. Feature-gate rollout

| Stage | What | Risk control |
|---|---|---|
| **R0** | Tables + RLS + RPC exist; API hidden | No UX change |
| **R1** | API create/get/patch/ingest behind flag; CCTV UI still ephemeral | Persistence proven in tests |
| **R2** | Flag: hydrate drawer from Design on open; save requirements/selection | Reopen fidelity |
| **R3** | Flag: Apply uses linkage + REPLACE RPC; confirm diverged | Stops duplicates |
| **R4** | Default on for workspaces; kill-switch flag remains | Monitor Apply 409/ partial |

If flag off at any stage: existing CCTV drawer path remains fully usable.

---

## 20. Backward compatibility

- No Quote schema change required for V1 linkage  
- No Share/Send/PDF/snapshot/lifecycle changes  
- No pricing changes  
- CCTV parity tests remain green (wrapper must not alter recommend outputs)  
- Quotes without Designs behave exactly as today  

---

## 21. Exact test plan

### TENANCY

- Design created in WS-A invisible to WS-B  
- Wrong workspace id → 404/403  

### PERSISTENCE

- create/load/update Design  
- requirements survive reopen  
- engineering + candidates survive  
- USER_OVERRIDE survives reopen  
- removed optional survives  

### CCTV

- recommend output identical with/without ingest wrapper  
- existing sizing parity + recommend tests unchanged  

### APPLY

- first Apply creates items + linkage  
- unrelated manual lines untouched  
- second Design’s lines untouched  
- blind second Apply without replace semantics rejected  

### RE-APPLY

- REPLACE owned only  
- diverged requires confirm  
- concurrent Apply → one winner (revision)  
- losing request no duplicate lines  

### MANUAL EDIT

- product/qty change → diverged detect; linkage preserved  
- price/discount change → not engineering diverged  

### CATALOG

- inactive selected product → needs_review / unresolved on refresh  
- unresolved optional does not block Apply of resolved  

### QUOTE

- Quote without Designs unchanged  
- totals match existing pricing path  
- Send/Share/PDF/snapshot suites green  

### AUTHZ/RLS

- viewer cannot Apply  
- technician cannot see cost in Design payloads  
- quotes.edit required to mutate Design  

### REVISE / DELETE

- revise Quote keeps Designs  
- delete Design leaves lines  
- soft-delete Quote hides Designs  

---

## 22. Risk map

| Area | Risk |
|---|---|
| Migration + RLS | **HIGH** |
| Apply RPC / transaction | **CRITICAL** |
| Quote item linkage correctness | **HIGH** |
| Re-Apply REPLACE + confirm | **HIGH** |
| Concurrency revision | **MEDIUM** |
| CCTV hydrate / override merge | **HIGH** |
| Quote revise interaction | **LOW** (same quote_id) |
| Soft-delete Quote visibility | **MEDIUM** |
| Commercial isolation in JSON | **MEDIUM** |
| Feature flag regressions | **MEDIUM** |
| Pricing / lifecycle / PDF | **LOW** if STOP conditions honored |

---

## 23. Files expected in future implementation

*(Planning list only — do not create now)*

- `supabase/migrations/XXXX_system_designs.sql` (+ apply RPC)  
- `apps/api/app/routers/system_designs.py` (or under quotes)  
- `apps/api/app/system_designs/` (persist, ingest, divergence helpers)  
- `packages/api-client` types + methods  
- `SystemBuilderDrawer.tsx` / `QuoteBuilder.tsx` hydrate + flag (minimal seam)  
- Tests: API tenancy/apply/divergence; web hydrate flag tests  
- Docs update after ship  

**Must not touch:** `pricing.py`, CCTV sizing/recommend core, public snapshot, authz catalog (unless tiny mapping doc), Share/Send semantics.

---

## 24. STOP conditions

Implementation of durable Design V1 **must stop / escalate** if it would require:

| Stop condition | Status for V1 |
|---|---|
| Pricing redesign | **Out of scope** |
| Quote lifecycle redesign | **Out of scope** |
| CCTV math rewrite | **Out of scope** |
| Generic engine rewrite / god engine | **Out of scope** |
| Public snapshot / PDF truth changes | **Out of scope** |
| New customer approval behavior | **Out of scope** |
| Broad authz redesign | **Out of scope** — map to quotes.* |
| Making Site required / site-aware CCTV | **Out of scope** |
| Changing Send for PARTIAL Designs | **Out of scope** |
| quote_items provenance columns | **Not required**; escalate only if Design-side proven insufficient |
| Full automatic reconcile | **Out of scope** |

---

## 25. Final implementation recommendation

Proceed to implementation **only after** PO ack of:

1. Design delete leaves Quote lines  
2. Apply RPC approach  
3. Divergence = product_id + qty only  
4. Recalc preserves valid overrides; invalid → `needs_review`  
5. Feature-gate stages R0–R4  

Then implement in order: migration+RLS → Design CRUD/ingest API → flag hydrate → Apply RPC REPLACE → confirm diverged → default flag.

**Highest-risk point:** atomic REPLACE Apply RPC + divergence confirm interacting with live Quote edits.

**Blockers:** none absolute — soft-delete semantics and RPC requirement are constraints, not blockers, if followed.

---

**END — IMPLEMENTATION READINESS — STOP**
