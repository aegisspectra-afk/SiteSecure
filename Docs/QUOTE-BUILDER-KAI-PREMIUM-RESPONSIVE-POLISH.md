# Quote Builder — Kai Premium Responsive Polish

**Baseline:** First Kai desktop redesign (`Docs/QUOTE-BUILDER-KAI-DESKTOP-REDESIGN.md`) — not reverted.  
**Scope:** Second visual/UX polish pass for **desktop + mobile**. Presentation only.  
**Frozen:** Mobile dock architecture, pricing/lifecycle, System Design R1–R3, DB/GitHub/credentials, Equipment Intent discovery.

---

## 1. Visual audit (from prior QA)

Inspected `Docs/quote-builder-kai-desktop-qa/` (1440 L/D, 1280, 1100, 390 L/D, 360).

| Weakness | Finding |
| --- | --- |
| Header | Title was a single flat string; status chips felt generic |
| Context | Empty customer opened a long form before composition |
| Totals | Numbers present but not “financial-grade” weight/alignment |
| Lines | Border-heavy grid; line total under-emphasized |
| Empty | Functional; still slightly generic |
| Readiness | Actionable, but % / missing-count less completion-oriented |
| Mobile header | Identity/status competed; save pill ok |
| Mobile context | Full metadata form dominated first viewport |
| Mobile dock | Correct architecture; total typography under-weighted |
| Dark | Solid, but surfaces needed quieter elevation |

---

## 2. Desktop improvements

- Split identity: kicker **הצעת מחיר** + authoritative **`#Q-…`**
- Status/version: compact squared chips (calm transaction states)
- Quiet save retained (single indicator)
- Context remains metadata surface; composition card elevated with soft Kai shadow
- Summary: price lines + divider + stronger `סה״כ לתשלום` tabular total
- Readiness: **`N מתוך M פרטים הושלמו`** (existing items only)
- Empty: soft radial surface (not dashed upload box); Add + Build System primary paths

---

## 3. Mobile improvements

- Header: title stack (muted label + bold `#number`); denser save/status
- Context accordion **defaults closed** (desktop still always shows body via CSS); readiness still opens it
- Empty composition: stacked full-width CTAs at ≤639px
- Line rows: stacked commercial card (desc → qty/price → emphasized line total + quiet actions)
- Dock: blur + stronger tabular total; **geometry / z-index / clearance unchanged** (`mainPadBottom` ≈ 168px; dockH ≈ 69px)
- Summary sheet: keeps on-demand model; money weight improved

---

## 4. Kai principles strengthened

Calm density · financial number hierarchy · compact status · surface layering · deliberate CTAs · precision · confidence — **without** banking terminology/widgets.

---

## 5. Financial-number treatment

- `font-variant-numeric: tabular-nums`
- Shared `--cpq-money-tracking`
- Summary total ~1.75rem / 750 weight
- Line totals labeled **סה״כ שורה** with stronger weight
- Dock total ~1.05rem tabular
- Locale/`formatMoney` / calculations **unchanged**

---

## 6. Context treatment

- Label/value hierarchy reinforced
- Empty customer: compact empty + **בחירת לקוח** hint
- Mobile: collapsed by default; expand for picker/fields
- Desktop: full context body always visible (CSS)

---

## 7. Composition treatment

- Content panel remains hero surface (elevation vs context)
- Primary `הוסף להצעה` / empty `הוסף פריט` + `בנה מערכת` + secondary catalog link preserved

---

## 8. Line-item treatment

- Soft surface + hover (no spreadsheet chrome)
- Mobile stack with total separator row
- Actions grouped in `.cpq-line-actions`
- Permissions / persist semantics unchanged

---

## 9. Summary / readiness treatment

- Subtotal → discounts → VAT → divider → **סה״כ לתשלום**
- Readiness completion copy; blocking vs recommended retained
- No emoji/debug checklist regression
- Validation rules unchanged

---

## 10. Mobile dock treatment

- Visual polish only (blur, shadow, total typography, primary weight)
- Preserved: one dock, AppShell nav layer, `--cpq-mobile-actions-offset`, gap, z-index 45, summary-on-demand, FAB offset, action semantics (`הוסף` overflow, Send short label)

---

## 11. RTL

- `#Q-…` / money / version use `ltr-meta` + `dir="ltr"` where needed
- Back chevron still `rtl:rotate-180`
- Mobile stacked totals align end/start correctly in RTL

---

## 12. Light / Dark

