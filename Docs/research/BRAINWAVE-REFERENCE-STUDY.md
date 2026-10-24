# Brainwave Visual Reference Study

**Mode:** REFERENCE / RESEARCH ONLY  
**Upstream:** https://github.com/sanidhyy/brainwave  
**Local clone:** `.external-reference/brainwave/` (gitignored, dockerignored, outside TS compile roots)  
**Branch:** `main`  
**HEAD SHA:** `601d552de7c10b686f3a7b6e7fa7a034a5c6ec6e`  
**Retrieval date (UTC):** 2026-09-29  
**License:** MIT (Copyright (c) 2024 Sanidhya Kumar Verma)  
**Disk usage:** ~27 MB (shallow clone; **no** `npm install` / no `node_modules`)  
**Product intent:** marketing / onboarding / storytelling inspiration only — **not** operational app UI.

Do **not** integrate Brainwave into SITE SECURE runtime, copy architecture wholesale, or auto-add its animation dependencies.

---

## What Brainwave is

A Vite + React + Tailwind demo: **modern animated SaaS generative-AI landing page**. Page composition (`src/App.jsx`):

1. Header (fixed, mobile overlay nav)
2. Hero
3. Benefits (feature cards)
4. Collaboration
5. Services (product showcase mosaic)
6. Pricing
7. Roadmap
8. Footer

Dependencies of interest (upstream only): `framer-motion`, `react-just-parallax`, `typewriter-effect`, `scroll-lock`. None installed into SITE SECURE by this study.

---

## Useful visual / product patterns (10)

### 1. Centered hero + product frame

| | |
|---|---|
| **Source** | `src/components/Hero.jsx`, `src/components/design/Hero.jsx` |
| **What** | Large centered `h1` + supporting body + single primary CTA, then a “device/window” frame (conic-gradient border, faux chrome bar, hero image). |
| **Why it works** | Clear first-viewport hierarchy: message → proof visual. One CTA avoids choice paralysis. |
| **SITE SECURE fit** | Public marketing landing hero; optional beta welcome splash. |
| **Timing** | **NOW** (structure only — SITE SECURE brand/copy/assets) |

### 2. Single primary CTA with high contrast

| | |
|---|---|
| **Source** | `src/components/Button.jsx`, `src/assets/svg/ButtonSvg.jsx`, hero “Get started” |
| **What** | One filled/white primary CTA in hero; secondary text links elsewhere (“See the full details”). Uppercase code-style label. |
| **Why it works** | Hierarchy is obvious; secondary actions don’t compete. |
| **SITE SECURE fit** | Landing “Request access” / “Join Founding Technician”; beta activation “Continue”. |
| **Timing** | **NOW** |

### 3. Section system with tag + title + body

| | |
|---|---|
| **Source** | `src/components/Heading.jsx`, `src/components/Tagline.jsx`, `src/components/Section.jsx` |
| **What** | Reusable section chrome: optional tagline, `h2`, supporting text; consistent vertical rhythm (`py-10` → `xl:py-40`). |
| **Why it works** | Predictable storytelling cadence; easy to scan on long pages. |
| **SITE SECURE fit** | Landing sections; onboarding chapter titles. |
| **Timing** | **NOW** |

### 4. Feature / benefit cards (information density check)

| | |
|---|---|
| **Source** | `src/components/Benefits.jsx`, `src/constants` `benefits`, `src/assets/benefits/*` |
| **What** | 2–3 column wrap of cards: title, short body, icon + “Explore more”. Decorative SVG card frames + hover image. |
| **Why it works** | Quick capability scan. |
| **SITE SECURE fit** | Landing “what you get” (Quote / Project / Asset / Job) — **rewrite** for operational value, not AI fluff. Cap at 4–6 cards with real outcomes. |
| **Timing** | **NOW** (content-led); decorative SVG frames **LATER** / optional |

### 5. Split storytelling: checklist + visual

| | |
|---|---|
| **Source** | `src/components/Collaboration.jsx` |
| **What** | Left: headline + check-list + CTA. Right: circular “orbit” visual of integrations. |
| **Why it works** | Text for comprehension; graphic for memorability. |
| **SITE SECURE fit** | “How SITE SECURE works” — replace orbit toys with workflow diagram (Customer → Site → Quote → …). |
| **Timing** | **NOW** (layout idea); orbit graphic **NOT RECOMMENDED** as-is |

### 6. Large showcase mosaic (Services)

| | |
|---|---|
| **Source** | `src/components/Services.jsx`, `src/components/design/Services.jsx` |
| **What** | Full-bleed feature panel + 2-up secondary panels with overlay copy and checklist. |
| **Why it works** | Feels like a product tour without leaving the page. |
| **SITE SECURE fit** | Quote Builder showcase + Site/Infrastructure showcase (real screenshots, not robot art). |
| **Timing** | **LATER** (needs production-quality captures) |

