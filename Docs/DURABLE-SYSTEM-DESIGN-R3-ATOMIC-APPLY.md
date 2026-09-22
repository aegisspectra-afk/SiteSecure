# DURABLE SYSTEM DESIGN — R3 ATOMIC OWNED APPLY

**Date:** 2026-09-22  
**Status:** IMPLEMENTED  
**Depends on:** R1 persistence, R2 CCTV hydrate, R3 preflight

---

## 1. Files changed

| Area | Path |
|---|---|
| RPC migration | `supabase/migrations/0055_system_design_apply_owned.sql` |
| Apply helpers | `apps/api/app/system_designs/apply.py` |
| Apply endpoint | `apps/api/app/routers/system_designs.py` (`POST …/system-designs/{id}/apply`) |
| API client | `packages/api-client/src/index.ts` |
| Drawer Apply | `apps/web/src/components/quotes/cpq/SystemBuilderDrawer.tsx` |
| Quote Builder | `apps/web/src/components/quotes/QuoteBuilder.tsx` |
| i18n | `apps/web/src/i18n/he.ts` |
| Tests | `apps/api/tests/test_system_designs_r3_apply.py` |
| This doc | `Docs/DURABLE-SYSTEM-DESIGN-R3-ATOMIC-APPLY.md` |

---

## 2. RPC signature / responsibility

```sql
public.system_design_apply_owned(
  p_workspace_id uuid,
  p_quote_id uuid,
  p_design_id uuid,
  p_expected_revision integer,
  p_actor_id uuid,
  p_apply_id uuid,
  p_section_id uuid,
  p_lines jsonb,                 -- server-prepared commercial rows
  p_confirmed boolean DEFAULT false,
  p_expected_divergence_hash text DEFAULT NULL,
  p_expected_proposed_hash text DEFAULT NULL
) RETURNS jsonb
```

**Responsibility (single Postgres transaction):**

1. Membership + `auth.uid()` / actor match  
2. Lock Design + Quote (`FOR UPDATE`)  
3. Verify Design↔Quote↔workspace, Quote `draft`, revision CAS  
4. Recompute live engineering divergence vs applied fingerprints  
5. If diverged: require confirmation + matching divergence/proposed hashes  
6. DELETE **only** `quote_items` currently linked on this Design’s components  
7. INSERT prepared catalog lines; rewrite component linkage / fingerprints / `apply_id`  
8. Bump Design revision, set `last_applied_at`, `lifecycle_status=applied`, aggregates  

**Does NOT:** calculate Quote totals/VAT/margin; trust browser money; delete arbitrary item IDs; mutate other Designs’ output; mutate non-draft Quotes.

---

## 3. SECURITY DEFINER protections

| Check | Enforcement |
|---|---|
| Fixed `search_path` | `SET search_path = public` |
| Auth | `auth.uid()` required; `p_actor_id` must equal `auth.uid()` |
| Tenancy | `auth_is_member(p_workspace_id)`; all rows scoped by workspace |
| Quote/Design binding | Design.quote_id must equal `p_quote_id` |
| Lifecycle | Quote must be `draft` + not deleted |
| Deletion scope | Owned ids collected from **this** Design’s components only |
| Insert scope | Products must be active in workspace; components must belong to Design |
| Hostile keys | Presence of `delete_item_id` on line → `INVALID_LINES` |
| Confirmation | Diverged path requires `p_confirmed` + matching hashes |
| Grants | `EXECUTE` to `authenticated` only; revoked from `PUBLIC` |

FastAPI also requires `quotes.edit` and resolves money before RPC.

---

## 4. Ownership / linkage

- Design-side only: `system_design_components.quote_item_id`  
- V1: one component → 0..1 owned Quote item  
- Unique partial index on `quote_item_id` prevents multi-owner  
- Manual lines remain unowned  
- Other Designs’ owned lines untouched (disjoint owned sets)  
- **Delete Design:** hard-delete Design/components; Quote lines remain as ordinary/unowned (FK `ON DELETE SET NULL` / components removed)

No `source_*` columns on `quote_items`.

---

## 5. Fingerprint / divergence

Engineering fingerprint per component:

```text
{product_id}|{qty}
```

Qty normalized (round 6 dp, strip trailing zeros) in Python and SQL.

**In fingerprint:** product_id, qty, expect `item_type=catalog`  
**Not in fingerprint:** unit_price, discount, description, section, cost, sort_order

Aggregate Design `apply_fingerprint` = sorted `component_id:product|qty` joined by `|`.

| Event | Class |
|---|---|
| qty / product change on owned line | ENGINEERING DIVERGENCE |
| owned item missing | MISSING → DIVERGENCE |
| price / discount / description / section only | NOT engineering divergence |

Design-changed (`calculated_at > last_applied_at`) with aligned fingerprints → clean Re-Apply (no confirm).

---

## 6. Initial Apply

1. Authorize `quotes.edit`  
2. Verify draft Quote + Design revision  
3. Build proposed engineering lines from selected components  
4. Resolve catalog list_price/cost/snapshot server-side  
5. Create/reuse CCTV section (item ownership only; no section ownership)  
6. Call RPC (insert + linkage + fingerprints + apply_id + revision++)  
7. `_persist_totals` (Python pricing)  
8. Return `{ quote, design, apply_id }`

---

## 7. Clean Re-Apply

