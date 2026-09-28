# Quote Builder — Structural Stage Separation

## 1. Root cause of previous similarity

Guided V1 / German Product Quality differentiated Stage 2 vs Stage 3 mainly via:

- titles / empty states
- CSS opacity demotion of `.cpq-line-commercial`
- toolbar copy

In the **populated** state both stages still mounted the same `QuoteLineRow` ERP grid (SKU · description · qty · unit price · discount · line total). The screenshot test without titles failed: Stage 2 still looked like a pricing table.

## 2. Old Stage 2 structure

`QuoteLinesPanel` `workspaceMode="planning"` → same `QuoteLineRow` table + muted money columns + composition toolbar.

## 3. Old Stage 3 structure

Same `QuoteLineRow` table + Quote discount + full commercial columns (unmuted).

## 4. New Stage 2 structure

**Solution workspace** (`data-testid="stage2-solution-workspace"`):

- Title: התכנון והציוד
- Count: `N פריטים בפתרון`
- Optional durable System Design card(s)
- Buckets: **ציוד** / **שירותים ועבודה** / notes
- `SolutionItemCard` — no unit price / discount / line total
- Composition actions: + תכנון מערכת · + קטלוג · + פריט · הוסף סעיף
- Inline catalog search (planning only)

## 5. New Stage 3 structure

**Commercial workspace** (`data-testid="stage3-commercial-workspace"`):

- Title: ההצעה המסחרית
- Count: `N שורות בהצעה`
- `QuoteLineRow` commercial grid
- Quote discount block
- Inline **סיכום כספי** (server totals)
- Toolbar: חזרה לתכנון וציוד (no System Builder / catalog / + פריט)

## 6. Shared state architecture

ONE Quote · ONE `items` state · ONE `persistQuoteLine` / delete / reorder.

`QuoteStagePanel` keep-alive still mounts Stage 2+3 together. Only the **presentation** switches:

- planning → `SolutionItemCard`
- pricing → `QuoteLineRow`

## 7. Planning representation

`SolutionItemCard` edits `description` / `qty` (and shows SKU as metadata). Same `QuoteLinePatch` contract.

## 8. Pricing representation

`QuoteLineRow` — full commercial fields + line total preview. Flush-on-unmount preserves dirty commercial edits when leaving Stage 3.

## 9. Equipment item representation

Card with title, catalog/manual chip, optional SKU metadata, qty. No money columns.

## 10. Service / labor representation

Separate **שירותים ועבודה** bucket; labor badge; no manufacturer/SKU emphasis.

## 11. System Design representation

`PlanningSystemDesignCard` from `listSystemDesigns` — title, lifecycle status copy, component chips, intent-without-catalog note, **פתיחת התכנון** (opens existing System Builder; no Apply on open).

## 12. Equipment Intent representation

Design-side only (unchanged E2). Surfaced as design-card note when components have intent without catalog product. Quote lines do not invent intent state.

## 13. Catalog-only representation

`product_id` present → chip **נבחר מהקטלוג**; SKU secondary.

## 14. Stage 2 actions

+ תכנון מערכת · + קטלוג · + פריט · הוסף סעיף · catalog search · Next → Stage 3.

## 15. Stage 3 actions

חזרה לתכנון וציוד · הוסף סעיף · commercial line edits · Quote discount · financial summary · Next → Stage 4. No composition launchers.

## 16. Stage-aware dock behavior

Same `QuoteMobileActionsBar` chrome / z-index / clearance.

| Stage | Summary | Primary |
|-------|---------|---------|
| 1 (draft) | identity / status | המשך לתכנון וציוד |
| 2 (draft) | תכנון וציוד · N פריטים | המשך למחיר |
| 3 (draft) | סה״כ · money | המשך לתנאים |
| 4 | commercial total | Send **not** in dock — Stage 4 panel owns formal Send |

## 17. Dirty-state preservation

- Panel stays mounted across Stage 2↔3
- Both row types flush pending patches on unmount / blur
- Test: edit description in planning → persist → pricing remount shows updated value

## 18. Read-only behavior

`canEdit=false` → cards/rows render without mutation controls; stages still browsable.

## 19. Kai usage

- Stage 2: compact solution cards, status chips, restrained surfaces
- Stage 3: tabular money, financial summary hierarchy, Quote discount block

## 20. Desktop comparison (1440)

Without titles: left = commercial grid + totals; right = design card + equipment/services cards + qty only. **PASS.**

## 21. Mobile comparison (390)

Without titles: Stage 2 dock shows item count + המשך למחיר; Stage 3 dock shows ₪ total + המשך לתנאים. **PASS.**

## 22. Screenshots

`Docs/quote-builder-structural-stage-separation-qa/`

- desktop-1440-{dark,light}-stage{2,3}
- desktop-1100-dark-stage{2,3}
- mobile-390-{dark,light}-stage{2,3}
- mobile-360-dark-stage{2,3}
- desktop-1440-dark-side-by-side
- mobile-390-dark-side-by-side
- `report.json`

## 23. Tests

- `tests/quote-structural-stage-separation.test.tsx`
- Updated: lines panel, mobile actions, system-apply, composition-a2, guided stages mocks
- Regressions: guided stages, quote builder, line row, E1/E2, lifecycle, system apply — **pass**
- `tsc --noEmit` + production `npm run build` — **pass**

## 24. Protected systems unchanged

No changes to: pricing.py · Quote lifecycle · Share/Send/Preview semantics · PDF/snapshot · R3 Apply · Equipment Intent E1/E2 semantics · authz/RLS · dock stack/clearance architecture · Stage 1 / Stage 4 redesign · E3 · non-catalog Apply · DB migrations.