### 7. Pricing card triad

| | |
|---|---|
| **Source** | `src/components/Pricing.jsx`, `src/components/PricingList.jsx`, constants `pricing` |
| **What** | Three plans; middle plan taller; feature list with checks; CTA per card; “Contact us” for enterprise-like tier. |
| **Why it works** | Familiar SaaS pattern; clear comparison. |
| **SITE SECURE fit** | Future subscription / Founding Technician vs Standard vs Org plans. |
| **Timing** | **LATER** (pricing not productized yet) |

### 8. Roadmap / status storytelling cards

| | |
|---|---|
| **Source** | `src/components/Roadmap.jsx` |
| **What** | 2-column staggered cards; date tagline; Done / In progress badges; short narrative + image. |
| **Why it works** | Builds trust and expectation for beta audiences. |
| **SITE SECURE fit** | Beta changelog / “what’s shipping”; **or** remap to “How work flows” steps (not literal roadmap). |
| **Timing** | **NOW** for beta trust; **LATER** for public roadmap page |

### 9. Fixed header + mobile full-screen nav

| | |
|---|---|
| **Source** | `src/components/Header.jsx`, `scroll-lock`, `src/components/design/Header.jsx` |
| **What** | Sticky bar with backdrop blur; hamburger opens full-viewport nav and locks scroll. |
| **Why it works** | Solid mobile marketing UX. |
| **SITE SECURE fit** | Public marketing site only (product app already has AppShell). |
| **Timing** | **NOW** when building public site |

### 10. Dark surface language + restrained section lines

| | |
|---|---|
| **Source** | `tailwind.config.js` (`n-*` neutrals), `src/index.css`, `Section` vertical stroke lines |
| **What** | Near-black canvas (`n-8` `#0E0C15`), muted body (`n-2`–`n-4`), hairline section guides. |
| **Why it works** | Premium night-mode marketing feel without needing cards everywhere. |
| **SITE SECURE fit** | Selective inspiration for landing/onboarding — map to SITE SECURE tokens, **not** Brainwave purple `#AC6AFF` / neon conic border as brand. |
| **Timing** | **NOW** (tone); palette copy **NOT RECOMMENDED** |

### Extra patterns evaluated (shorter)

| Pattern | Source | Verdict |
|---|---|---|
| Conic-gradient borders / rainbow glow | `bg-conic-gradient` in Tailwind + Hero/Services | **NOT RECOMMENDED** for SITE SECURE (AI/cyber cliché) |
| Floating notification chip + icon rail on hero | `Notification.jsx`, parallax icon list | Marketing optional **LATER**; never in product |
| Company logo strip | `CompanyLogos.jsx` | **LATER** if partners/customers allow |
| Typewriter rotating headline | `typewriter-effect` in Hero / Services | **NOT RECOMMENDED** (distracting; weak for B2B field ops) |
| Mouse / scroll parallax balls & rings | `design/Hero.jsx` `MouseParallax`, `ScrollParallax` | Marketing **SAFE** if subtle; **NOT** for product app |

---

## Motion / animation review

| Technique | Where | Classification |
|---|---|---|
| Framer Motion section fade (`opacity` whileInView, 1.5s, once) | `Section.jsx` | **SAFE FOR MARKETING**; light **SAFE FOR ONBOARDING** if ≤300–500ms and never blocks taps; **NOT FOR PRODUCT APP** |
| Scroll parallax floating UI chips | `Hero.jsx` `ScrollParallax` | **SAFE FOR MARKETING**; **NOT FOR PRODUCT APP** |
| Mouse parallax colored orbs | `design/Hero.jsx` `MouseParallax` | **SAFE FOR MARKETING** (keep subtle); **NOT FOR PRODUCT APP** |
| Typewriter loops | Hero, Services design | Prefer **NOT** — even marketing; static headline stronger for SITE SECURE |
| `animate-pulse` / `animate-spin` decorative | Pricing stars, Roadmap, Generating, Collaboration icons | **SAFE FOR MARKETING** sparingly; onboarding only for true loading; **NOT FOR PRODUCT APP** chrome |
| Hover opacity image reveal on benefit cards | `Benefits.jsx` | **SAFE FOR MARKETING**; **NOT FOR PRODUCT APP** |

**Hard rule for SITE SECURE:** Quote Builder, Dashboard, Jobs, Sites, Assets, Settings, Platform Admin stay calm and dense — no Framer reveal cascades, no parallax, no decorative spin/pulse.

**Do not auto-add** `framer-motion`, `react-just-parallax`, or `typewriter-effect` to the product app. If marketing site is a separate surface later, decide deps then.

