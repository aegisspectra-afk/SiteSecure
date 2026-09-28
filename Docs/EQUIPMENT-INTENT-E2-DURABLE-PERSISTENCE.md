# EQUIPMENT INTENT E2 — Durable Persistence

**Date:** 2026-09-23  
**Scope:** System Design / System Builder (CCTV) — durable Equipment Intent persistence + hydration + editing  
**Boundary:** Design-side only. No Apply/R3/Quote/pricing/lifecycle changes.

---

## 1. Final Equipment Intent domain shape

```ts
type EquipmentIntent = {
  manufacturer?: string;          // free text, optional
  model_reference?: string;       // free text, optional — NOT a catalog SKU
  display_description?: string;   // optional short note
  selected_attributes?: Record<string, string | number | boolean | null>; // role-specific, controlled
};

// Conceptual (derived, not a separate DB enum column):
type SelectionKind = "catalog" | "intent" | "unresolved";
```

Commercial keys (`cost`, `list_price`, `unit_price`, `margin`, `product_id`, `sku`, …) are rejected/stripped.

---

## 2. Persistence location

Additive column on existing durable components:

| Table | Column | Type |
|---|---|---|
| `system_design_components` | `equipment_intent` | `jsonb` (nullable) |

Migration: `supabase/migrations/0056_system_design_equipment_intent.sql` (additive; **not deployed to production in this task**).

No new domain table. No fake Product rows. No Quote items.

---

## 3. Why it is not a Product

Equipment Intent answers: **what equipment does the user intend to use?**

It does **not**:

- create `product_id` / SKU / catalog linkage  
- invent price / cost / margin  
- become a Quote line  
- replace engineering requirements  

Catalog Product remains a separate, optional resolution mode.

---

## 4. Engineering vs equipment vs catalog

Pipeline (unchanged conceptually):

```
Requirements → Engineering Design → Equipment Intent → Catalog Product (optional) → Quote → Pricing
```

| Concern | Source of truth |
|---|---|
| WHAT IS REQUIRED? | Engineering (`technical_requirements`, engineering result) |
| WHAT DOES THE USER INTEND? | `equipment_intent` on Design component |
| WHICH CATALOG PRODUCT? | `user_selected_product_id` / candidates |
| WHAT IS OFFERED COMMERCIALLY? | Quote items (R3 Apply) — **unchanged** |

---

## 5. Manufacturer behavior

- Optional free text  
- Suggestions from workspace catalog candidate manufacturers when available  
- Suggestions never restrict input  
- No hardcoded global brand registry  
- Deduplicated, case-insensitive for display; user text not silently rewritten  

---

## 6. Model / reference behavior

- Optional free text  
- Distinguishes user-specified model from catalog-verified product  
- Typing a model does **not** create `product_id` / SKU / verified compatibility  

---

## 7. Role-specific attributes

No generic schema framework. For CCTV E2:

- Persist `selected_attributes` only when the user makes an equipment choice  
- Forbidden commercial keys stripped  
- Do not duplicate deterministic engineering outputs into intent unless the user chooses them  

Services/labor roles **never** receive Equipment Intent UI.

---

## 8. Equipment resolution states

Activated in E2 (orthogonal to engineering completeness):

| State | Meaning |
|---|---|
| `REQUIREMENT_READY` | Engineering known; no catalog product; no intent |
| `EQUIPMENT_SPECIFIED` | Durable intent present; no catalog product |
| `CATALOG_RESOLVED` | Catalog product selected |
| `NEEDS_REVIEW` | Prior choice retained but requirement fingerprint changed / review flagged |

`selection_kind` is derived: catalog wins over intent; never both at once.

---

## 9. Hydration / reopen

On System Builder open with an existing Design:

1. Load Design + components (includes `equipment_intent`)  
2. Rebuild recommendation via `recommendationFromDesign`  
3. Hydrate catalog selection via `selectionFromDesign`  
4. Hydrate intent via `intentFromDesign` (by `role_key`)  
5. Restore `needs_review` flags  

Survives drawer close, stage navigation, refresh, Quote reopen.

---

## 10. Recalculation preservation

`mergeIntentAfterRecalculate`:

- Match by stable **`role_key`** (not display text / array index)  
- Preserve valid intent when role still exists  
- If technical-requirements fingerprint changed → keep intent + mark `needs_review`  
- If role disappears → drop intent + flag review  

Same philosophy as catalog override merge. CCTV sizing/recommend math unchanged.

---

## 11. needs_review behavior

UI copy: **«הציוד שהוגדר דורש בדיקה לאחר שינוי בתכנון»**

Means: requirement changed / review needed — **not** proven incompatibility unless existing deterministic rules already establish it.

---

## 12. Catalog → Intent transition

User action: **«הגדר ציוד ללא קטלוג»** / save intent.

- Clears `user_selected_product_id` for that role  
- Persists `equipment_intent`  
- Visible state never shows both CATALOG_RESOLVED and EQUIPMENT_SPECIFIED  

---

## 13. Intent → Catalog transition

