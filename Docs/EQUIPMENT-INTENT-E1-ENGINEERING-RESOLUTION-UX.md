# EQUIPMENT INTENT E1 — Engineering / Equipment Resolution UX Split

**Date:** 2026-09-23  
**Scope:** System Builder (CCTV) presentation only — inside Quote Stage 2 · תכנון וציוד  
**Product code:** UX + copy + presentation helpers. No schema / R3 / pricing / sizing changes.

---

## 1. Previous conceptual problem

CCTV engineering could already succeed with an empty catalog (`build_cctv_requirements` → valid roles / TB / PoE). Catalog matching then marked roles `UNRESOLVED` / recommendation `BLOCKED`, and the drawer showed **«לא ניתן להשלים את המערכת»**.

Sellers experienced **engineering failure** when the real gap was **equipment / catalog resolution**.

---

## 2. Engineering status model

Orthogonal to catalog:

| State | Meaning |
|---|---|
| `ENGINEERING_INCOMPLETE` | `INVALID_INPUT` or hard unresolved sizing codes |
| `ENGINEERING_COMPLETE` | Existing `engineering` + input signals are sufficient |

**Important:** recommendation `status === "BLOCKED"` (catalog gaps) does **not** imply engineering incomplete.

Derived in `deriveEngineeringStatus()` from existing recommendation fields only — no second calculation.

---

## 3. Equipment resolution model

Per physical component (presentation):

| State | Meaning in E1 |
|---|---|
| `REQUIREMENT_READY` | Engineering known; no catalog product selected |
| `EQUIPMENT_SPECIFIED` | Reserved for E2+ Intent persistence — not enabled |
| `CATALOG_RESOLVED` | Structured/partial catalog product selected |
| `NEEDS_REVIEW` | Selection incompatible / text-assisted core / design `needs_review` |

Mapped via `resolveComponentProduct` + existing confidence/compatibility. No new DB fields.

---

## 4. Warning taxonomy

Presentation-side classification (`classifyWarningCode`):

| Class | Examples |
|---|---|
| ENGINEERING | `CABLE_DISTANCE_UNRESOLVED`, bitrate defaults, PoE architecture notes |
| CATALOG | `CATALOG_EMPTY`, `HDD_OPTIONS_EMPTY`, `COMPONENT_UNRESOLVED` |
| COMPATIBILITY | environment unverified, surveillance-grade, text-assisted NVR |
| COMMERCIAL | reserved |

Assumptions/warnings sit behind **«הנחות ותזכורות»** disclosure to avoid vertical stacks on mobile.

---

## 5. Empty-catalog UX

Order after successful calculate:

1. ✓ **התכנון ההנדסי הושלם** + CCTV summary  
2. **תכנון מערכת** (cameras / NVR / storage / PoE / architecture)  
3. **ציוד** — pending count + calm catalog note  
4. Component cards: requirement vs equipment  
5. **שירותים ועבודה** separated  

Removed catastrophic framing of empty catalog as system failure.

---

## 6. Component card states

Each physical card:

- Title + qty  
- **דרישה הנדסית** chips / unresolved requirement text  
- **ציוד** — product name or «טרם נבחר»  
- Catalog gap note when no candidates  
- Primary action: **בחר מהקטלוג** / **החלף** when candidates exist  

«הגדר ציוד» Intent affordance **not** shown (no dead UI).

---

## 7. Services distinction

Roles in the services group render under **שירותים ועבודה**, without manufacturer/model/catalog-resolution semantics. Existing service resolution / optional remove preserved.

---

## 8. HDD behavior

- Engineering: required TB from summary / technical requirements remains visible.  
- Catalog: `HDD_OPTIONS_EMPTY` → Hebrew catalog gap (“לא נמצאו כוננים תואמים בקטלוג”), **not** “hdd options empty”.  
- Packing algorithm unchanged.

---

## 9. Cable behavior

- Missing distance → ENGINEERING (`לא הוגדר מרחק כבל משוער.`)  
- No meter-priced cable product → CATALOG  
Not collapsed into one “unresolved system” banner.

---

## 10. PoE behavior

External switch requirement remains in engineering summary even with zero switch SKUs. Card shows requirement chips + «טרם נבחר» — not whole-system failure.

---

## 11. Apply behavior

**Unchanged.** `canAddRecommendationToQuote` / R3 catalog Apply untouched.

UI copy only:

- Engineering complete ≠ ready to add  
- Empty gate → explain equipment still required before quote add  
- Partial gate → existing «הוסף את הפריטים הזמינים»  
- No fake product / SKU / price  

---

## 12. Guided Workspace integration

System Builder remains a drawer inside Quote Stage 2. Close / Apply do not auto-advance Quote stages. Guided P0 architecture untouched.

---

## 13. Mobile behavior

390 / 360: prioritize engineering banner → plan → equipment status → cards. Warnings collapsed. Quote dock untouched. CSS: `.cpq-e1-*`.

---

## 14. Files changed

| File | Change |
|---|---|
| `apps/web/src/lib/cctv-equipment-intent-e1.ts` | **New** presentation helpers |
| `apps/web/src/lib/cctv-recommend-copy.ts` | Services label; HDD/catalog Hebrew; cable copy |
| `apps/web/src/components/quotes/cpq/SystemBuilderDrawer.tsx` | E1 review layout |
| `apps/web/src/i18n/he.ts` | Engineering vs equipment copy |
| `apps/web/src/styles.css` | `.cpq-e1-*` calm status styles |
| `apps/web/tests/cctv-equipment-intent-e1.test.ts` | **New** focused tests |
| `apps/web/scripts/equipment_intent_e1_qa.mjs` | Visual QA fixtures |
| `Docs/EQUIPMENT-INTENT-E1-ENGINEERING-RESOLUTION-UX.md` | This doc |
| `Docs/equipment-intent-e1-qa/*` | Screenshots + report |

---

## 15. Tests / build

```text
vitest: cctv-equipment-intent-e1, cctv-build-system, cctv-design-persistence,
        cctv-sizing, quote-composition-a2, quote-guided-stages-p0,
        quote-system-apply, quote-mobile-actions, quote-builder
tsc --noEmit: pass
vite build: pass
pytest: test_cctv_recommend + test_system_designs_r3_apply → 40 passed
```

---

## 16. Screenshots

Under `Docs/equipment-intent-e1-qa/`:

- `desktop-empty-catalog.png`
- `desktop-partial-catalog.png`
- `desktop-resolved-catalog.png`
- `mobile-390-empty.png`
- `mobile-360-empty.png`
- `mobile-390-resolved.png`
- `dark-desktop-empty.png`

---

## 17. Deferred E2+

- Equipment Intent persistence (manufacturer / model free-text)  
- Manual equipment Apply / free-line ownership  
- Enabling «הגדר ציוד»  
- R3 non-catalog Apply  
- Alarm / Access / Intercom  
- Catalog upgrade/link flows  
- New fingerprints / quote_item fields / migrations  

---

## 18. Protected systems unchanged

CCTV sizing/recommendation formulas · `pricing.py` · Quote pricing authority · R1–R3 Apply semantics · atomic Replace · divergence confirmation · Quote lifecycle · Send/Share/PDF · authz/RLS · Guided Quote Workspace architecture · mobile Quote dock.