---

## Adaptation matrix

| Brainwave pattern | → SITE SECURE use case |
|---|---|
| Hero (message + frame + 1 CTA) | Public landing first viewport |
| CTA hierarchy (primary filled / secondary text) | Landing + beta activation |
| Feature / benefit grid | Explain Quote / Project / Asset / Job outcomes |
| Collaboration split + checklist | “How SITE SECURE works” workflow |
| Services mosaic | Quote Builder showcase + Site/Infrastructure showcase |
| Pricing cards | Future subscription / plans |
| Roadmap status cards | Beta “what’s shipping” or workflow chapters |
| Section fade-in | Marketing only |
| Dark premium surfaces | Selective visual inspiration — remapped tokens |
| Sticky marketing header | Public site nav |
| Orbit / robot / neon conic | Do not ship |
| Typewriter / heavy parallax | Do not ship into product; avoid or minimize on marketing |

---

## Founding Technician onboarding ideas

Keep **functional first**. Borrow structure, not spectacle.

| Idea | From Brainwave | Adapt as |
|---|---|---|
| Welcome headline + one primary action | Hero CTA | “Welcome — create your first customer” / continue to quote |
| Short checklist with checks | Collaboration list | Progress: Customer → Site → Quote (no orbit) |
| Status badges Done / In progress | Roadmap | Checklist steps; static icons, no spin |
| Tag + title section rhythm | Heading / Tagline | Step titles in first-run panels |
| Feature cards | Benefits | Optional “why this step” tips — high information, no glow borders |

**Avoid:** parallax, typewriter, full-viewport decorative motion, anything that delays or obscures progress controls.

---

## Landing page concept (not implemented)

Inspired structure for a future SITE SECURE marketing page:

1. **Hero** — Brand-forward name, one outcome headline, one supporting sentence, one CTA (e.g. Founding Technician / request access), one real product visual (app screenshot or field-ops still — not robot art).
2. **Core value** — Why SITE SECURE exists for security / infrastructure field teams (3 bullets max).
3. **Workflow** — Customer → Site → Quote → Project → Job → Asset (horizontal on desktop, stacked on mobile).
4. **Quote Builder showcase** — Services-style large panel with real UI capture + checklist of outcomes.
5. **Site / Infrastructure showcase** — Second panel: dossier, assets, connections (when ready).
6. **Founding Technician / beta CTA** — Clear cohort ask + secondary “talk to us”.
7. **Security / reliability** — Calm section: tenancy, audit, access control (no neon).
8. **Pricing placeholder** — Optional “Plans coming” or three-card skeleton when pricing exists.
9. **Footer** — Legal, contact, minimal links.

Typography/color: SITE SECURE design system only. Brainwave Sora/purple/conic is reference, not destination.

---

## Visual rules for SITE SECURE (from this study)

### Allowed inspiration

- Dark premium surfaces (mapped to existing tokens)
- Subtle glow / restrained gradients (one accent, low saturation)
- Strong hero hierarchy (brand, one headline, one line, one CTA group, one visual)
- Clean CTA contrast
- Structured feature storytelling (sections with one job each)

### Avoid

- AI/cyber visual clichés (robot faces, rainbow conic borders, floating notification spam)
- Neon overload / Brainwave purple identity
- Oversized decorative graphics that don’t show the product
- Animation everywhere
- Low-information cards
- Poor density patterns leaking into operational screens
- Copied brand identity, assets, or large source blocks

---

## License / code reuse

- **MIT** — permissive; retain copyright notice if any snippet is reused.
- **Policy for SITE SECURE:** prefer conceptual adaptation and fresh implementation in the existing design system.
- Do **not** copy large JSX/CSS/SVG blocks or ship Brainwave assets (robot, brainwave logos, benefit card SVGs) as product chrome.
- This study did **not** run install scripts and did **not** add Brainwave code to `apps/` or production deps.

---

## What not to use

- Wholesale page clone / component library vendor
- Framer + parallax + typewriter stack inside the product SPA
- Conic neon borders and purple accent system as brand
- Decorative “Generating…” / AI chat chrome metaphors
- Dense operational UIs restyled as marketing cards
- Auto-install of Brainwave `package.json` dependencies into SITE SECURE

---

## Confirmation

| Check | Status |
|---|---|
| Shallow clone at `.external-reference/brainwave/` | Yes |
| Listed in `.gitignore` / `.dockerignore` | Yes (`.external-reference/`) |
| Outside `apps/web` TS `include` (`src`, `tests`) | Yes |
| `npm install` in Brainwave | **Not run** |
| Code copied into production tree | **None** |
| Landing / onboarding implemented | **No** (study only) |
