# LANDING-V2 PRODUCT-LED HOMEPAGE REPORT

Date: 2026-09-30  
Agent: LANDING-V2  

## SITE SECURE UI Review Checklist

| Bold item | Result |
|---|---|
| Dark mode preserved | PASS — marketing remains dark-first `public-shell` |
| Light mode works | N/A for homepage (intentionally dark-only marketing surface); app light theme untouched |
| Theme tokens reused | PASS — no token/palette rewrite |
| Dark contrast hierarchy | PASS |
| RTL / logical props | PASS for marketing LTR shell; Hebrew secondary copy `dir=rtl`; product snaps show real RTL app |
| Responsive 1440/1032/768/390/360 | PASS — visual QA, no horizontal overflow |
| Bottom Nav untouched | PASS |
| No giant marketing cards in tools | PASS — product tools not modified |
| No neon/glass/mesh | PASS |
| Keyboard / focus-visible | PASS — existing CTA/nav patterns retained |
| prefers-reduced-motion | PASS — friction/field transforms reduced |
| Scope discipline | PASS — no Quote Builder / Today / RBAC / Bottom Nav changes |

Sign-off: Area = Public homepage · Themes = dark marketing · Breakpoints = 1440/1280/1032/768/390/360 · RTL = marketing LTR + HE secondary · Reviewer = agent · Date = 2026-09-30

---

## 1. Existing homepage problems

- Visually strong but conceptual: CSS mock consoles (HeroConsole, SiteFileStage, TwinExplorer, FieldPhone, IntelligencePanel) instead of real product UI.
- Too long: seven storytelling sections including Digital Twin + conceptual Intelligence.
- Quote Builder — the strongest real product — was absent from the page.
- Intelligence “3 things require attention” competed with live capabilities.
- Secondary CTA pointed at Site File; nav included Digital Twin.

## 2. Final information architecture

1. Hero (real Quote Builder snapshot)
2. Quote Builder
3. Operational Chain strip
4. Site File
5. Installed Assets
6. Field Operations (Today + FieldJob)
7. Compact Before/After friction
8. Security
9. Early Access CTA

Removed as major sections: Fragmented Operations (oversized), Digital Twin, Intelligence conceptual preview.

## 3. Hero

- Eyebrow: `SITE SECURE / SECURITY OPERATIONS PLATFORM`
- Headline: `SECURITY OPERATIONS. / ONE SYSTEM.`
- Support: first contact → quote → installation → assets → service
- Secondary: customers, sites, quotes, technicians, projects, equipment
- Hebrew secondary line retained, disciplined
- Visual: real Quote Builder desktop snapshot (Golda Meir School / Herzl 12)

## 4. CTA behavior

| State | Primary | Secondary |
|---|---|---|
| Unauthenticated | Join Early Access → `/register` | Explore the Platform → `/#quotes` |
| Authenticated, no workspace | Continue Setup → `/onboarding` | Explore the Platform |
| Authenticated, has workspace | Open Dashboard → `/app` | Explore the Platform |
| Session error | Session unavailable → `/login` | — |

Uses existing `session.has_workspace` only (no backend changes). Business activation ring (`workspaceSetup`) is not consumed on the marketing page.

## 5. Quote Builder section

- First major section after Hero
- Title: FROM SITE VISIT / TO PROFESSIONAL QUOTE
- Real pricing-stage snapshot with VAT, discount, labor, line items
- Four compact proof points (catalog/labor, optional/VAT, preview/PDF/send, revisions)
- CTA: See Quote Workflow → `#flow`

## 6. Operational flow

Compact strip: Customer → Site → Quote → Approval → Project → Installation → Assets → Service

## 7. Site File section

- A SITE IS MORE / THAN AN ADDRESS
- Real Site File snapshot (Herzl 12, cameras/NVRs/switches, health, tabs)
- Proof: systems & devices, serials & warranties, documents & service
- “Digital Twin” not used as primary marketing language

## 8. Installed Assets section

- FROM PROJECT SCOPE / TO INSTALLED EQUIPMENT
- Real Site File → Installed Equipment tab snapshot
- Note: dedicated asset-detail URL returned Method Not Allowed during capture; equipment tab used as honest installed-assets surface

## 9. Field Operations section

- THE FIELD, / CONNECTED.
- Real mobile Today (1 job, Herzl 12, Camera Installation) + FieldJob checklist
- OFFICE → FIELD label
- Bottom Nav shown as-is (not redesigned)

## 10. Security section

- BUILT FOR SECURITY / OPERATIONS.
- Six real pillars; CTA Explore Security → `/legal/security`

## 11. Removed/merged conceptual content

| Removed / reduced | Disposition |
|---|---|
| FRAGMENTED OPERATIONS (large) | Compact Before/After friction |
| DIGITAL TWIN explorer | Removed |
| OPERATIONAL CHAIN (animated rail) | Slim static flow strip |
| INTELLIGENCE conceptual panel | Removed entirely |
| CSS mock HeroConsole / FieldPhone / SiteFileStage | Replaced by real snapshots |

