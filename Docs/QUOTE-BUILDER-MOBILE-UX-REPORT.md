# Quote Builder — Mobile UX + Sticky Layer Correction

**Date:** 2026-09-22  
**Scope:** Mobile presentation only for existing Quote Builder  
**Status:** Complete. **Stopped.**

## NO QUOTE / CPQ / PRICING / BUSINESS LOGIC CHANGED

Confirmed: no edits to pricing calculations, totals sources, VAT/discount math, quote payloads, mutations, validation semantics, lifecycle, PDF, CCTV, catalog pricing, `can()`/`authorize()`, RLS, or plan entitlements. Totals still render `formatMoney(live.total_gross, currency)` only.

---

## Root cause — “טרם נשמר” followed the user

| Finding | Detail |
|---|---|
| **Cause** | Entire `QuoteHeader` used Tailwind `sticky top-0 z-20`. |
| **Amplifier** | On mobile, `.cpq-save-state-inline` spanned `grid-column: 1 / -1` with padded bordered background → looked like a **large white band**. |
| **Scroll owner** | Primary scroll is `.ops-main` (`overflow-y: auto`), so the sticky header stuck to the top of that container while content scrolled underneath. |
| **Not** | A separate sticky on the save indicator alone. |

---

## Sticky layer map

### BEFORE

| ELEMENT | POSITION | OFFSET | Z | MOBILE | DESKTOP | SHOULD STAY STICKY? |
|---|---|---|---|---|---|---|
| AppShell chrome | fixed / shell | top | high | yes | yes | yes (unchanged) |
| Quote header (incl. טרם נשמר + stepper) | **sticky** | top: 0 | 20 | yes | yes | **no on mobile** |
| Quote mobile summary sheet handle | fixed | above actions | 38–39 | yes | no | **no when closed** |
| Quote mobile actions bar | fixed | above bottom nav | 45 | yes | no | yes (single bar) |
| Floating AppShell nav | fixed | safe-area bottom | 40 | yes | no | yes (unchanged) |

### AFTER

| ELEMENT | POSITION | OFFSET | Z | MOBILE | DESKTOP | NOTES |
|---|---|---|---|---|---|---|
| AppShell chrome | unchanged | — | — | yes | yes | untouched |
| Quote header | **relative** (mobile) / sticky (desktop ≥1024) | desktop top: 0 | 1 / 20 | scrolls away | sticky | save = compact pill |
| Stepper | in-flow under header | — | — | scrolls with header | desktop stepper | short Hebrew labels |
| Quote summary sheet | **hidden when closed** (docked) | opens from total chip | 38–39 | on demand | n/a | no permanent handle |
| Quote actions bar | fixed | one row above nav | 45 | yes | hidden | total + add + preview + primary + overflow |
| Floating AppShell nav | unchanged | — | 40 | yes | n/a | padding via `--cpq-mobile-actions-offset` |

**Sticky budget met:** mobile top = AppShell only (quote header scrolls). Mobile bottom = one quote action bar + existing floating nav.

---

## Presentation changes

| Area | Change |
|---|---|
| **Header** | Removed mobile sticky; compact title + status + save pill; desktop sticky preserved via CSS |
| **Stepper** | Short Hebrew labels (פרטים / פריטים / תמחור / בדיקה) + icons; existing steps only |
| **Customer** | Progressive disclosure: choose → search **or** create (existing mutations/queries unchanged) |
| **Surfaces** | Mobile: less card-in-card on context / empty customer |
| **Bottom** | Single compact actions row; collapsed summary handle removed; total chip opens existing sheet |
| **Offsets** | `--cpq-mobile-actions-offset` reduced (~3.85rem); sheet offset 0 when closed |

---

## Files changed

