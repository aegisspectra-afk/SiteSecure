# Quote Builder — Kai Desktop Redesign

**Scope:** Presentation / UX only for `/app/quotes/new` and `/app/quotes/:id`.  
**Out of scope:** Pricing authority, lifecycle semantics, Send/Share/Preview contracts, CCTV / Durable System Design R1–R3, RLS, API contracts, mobile bottom-stack architecture.

---

## 1. UX problems found (pre-redesign)

| Problem | Symptom |
| --- | --- |
| Flat header hierarchy | Breadcrumb, number, status, version, save, Preview, Send competed as peers |
| Form-first context | Customer / lead / validity / template / terms all exposed at full weight before composition |
| Action duplication | Multiple Add / System / catalog CTAs in toolbar, empty state, and secondary menus |
| Empty state noise | Catalog search + several equal-weight buttons made “start here” unclear |
| Punitive readiness | Emoji / checkbox-style list made optional Site look like a failure |
| Weak totals hierarchy | Summary did not elevate `סה״כ לתשלום` as the commercial hero number |
| Card soup | Dense bordered regions without clear primary workspace |

---

## 2. Kai principles applied

- Strong title → secondary meta → quiet save hierarchy  
- Generous but efficient spacing; restrained borders; consistent radii (~14px Kai surfaces)  
- Progressive disclosure for secondary metadata  
- One primary composition CTA (`הוסף להצעה`) once items exist  
- Premium empty onboarding (not an error)  
- Sticky summary rail owns money + readiness + Send  
- Heebo + brand `#0b6bcb`; Light / Dark / System preserved  
- Lucide only; no new motion libraries  

---

## 3. Layout before / after

**Before:** Long single-column administrative form with competing toolbars and a secondary summary.  

**After (desktop ≥ lg):**

```
┌────────────────────────────────────────────────────────────┐
│ Compact Quote header (title · status · quiet save · CTAs) │
├──────────────────────────────┬─────────────────────────────┤
│ MAIN WORKSPACE               │ SUMMARY RAIL (sticky)       │
│  · Context card              │  · Totals (סה״כ לתשלום)   │
│  · Composition (hero)        │  · מוכנות לשליחה            │
│                              │  · Send CTA                 │
└──────────────────────────────┴─────────────────────────────┘
```

Composition receives the majority of horizontal space (QA: ~964px items vs ~352px summary at 1440).

---

## 4. Header redesign

- Primary: `הצעת מחיר #Q-…`  
- Secondary chips: status · version · optional customer/site hint  
- Quiet inline save (`נשמר…` / `שומר…` / `יש שינויים שלא נשמרו`) — single DOM instance (no duplicate “טיוטה חדשה”)  
- Actions: Preview secondary; Send primary; Save ghost; More menu  
- Back / breadcrumb visually secondary; RTL back chevron via `rtl:rotate-180`  

---

## 5. Quote context redesign

Surface title: **לקוח ופרטי הצעה**

- Accordion default: open when no customer; collapsed summary when customer exists  
- Empty customer: intentional empty state + picker (not fake values)  
- With customer: summary rows (customer / site / project / validity) + **עריכת פרטים**  
- Lead, extra project details, terms/docs, template remain available under progressive disclosure  

---

## 6. Composition redesign

- Zone title **תוכן ההצעה** + item count  
- Non-empty: primary **+ הוסף להצעה** opens existing unified quick-add (catalog / free / service / note / template / package / build system / section)  
- Section add remains secondary ghost when relevant  

---

## 7. Action consolidation

| Before | After |
| --- | --- |
| Toolbar `הוסף` + empty duplicates + System buttons | Empty: `הוסף פריט` + `בנה מערכת` + link `עיון בקטלוג` |
| Catalog always under empty | Catalog panel only after `עיון בקטלוג` (or existing query) |
| System as peer toolbar noise when filled | System lives in quick-add; strong treatment only when empty |

Mobile dock still uses short `הוסף` (`cpqAddCommand`) — closed mobile architecture unchanged.

---

## 8. Empty-state redesign

Copy:

- Title: ההצעה עדיין ריקה  
- Body: התחילו בהוספת ציוד, שירות או בתכנון מערכת מלאה  

CTAs: primary add · secondary System Builder · tertiary browse catalog. Not styled as an error.

---

## 9. Quote item treatment

- Section head + count/net; line rows keep commercial fields  
- Kai surfaces / spacing; no spreadsheet chrome added  
- No pricing math in UI  

---

## 10. Summary redesign

- Sticky desktop rail  
- Strongest number: **סה״כ לתשלום** (server totals only)  
- Secondary: before VAT, VAT, discounts when present  
- Cost/margin still permission-gated  

