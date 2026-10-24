# QUOTE-10 PLAN VS PRICING STAGES REPORT

Focused Quote Builder UX: Step 2 composition vs Step 3 commercial pricing. No schema/pricing-engine/autosave/revision/PDF/send API changes.

## 1. Previous duplication

Steps 2 (`items`) and 3 (`pricing`) shared one keep-alive `QuoteLinesPanel` with the same catalog, QuickAdd, add-section, and full ERP line rows (qty + price + discount). Only CSS emphasis differed — the wizard felt like the same screen twice.

## 2. Step 2 final responsibility

**תכנון וציוד** — build the solution: what we offer (catalog, QuickAdd, sections, systems, qty/description composition via `SolutionItemCard`).

## 3. Step 2 UI changes

- `workspaceMode="planning"`
- `SolutionItemCard` (description / SKU / qty) — no unit price / discount / line total
- Toolbar: הוסף להצעה + הוסף סעיף + catalog inline
- Title/subtext: composition-oriented
- CTA next: **המשך למחיר**

## 4. Step 3 final responsibility

**הצעה ומחיר** — commercial review: price/discount the composed lines; quote discount + validity; full summary rail. Not a second compose surface.

## 5. Step 3 UI changes

- `workspaceMode="pricing"`
- No catalog / QuickAdd / add section / system launchers
- Lines via `QuoteLineRow` (qty, unit price, discount %, line total)
- Empty state → חזרה לתכנון
- Secondary: **עריכה בתכנון**
- Commercial strip: quote discount ₪/%, validity date
- Section discount kept (commercial)

## 6. Pricing summary

Existing `QuoteSummaryAside` full rail on pricing + review (subtotal, discounts, VAT, total, optional cost/margin for authorized roles). Stage 3 strip labeled **סיכום מסחרי** for quote-level discount + validity.

## 7. CTA hierarchy

| Step | Next | Back |
|------|------|------|
| 1 פרטים | המשך לתכנון וציוד | חזרה |
| 2 תכנון | **המשך למחיר** | חזרה לפרטי ההצעה |
| 3 מחיר | **המשך לשליחה** | **חזרה לתכנון** |
| 4 שליחה | (lifecycle) **שליחה ללקוח** | חזרה להצעה ומחיר |

Header/sidebar formal **שליחה ללקוח** remains primary emphasis on Step 4 (`ghost` until review). Mobile dock uses stage-aware next labels on Steps 2–3.

## 8. Stage navigation

Shared `QuoteStagePanel` keep-alive for `["items","pricing"]` — no remount; lines/draft preserved 2↔3↔4. `goToStep` remains presentation-only (no save/createOnce).

## 9. Autosave regression

Same `persistQuoteLine` / draft `updateDraft` paths. Added `isIncompleteNumericDraft` for SolutionItemCard flush safety. No formula changes.

## 10. Optional items

Unchanged server/optional semantics; pricing rows still show line state. No new optional UI this pass.

## 11. Role/cost security

`canViewCost` / margin blocks still gated as before in `QuoteSummaryAside`. No Q4-S weakening.

## 12–15. Desktop / tablet / mobile / RTL

Same design system; planning cards vs bordered pricing rows; commercial strip stacks on narrow; RTL + `ltr-meta` money fields preserved.

## 16. Accessibility

Stage panels keep headings; empty pricing CTA; tab/focus patterns unchanged; status not color-only on badges.

## 17. Tests

No new automated matrix this pass. Structural separation now matches the intended `workspaceMode` seam used by existing structural tests expectations.

## 18. Typecheck

Vite build transpile of changed modules — success (repo-wide pre-existing test TS noise unchanged).

## 19. Build

`apps/web` `npm run build` — **success**.

## 20. Remaining quote UX gaps

- Quote-level discount still also editable under Details disclosure (same draft fields; intentional dual entry until Details is slimmed).
- Pricing rows still expose delete/reorder (commercial row component); primary compose/delete UX is Step 2.
- Payment terms remain owned by Step 4 (review) — not duplicated into Step 3.
- Live visual QA of a full 4-camera quote path not re-shot in this agent turn.

### UI Review Checklist

Dark tokens, RTL, dense ops density, no giant cards, related-not-identical stages, no bottom-nav change, focus-visible controls retained.
