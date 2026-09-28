# Quote Builder — Guided Workspace V1

**Date:** 2026-09-23  
**Scope:** Stage differentiation + Kai Fintech UI pass (presentation only)  
**Baseline:** Guided Workspace P0 (`Docs/QUOTE-BUILDER-GUIDED-WORKSPACE-P0.md`)

---

## 1. Final four-stage product model

| ID | Label | Question |
|---|---|---|
| `details` | פרטי ההצעה | למי מכינים את ההצעה? |
| `items` | תכנון וציוד | מה הפתרון שאנחנו מתכננים? |
| `pricing` | הצעה ומחיר | מה אנחנו מציעים מסחרית ובכמה? |
| `review` | תנאים ושליחה | האם הכול מוכן ללקוח? |

One Quote · one state · one pricing · one lifecycle. Stages are focused workspaces, not separate drafts.

---

## 2. Question each stage answers

See table above. Navigation is free-jump; stage change does **not** create Quote, send, revise, or call `ensureQuoteId`/`createOnce`.

---

## 3. Stage 1 composition

- Intro: title + subtext  
- Customer identity block (or empty “לא נבחר לקוח” + existing picker/create)  
- Optional site with helper (not a Send blocker)  
- Primary fields: title, validity, lead/template  
- Progressive disclosure for project-more  
- Footer: חזרה · **המשך לתכנון וציוד**

---

## 4–5. Stage 2 composition / empty / populated

**Empty:** “איך תרצו לבנות את הפתרון?” with hierarchical paths:

1. **תכנון מערכת** (featured) → System Builder  
2. **בחירה מהקטלוג** → catalog  
3. **הוספה ידנית** → quick-add  

**Populated:** title **התכנון והציוד**; compact `+ תכנון מערכת / + קטלוג / + פריט`; solution-oriented line cards; section discounts de-emphasized vs Stage 3.

`QuoteLinesPanel` stays mounted (`workspaceMode="planning"`).

---

## 6–7. Stage 3 composition / empty / populated

**Empty:** “עדיין אין פריטים להצעה” + CTA **חזרה לתכנון וציוד** only.  
No System Builder / catalog / add-item CTAs.

**Populated:** title **ההצעה המסחרית**; commercial line editing; section discounts visible; full summary rail with strong total.

`QuoteLinesPanel` same mount (`workspaceMode="pricing"`).

---

## 8. Stage 4 composition

- Terms as Kai-like setting rows (default vs customized; edit on demand) — no “דורס”  
- Customer notes vs internal notes with truthful helpers  
- Readiness checklist: נדרש / מומלץ / מוכן (site remains recommended)  
- Final commercial summary (customer · item count · server total)  
- Actions: תצוגת לקוח + **one** שליחה לאישור הלקוח  
- Footer: חזרה להצעה ומחיר · **no Next**

---

## 9. Readiness presentation

`UnifiedReadiness` shows checklist with required vs recommended. Progress “N מתוך M” uses **required** items only so optional site does not look like incompleteness.

---

## 10. Final action architecture

| Surface | Send |
|---|---|
| Stage 4 panel | Primary formal Send |
| Header | Ghost when sendable; **hidden on Stage 4** (avoids duplicate) |
| Sidebar | No Send footer |
| Mobile dock | Unchanged protected architecture |

Preview remains separate (תצוגת לקוח).

---

## 11. Stepper / navigation

Desktop: semantic Next/Back labels. Mobile: חזרה/המשך via short labels. Stage 4 has no Next. Free jump preserved.

---

## 12. Kai Fintech patterns used

From `Docs/FINTECH-TO-SITE-SECURE-DESIGN-MIGRATION.md` + prior Kai polish docs:

- Featured + supporting action hierarchy (Stage 2 paths)  
- Compact settings rows (Stage 4 terms)  
- Strong tabular total emphasis (Stage 3–4)  
- Progressive disclosure  
- Calm premium surfaces / restrained borders  
- Checklist readiness (not banking widgets)

---

## 13. Kai patterns rejected

- Credit cards / wallets / transaction feeds  
- Fake balances / finance charts  
- Banking copy  
- Flutter port  

---

## 14–17. Desktop / mobile / RTL / themes

Desktop 1100–1440: wider Stage 2 path grid; financial rail on 3–4.  
Mobile 360/390: stacked paths; dock/clearance unchanged.  
RTL + Heebo preserved. Light/Dark tokens work.

---

## 18. Dirty-state preservation

`QuoteStagePanel step={["items","pricing"]}` keeps one `QuoteLinesPanel` mounted; mode is a prop. Proven in tests (same `#quote-items` node).

---

## 19. Read-only / sent

Existing `canEdit` / status gating unchanged; stages remain browsable.

---

## 20. Files changed

- `apps/web/src/components/quotes/cpq/QuoteLinesPanel.tsx`  
- `apps/web/src/components/quotes/QuoteBuilder.tsx`  
- `apps/web/src/components/quotes/workspace/UnifiedReadiness.tsx`  
- `apps/web/src/components/quotes/quote-creation/QuoteContextCard.tsx`  
- `apps/web/src/i18n/he.ts`  
- `apps/web/src/styles.css`  
- `apps/web/tests/quote-guided-stages-p0.test.tsx`  
- `apps/web/tests/quote-builder.test.tsx`  
- `apps/web/scripts/quote_builder_guided_v1_qa.mjs`  
- `Docs/QUOTE-BUILDER-GUIDED-WORKSPACE-V1.md`  
- `Docs/quote-builder-guided-v1-qa/*`

---

## 21. Screenshots

`Docs/quote-builder-guided-v1-qa/` (20 shots: desktop dark/light, 1100/1280/1440, mobile 390/360).

---

## 22. Exact tests / build

```
quote-guided-stages-p0.test.tsx   14 passed
quote-builder.test.tsx            19 passed
quote-mobile-actions.test.tsx     10 passed
cctv-equipment-intent-e1/e2       29 passed
cctv-design-persistence           11 passed
cctv-build-system                 11 passed
tsc --noEmit                      OK
npm run build                     OK
```

---

## 23. Protected systems unchanged

Pricing · PDF · snapshot · CCTV math · System Design R1–R3 · Equipment Intent semantics · Apply RPC/fingerprints · Share/Send/Revise semantics · authz/RLS · migrations · mobile dock stack · no E3.