- Light: clearer surface separation + restrained elevation
- Dark: quiet console shadows; empty radial tint; no glow spam
- Verified via 1440 light/dark + 390 dark screenshots

---

## 13. Accessibility

- Semantic header `h1` (sr-only) still `cpqHeaderTitle(...)`
- Regions/buttons unchanged in role
- Focus-visible on dock total retained
- Touch targets: dock primary min-height ~2.65rem; accordion min-height 2.75rem
- Reduced motion: transitions disabled

---

## 14. Responsive behavior

| Viewport | Notes |
| --- | --- |
| 1440 / 1280 | Two-column; title `#Q-…`; no overflow |
| 1100 | Composition shrinks; rail ~352px; no overflow |
| 390 / 360 | Compact header; collapsed context; dock ~69px; clearance 168px; content clears dock |

---

## 15. Before / after (vs first Kai redesign)

| | Clearer | Calmer | More premium | Noise removed | Mobile-specific |
| --- | --- | --- | --- | --- | --- |
| Header | Split kicker/`#` | Quieter chips | Authoritative number | Flat string | Title stack |
| Context | — | Mobile collapsed | Metadata feel | Form-first mobile | Accordion default closed |
| Totals | Tabular hierarchy | Divider | Strong due total | Soft total | Dock total weight |
| Lines | Total emphasis | Softer borders | Card scan | Dense icon row feel | Stack layout |
| Empty | Two paths | Soft surface | Intentional | Dashed vibe | Full-width CTAs |
| Readiness | N/M completed | Thinner bar | Guidance | % badge noise | Same model |

---

## 16. Screenshots

`Docs/quote-builder-kai-premium-qa/`

- desktop-1440-light.png / desktop-1440-dark.png
- desktop-1280-light.png / narrow-desktop-1100-light.png
- mobile-390-light.png / mobile-390-dark.png / mobile-360-light.png
- report.json

Script: `apps/web/scripts/quote_builder_kai_premium_qa.mjs`

---

## 17. Files changed

- `apps/web/src/components/quotes/workspace/QuoteHeader.tsx`
- `apps/web/src/components/quotes/workspace/QuoteContextBar.tsx`
- `apps/web/src/components/quotes/workspace/UnifiedReadiness.tsx`
- `apps/web/src/components/quotes/cpq/QuoteSummaryAside.tsx`
- `apps/web/src/components/quotes/cpq/QuoteLineRow.tsx`
- `apps/web/src/components/quotes/QuoteBuilder.tsx` (accordion default only)
- `apps/web/src/i18n/he.ts` (`cpqReadinessProgress`, `cpqLineTotal`, `cpqHeaderUntitled`)
- `apps/web/src/styles.css` (premium polish block)
- `apps/web/scripts/quote_builder_kai_premium_qa.mjs`
- `Docs/QUOTE-BUILDER-KAI-PREMIUM-RESPONSIVE-POLISH.md`
- `Docs/quote-builder-kai-premium-qa/*`

---

## 18. Exact tests / build

```text
quote-builder.test.tsx                 19 passed
quote-system-apply.test.tsx             5 passed
quote-mobile-actions.test.tsx          10 passed
quote-readiness-unified.test.ts         1 passed
quote-line-row.test.tsx                 9 passed
quote-composition-a2.test.tsx           5 passed
quote-lifecycle-continuity.test.tsx    11 passed
cctv-build-system / persistence / sizing / system-section  55 passed
tsc --noEmit                            pass
vite production build                   pass
```

---

## 19. Protected architecture confirmation

| Guard | Status |
| --- | --- |
| Pricing / VAT / discounts | Unchanged |
| Autosave / createOnce / lifecycle | Unchanged |
| Preview / Share / Send semantics | Unchanged |
| Mobile dock architecture / clearance / z-index | Unchanged (visual only) |
| CCTV + Durable System Design R1–R3 | Untouched (tests pass) |
| Equipment Intent / catalog-independent R3 | Not implemented |
| DB 0054/0055 / Supabase / GitHub credentials | Not touched |

---

## Remaining imperfections

- Empty-customer **desktop** still exposes the full picker form (desktop CSS forces body open) — intentional for Send-critical path.
- Send confirm dialog emoji checklist is a separate surface (not the readiness rail).
- Feedback FAB can still sit near fields on mobile (offset model not redesigned).
- Populated multi-section / ready-to-send visual fixtures were limited to the empty draft QA quote; line-item CSS verified via unit tests + code review.