## 12. Snapshot generation process

1. Script `apps/web/scripts/landing_v2_snapshots.mjs` seeds disposable demo workspace via API
2. Playwright captures dark UI at 1440 desktop / 390 mobile
3. Workspace ID injected into localStorage for stable hydration
4. Privacy check rejects visible `@` emails
5. JPEGs optimized via `sips` into `apps/web/public/landing-v2/`

## 13. Snapshots created

**Source (Docs/landing-v2-snapshots/):**

- `01-quote-builder-desktop.png`
- `02-quote-review-desktop.png` (pricing stage — VAT/discount summary)
- `02b-quote-preview-desktop.png`
- `03-site-file-desktop.png`
- `03b-site-equipment-desktop.png`
- `04-asset-detail-desktop.png` (fallback copy of 03b — detail route failed)
- `05-today-mobile.png`
- `06-fieldjob-mobile.png`
- `07-project-desktop.png`
- `manifest.json`

**Web (apps/web/public/landing-v2/):** matching `.jpg` set (~55–178KB each)

**Visual QA (Docs/landing-v2-visual-qa/):** 1440/1280/1032/768/390/360 hero + full + sections; `report.json`; product PNG copies

## 14. Demo data used

- Company: Aegis Security Demo
- Customer: Golda Meir School
- Site: Herzl 12, Tel Aviv
- Quote: CCTV Installation — Dome 4MP ×4, NVR 8ch, HDD 4TB, PoE Switch, Cat6, Labor, optional Extra dome
- Assets: CAM-001… / NVR-001 / SW-001
- Technician: Daniel
- Job: Camera Installation

## 15. Screenshot privacy check

- No personal emails in marketing shots (script `privacyOk`)
- Demo-only customer/site names
- No service-role tokens or real customer data in artifacts

## 16. Desktop result

- 1440/1280: split hero with framed Quote Builder; Quote section strong with pricing snapshot
- No horizontal overflow
- Product framing: thin border, panel radius, subtle elevation, product labels

## 17. Tablet result

- 1032/768: stacks cleanly; flow strip scrolls horizontally if needed; CTAs wrap
- No overflow

## 18. Mobile result

- 390/360: hero readable; snapshot under CTAs; field phones stack; no overflow

## 19. Dark-first visual quality

- Premium dark marketing shell retained
- Product is the visual hero
- No neon, glassmorphism, floating orbs, or conceptual intelligence chrome

## 20. Accessibility

- Semantic `h1`/`h2` hierarchy
- Product `img` alt text
- Skip link retained
- Focus-visible on nav/CTAs
- Reduced-motion for field offset
- Meaningful copy if images fail

## 21. Performance / image optimization

- PNGs → JPEG (~80 quality, desktop max edge 1600)
- Hero image `loading=eager` + `fetchPriority=high`
- Below-fold shots `loading=lazy`
- Avoids multi-MB raw PNGs on the marketing path

## 22. Files changed

- `apps/web/src/components/public/PublicHome.tsx`
- `apps/web/src/components/public/PublicSurfaces.tsx`
- `apps/web/src/components/public/PublicChrome.tsx`
- `apps/web/src/i18n/public-he.ts`
- `apps/web/src/styles.css` (product-shot / flow / proof / friction)
- `apps/web/tests/public.test.tsx`
- `apps/web/scripts/landing_v2_snapshots.mjs`
- `apps/web/scripts/landing_v2_visual_qa.mjs`
- `apps/web/public/landing-v2/*.jpg`
- `Docs/landing-v2-snapshots/*`
- `Docs/landing-v2-visual-qa/*`

## 23. Tests

- `vitest run tests/public.test.tsx` — 4/4 passed

## 24. Typecheck

- No errors in public landing files
- Workspace `npm run typecheck` still fails on pre-existing unrelated test typings (customers-page, work-navigation, today-routing, etc.) — not introduced by LANDING-V2

## 25. Build

- `npm run build` in `apps/web` — succeeded

## 26. Remaining homepage gaps

1. **Asset detail snapshot** — `/sites/:id/assets/:id` returned Method Not Allowed during capture; Installed Equipment tab used instead.
2. **Quote customer-preview document** — preview route capture did not reliably show print document; pricing stage used for Quote section (honest, stronger commercial UI).
3. **Equipment list density** — Installed Equipment tab capture emphasizes tab chrome / add surface more than a dense CAM-001 table; Site File overview still carries the equipment counts story.
4. **Business setup vs workspace setup** — homepage CTAs use `has_workspace` only; incomplete activation (no first customer/quote) still shows Open Dashboard once workspace exists.
5. **Repo typecheck debt** — unrelated failing test types remain outside this task.

---

LANDING-V2 complete. Stopped — did not start LANDING-V3.
