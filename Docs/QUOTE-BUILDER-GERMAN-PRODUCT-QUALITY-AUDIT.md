# Quote Builder — German-Grade Product Quality Audit

**Date:** 2026-09-24  
**Scope:** Precision UX / hierarchy / microcopy / control audit on Guided Workspace V1  
**Not in scope:** Redesign, E3, R3 Apply changes, pricing/PDF/CCTV math, migrations

---

## 1. Quality principles used

German engineering discipline + Kai Fintech refinement:

- One primary question per stage  
- Every control must communicate state, needed info, next action, or consequence  
- Precision over decoration; hierarchy over card explosion  
- Explicit state over clever UI; predictable actions  
- Progressive disclosure; server-owned commercial truth  
- No banking semantics  

---

## 2–3. Stage 1 — structure & controls

**Hierarchy**

1. Intro: פרטי ההצעה + subtext  
2. Customer identity / picker  
3. Site (optional)  
4. Lead (if permitted)  
5. Title + validity  
6. Project name  
7. Progressive: project more (address, summary, key points, create site)  
8. Template (if catalog)  
9. Nav: Back · המשך לתכנון וציוד  

**Controls**

| Control | Visible when | Behavior | Mutation | Persistence |
|---|---|---|---|---|
| בחירת לקוח | No customer / choose mode | Opens existing search | No until pick | On pick: existing draft/customer path |
| + לקוח חדש | CRM create permitted | Existing create form | Creates customer via API | Existing associate behavior |
| שינוי לקוח | Customer selected + canEdit | Re-opens chooser | May clear incompatible site per existing rules | Existing |
| Site select | Sites permitted | Existing Select | Updates draft site/project fields | Existing save |
| Title / validity | Always in Stage 1 | Draft fields | Local draft | Existing header persist |
| Project more | Toggle | Disclosure only | Nested fields | Existing |
| Template apply | Catalog | Existing apply | Existing | Existing |
| המשך לתכנון וציוד | Desktop nav | `goToStep("items")` | **None** | None |

**Removed from Stage 1:** Quote-level discount fields (commercial → Stage 3).

---

## 4–5. Stage 2 — structure & controls

**Empty**

- איך תרצו לבנות את הפתרון?  
- Featured: תכנון מערכת → System Builder  
- Supporting: קטלוג · הוספה ידנית  

**Populated**

- התכנון והציוד  
- Compact: + תכנון מערכת / + קטלוג / + פריט  
- Lines with `workspaceMode=planning` (commercial columns demoted visually)  
- Inline catalog only in planning  

| Control | Behavior | Side effect |
|---|---|---|
| התחל תכנון | Opens System Builder drawer | Existing Design create/ensure only when Design flow requires Quote |
| עיון בקטלוג | Focus catalog search | Existing add-to-quote on select |
| הוסף פריט | Quick-add menu | Existing composition types |
| + compact cluster | Same three flows | No new types |
| המשך להצעה ומחיר | Stage 3 only | No Apply/pricing mutation |

---

## 6–8. System Builder / Equipment Intent / Catalog

Unchanged semantics:

- Nested Stage 2 drawer  
- CCTV recommend / durable Design / E1–E2 Intent  
- Catalog select → product_id Quote lines only via existing add  
- Intent ≠ product_id / SKU / price / Apply  

---

## 9–12. Stage 3 — structure, controls, pricing, finance

**Empty:** directional CTA חזרה לתכנון וציוד only.

**Populated:** ההצעה המסחרית + lines (`workspaceMode=pricing`) + Quote discount block + full summary rail.

| Control | Behavior |
|---|---|
| Qty / unit price / discount | Existing line persist |
| Section discount | Pricing mode only |
| Quote discount amount/% | Stage 3 commercial block (moved from Stage 1) |
| Delete / reorder | Existing; R3 divergence preserved |
| Financial summary | Server totals only (`subtotal_net`, discounts, VAT, `total_gross`) |
| Total | Strongest tabular number |

---

## 13–18. Stage 4 — structure, controls, readiness, Preview/Share/Send

**Hierarchy**

1. Intro  
2. Terms settings rows (payment / warranty / general) — empty = **לא הוגדר** (not false “company default”)  
3. Customer notes + internal notes with truthful helpers  
4. Readiness checklist (required vs recommended)  
5. Final summary (customer · count · server total)  
6. תצוגת לקוח · שליחה לאישור הלקוח  
7. Back only (no Next)  