| Path | Why |
|---|---|
| `apps/web/src/components/quotes/workspace/QuoteHeader.tsx` | Drop Tailwind sticky; mobile title |
| `apps/web/src/components/quotes/workspace/QuoteMobileActionsBar.tsx` | One-row action bar |
| `apps/web/src/components/quotes/workspace/QuoteMobileSheet.tsx` | Hide docked handle when closed |
| `apps/web/src/components/quotes/QuoteBuilder.tsx` | `customerEntryMode` presentation only |
| `apps/web/src/styles.css` | Sticky budget, compact chrome, denser mobile surfaces |
| `apps/web/scripts/quote_builder_mobile_qa.mjs` | Scroll QA against `.ops-main` |
| `Docs/quote-builder-mobile-qa/*` | Screenshots + `report.json` |
| `Docs/QUOTE-BUILDER-MOBILE-UX-REPORT.md` | This report |

---

## Scroll QA (390 Light)

| Position | Unsaved `top` | `.ops-main` scrollTop | Result |
|---|---|---|---|
| Top | ~89 | 0 | Compact pill in header |
| Mid | **−454** | 543 | Unsaved **off-screen** (does not follow) |
| Bottom | **−945** | 1034 | Still off-screen |

Probe: header `position: relative` on mobile.

---

## Screenshots

Under `Docs/quote-builder-mobile-qa/`:

- `quote-mobile-390-top-light.png`
- `quote-mobile-390-mid-light.png`
- `quote-mobile-390-bottom-light.png`
- `quote-mobile-390-top-dark.png`
- `quote-mobile-360/375/430-light.png`
- `quote-tablet-768-light.png`
- `quote-desktop-1280-light.png`
- `quote-desktop-1440-light.png`
- `report.json`

---

## Tests

| Suite | Result |
|---|---|
| `quote-mobile-actions.test.tsx` | Pass |
| `quote-builder.test.tsx` | Pass |
| `quote-cpq.test.ts` | Pass |
| `npm run typecheck` | Pass |
| `npm run build` | Pass |

Financial/CPQ unit expectations unchanged.

---

## Known limitations

1. Quote lines “add” chip cluster inside `QuoteLinesPanel` remains dense on mobile — out of this sticky-budget pass (no CPQ rewrite).
2. Desktop Quote Builder intentionally keeps sticky header + sidebar; not converted to mobile chrome.
3. AppShell chat FAB still floats (global shell; not Quote Builder sticky stack).

---

## FINAL MOBILE BOTTOM STACK CORRECTION

**Date:** 2026-09-22  
**Scope:** Surgical layout/composition only for ≤767 (inspected 768). Approved prior Quote Builder mobile UX left intact.  
**Status:** Complete. **Stopped.**

### Root cause

| Finding | Detail |
|---|---|
| **Primary** | `QuoteMobileActionsBar` is portaled to `document.body`, so it **does not inherit** `.ops-shell`’s `--ops-bottom-nav-offset`. CSS fell back to ~60px and the dock **overlapped** the real floating nav (68px height + 10px bottom inset). |
| **Amplifier** | Closed summary still contributed a permanent “סיכום הצעה” / totals handle layer above the dock → **three** Quote bottom layers + AppShell nav. |
| **Crowding** | Dock permanently showed הוסף + תצוגה מקדימה + primary at equal weight → tall / squeezed row on ≤390. |

### BEFORE — bottom layers (≤767)

1. Permanent summary handle (“סיכום הצעה” / total mini)
2. Totals / readiness chrome
3. Full Quote actions row (add + preview + send + overflow)
4. AppShell floating nav

Dock `bottom` ≈ 60px → overlap with nav (~18px in live probe).

### AFTER — bottom layers (≤767, summary CLOSED)

1. **One** compact Quote Builder action dock (~66px)
2. **One** AppShell floating nav (unchanged)

Deliberate **8px** gap (`--cpq-dock-gap`). Overlap = **0**.

Summary CLOSED = **zero-height** visual layer (`display: none` on docked sheet; root `visibility: hidden`).

### AppShell nav geometry (measured)

