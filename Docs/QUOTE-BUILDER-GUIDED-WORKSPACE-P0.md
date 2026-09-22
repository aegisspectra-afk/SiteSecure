# Quote Builder — Guided Workspace P0

**Date:** 2026-09-22  
**Scope:** Focused stage **presentation** only (hybrid guided workspace)  
**Discovery:** [`QUOTE-BUILDER-GUIDED-WORKSPACE-DISCOVERY.md`](./QUOTE-BUILDER-GUIDED-WORKSPACE-DISCOVERY.md)

---

## 1. Previous cognitive-load problem

After Kai polish, the Quote Builder still exposed customer, composition, pricing, terms, readiness, and Send on one long page. The existing stepper only scrolled within that page.

---

## 2. Implementation approach

- Keep **one** `QuoteBuilder`, **one** Quote state, **four** existing step IDs (`details` | `items` | `pricing` | `review`).
- Add `QuoteStagePanel` wrappers that **keep children mounted** and toggle `hidden` / `is-active` so local dirty line state survives.
- Relabel stepper via `he.ts`.
- Stage-aware summary rail density; readiness + terms live in Stage 4; free jump; optional חזרה/המשך.
- **No** `?stage=`, no router work, no createOnce on navigation.

---

## 3. Stage presentation model

| Active stage | Dominant workspace | Rail |
| --- | --- | --- |
| `details` | Context / quote metadata | Compact total |
| `items` | Composition (planning emphasis) | Compact total |
| `pricing` | Same lines (commercial emphasis) | **Full** summary |
| `review` | Terms + readiness + Preview/Send | Full summary + Send footer |

Inactive panels remain in the DOM (`hidden`) — not unmounted.

---

## 4. Stage 1 — פרטי ההצעה

Customer, site, lead, title, project, validity, quote-level template, progressive project-more, template fast-path when applicable. Terms removed from this surface (moved to Stage 4).

---

## 5. Stage 2 — תכנון וציוד

`QuoteLinesPanel` + quick-add / System Builder / catalog / packages. Planning emphasis class. Same item model as Stage 3.

---

## 6. Stage 3 — הצעה ומחיר

Same mounted `QuoteLinesPanel` with pricing emphasis; full commercial summary in the rail.

---

## 7. Stage 4 — תנאים ושליחה

Payment terms, warranty, general terms, notes; UnifiedReadiness; Preview + Send actions; desktop Send footer in rail.

---

## 8. Global context

Header: number, status/version, quiet save, compact customer hint, stage navigator. Send remains reachable in header (ghost off Stage 4; strong on Stage 4). Compact total in rail for Stages 1–2.

---

## 9. Summary behavior

- Stages 1–2: compact סה״כ chip  
- Stages 3–4: full `QuoteSummaryAside` (server totals only)

---

## 10. Desktop navigation

Horizontal stepper (relabeled). Active step inset underline. Free click. Contextual חזרה/המשך call `goToStep` only.

**Visibility fix (P0):** base `.cpq-stepper { display: none }` hid the non-icons desktop nav even when `.cpq-stepper-desktop` was shown. Override at `≥1024px`: `.cpq-stepper-desktop .cpq-stepper { display: block; }`.

---

## 11. Mobile navigation

`שלב X מתוך 4` + stage title; icon stepper; one stage panel visible. Dock architecture unchanged.

---

## 12. Dirty-state protection

| Surface | Strategy |
| --- | --- |
| Header draft fields | Parent `draft` state — safe if unmounted |
| `QuoteLinesPanel` / `QuoteLineRow` | **Always mounted**; hidden when inactive |
| Terms textareas | Parent `draft`; shown on Stage 4 |

---

## 13. createOnce verification

`goToStep` / `goAdjacentStage` only update presentation state (+ UI expand flags). Tests confirm navigating `/app/quotes/new` stages does **not** call `createQuote`.

---

## 14. Lifecycle / read-only

`canEdit` unchanged. Non-draft still browses stages; controls stay disabled per existing rules. Lifecycle CTAs unchanged.

---

## 15. RTL

Stage order native RTL; labels Hebrew; money `ltr-meta`.

---

## 16. Responsive QA

Captured under `Docs/quote-builder-guided-p0-qa/`:

- Desktop 1440: all four stages (light) + items/pricing dark  
- 1280 details, 1100 pricing  
- Mobile 390/360: all four stages light; 390 review dark  
- New empty quote → Stage 1  
- `report.json` includes active/inactive panel counts and dock padding  

---

## 17. Files changed

- `apps/web/src/components/quotes/QuoteBuilder.tsx`
- `apps/web/src/components/quotes/workspace/QuoteStagePanel.tsx` (new)
- `apps/web/src/components/quotes/workspace/types.ts`
- `apps/web/src/components/quotes/workspace/QuoteStepper.tsx` (labels via i18n)
- `apps/web/src/i18n/he.ts`
- `apps/web/src/styles.css`
- `apps/web/tests/quote-guided-stages-p0.test.tsx` (new)
- `apps/web/tests/quote-builder.test.tsx`
- `apps/web/tests/quote-system-apply.test.tsx`
- `apps/web/tests/quote-mobile-actions.test.tsx`
- `apps/web/scripts/quote_builder_guided_p0_qa.mjs`
- `Docs/QUOTE-BUILDER-GUIDED-WORKSPACE-P0.md`
- `Docs/quote-builder-guided-p0-qa/*`

---

## 18. Screenshots

`Docs/quote-builder-guided-p0-qa/` (see `report.json` for full list).

---

## 19. Exact tests / build

```text
quote-guided-stages-p0.test.tsx     8 passed
quote-builder.test.tsx             19 passed
quote-system-apply.test.tsx         5 passed
quote-mobile-actions.test.tsx      10 passed
quote-composition / line / lifecycle / readiness  26 passed
cctv + system-section              55 passed
tsc --noEmit                       pass
vite production build              pass
```

---

## 20. Deferred (P1–P5)

- P1 deeper Stage 4 restructuring  
- P2 `?stage=` deep link  
- P3 extra mobile stage behavior  
- P4 richer planning vs pricing field split  
- P5 Next/Back polish  
- Equipment Intent / non-catalog R3 / DB verification  

---

## 21. Protected systems unchanged

Pricing/VAT/discounts, autosave semantics, createOnce triggers, CCTV/R1–R3/Apply, authz/RLS, Share/Send/PDF lifecycle, mobile dock geometry/z-index — **unchanged**.