User action: pick a real catalog candidate.

- Sets catalog selection  
- Persist path clears `equipment_intent` for that role (mutual exclusivity)  
- No silent auto-match from manufacturer/model text  
- Intent cleared only after successful mode switch persist sequence in drawer state  

E2 does **not** retain inactive intent history (unnecessary complexity deferred).

---

## 14. Empty-catalog flow

Valid end state:

- ✓ התכנון ההנדסי הושלם  
- Engineering requirements visible  
- ציוד מוגדר (e.g. Hikvision · דגם טרם נבחר)  
- No `product_id`, no fake SKU, no invented price  
- Apply still not ready (catalog gate unchanged)  

---

## 15. CAS / concurrency

Equipment Intent edits use existing Design PATCH + revision CAS.

Stale revision → `409 CONFLICT_REVISION` + existing conflict UX.  
No auto-overwrite / silent retry / last-write-wins.

---

## 16. Security / authz

Uses existing System Design access (`quotes.view` / `quotes.edit`, workspace isolation, parent Quote visibility, RLS).  
No new authorization path. Candidate commercial stripping remains intact.

---

## 17. Mobile UX (360 / 390)

- Requirement + equipment state remain scannable  
- Intent editor is compact (manufacturer + model)  
- Actions above AppShell/Quote docks (existing bottom-clearance)  
- Manufacturer datalist suggestions usable with keyboard  

---

## 18. Desktop UX

- Default card stays scannable  
- Edit on demand (no permanently expanded 15-field forms)  

---

## 19. Apply boundary (E2 stops here)

R3 Apply contract **unchanged**.

If `EQUIPMENT_SPECIFIED` without catalog product:

> הציוד נשמר בתכנון. הוספה להצעה ללא מוצר קטלוגי תתאפשר בשלב הבא.

Apply button remains gated by existing catalog product resolution. Intent does **not** enable Apply.

---

## 20. Files changed

**Schema**

- `supabase/migrations/0056_system_design_equipment_intent.sql`

**API**

- `apps/api/app/system_designs/__init__.py` — `sanitize_equipment_intent`  
- `apps/api/app/routers/system_designs.py` — column select/payload/public strip  
- `apps/api/tests/test_system_designs_r1.py` — sanitize tests  

**Client**

- `packages/api-client/src/index.ts` — `EquipmentIntent` + component fields  

**Web**

- `apps/web/src/lib/cctv-equipment-intent-e2.ts` — normalize / suggestions / selection kind  
- `apps/web/src/lib/cctv-equipment-intent-e1.ts` — `EQUIPMENT_SPECIFIED` + intent-aware pending  
- `apps/web/src/lib/cctv-design-persistence.ts` — persist / hydrate / merge intent  
- `apps/web/src/components/quotes/cpq/SystemBuilderDrawer.tsx` — editor + mode switches  
- `apps/web/src/i18n/he.ts` — Hebrew copy  
- `apps/web/src/styles.css` — compact intent editor  
- `apps/web/tests/cctv-equipment-intent-e2.test.ts`  
- `apps/web/scripts/equipment_intent_e2_qa.mjs`  

**Docs**

- `Docs/EQUIPMENT-INTENT-E2-DURABLE-PERSISTENCE.md`  
- `Docs/equipment-intent-e2-qa/*`  

---

## 21. Migrations

`0056_system_design_equipment_intent.sql` — additive `equipment_intent jsonb`.  
Production DB verification deferred.

---

## 22. Exact tests / build

```
apps/web: vitest
  cctv-equipment-intent-e2.test.ts     18 passed
  cctv-equipment-intent-e1.test.ts     11 passed
  cctv-design-persistence.test.ts      11 passed
  cctv-build-system.test.ts            11 passed
  cctv-sizing.test.ts                  30 passed
  quote-guided-stages-p0.test.tsx       8 passed
  quote-mobile-actions.test.tsx        10 passed
  quote-builder.test.tsx               19 passed

apps/api: pytest
  test_system_designs_r1.py            17 passed
  test_system_designs_r3_apply.py      25 passed

apps/web: tsc --noEmit                  OK
apps/web: npm run build                 OK
```

---

## 23. Screenshots

`Docs/equipment-intent-e2-qa/` — desktop + mobile 390/360, light + dark fixtures.

---

## 24. Deferred E3 / E4

| ID | Work |
|---|---|
| E3 | R3 contract extension for owned non-catalog output |
| E4 | Apply Equipment Intent to Quote (safe ownership) |
| E5 | Explicit link/upgrade Intent → catalog product |

Also deferred: Alarm / Access / Intercom builders, AI matching, pricing invention, production DB verify.

---

## 25. Protected systems unchanged

- R3 Apply RPC / fingerprints / confirmation token / divergence  
- `quote_items` / free Quote lines  
- `pricing.py` / discounts / VAT / cost / margin  
- Preview / Share / Send / PDF / Revise  
- CCTV recommend/sizing math  
- Quote Guided Workspace stages (no fifth stage)  