| Token / element | Value |
|---|---|
| `.ops-bottom-nav` height | `var(--premium-nav-height, 68px)` → **68px** |
| `.ops-bottom-nav` bottom | `10px + safe-area` |
| `--ss-mobile-nav-reserve` | `68px + 10px + safe-area` (= **78px** when safe-area = 0) |
| Dock `bottom` | `reserve + --cpq-dock-gap (8px)` → **86px** (probe `bottomCss: 86px`) |
| Dock height (QA) | **66px** (target 56–68) |
| Gap dock→nav | **8px** |
| z-index | dock **45** / nav **40** / open sheet root **55** |

### Action placement (same handlers; presentation only)

| Action | Where |
|---|---|
| Total (`live.total_gross` via existing `formatMoney`) | Dock total chip → opens existing summary sheet |
| Primary CTA (e.g. שליחה לאישור) | Dock primary — same enablement / mutations |
| הוסף | Overflow “עוד” (+ still available in-flow on lines empty state) |
| תצוגת לקוח / preview | Overflow “עוד” |
| Low-frequency more-menu items | Existing overflow panel (unchanged) |

### Summary sheet

| State | Behavior |
|---|---|
| Closed | No permanent “סיכום הצעה” bar; access via dock total + chevron |
| Open | Existing `QuoteMobileSheet` content; Escape / handle / swipe dismiss; body scroll lock cleared on close |
| After dismiss | No ghost height, no stuck `body` overflow, dock geometry restored |

### Content bottom reservation

```
padding-bottom = --cpq-mobile-actions-offset (3.25rem)
               + --ss-mobile-nav-reserve
               + 0.75rem
```

Last catalog search / empty-state controls clear both persistent layers (390 bottom scroll verified).

### QA

| Check | Result |
|---|---|
| 360 closed | PASS — dock + nav, gap 8, overlap 0 |
| 390 mid-scroll closed | PASS — scrollY 543 |
| 390 bottom closed | PASS — no summary ghost |
| 390 summary open | PASS |
| 390 closed after summary | PASS |
| 390 dark | PASS — dock / nav distinguishable |
| 768 | PASS — same mobile dock architecture |
| 1440 | PASS — desktop sidebar/actions intact; no mobile dock |

Screenshots under `Docs/quote-builder-mobile-qa/`:

- `quote-bottom-360-closed-light.png`
- `quote-bottom-390-closed-light.png`
- `quote-bottom-390-mid-closed-light.png`
- `quote-bottom-390-summary-open-light.png`
- `quote-bottom-390-closed-after-summary-light.png`
- `quote-bottom-390-closed-dark.png`
- `quote-bottom-768-light.png`
- `quote-bottom-1440-light.png`
- `bottom-stack-report.json`

### Tests

| Suite | Result |
|---|---|
| `quote-mobile-actions.test.tsx` | Pass |
| `quote-builder.test.tsx` | Pass |
| `quote-cpq.test.ts` | Pass |
| `npm run typecheck` | Pass |
| `npm run build` | Pass |

### Business logic

**Untouched:** quote calculations, CPQ, pricing, discounts, VAT, `live.total_gross` source, payloads, mutations, approval/send semantics, permissions, customer behavior, lifecycle, PDF, catalog, backend, API, RLS, authz.

### Files touched (this correction)

| Path | Why |
|---|---|
| `QuoteMobileActionsBar.tsx` | Compact dock: total→summary + primary + overflow (add/preview) |
| `QuoteMobileSheet.tsx` | Escape dismiss; closed docked = no handle layer |
| `styles.css` | `--ss-mobile-nav-reserve`, dock offset, sheet closed zero-height, content padding |
| `quote-mobile-actions.test.tsx` | Overflow placement expectations |
| `scripts/quote_builder_bottom_stack_qa.mjs` | Geometry + summary open/close screenshots |
| `Docs/quote-builder-mobile-qa/*` | Bottom-stack shots + JSON |
| `Docs/QUOTE-BUILDER-MOBILE-UX-REPORT.md` | This section |

---

## FLAGSHIP QUOTE BUILDER FINALIZATION

**Date:** 2026-09-22  
**Route:** `/app/quotes/new` (flagship workflow)  
**Scope:** Presentation / composition / hierarchy only  
**Status:** Complete. **Stopped.**

