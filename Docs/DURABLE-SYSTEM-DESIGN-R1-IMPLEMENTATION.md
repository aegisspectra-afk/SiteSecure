# DURABLE SYSTEM DESIGN — R1 IMPLEMENTATION

**Date:** 2026-09-22  
**Scope:** Persistence foundation only (tables, RLS, CRUD API, revision CAS)  
**Not in R1:** CCTV hydrate, Apply/REPLACE RPC, QuoteBuilder wiring, quote_items provenance columns

---

## 1. Exact migration

`supabase/migrations/0054_system_designs.sql`

Creates:

- `public.system_designs`
- `public.system_design_components`
- helper `public.system_design_quote_visible(workspace_id, quote_id)`
- RLS FORCE policies on both tables
- `set_updated_at` triggers
- indexes + CHECKs + partial unique on `quote_item_id`

---

## 2. Tables / columns

### `system_designs`

| Column | Notes |
|---|---|
| id, workspace_id, quote_id | Identity + tenancy; Quote FK CASCADE (hard delete only) |
| site_id | Optional; SET NULL |
| engine_type | CHECK `cctv` only in V1 |
| engine_version | int ≥ 1 |
| lifecycle_status | `draft` \| `calculated` \| `applied` |
| requirements, engineering_result, recommendation_meta | JSONB |
| calculated_at, last_applied_at, current_apply_id, apply_fingerprint | Apply metadata reserved; unused by Apply in R1 |
| revision | Optimistic concurrency (starts at 1) |
| created_by, created_at, updated_at, deleted_at | Conventions + soft-hide |

### `system_design_components`

| Column | Notes |
|---|---|
| id, workspace_id, design_id | Identity; CASCADE with Design |
| role_key | UNIQUE per design |
| label, quantity, optional, blocking, removed | Role semantics |
| resolution_status, technical_requirements, candidates, reason_codes | Recommendation round-trip |
| engine_preferred_product_id, user_selected_product_id, selection_origin, needs_review | Override model |
| quote_item_id, applied_*, last_apply_id | Linkage reserved; null until R3 Apply |

---

## 3. Indexes / FKs

- `(workspace_id, quote_id)` / engine partial indexes where `deleted_at IS NULL`
- UNIQUE `(design_id, role_key)`
- UNIQUE partial `(quote_item_id)` where not null
- FKs: workspaces CASCADE, quotes CASCADE, sites SET NULL, products SET NULL, quote_items SET NULL

---

## 4. RLS

- Designs visible only when `deleted_at IS NULL` **and** `system_design_quote_visible` (parent Quote `deleted_at IS NULL` + same visibility family as quotes: managerial / owner / assigned site).
- Components gated via EXISTS parent Design + same visibility.
- INSERT/UPDATE/DELETE similarly constrained.
- Public quote tokens have **no** Design access.

---

## 5. Authz mapping

| Op | Action |
|---|---|
| list / get | `quotes.view` |
| create / patch / delete | `quotes.edit` |

No new authz catalog grants.

---

## 6. API endpoints

| Method | Path |
|---|---|
| GET | `/api/v1/workspaces/{workspace_id}/quotes/{quote_id}/system-designs` |
| POST | `/api/v1/workspaces/{workspace_id}/quotes/{quote_id}/system-designs` |
| GET | `/api/v1/workspaces/{workspace_id}/system-designs/{design_id}` |
| PATCH | `/api/v1/workspaces/{workspace_id}/system-designs/{design_id}` |
| DELETE | `/api/v1/workspaces/{workspace_id}/system-designs/{design_id}` |

Files:

- `apps/api/app/routers/system_designs.py`
- `apps/api/app/system_designs/__init__.py` (sanitize + soft-delete stamp)

---

## 7. Request / response models

- `SystemDesignCreate`: `engine_type`, `engine_version`, `requirements`, optional `site_id`
- `SystemDesignPatch`: required `revision`; optional requirements / engineering_result / recommendation_meta / lifecycle_status / engine_version / calculated_at / site_id / `components[]` / `components_replace`
- `SystemDesignComponentIn`: role + selection + candidates + optional linkage fields
- Responses: Design + `components[]`; commercial keys stripped

---

## 8. Revision / CAS

1. Client sends `revision` matching current.  
2. Mismatch → **409 `CONFLICT_REVISION`** (no write).  
3. Conditional PostgREST patch `revision=eq.{n}`; empty representation → 409.  
4. Success increments revision to `n+1`.

---

## 9. Soft-delete parent handling

1. RLS hides Designs when Quote `deleted_at` set.  
2. API `_load_live_quote` requires `deleted_at is.null`.  
3. On Quote soft-delete (`delete_quote`), service-role stamps Designs `deleted_at` via `soft_delete_designs_for_quote` (CASCADE does not run on soft-delete).

Explicit Design DELETE hard-removes Design + components; **does not** delete Quote lines.

---

## 10. Commercial-data isolation

- `strip_commercial_keys` removes `cost`, `list_price`, `unit_price`, margin-like keys from JSON on write sanitize and read.
- Design responses never include quote cost/margin totals.
- No money columns on Design tables.

---

## 11. Tests

`apps/api/tests/test_system_designs_r1.py` — **13 passed**

Covers: sanitize, create, engine validation, soft-deleted quote/design hide, CAS success/stale/empty, components round-trip without cost/list_price, delete leaves quote_items, authz deny, soft-delete stamp, migration SQL presence.

---

## 12. Rollout state

- **R1 dormant API:** available when migration applied; **not** wired into CCTV UI / QuoteBuilder.
- No new feature-flag platform invented. Existing CCTV path unchanged when Design API unused.
- REPLACE Apply RPC **not** implemented (deferred R3).

**Deploy note:** apply migration `0054_system_designs.sql` before relying on API against a live DB.

---

## 13. Deferred R2 / R3

| Stage | Work |
|---|---|
| R2 | CCTV drawer hydrate/save Design; ingest `/cctv/recommend` into components |
| R3 | Apply REPLACE SECURITY DEFINER RPC; divergence confirm; linkage fill |
| Later | Default-on flag; multi-engine beyond cctv CHECK |

---

## Exit criteria checklist

| Criterion | Status |
|---|---|
| A Design persists under Quote | Yes (API) |
| Components persist/reload | Yes |
| Workspace isolation RLS | Yes (migration) |
| Parent Quote visibility | Yes |
| Soft-deleted Quote hides Designs | Yes (RLS + API + stamp) |
| Revision CAS 409 | Yes |
| No cost/margin leak | Yes |
| Quotes without Designs unchanged | Yes |
| CCTV unchanged | Yes (no UI/math touch) |
| Pricing unchanged | Yes |
| No Apply/REPLACE | Yes |

---

**END R1 — STOP before R2**