---

## 11. Readiness redesign

- Title: **מוכנות לשליחה**  
- Unresolved only; labels **חוסם שליחה** vs **מומלץ** from existing gap severity  
- Site / validity recommended (not blockers) when that is the product rule  
- Actionable CTAs (בחירת לקוח / הוסף להצעה / הגדרה)  
- Misleading “0%” when ready avoided; percent shown only when useful mid-progress  
- **Send validation logic unchanged**  

---

## 12. RTL decisions

- Hebrew-first copy; kickers above values  
- Back arrow mirrors in RTL  
- `ltr-meta` for phone / money / version  
- Summary and readiness CTA columns compose naturally RTL  

---

## 13. Responsive behavior

| Width | Behavior |
| --- | --- |
| 1440 / 1280 | Two-column; composition dominates |
| ~1100 | Rail remains; composition shrinks; no horizontal overflow (QA) |
| ≤ mobile breakpoints | Existing single-column + closed dock/nav stack |

---

## 14. Mobile regression protection

Closed architecture preserved:

- One Quote dock + one AppShell nav layer  
- Clearance / padding-bottom model (QA: `mainPadBottom` ≈ `168px` at 360/390)  
- Summary-on-demand + feedback FAB offset not redesigned  
- Mobile action semantics / short Add label unchanged  

---

## 15. Accessibility

- Semantic buttons / regions (`מוכנות לשליחה`, summary heading)  
- Focusable skip-to-content retained  
- Save `aria-live="polite"`  
- No clickable-div replacements for primary actions  
- Contrast via existing tokens in Light/Dark  

---

## 16. Files changed (this redesign)

Presentational focus:

- `apps/web/src/components/quotes/workspace/QuoteHeader.tsx`
- `apps/web/src/components/quotes/workspace/QuoteContextBar.tsx`
- `apps/web/src/components/quotes/workspace/UnifiedReadiness.tsx`
- `apps/web/src/components/quotes/workspace/QuoteSaveIndicator.tsx` (consumption)
- `apps/web/src/components/quotes/cpq/QuoteLinesPanel.tsx`
- `apps/web/src/components/quotes/cpq/QuoteSummaryAside.tsx`
- `apps/web/src/i18n/he.ts` (labels / readiness / empty / context)
- `apps/web/src/styles.css` (Kai Quote Builder block)
- `apps/web/tests/quote-system-apply.test.tsx` (selector updates for new primary Add label)
- `apps/web/scripts/quote_builder_kai_desktop_qa.mjs`
- `Docs/QUOTE-BUILDER-KAI-DESKTOP-REDESIGN.md`
- `Docs/quote-builder-kai-desktop-qa/*`

---

## 17. Exact tests / build results

```text
vitest: quote-builder.test.tsx — 19 passed
vitest: quote-system-apply.test.tsx — 5 passed
vitest: quote-mobile-actions.test.tsx — 10 passed
vitest: quote-readiness-unified.test.ts — 1 passed
vitest: quote-composition-a2 / line-row / section-name / lifecycle — 29 passed
vitest: cctv-build-system / cctv-design-persistence / cctv-sizing / system-section — 55 passed
tsc -p tsconfig.json --noEmit — pass
npm run build (vite + tsc) — pass
```

---

## 18. Screenshots produced

Under `Docs/quote-builder-kai-desktop-qa/`:

- `desktop-1440-light.png`
- `desktop-1440-dark.png`
- `desktop-1280-light.png`
- `narrow-desktop-1100-light.png`
- `mobile-390-light.png`
- `mobile-390-dark.png`
- `mobile-360-light.png`
- `report.json`

---

## 19. Protected systems confirmed unchanged

| System | Status |
| --- | --- |
| Quote pricing / VAT / discounts (server-owned) | Unchanged |
| Autosave / createOnce | Unchanged |
| Send / Share / Preview / PDF / public approval | Unchanged |
| Project handoff | Unchanged |
| CCTV sizing / recommendation | Unchanged (55 tests pass) |
| Durable System Design R1–R3 / atomic Apply / ownership / divergence | Untouched |
| RLS / authz catalog / API contracts | Untouched |
| Mobile dock z-index / clearance model | Preserved |

---

## Remaining visual notes (non-blocking)

- Empty-customer context still expands the full picker form (by design so Send-critical customer is reachable). Further fold of lead/title into a second disclosure could tighten the first viewport more.  
- Send confirm dialog still uses emoji checklist when opened (separate surface; not the sticky readiness rail).  
- Feedback FAB can overlap fields on narrow mobile (pre-existing; offset model not redesigned here).  