Owned fingerprints match live items → DELETE owned + INSERT proposed + rewrite linkage.  
No append. Manual / other-Design lines untouched.

---

## 8. Engineering divergence

Without confirmation token → **409 `DESIGN_APPLY_DIVERGED`** with review DTO + signed token. **No mutation.**

---

## 9. Commercial-only edit behavior

When the **same engineering identity** (product_id + qty) is being replaced:

| Field | Behavior |
|---|---|
| `unit_price` | **Preserved** from live owned item |
| `discount` / `discount_type` | **Preserved** |
| `description` | **Preserved** if non-empty |
| `section_id` | **Preserved** |
| `cost` | **Always** from live catalog (not preserved from item; never from browser) |

When engineering identity changes (new product/qty) on clean Design Re-Apply: catalog defaults + apply section.  
That is intentional Design output replacement, not “silent commercial destroy under engineering diverge.”

If engineering diverged on the Quote: confirmation required; confirmed replace uses the same preserve rules where product+qty still matches per line.

No generic merge engine.

---

## 10. Confirmation binding

HMAC-SHA256 signed token (key derived from service role / anon key). Binds:

- workspace_id, quote_id, design_id  
- expected Design revision  
- divergence hash  
- proposed output hash  
- expiry (15 minutes)

No `force=true`. Stale/wrong/tampered token → `CONFIRMATION_STALE`. Stateless (no confirmation table).

---

## 11. Pricing boundary / failure recovery

- RPC = composition mutation only  
- Python `_persist_totals` / `pricing.recalculate` = money authority  

If RPC commits and pricing persist fails:

- HTTP **503** `API_UNAVAILABLE`  
- `details.apply_committed=true`  
- points to existing `POST …/quotes/{id}/recalculate`  
- Does **not** claim full Apply rollback  

Targeted unit test: `test_pricing_failure_after_rpc_surfaces_recoverable_error`.

---

## 12. Concurrency

- Design `FOR UPDATE` + revision CAS → only one Apply wins  
- Loser: `REVISION_CONFLICT` / SQL `REVISION_CONFLICT`  
- Apply vs Send: RPC requires draft  
- Apply vs owned-line edit: live fingerprint check inside txn  
- Two Designs: disjoint owned sets  

---

## 13. Delete Design

Unchanged from R1: hard-delete Design + components; Quote lines stay commercial/unowned.

---

## 14. Frontend behavior

Durable path (Design present):

```text
SystemBuilderDrawer → api.applySystemDesign → onAppliedQuote(quote)
```

Divergence: inline alert in existing sheet + Confirm replace (uses bound token).  
No new dock/wizard. Mobile bottom stack unchanged.

---

## 15. Backward compatibility

| Path | Behavior |
|---|---|
| Durable CCTV Design exists | **Atomic Apply only** |
| No Design (persist never succeeded) | Legacy `applyCctvBuildLines` / sequential `addQuoteItem` remains as fallback |

Do not manufacture a Design solely to hide mismatch.

---

## 16. Tests / results

### R3 unit (`tests/test_system_designs_r3_apply.py`)

Fingerprints, divergence (qty/product/missing/price/discount), commercial preserve, confirmation bind/reject, RPC SQL contract static audit, initial apply mock, diverged no-RPC, sent Quote block, stale revision, pricing-after-RPC failure.

### Regression (this session)

| Suite | Result |
|---|---|
| `test_system_designs_r3_apply.py` | **25 passed** |
| R3 + R1 + CCTV recommend/sizing/hardening + pricing + quote snapshot/validation/phase2 + A3 outbound + share truth + sku/share + public boundary | **114 passed** |
| `tests/cctv-design-persistence.test.ts` + `system-section.test.ts` | **14 passed** (2 files) |
| `npx tsc --noEmit` (web) | **passed** |
| `npm run build` (web vite + tsc) | **passed** |
| `tests/quote-mobile-actions.test.tsx` | **10 passed** |
| `test_tenant_isolation.py` (live Supabase) | Not re-verified here (network/proxy); R3 does not change RLS catalog |

---

## 17. Deferred

- Live integration/RPC security tests against real Supabase (direct SQL invoke) — unit + SQL contract covered; live DB not required for R3 exit in mocked env  
- Optional `last_applied_design_revision` column (timestamps + revision CAS sufficient)  
- Section ownership / empty-section cleanup  
- Generic multi-engine Apply beyond CCTV  
- Removing legacy fallback once all CCTV Applies are proven durable-only in production

---

## Exit criteria map

| # | Criterion | Status |
|---|---|---|
| A | Initial Apply atomic composition+ownership | Done (RPC) |
| B | Re-Apply no blind duplicate | Done |
| C | Only this Design’s owned output replaced | Done |
| D | Engineering divergence blocks replace | Done |
| E | Known divergence needs bound confirmation | Done |
| F | Stale confirmation rejected | Done |
| G | Commercial-only edits not silently destroyed | Preserve when same engineering identity |
| H | Client cannot dictate money | ApplyIn forbids; catalog authority |
| I | Concurrent Apply cannot double-create | Revision CAS |
| J | Sent Quote cannot mutate | Done |
| K | Pricing remains Python | Done |
| L | CCTV engineering unchanged | Recommend path untouched |
| M | Manual / other-Design lines untouched | Done |

**STOP after R3 — no next domain engine.**
