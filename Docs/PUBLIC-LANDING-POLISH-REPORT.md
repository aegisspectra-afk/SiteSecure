# PUBLIC LANDING POLISH REPORT

**Date:** 2026-09-22  
**Scope:** Public SITE SECURE homepage only (`/`)  
**Status:** Complete. **Stopped.**

Public site remains **fixed dark**. No `/app`, auth, backend, or Phase 3 work.

---

## Files inspected

- `apps/web/src/components/public/PublicHome.tsx`
- `apps/web/src/components/public/PublicSurfaces.tsx`
- `apps/web/src/components/public/PublicChrome.tsx`
- `apps/web/src/i18n/public-he.ts`
- `apps/web/src/styles.css` (public section)
- `apps/web/src/lib/theme.ts` (`isBrandDarkPath`)
- `apps/web/tests/public.test.tsx`
- Kai craftsmanship refs (not ported):  
  `Fintech App UI/card_app/lib/screens/home_screen.dart`  
  `card_hero.dart`, `metallic_card.dart`, `transaction_tile.dart`, `pill_button.dart`

## Files changed

| File | Change |
|---|---|
| `PublicHome.tsx` | Hero hierarchy; section rhythm; remove Numbers; Explore → `/#site-file`; Intelligence conceptual badge |
| `PublicSurfaces.tsx` | Preview/dossier/chaos/field/ops density polish; remove MetricsStrip |
| `public-he.ts` | Hebrew support as single quiet line; conceptual badge copy; drop numbers strings |
| `styles.css` | Typography integrity; scene densities; product-object hairlines; chaos contrast; mobile hero |
| `tests/public.test.tsx` | Numbers removed; Explore href; conceptual badge |

---

## Kai references used

Borrowed **craft only** (not fintech semantics):

- Object-like product surfaces (controlled edge light / hairline, not heavy glass)
- Dense operational row language (`transaction_tile` spacing discipline)
- Restrained press/hover feedback language (CSS only)
- Mobile device frame as a composed object (`FieldPhone`)

No Flutter port. No new runtime animation dependency.

---

## Hero changes

- Order preserved: eyebrow → H1 → product definition → support → Hebrew (quieter) → CTAs → preview
- English-led identity kept; Hebrew combined into one deliberate secondary line (`lang="he"`)
- Typography: less aggressive tracking; `word-spacing`; intentional line blocks; desktop `nowrap` so lines never crush into `OPERATIONSFOR` / `REALWORLD`
- Measured @1440 / 390: each H1 line is a single rendered line
- Preview: SITE SECURE blue top hairline, subtler depth, clearer internal hierarchy — still marketing PREVIEW, not live data

## Story-flow changes

Preserved sequence; varied section density (`air` / `default` / `tight`) so pacing is not one identical card stack.

| Section | Question answered |
|---|---|
| 01 Fragmented | Why SITE SECURE exists |
| 02 Site File | Central operational record |
| 03 Digital Twin | Physical hierarchy / context |
| 04 Operational Chain | Continuous work history |
| 05 Field | Office → technician day |
| 06 Intelligence | Conceptual attention preview |
| 07 Security | Access / isolation controls |
| Pilot | Early Access conversion |

## Sections preserved

Hero, Live preview, Fragmented, Site File, Digital Twin, Operational Chain, Field, Intelligence, Security, Early Access CTA, Footer, skip-link, sticky header, legal links.

## Numbers section removal

Removed **SITE SECURE IN NUMBERS** (`#numbers` / MetricsStrip). Story goes Security → Pilot CTA. No replacement fake metrics.

## CTA / anchor corrections

| Control | Destination |
|---|---|
| Start Your Workspace | `/register` (guest) / workspace paths when signed in |
| Explore the Platform | `/#site-file` (homepage Site File) |
| Nav Platform | `/#operations` |
| Nav Site File / Twin / Security | `/#site-file`, `/#twin`, `/#security` |
| Explore Security | `/legal/security` |
| Early Access footer | `/#pilot` |
| Contact | `mailto:info@aegisspectra.co.il` |

Not linking Explore to `/register#site-file`.

## Intelligence claim handling

- Badge: **CONCEPTUAL PREVIEW**
- Subcopy + panel disclaimer preserved
- No AI / prediction / live monitoring claims

## Security claim handling

Unchanged pillars (RBAC, workspace isolation, RLS, auth, auditability, data protection). No SOC2 / ISO / GDPR certification claims. Trust page CTA preserved.

## Mobile composition

@390: shorter hero padding, readable H1 (single lines), stacked CTAs, preview continues below fold, no horizontal overflow. Field phone denser. Ops rail remains horizontal-scrollable without page overflow.

## Accessibility

- Skip link `דלגו לתוכן` preserved
- Single H1; section H2 manifests
- Focus-visible patterns unchanged
- `prefers-reduced-motion` respected (chaos/ops timers already gated; CSS transitions disabled)

## Responsive QA

Screenshots: `Docs/public-landing-qa/`

- Heroes: 390, 430, 768, 1280, 1440, 1440-short
- Full pages + section crops
- Reduced-motion 1280
- `report.json`: no overflowX; all anchors present; numbers absent

## Claim audit (internal)

| Kind | Examples |
|---|---|
| SHIPPED PRODUCT FACT | Workspace ops platform framing; Site File dossier concept; RBAC/RLS/isolation language aligned to product |
| CONCEPTUAL PREVIEW | Intelligence panel + badge + disclaimer |
| MARKETING POSITIONING | Hero manifesto; Early Access CTA; Fragmented→One system story (no fake integrations) |

## Tests

