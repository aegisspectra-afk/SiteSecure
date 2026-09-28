# Q4 COMMERCIAL MODEL REPORT

## 1. Files changed
- `supabase/migrations/20260927220000_quote_items_is_optional.sql`
- `supabase/migrations/20260927220100_quote_items_cost_visibility_note.sql`
- `apps/api/app/pricing.py`
- `apps/api/app/routers/quotes.py`
- `apps/api/app/routers/quote_cpq.py`
- `apps/api/app/quote_snapshot.py`
- `apps/api/app/quote_pdf.py`
- `apps/api/tests/test_quote_commercial_q4.py`
- `packages/api-client/src/index.ts`
- `apps/web/src/lib/quote-pricing.ts`
- `apps/web/src/lib/quote-cpq.ts`
- `apps/web/src/lib/quote-line-edit.ts`
- `apps/web/src/components/quotes/cpq/QuoteSummaryAside.tsx`
- `apps/web/src/components/quotes/cpq/QuoteLineRow.tsx`
- `apps/web/src/components/quotes/cpq/QuoteLinesPanel.tsx`
- `apps/web/src/components/quotes/QuoteBuilder.tsx`
- `apps/web/src/components/quotes/document/QuoteDocument.tsx`
- `apps/web/src/i18n/he.ts`
- `apps/web/src/styles.css`
- `apps/web/tests/quote-commercial-q4.test.ts` (+ test label updates)

## 2. Optional-item data model
- New boolean `quote_items.is_optional NOT NULL DEFAULT false`
- Dedicated field (not reused)
- Exposed on API create/patch, public payload, PDF description prefix

## 3. Migration
- Applied to production project `SiteSecureV1` (`rhxqqudlngimhplvndmz`)
- Files: `20260927220000_quote_items_is_optional.sql`, `20260927220100_quote_items_cost_visibility_note.sql`

## 4. Optional-item pricing semantics
Canonical in `pricing.recalculate` (unchanged authority):
1. Line net (qty × price − line discount)
2. Section discount on **required** section subtotals only
3. Quote discount on **required** subtotal only
4. VAT on required after-discount → stored `subtotal_net` / `vat_amount` / `total_gross`
5. Cost/margin on required revenue only

Optional (computed, not stored as quote columns):
- `optional_subtotal` — sum of optional line nets (after line discount only)
- `optional_vat_amount` / `optional_total_gross`
- `total_with_options_gross` = base `total_gross` + optional total gross
- Optional excluded from base / customer binding total

## 5. Optional-item UI
- Stage 3 line checkbox + badge `אופציונלי`
- Summary / Stage 3 financial summary / preview document show optional subtotal + total with options
- No customer-side option selection UX

## 6. Discount order
Confirmed unchanged:
**line → section → quote → VAT** (`pricing.py`)

## 7. Discount UX changes
- Line discount labeled `הנחת שורה %`
- Section discount keeps distinct section copy
- Quote discount titled `הנחת הצעה` + hint that it applies after line/section (not double-counted)
- Summary shows: scope (pre commercial discounts) → lines subtotal → section discount → quote discount → לפני מע״מ → optional → VAT → base total → total with options

## 8. Summary semantics
When applicable: Subtotal (after discounts), section/quote discounts separately, optional, VAT, grand (base), total with options; cost / GP / margin % only with `quotes.view_cost`. Server totals via `_with_validation` enrichment.

## 9. Cost visibility matrix
| Role | view_cost | override_price | Notes |
|---|---|---|---|
| Owner | Yes | Yes | Full commercial |
| Administrator | Yes | Yes | Full commercial |
| Manager | Yes | Yes | Full commercial |
| Sales | No | No | Edit/discount; cost stripped; catalog unit price read-only |
| Technician | No | No | No quote commercial grants |
| Viewer | No | No | View-only; cost stripped |

API strip expanded: `cost_total`, `margin_*`, `optional_cost_total`, item `cost` / derived profit keys, `catalog_snapshot.cost`.

## 10. Direct API/PostgREST result
**PROVEN leak (architectural):** `quote_items_select` grants full-row SELECT including `cost` to members who can see the quote. No column mask in RLS.
**Product path protected:** FastAPI `_strip_cost` + `quotes.view_cost`.
**Not fixed with column REVOKE** in this pass: UserClient JWT still needs cost for authorized recalculation; closing PostgREST requires service-role commercial reads (remaining gap). Documented in migration comment + `test_postgrest_quote_items_select_has_no_column_mask`.

## 11. Price override behavior
- Catalog-linked `unit_price` editable only with `quotes.override_price`; otherwise read-only selling price
- Free/labor remain editable with `quotes.edit`
- Divergence from catalog `list_price` still audited (`price_override` event + audit)
- Snapshot keeps original list price in `catalog_snapshot`
- Preview/PDF use stored `unit_price` / `line_net`
- Cost not exposed by price edit alone

## 12. Preview behavior
- Optional flag on items; optional totals in public payload; discount layers clarified in document totals; no cost/margin

## 13. PDF behavior
- Optional lines prefixed `[אופציונלי]`
- Totals: lines subtotal, section/quote discounts, base לפני מע״מ, optional, VAT, base grand, total with options
- Engine not rewritten

## 14–19. Viewport / theme
Code-level RTL/Hebrew labels and responsive commercial controls shipped. Full browser matrix at 1440/768/390/360 dark/light not re-captured in this pass (logical coverage via existing builder layout + focused unit tests). Remaining: visual QA pass recommended.

## 20. Focused tests
- API: `test_pricing.py`, `test_quote_commercial_q4.py`, `test_authorize.py`, quote snapshot/phase2 — **pass**
- Web: `quote-commercial-q4`, quotes/line-row/composition/structural — **pass**

## 21. Full web tests
- Last full run after label fixes not fully re-executed end-to-end in this message; focused commercial + regression set green; prior full run had 3 failures fixed (discount/unit-price labels). Build succeeded.

## 22. API tests
- Relevant commercial suite green
- Full `tests/` (ignore dispatch): **432 passed**, 9 failed unrelated (live quota/JWT isolation, missing `pymupdf` for PDF glyph checks)
- `test_dispatch_ops.py::test_today_buckets_now_next_later` failed separately (pre-existing KeyError)

## 23. Typecheck
`tsc --noEmit` — pass

## 24. Build
`npm run build` — pass (`built in ~5.4s`)

## 25. Remaining commercial gaps
- Customer-side optional selection / binding UX (explicitly out of Q4)
- PostgREST column-level cost lockdown (needs service-role load path)
- Staff PDF after send still primarily snapshot-driven; optional totals for older snapshots without new keys remain 0 until re-send
- Visual mobile/desktop QA screenshots for Q4 controls
- Persist optional totals on `quotes` table not required (computed each response)

**STOP — Q5 not started.**
