# DURABLE SYSTEM DESIGN — R2 CCTV PERSISTENCE + HYDRATION

**Date:** 2026-09-22  
**Depends on:** R1 System Design persistence API  
**Out of scope:** REPLACE Apply, quote_item linkage, divergence confirm, CCTV math changes

---

## 1. Files changed

| File | Role |
|---|---|
| `packages/api-client/src/index.ts` | System Design types + CRUD client methods |
| `apps/web/src/lib/cctv-design-persistence.ts` | Map CCTV state ↔ Design document |
| `apps/web/src/components/quotes/cpq/SystemBuilderDrawer.tsx` | Hydrate / persist / CAS UX |
| `apps/web/src/components/quotes/QuoteBuilder.tsx` | Pass `quoteId` + `ensureQuoteId` (createOnce) |
| `apps/web/src/i18n/he.ts` | Conflict / save / load / hydration copy |
| `apps/web/tests/cctv-design-persistence.test.ts` | R2 mapping + reopen fidelity tests |
| `Docs/DURABLE-SYSTEM-DESIGN-R2-CCTV-HYDRATION.md` | This report |

---

## 2. CCTV state → persistence mapping

| Drawer state | Classification | Storage |
|---|---|---|
| `CctvBuildRequirements` form | **PERSIST** | `system_designs.requirements.form` |
| `SystemRecommendation.engineering` | **PERSIST** | `engineering_result` |
| warnings / assumptions / unresolved / status / blocking / input / catalog_* | **PERSIST** | `recommendation_meta` |
| components (role, qty, optional, blocking, candidates, reasons, resolution) | **PERSIST** | `system_design_components` |
| engine preferred product | **PERSIST** | `engine_preferred_product_id` |
| user selected product | **PERSIST** | `user_selected_product_id` + `selection_origin` |
| optional removal | **PERSIST** | `removed` |
| invalid prior selection after recalc | **PERSIST** | `needs_review` |
| `engine_version` / `calculated_at` / `lifecycle_status` | **PERSIST** | header columns |
| step / loading / swapRole / appliedOnce / lastLines | **PRESENTATIONAL** | not persisted |
| progress ring stages | **PRESENTATIONAL** | not persisted |
| Quote line totals / prices | **RECOMPUTE** via Quote | never on Design |
| Live catalog attrs after reopen | **RECOMPUTE** only on explicit recalculate | candidates frozen from last calc |

---

## 3. Design creation semantics

- Opening the drawer **does not** create a Design.
- On successful `POST /cctv/recommend`, drawer calls `ensureQuoteId` if needed, then:
  - `listSystemDesigns` → reuse earliest `engine_type=cctv` if any
  - else `createSystemDesign`
  - re-list and prefer earliest (race soft-guard; no unique DB constraint)
- Duplicate CCTV Designs from races are possible; client always binds to earliest. Full uniqueness deferred (multi-CCTV future).

---

## 4. Load / hydration flow

1. Drawer opens with `quoteId`.
2. List Designs → pick active CCTV → `getSystemDesign`.
3. Hydrate requirements; if recommendation present → rebuild `SystemRecommendation` + selection → `review` step.
4. No quote id → lead defaults (legacy ephemeral).
5. `hydratingRef` blocks selection PATCH during hydrate (no save loop).

---

## 5–7. Requirements / recommendation / selection

- Requirements written on successful recommend ingest.
- Recommendation + components written with `components_replace: true`.
- Selection changes debounce (~400ms) PATCH components only.
- Engine preferred vs user override remain distinct columns/origins.
- Optional removals restored via `removed`.

---

## 8. CAS handling

- Every PATCH sends `revisionRef`.
- Success adopts returned revision.
- **409 / CONFLICT_REVISION:** set conflict banner; block calculate/apply; **Reload design** button; **no** auto-retry / last-write-wins.

---

## 9. Error handling

| Failure | UX |
|---|---|
| Recommend fail | `serverError`; stay on requirements; local form kept |
| Save fail | `persistError`; **local recommendation/selection kept** |
| Load fail | `persistError`; fall back to lead defaults |
| Conflict | dedicated banner + reload |

Persistence errors are never labeled as calculation failures.

---

## 10. Recalculation

- Still calls existing `api.recommendCctv` (unchanged math).
- `mergeSelectionAfterRecalculate` keeps selectable prior picks / optional removals.
- Invalid priors → `needsReviewRoles` + `needs_review` on components + status hint — **not** silently confirmed.

---

## 11. Apply boundary confirmation

- `handleAdd` → existing `onApply` → `applyCctvBuildLines` → `addQuoteItem`.
- Design linkage fields (`quote_item_id`, `applied_*`, `apply_id`) remain unset.
- No REPLACE / delete owned lines / divergence gate.

---

## 12. Known R3 limitation

Re-Apply can still duplicate Quote lines (pre-R2 session fingerprint only). R2 does not implement REPLACE. Documented; not half-implemented.

---

## 13. Tests

| Suite | Result |
|---|---|
| `cctv-design-persistence.test.ts` (R2) | **11 passed** |
| CCTV build + sizing + quote-builder + mobile | **81 passed** (includes R2 11) |
| API R1 + CCTV + pricing + A3 + authz | **94 passed** |
| `tsc --noEmit` | pass |
| production build | pass |

---

## 14. Protected areas

Unchanged: CCTV sizing/recommend math, pricing, lifecycle, Share/Send, PDF/snapshot, QuoteBuilder bottom stack, authz catalog, quote_items schema.