- `tests/public.test.tsx`: **4 passed**
- typecheck: pass
- production build: pass
- changed-file lint: pass

## Safety

No `/app` redesign, Dashboard, auth behavior, API, DB, RBAC, RLS, entitlements, quotes, pricing, PDF, jobs, Payment Details, or new dependencies.

---

# KAI PATTERN EXTRACTION

**Date:** 2026-09-22 (extension of landing polish)  
**Note:** The purchased Kai tree in-repo does **not** contain separate Analytics / Send Money / Add Card product screens. Closest sources were inspected and mapped below.

## Kai files inspected

| File | Role |
|---|---|
| `lib/screens/home_screen.dart` | Focal dark header + metallic card + transaction sheet |
| `lib/screens/profile_view.dart` | Identity → important object → clean menu rows |
| `lib/screens/card_selection_screen.dart` | Selected object hierarchy / carousel craft |
| `lib/widgets/metallic_card.dart` | Layered product object |
| `lib/widgets/card_hero.dart` | Object flight / dominance |
| `lib/widgets/transaction_tile.dart` | Row grammar |
| `lib/widgets/pill_button.dart` | Compact press-scale action |
| `lib/widgets/app_bottom_nav.dart` | Floating selected-state nav |
| `lib/widgets/kyc/kyc_field.dart` (`KycSegmented`) | Sliding selected pill |
| `lib/widgets/kyc/birth_date_sheet.dart` | Bottom sheet progressive disclosure |
| `lib/screens/order_confirmation_screen.dart` | Action hierarchy |
| `lib/theme/app_colors.dart` | Kai palette (not imported) |

### Screens requested vs found

| Requested | In-repo equivalent |
|---|---|
| HOME | `home_screen.dart` `_HomeView` |
| ADD CARD bottom sheet | Not present as Add Card; closest: `birth_date_sheet.dart` + card selection route |
| TRANSACTIONS / ACTIVITY | `_TransactionSheet` + `transaction_tile.dart` |
| ANALYTICS | No dedicated screen — composition borrowed from Home dominant dark surface |
| PROFILE | `profile_view.dart` |
| SEND MONEY / RECIPIENT LIST | No dedicated screen — row grammar from transactions/profile menus |

## Pattern → application matrix

| SCREEN / SOURCE | PATTERN EXTRACTED | USED NOW? | WHERE? | RESERVED FOR PHASE 3? |
|---|---|---|---|---|
| Home | Focal product object + supporting sheet | YES | Hero layered live console | — |
| Home | One dominant dark surface | YES | Site File dossier; Chaos “after”; Twin leaf; Intelligence | — |
| Home / Transactions | Row-based information | YES | Equipment, devices, attention, site meta, pillars | Operational rows in /app |
| Profile | Identity → summary → rows | YES | Site File identity band + metrics + meta rows | — |
| KycSegmented | Selected/unselected segmented control | YES | Site File preview tabs (demo content only) | Mobile selected-state in FieldJob |
| Pill button | Compact press feedback (180–200ms) | YES | Preview actions (`Start Work`, `Review Issues`) via CSS | — |
| Metallic / CardHero | Soft layering without 3D | YES | Hero stack; Twin depth plates | — |
| Card selection | Hierarchy + selected leaf | YES | Digital Twin rail → leaf object | — |
| App bottom nav | Floating mobile nav craft | NO | — | YES |
| Birth date sheet | Bottom sheet progressive disclosure | NO | — | YES |
| Profile menu rows | Dense nav rows | PARTIAL | Landing rows only | Technician quick-action strip |

## Applied now (landing only)

- **Hero:** layered focal live-ops object; row equipment list; compact in-product `Start Work` vs website CTAs
- **Site File:** dossier identity hierarchy; segmented preview tabs; device/meta rows; asymmetric desktop split
- **Digital Twin:** depth plates + selected leaf surface; hierarchy readable before copy
- **Field:** denser native phone object; row equipment; compact Start Work
- **Intelligence:** attention rows on one surface; CONCEPTUAL PREVIEW badge preserved
- **Section rhythm:** asymmetric splits (Site File / Twin / Field / Intelligence) vs full-width Ops / Security
- **Numbers section:** remains removed

## KAI PATTERNS RESERVED FOR PHASE 3

Do **not** implement in authenticated product during this pass:

1. **Mobile bottom sheets** (Kai `birth_date_sheet` grammar) — FieldJob progressive disclosure
2. **Technician quick-action strip** — compact circular/shortcut actions from Home greeting
3. **Floating selected-state bottom nav craft** (`app_bottom_nav` puck) — only if AppShell work is approved later
4. **Operational row lists in /app** — Today / Jobs / Service using `transaction_tile` density
5. **Mobile selected-state controls** — FieldJob filters / day segments
6. **Technician-focused mobile composition** — native FieldJob screens (not landing previews)

## Final visual questions

| Question | Answer |
|---|---|
| Generic SaaS if branding removed? | **No** — site IDs, floors, devices, field job, warranty/service rows remain domain-specific |
| Looks like fintech? | **No** — no cards/balances/charts/purple; SITE SECURE blue + graphite + operational objects |

## QA (Kai extension)

`Docs/public-landing-qa/` refreshed: 390/430/768/1280/1440 heroes + full pages; section crops.  
`report.json`: no overflowX; focal/segment/dossier/rows present; numbers absent; Explore → `/#site-file`.

## Tests (re-run)

- `tests/public.test.tsx`: pass
- typecheck: pass
- production build: pass

---

### STOP

Kai pattern extraction applied to the **public landing only**.  
**Do not** start Phase 3.  
**Do not** modify authenticated modules.  
Wait for approval.
