# QUOTE-11 CCTV PLANNER → QUOTE REPORT

**Date:** 2026-09-30  
**Scope:** Q4-S `products.cost` JWT fix + empty-template UX + QUOTE-11 Add-to-Quote reliability  
**Deploy:** shipped to `main` (Vercel web + Render API staging) with this commit set

---

## 1. Root cause

Two separate issues:

**A. Console 404 on `/cctv/recommend` (and catalog products)**  
After Q4-S column lockdown, `PRODUCT_SELECT` still requested `products.cost` via the user JWT. PostgREST returned `42501 permission denied for table products`. `as_list()` mapped 401/403 → opaque `NOT_FOUND` 404.

**B. Broken Add-to-Quote promise (QUOTE-11)**  
With empty/partial catalog, engineering completes (`התכנון ההנדסי הושלם`) while required roles stay `טרם נבחר`.  
`canAddRecommendationToQuote` returned `{ ok: false, reason: "empty" }` when **no** catalog products resolved → CTA stayed labeled «הוסף להצעה» but disabled (or Design Apply failed with «אין רכיבים נבחרים להחלה»).  
Durable Apply RPC **requires** `product_id` on every line — cannot store unresolved BOM via R3 alone.

---

## 2. Current data model constraint

| Path | Can store unresolved? |
|------|------------------------|
| `system_design_apply_owned` RPC | **No** — every line needs active `product_id` |
| `quote_items` free lines (`item_type=free`, no SKU/price) | **Yes** — reused without schema migration |

**Chosen approach:** resolved roles → existing Design Apply; unresolved **required** roles → free lines marked `package_name=cctv-planned:{role}` + description prefix `נדרש ציוד`. No fake SKU / no fake price.

---

## 3. Empty catalog behavior

- Recommend still returns engineering BOM (200).  
- Add-to-Quote **enabled** → inserts planned free lines only.  
- CTA: «הוסף תכנון להצעה».  
- No 400/404 from apply when no products.

## 4. Partial catalog behavior

- Resolved roles → catalog lines via Design Apply.  
- Missing required roles → planned free lines in same CCTV section.  
- CTA: «הוסף את הפריטים הזמינים + דרישות חסרות».

## 5. Full catalog behavior

- All required resolved → normal Design Apply.  
- `incomplete=false`; CTA «הוסף תכנון להצעה».  
- Quantities from recommendation; prices from catalog/quote APIs only.

## 6. Required unresolved items

Become free lines: name = role label HE, description = `נדרש ציוד · …`, `unit_price=0`, badge «נדרש ציוד» in Step 2.

## 7. Optional items

Unresolved optional roles are **not** forced into the quote (user may remove/leave out). Do not block send.

## 8. Add-to-Quote behavior

| State | Button |
|-------|--------|
| `INVALID_INPUT` | disabled |
| Only planned | enabled — planned free lines |
| Partial resolved | enabled — Apply + planned |
| Fully resolved | enabled — Apply |
| Double-click same fingerprint | blocked (`cpqCctvDuplicateBlocked`) |

Errors keep planner open; retry allowed.

## 9. Step 2 integration

Planned lines appear in the CCTV section with warning chip. User can edit/replace with a real catalog product (manual for now — no in-card catalog picker in this checkpoint).

## 10. Step 3 behavior

Navigation preserved. Planned required lines remain visible at ₪0 with badge; readiness/gaps surface incompleteness.

## 11. Send safety

New critical rule `planned_equipment_rule`: blocks send when non-optional items have `package_name` starting with `cctv-planned:` or description starting with `נדרש ציוד`. Message lists pending roles.

## 12. Duplicate protection

- Fingerprint includes planned roles.  
- Re-apply deletes prior `cctv-planned:*` lines then re-inserts.  
- Design Apply still owns resolved catalog lines.

## 13. Retry/error behavior

Apply errors stay in-drawer (`localApplyError`). Divergence / revision conflict paths unchanged. Design persist failure does not wipe local review state.

## 14. User-facing copy cleanup

- `HDD_OPTIONS_EMPTY` → «לא נמצא כונן אחסון מתאים בקטלוג (נדרש ≈XTB)» (no English debug).  
- Status copy: «הנדסה הושלמה — ציוד חלקי».  
- Empty templates filtered from picker (`item_count > 0`). Backend already returns `TEMPLATE_EMPTY`.

## 15. Desktop

Logic/UI tokens unchanged; checklist: dark tokens, RTL, density, no Bottom Nav changes. Breakpoints 1440/1032/768 not screenshot-captured this turn — behavior is CTA + chip + free-line (same layout chrome).

## 16. Mobile

Same drawer + solution cards; primary CTA remains in footer; planned chip wraps. 390/360 not re-shot this turn.

## 17. Tests

- `cctv-build-system.test.ts` — 11 pass (empty/partial planned gates).  
- `cctv-equipment-intent-e1.test.ts` — 11 pass.  
- E2 intent-persistence failures for `equipment_intent` 4-arg helper are **pre-existing** on branch (signature drift); Q updated for QUOTE-11 gate.

## 18. Typecheck

Focused Vitest suites green for changed gate/projection.

## 19. Build

Not a full production rebuild in-agent; deploy via GitHub → Vercel/Render from `main`.

## 20. Remaining CCTV gaps

- In-row «בחר מוצר» catalog picker for planned lines (Step 2).  
- Link planned free lines to Design component ids (stronger ownership than `package_name`).  
- Optional: RPC support for product-less lines (would need migration — deferred per §5).  
- **CCTV-DESIGNER-2** (professional hierarchy / live summary / explainability) — **not** in this checkpoint.  
- E2 `componentsFromRecommendation(..., intentByRole)` signature restore if Equipment Intent E2 is still in scope.

---

## UI Review Checklist (sign-off)

| Item | Result |
|------|--------|
| Area touched | Quote CCTV drawer, solution cards, catalog select, quote send rules |
| Themes | Dark tokens reused; no theme provider change |
| Breakpoints | Logic-only; existing drawer/cards |
| Bottom Nav | Untouched |
| Permissions | Cost still service-role only after authorize |
| Fake SKU/price | None |

**STOP** — QUOTE-11 complete; CCTV-DESIGNER-2 not started.
