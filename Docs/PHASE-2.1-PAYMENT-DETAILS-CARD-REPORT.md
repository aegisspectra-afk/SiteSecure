# Phase 2.1 — Kai-Inspired Payment Details Card

**Date:** 2026-09-21  
**Scope:** `/app/settings/company` · **פרטי תשלום** only  
**Status:** Complete. **Stopped.**

SITE SECURE · React 19 / TypeScript / Vite / TanStack Query / FastAPI / Supabase.

Kai/Flutter = surface / proportion / gradient reference only. **Not** a credit card. **Not** a Flutter port.

---

## Kai files inspected

| File | Extracted |
|---|---|
| `Fintech App UI/card_app/lib/widgets/card_hero.dart` | Deliberate object proportions; radius ~20–22; flight restraint — **no 3D flip on web** |
| `Fintech App UI/card_app/lib/widgets/metallic_card.dart` (`MetallicSurface`) | Narrow graphite face; soft top-left sheen; edge vignette; fine rim (~0.7px); layered shadow |
| Visa / chip / contactless | **Excluded** |

SITE SECURE take: graphite plate + restrained `#0b6bcb` atmosphere + business fields only.

---

## Files changed

| Path | Role |
|---|---|
| `apps/web/src/routes/app/settings/company.tsx` | View↔Edit wiring; existing mutation preserved |
| `apps/web/src/components/settings/PaymentDetailsCard.tsx` | Read-only card + empty CTA |
| `apps/web/src/lib/payment-details.ts` | `hasPaymentDetails`, `maskBankAccount` (presentation only) |
| `apps/web/src/i18n/he.ts` | Edit/Cancel/Add/status/instructions strings |
| `apps/web/src/styles.css` | `.ss-payment-*` surface |
| `apps/web/tests/payment-details.test.tsx` | Unit + component |
| `apps/web/scripts/phase_2_1_payment_qa.mjs` | Authenticated visual QA |
| `Docs/phase-2.1-qa/*` | Screenshots + `report.json` |

---

## Existing behavior preserved

| Concern | Unchanged |
|---|---|
| Query | `api.getCompanyProfile` · `["company-profile", workspaceId]` |
| Mutation | `api.patchWorkspaceSettings` branding (`bankName`, `bankBranch`, `bankAccount`, `bankAccountHolder`, `paymentInstructions`, `showBankOnDocuments`) |
| Validation / permissions / loading / errors | Same form + `workspace.edit` + existing error UI |
| Show on documents | Same boolean → same API field |
| PDF / quotes | Untouched |

---

## View / Edit

Local `paymentEditing` only.

| Condition | Mode |
|---|---|
| Saved bank/branch/account/holder | Default **View** → premium card |
| No core fields | Default **Edit** form (no fake empty card) |
| **עריכה** | Existing form |
| **ביטול** (when saved exist) | Reset from profile → View |
| Save **success** | → View if details exist |
| Save **failure** | Stay Edit · existing error · no success chrome |

---

## Card hierarchy (View)

```
SITE SECURE
פרטי תשלום
[BANK NAME]
סניף · חשבון (masked) · בעל החשבון
✓ מוצג במסמכים  |  לא מוצג במסמכים
```

Instructions (**הוראות לתשלום**) sit **below** the card when non-empty. Empty → no block.

---

## Masking

Presentation only: `••••` + last 4 (spaces stripped). Full value stays in Edit inputs. No localStorage / URL / analytics / console of account numbers.

---

## Light / Dark · RTL · Responsive

- Card stays a **dark premium object** in Light and Dark (identity, not Dashboard time-of-day).
- `dir="auto"` for bank/holder/instructions; `dir="ltr"` + `.ltr-meta` for branch/account.
- Desktop max-width `min(26.5rem, calc(100vw - 2rem))` (~424px @1440). Mobile full gutter width (~358px @390). No horizontal scroll.

---

## Visual QA

`Docs/phase-2.1-qa/`

| Shot | Result |
|---|---|
| 390 Light/Dark View | Card + mask + doc status |
| 1440 Light/Dark View | Capped object width |
| 390 / 1440 Edit | Existing fields |
| 390 docs-off | **לא מוצג במסמכים** after save |

---

## Tests

| Check | Result |
|---|---|
| `tests/payment-details.test.tsx` | 8 passed |
| typecheck | Pass |
| eslint (changed TS/TSX) | Clean |
| production build | Pass |
| Playwright QA script | Pass |

---

## Safety

No backend / DB / migration / API / RLS / RBAC / auth / PDF / quote / pricing / Stripe / payment-processing changes. No Visa/Mastercard/chip/CVV. No new dependency. Scope stopped at Company **פרטי תשלום**.

---

## STOP

Phase 2.1 complete. **Do not** redesign other Settings sections or Dashboard from this pass. Ready to return to main Phase 2 work on approval.