| Control | Behavior |
|---|---|
| Terms עריכה | Opens Quote-specific textarea; does not mutate company defaults |
| Readiness row CTA | Navigates/focuses existing field/stage |
| תצוגת לקוח | Staff Preview only — no publish/send |
| שליחה לאישור הלקוח | Formal Send via existing confirm flow |
| Share (overflow) | Remains view-oriented A3 semantics |

**Duplicates removed on Stage 4**

- Header Preview hidden  
- Header Send hidden  
- Dock Send hidden  
- Dock Preview hidden  
- Sidebar Send already off  
- Duplicate readiness details list removed  

---

## 19–21. Navigation / stepper / save

- Stage click = presentation only (no createOnce / ensureQuoteId / Send / Apply)  
- Desktop semantic Next/Back; mobile short labels  
- Stage 4: no Next  
- Stepper free-jump; no fake completion marks  
- Save indicator secondary; nav does not force artificial persist  

---

## 22. Read-only / sent

`canEdit` / status gating unchanged; stages remain browsable.

---

## 23–24. Kai patterns used / rejected

**Used:** featured decision surface, settings rows, financial hierarchy, progressive disclosure, strong primary action, tabular numbers, calm surfaces, compact status.

**Rejected:** wallets, cards, transactions, fake balances, banking icons/copy.

---

## 25. Terminology / microcopy changes

| Before | After |
|---|---|
| דורס ברירת מחדל (terms) | לא הוגדר / הותאם להצעה זו |
| דריסת מחיר / מרווח | שינוי מחיר / מרווח |
| דריסת bitrate | קצב נתונים מותאם |
| תצוגה מקדימה (live pane) | תצוגת עריכה חיה |
| v{N} chip | גרסה N |
| Empty terms = company default | Empty = לא הוגדר (truthful) |

---

## 26. Duplicated actions removed

Stage 4: single formal Send + Preview in panel. Header/dock Send+Preview suppressed on review. Live-edit preview renamed to avoid colliding with customer Preview.

---

## 27–31. QA results

- Desktop 1100–1440: stage purposes distinct; Stage 2/3 no longer interchangeable  
- Mobile 360/390: one task; dock architecture unchanged  
- RTL: structural order preserved; money `ltr-meta`  
- Light/Dark: first-class surfaces  
- a11y: stage panels keep `hidden`/aria; terms `aria-expanded`; focus preserved  

Screenshots: `Docs/quote-builder-guided-v1-qa/` (+ this pass reuses V1 captures; re-run `quote_builder_guided_v1_qa.mjs` after build).

---

## 32. Screenshots

See `Docs/quote-builder-guided-v1-qa/report.json` (20 shots covering empty/populated Stages 1–4, light/dark, 1440/1280/1100/390/360).

---

## 33. Files changed (this pass)

- `QuoteBuilder.tsx` — Stage 1 discount move, Stage 3 discount block, Stage 4 CTA isolation, accordion default  
- `QuoteLinesPanel.tsx` — intro classes, planning catalog gate, mode → lines  
- `QuoteLineRow.tsx` — `workspaceMode` + commercial demotion class  
- `QuoteHeader.tsx` — `hidePreview`, גרסה label  
- `QuoteMobileActionsBar.tsx` — Stage 4 Send/Preview suppression  
- `UnifiedReadiness.tsx` — single remediation surface  
- `quote-readiness.ts` — stop softening valid_until to recommended  
- `he.ts` — terminology  
- `styles.css` — planning/pricing/discount precision  
- `Docs/QUOTE-BUILDER-GERMAN-PRODUCT-QUALITY-AUDIT.md`

---

## 34. Exact tests / build

```
quote-guided-stages-p0     14 passed
quote-builder              19 passed
quote-mobile-actions       10 passed
quote-lines-panel           1 passed
cctv-equipment-intent e1/e2 29 passed
API R1 + R3 Apply          42 passed
tsc --noEmit               OK
npm run build              OK
```

---

## 35. Protected systems unchanged

Pricing formulas · PDF/snapshot · CCTV math · System Design R1/R2/R3 · Equipment Intent persistence · Apply RPC/fingerprints · Share/Send/Revise semantics · authz/RLS · migrations · mobile dock architecture · no E3.

---

## 36. Deferred

- Company-default terms hydration (when API exposes defaults, restore “לפי ברירת המחדל…” only if text is known)  
- E3 non-catalog Apply  
- Alarm / Access / Intercom builders  
- Production DB verification  