### NO QUOTE / CPQ / PRICING BUSINESS LOGIC CHANGED

Confirmed: no edits to pricing, discounts, VAT, totals source (`live.total_gross`), line math, CCTV sizing/recommendations, quote payloads, mutations, approval semantics, permissions, customer API, PDF snapshot behavior, RLS, or authz.

---

### P0 — Content behind AppShell nav

#### Root cause

| Layer | Problem |
|---|---|
| **Double padding** | `.ops-main` already reserved `--ops-bottom-nav-offset` (~105px) **and** `.quote-builder` reserved dock+nav again (~142px) → stacked void **or** inconsistent ownership when one path lost tokens. |
| **Portal escape** | Quote dock is portaled to `document.body`, so shell tokens did not apply consistently. |
| **Translucent dock** | Semi-transparent dock allowed scrolled text to remain readable through the persistent layer. |
| **Capsule gutters** | Floating nav is inset 12px — text could remain visible in side gutters of the nav band. |
| **Brief regression** | An early dock `::after` shield lived in the dock’s `z-index: 45` context and **painted over** the AppShell nav (`z-index: 40`). Fixed by moving the scrim to `html::before` at `z-index: 35`. |

#### Actual geometry (390×844, measured)

| Element | Value |
|---|---|
| AppShell nav height | **68px** (`--premium-nav-height`) |
| Nav bottom offset | **10px** + safe-area |
| `--ss-mobile-nav-reserve` | **78px** (safe-area 0) |
| Quote dock height | **66px** |
| Dock bottom | reserve + **8px** gap → **86px** |
| Dock↔nav gap | **8px** |
| `--quote-mobile-bottom-clearance` | dock + gap + nav-reserve + **1rem** ≈ **168px** on `.ops-main` |
| Scroll-end clearance above dock | **~33px** breathing |
| Text behind nav at scroll-end | **0** (leaf content) |

#### Reserved bottom-space model

```
CONTENT
  ↓
--quote-mobile-bottom-clearance   (owned by .ops-main under html:has(.quote-builder))
  ↓
QUOTE ACTION DOCK                 (opaque, z=45)
  ↓  --cpq-dock-gap (8px)
APPSHELL FLOATING NAV             (z=40)
  ↓
safe-area / --ss-mobile-nav-reserve
```

Tokens set on `html:has(.quote-builder.cpq-builder)` so portaled dock + feedback inherit the same model. Quote-local only — AppShell not redesigned globally.

Nav-band scrim: `html:has(.quote-builder)::before` at `z-index: 35` (below nav, above page).

Feedback launcher on this route: raised to sit above the clearance (`z-index: 44`).

---

### Quote journey audit (current implementation)

| Stage | Primary task | Persistent | Progressive |
|---|---|---|---|
| Entry `/app/quotes/new` | Start draft quote | AppShell + dock | — |
| Identity / header | Know which quote + save state | Compact header (scrolls on mobile) | Stepper labels |
| Customer | Assign or create customer | Context bar when set | choose → search **or** create |
| Details | Title, validity, site, project | — | Accordion / more details |
| System / design | Build CCTV/system packages | — | System builder drawer |
| Catalog / items | Add & edit lines | Scope panel | Empty CTAs vs toolbar |
| Pricing | Trust live totals | Dock total | Summary sheet |
| Summary | Completeness + totals | Total chip | Sheet / desktop rail |
| Preview | Customer view | Overflow | Existing preview route |
| Approval | Send when ready | Dock primary (same enablement) | — |

---

### UX issues found → presentation fixes

| Issue | Fix |
|---|---|
| P0 occlusion / double reserve | Single clearance owner + opaque dock + gutter scrim |
| Empty scope duplicated add chips + empty CTAs | Hide `.cpq-scope-toolbar.is-empty` on ≤767 |
| Mobile density | Tighter content-panel / empty padding; 2-col empty actions ≥480 |
| Feedback FAB in dock zone on quote | Quote-local bottom using clearance token |
| Summary closed ghost | Unchanged from prior pass (docked sheet zero-height) |

**Not changed (by design):** CCTV/system logic, line pricing, desktop sticky header ≥1024, customer mutations, sticky budget (still one dock + nav).

---

### Composition

**Mobile ≤767:** scrollable workspace → one opaque Quote dock → gap → AppShell nav. Summary on demand from total chip.

**Desktop 1280/1440:** existing main workspace + summary sidebar rail; no mobile dock; actions in header/sidebar.

---

### Action hierarchy (preserved semantics)

| Action | Mobile placement |
|---|---|
| Total (`live.total_gross`) | Dock → opens summary |
| Primary CTA (send / lifecycle) | Dock primary |
| הוסף / תצוגת לקוח | Overflow “עוד” (+ in-flow empty/scope when relevant) |

---

### Kai craftsmanship used (not fintech look)

Compact dock rhythm · progressive disclosure · bottom-sheet quality · touch targets · spacing discipline · operational rows — **no** banking chrome / purple / card metaphors.

---

### RTL / bidi

Existing `ltr-meta` on currency, phones, IDs retained. No new mixed-direction regressions introduced.

---

### Accessibility

Summary Escape dismiss retained. Dock total remains keyboard-focusable summary entry. Body scroll lock clears on sheet close.

---

### Product acceptance

1. **New office user:** Journey reads as quote workspace (stepper + customer choose + scope empty CTAs + total + next action) — **YES**  
2. **Experienced user:** Less duplicate chrome; dock keeps total + primary — **YES**  
3. **360/390 last content vs nav:** Scroll-end clearance ~33px; leaf text behind nav = 0 — **YES**

---

### Tests

| Suite | Result |
|---|---|
| Full `apps/web` vitest (52 files / 363 tests) | Pass |
| quote-mobile-actions / quote-builder / quote-cpq | Pass |
| cctv-sizing / cctv-build-system / quote-system-apply / system-section | Pass |
| typecheck | Pass |
| production build | Pass |

Financial/CPQ expectations **not** updated.

---

### Screenshots

Under `Docs/quote-builder-flagship-qa/`:

- `flagship-360-bottom-light.png`
- `flagship-375-bottom-light.png`
- `flagship-390-top-light.png`
- `flagship-390-customer-light.png`
- `flagship-390-mid-light.png`
- `flagship-390-items-light.png`
- `flagship-390-bottom-light.png`
- `flagship-390-summary-open-light.png`
- `flagship-390-summary-closed-after-light.png`
- `flagship-390-bottom-dark.png`
- `flagship-430-bottom-light.png`
- `flagship-1280-light.png`
- `flagship-1440-light.png`
- `flagship-1440-dark.png`
- `report.json`

---

### Known limitations

1. Global FeedbackCenter FAB can still sit near last fields horizontally (raised vertically on quote route only).  
2. Mid-scroll content still passes under opaque fixed chrome (expected); readable-through-nav is blocked by opaque dock + nav-band scrim.  
3. Scope empty-state vs catalog search still share vertical space — further densification deferred.  
4. Desktop form column still has some unused vertical air — left intact to avoid broad layout rewrite.

### Files touched

| Path | Why |
|---|---|
| `apps/web/src/styles.css` | Bottom-space model, opaque dock, nav-band scrim, mobile density |
| `apps/web/src/components/quotes/cpq/QuoteLinesPanel.tsx` | `cpq-scope-toolbar is-empty` presentation class |
| `apps/web/scripts/quote_builder_flagship_qa.mjs` | Flagship + P0 QA |
| `apps/web/scripts/quote_p0_occlusion_probe.mjs` | Geometry probe |
| `Docs/quote-builder-flagship-qa/*` | Screenshots + JSON |
| `Docs/QUOTE-BUILDER-MOBILE-UX-REPORT.md` | This section |

---

**STOP.** Awaiting approval. No PDF Studio / Dashboard / Landing / backend work started.
