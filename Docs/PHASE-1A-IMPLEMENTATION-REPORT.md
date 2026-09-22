# Phase 1A — Implementation Report

**Date:** 2026-09-21  
**Scope:** Design foundation + Login/Register visual redesign + mobile nav visual prototype  
**Status:** Complete, then corrected (fixed-dark public/auth). Stopped. No Phase 1B.

This was a presentation-layer change only. SITE SECURE remains React 19 / Vite / TanStack Router / TanStack Query / FastAPI / Supabase.

---

## FILES CHANGED

| File | Why |
|---|---|
| `packages/design-system/src/tokens.json` | Additive premium radius, motion, canvas, control-height tokens. Existing control/panel radii unchanged. |
| `packages/design-system/src/tokens.css` | Emit CSS variables for the new tokens; opt-in `.auth-premium.auth-root` light canvas (does not replace global `.auth-root`). |
| `packages/ui/src/Button.tsx` | Opt-in `variant="pill"`; existing variants unchanged. |
| `packages/ui/src/Field.tsx` | Opt-in `appearance="comfortable"`; default field API unchanged. |
| `packages/ui/src/Display.tsx` | Opt-in `appearance="premium"` on `Card`. |
| `packages/ui/src/index.ts` | Export new types. |
| `apps/web/src/styles.css` | Premium auth chrome, pill/field geometry fallbacks, floating bottom nav + puck, shake, reduced-motion. Ops 3px radii in `.ops-shell` untouched. |
| `apps/web/src/components/AppBottomNav.tsx` | Floating capsule + transform puck. Same items, links, ARIA, More/Work. |
| `apps/web/src/routes/dev/ui.tsx` | “Premium Mobile Foundation” showcase. |
| `apps/web/src/routes/login.tsx` | `tone: "premium"` on existing AuthLayout shell only. |
| `apps/web/src/routes/register.tsx` | `tone: "premium"` on existing AuthLayout shell only. |
| `apps/web/src/components/LoginForm.tsx` | Comfortable fields + pill CTA + error shake class. Submit/validation/remember-device unchanged. |
| `apps/web/src/components/RegisterForm.tsx` | Same visual family. Schema, fields, onSubmit unchanged. |
| `apps/web/src/components/auth/AuthLayout.tsx` | Optional `tone` prop (`console` default). Premium class on Login/Register only. |
| `apps/web/src/components/auth/AuthField.tsx` | Passes `appearance`; default path unchanged for other auth screens. |

No other product screens were restyled.

---

## TOKENS ADDED

All additive. Action blue `#0b6bcb` and Heebo are unchanged.

From `tokens.json` / `tokens.css`:

| Token | Value | Role |
|---|---|---|
| `radius.comfortable` / `--radius-comfortable` | 14px | Comfortable fields |
| `radius.premium` / `--radius-premium` | 22px | Auth panel / premium card |
| `radius.pill` / `--radius-pill` | 999px | Pill CTA |
| `shadow.premium` / `--shadow-premium` | `0 1px 2px rgb(15 23 42 / 6%)` | Hairline-first elevation |
| `motion.pressMs` / `--motion-press` | 200ms | Press scale |
| `motion.navMs` / `--motion-nav` | 440ms | Nav puck |
| `motion.enterMs` / `--motion-enter` | 420ms | Auth entrance (under 500ms) |
| `motion.easeOutCubic` / `--ease-out-cubic` | `cubic-bezier(0.33, 1, 0.68, 1)` | Ease-out cubic stand-in |
| `premium.canvasWarm` / `--color-premium-canvas` | `#F6F5F3` | Auth page only |
| `premium.surface` / `--color-premium-surface` | `#FFFFFF` | Panel/field fill |
| `premium.hairline` / `--color-premium-hairline` | `#EDEDED` | Borders |
| `premium.navSurface` / `--color-premium-nav` | `#0E0E0E` | Floating nav |
| `premium.navPuck` / `--color-premium-puck` | `#FFFFFF` | Active puck |
| `premium.controlHeight` / `--premium-control-height` | 54px | Comfortable input |
| `premium.ctaHeight` / `--premium-cta-height` | 58px | Pill CTA |
| `premium.gutterMobile` / `--premium-gutter` | `clamp(16px, 5.5vw, 24px)` | Auth mobile gutter |
| `--premium-nav-height` | 68px | Floating bar height |
| `--ops-bottom-nav-offset` (ops-shell) | `calc(5.35rem + safe-area)` | Clearance for taller floating bar |

Not changed globally: `--radius-control` / `--radius-panel` (still 6/8 in design-system; ops-shell still 3px).

---

## COMPONENTS CHANGED

### Button
- New `variant="pill"`: 58px, full pill, action blue, `active:scale(0.97)`, 200ms, existing spinner/`aria-busy`/`disabled`.
- `primary` / `secondary` / `ghost` / `danger` unchanged.

### Field / Input
- New `appearance="comfortable"`: 54px, 14px radius, hairline, stronger focus on auth.
- Labels, ids, errors, `aria-invalid`, revealable password, autocomplete preserved.

### Card
- New `appearance="premium"`: 22px radius, hairline, light shadow. Default Card unchanged.

### AppBottomNav
- Floating black capsule, white puck via `transform: translate3d` from `getBoundingClientRect` (physical left, RTL-safe).
- Destinations, `isNavSelected`, More/Work, `aria-current`, portal unchanged.
- Hidden at `≥1024px` as before.

### Login / Register
- Shared warm canvas + desktop split (brand panel + 420px form).
- Mobile: brand panel hidden; full-viewport warm canvas; no horizontal overflow (verified at 360 CSS px).
- No social login, no Visa, no fake delay, no Slate/Kai branding.

---

## AUTH FILES

| File | Mix | Behavior preserved? |
|---|---|---|
| `apps/web/src/routes/login.tsx` | Presentation + existing auth logic | **Yes.** Only added `tone: "premium"`. `signInWithPassword`, `refresh`, `afterAuthPath`, `next`, launch sequence unchanged. |
| `apps/web/src/routes/register.tsx` | Presentation + existing auth logic | **Yes.** Only added `tone: "premium"`. `signUp`, `emailRedirectTo`, `patchMe`, verify-email redirect, `next` unchanged. |
| `apps/web/src/components/LoginForm.tsx` | Presentation + existing client validation | **Yes.** Zod schema, remember-device, `onSubmit(email, password)` unchanged. |
| `apps/web/src/components/RegisterForm.tsx` | Presentation + existing client validation | **Yes.** All four fields, password min 8, mismatch refine, `onSubmit({fullName,email,password})` unchanged. |
| `apps/web/src/components/auth/AuthLayout.tsx` | Presentation only | Default `tone="console"` so forgot-password / reset / verify-email / onboarding keep the previous console. |
| `apps/web/src/components/auth/AuthField.tsx` | Presentation only | Default appearance unchanged. |

---

## VISUAL BEHAVIOR

| Behavior | Implementation |
|---|---|
| Press | Pill `scale(0.97)` via `.ss-btn-pill:active` and `.auth-premium .auth-cta:active`. |
| Focus | Comfortable fields: 3px action-blue ring on `:focus-visible`. Buttons keep existing focus-visible outline. |
| Nav puck | `translate3d(x,y,0)` 440ms `--ease-out-cubic`. Does not gate routing. |
| Loading | Existing Button spinner + `loadingLabel` (`he.authenticating` / `he.creatingAccount`). Duration = real auth request. |
| Errors | Existing field `role="alert"` + `AuthAlert`. Optional `.ss-auth-shake` (360ms) is supplementary only. |
| Auth entrance | Panel/form fade-rise ≤420ms. |
| Reduced motion | Global tokens.css already collapses animation/transition duration. Extra: no shake, no puck transition, no press scale. |

---

## TESTS RUN

```bash
npm run test -w @site-secure/ui
npm run test -w @site-secure/web -- tests/auth.test.tsx tests/foundation.test.tsx tests/theme.test.tsx
npm run test -w @site-secure/web
npm run web:typecheck
npx eslint <Phase 1A files only>
npm run web:lint          # full workspace lint
npm run web:build
```

## TEST RESULTS

| Command | Result |
|---|---|
| `@site-secure/ui` vitest | **PASS** 8/8 |
| web `auth` + `foundation` + `theme` | **PASS** 45/45 (after keeping `background-color: var(--color-bg-nav)` on the nav, remapped to the premium surface) |
| full `@site-secure/web` vitest | **PASS** 51 files, 351 tests |
| `web:typecheck` | **PASS** |
| eslint on Phase 1A files | **PASS** (0 errors) |
| `web:lint` (entire web package) | **FAIL** — pre-existing, not in Phase 1A files: `CatalogImportWizard.tsx`, `QuoteBuilder.tsx`, `QuoteMobileSheet.tsx`, `cctv-sizing/hdd.ts`, three quote test files (`react-hooks/exhaustive-deps` missing, unused vars). Not fixed (out of scope). |
| `web:build` | **PASS** (chunk-size warning pre-existing) |

Auth empty-field / short-password / mismatch coverage: `apps/web/tests/auth.test.tsx` (passed). Live browser submit of empty login was not clicked (browser interaction blocked in this session).

---

## VIEWPORTS CHECKED

| Surface | Viewport | How | Result |
|---|---|---|---|
| Login | CSS 360×800 (`Emulation.setDeviceMetricsOverride`) | Computed styles + screenshot | Aside hidden; canvas `#F6F5F3`; pill 58×999; field 54×14; RTL form; no `overflowX`. Screenshot letterboxed in the IDE browser chrome. |
| Register | Desktop (cleared metrics, ~1280+) | Screenshot | Split composition; ~420px form; pill CTA; all existing fields; Hebrew RTL. |
| Login | Default IDE browser (wide) | Accessibility snapshot | All existing controls present (email, password, reveal, forgot, remember, submit, register link). |
| Register | Default IDE browser | Accessibility snapshot | fullName, email, password, confirm, strength, step rail, login link. |
| Login 390 / 430 / 768 / 1440 | — | **Not screenshot in this session** | Geometry is fluid CSS; 360 computed layout is the mobile proof. |
| Register 360–430 | — | **Not screenshot** | Same AuthLayout as login. |
| Authenticated mobile shell | — | **NOT VERIFIED visually** (no session in this pass) | Nav CSS + component compiled; hidden at ≥1024 as before. |
| `/dev/ui` Premium section | — | **NOT opened in browser this pass** | Code added; page still DEV-only. |

---

## RTL FINDINGS

- Form panel remains `dir="rtl"`; shell stays `dir="ltr"` for the desktop split (existing).
- Email fields keep `ltr` / `ltr-meta`.
- Password reveal uses logical `end-1`.
- Nav puck uses **physical** `left: 0` + `translate3d` from `getBoundingClientRect`, so RTL does not invert the origin.
- Hebrew titles/labels/CTA render correctly on Login (360) and Register (desktop).
- Universal icons (eye, trust locks) were not mirrored.

---

## ACCESSIBILITY FINDINGS

| Area | Status |
|---|---|
| Semantic `<button>` / `<form>` / `<label htmlFor>` | Preserved |
| Enter-to-submit | Preserved (`type="submit"`) |
| Focus-visible | Preserved on buttons; fields get action ring |
| `aria-busy` / disabled while loading | Preserved |
| `aria-invalid` / `aria-describedby` / `role="alert"` | Preserved |
| `aria-current` on nav links | Preserved |
| Min 44px targets | Pill 58; fields 54; nav items min 44; password reveal 40 on comfortable |
| Autofill / password manager | `autoComplete` values unchanged (`email`, `current-password`, `new-password`, `name`) |
| Reduced motion | Respected (see above) |
| Clickable divs | None added |

---

## KNOWN LIMITATIONS

- ~~Forgot password / reset / verify-email were not redesigned~~ **Superseded by the Dark Auth/Public Correction below.**
- Tailwind `@theme` did not expose `--radius-pill` / `--radius-comfortable` on `:root`; geometry is applied via `:root` duplicates + `.ss-btn-pill` / `.ss-field-comfortable` CSS.
- Authenticated floating nav was not visually QA’d with a real `/app` session (`/dev/ui` confirmed Light/Dark/System still apply outside brand-dark paths).
- Full `web:lint` still fails on unrelated quote/catalog files.
- Desktop auth still uses the existing product-flow brand panel (SITE SECURE copy, not fintech). That is a restrained split, not a stretched mobile form.

---

## EXPLICIT SAFETY CONFIRMATION

| Statement | True? |
|---|---|
| No backend changes. | **True** |
| No API contract changes. | **True** |
| No Supabase infrastructure changes. | **True** |
| No authentication behavior changes. | **True** |
| No session behavior changes. | **True** |
| No RBAC changes. | **True** |
| No permission changes. | **True** |
| No technician scope changes. | **True** |
| No workspace isolation changes. | **True** |
| No route destination changes. | **True** |
| No quote logic changes. | **True** |
| No pricing changes. | **True** |
| No VAT calculation changes. | **True** |
| No job lifecycle changes. | **True** |
| No CCTV changes. | **True** |
| No PDF changes. | **True** |
| No Catalog changes. | **True** |
| No Dashboard data changes. | **True** |
| No ActivityList changes. | **True** |
| No Flutter reference files changed. | **True** |
| No new runtime dependencies added. | **True** |

---

Phase 1A (initial) completed, then corrected. See **PHASE 1A — DARK AUTH/PUBLIC CORRECTION** below.

---

# PHASE 1A — DARK AUTH/PUBLIC CORRECTION

**Date:** 2026-09-21  
**Scope:** Restore fixed-dark public/auth SITE SECURE identity. Complete Forgot/Reset/Verify visual family. Keep `/app` Light/Dark/System.  
**Status:** Complete. Stopped. No Phase 1B.

---

## WHY THE LIGHT/WARM AUTH CANVAS HAPPENED

Phase 1A added an opt-in `.auth-premium.auth-root` token override that switched `color-scheme` to **light** and remapped auth surfaces to Slate-inspired warm tokens:

- `--color-bg-0: var(--color-premium-canvas)` → `#F6F5F3`
- `--color-bg-1` / field fill → `#FFFFFF`
- Login/Register passed `tone: "premium"`, so those screens left the existing dark `.auth-root` / `.auth-shell` grid.

That was a product-direction error. SITE SECURE public and pre-auth must be a **fixed dark brand experience**. The warm canvas token remains in `tokens.json` as an unused experimental value; it no longer paints any public/auth route.

---

## HOW FIXED-DARK PUBLIC/AUTH SCOPING IS IMPLEMENTED

Two theme contexts, no second theme store:

1. **Public / auth (fixed dark)**  
   Path-scoped class `html.ss-brand-dark` plus existing `.auth-root` / `.public-root` token remaps.  
   Does **not** set `html.dark`. Does **not** read `site-secure-theme`, system scheme, or appearance settings to decide the canvas.

2. **Authenticated app (`/app`, `/admin`, `/dev`)**  
   Unchanged `html.dark` from Light / Dark / System via `applyDocumentTheme`.  
   Stored key remains `site-secure-theme`.

`isBrandDarkPath(pathname)` returns false only for `/app`, `/admin`, `/dev` (and their subpaths). Every other existing route — `/`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`, `/onboarding`, `/invite/*`, `/legal/*`, `/public/*`, `/q/*` — is brand-dark.

FOUC: the same path rule runs in the **blocking** `index.html` boot script and paints `html.ss-brand-dark` / `#070b12` before the app module. `ThemeRuntime` re-applies `applyDocumentTheme(readThemeMode(), pathname)` on SPA navigations so leaving login into `/app` drops `ss-brand-dark` without forcing the app dark.

---

## FILES CHANGED (CORRECTION)

| File | Why |
|---|---|
| `apps/web/index.html` | Path-scoped `ss-brand-dark` boot + inline canvas so public/auth do not flash light. |
| `apps/web/src/lib/theme.ts` | `isBrandDarkPath`, `BRAND_DARK_CLASS`, `applyDocumentTheme` applies brand canvas without toggling `html.dark` for it. |
| `apps/web/src/lib/use-theme.ts` | `ThemeRuntime` follows router pathname. |
| `packages/design-system/src/tokens.css` | `html.ss-brand-dark`; `.auth-premium.auth-root` is dark elevated hierarchy, not warm canvas. |
| `apps/web/src/styles.css` | Restore `.auth-shell` dark grid/glow under premium; dark panel/fields; SITE SECURE blue pill. |
| `packages/ui/src/Field.tsx` | Comfortable fields inherit ambient `--color-bg-2` / `--color-border` (work on dark auth). |
| `apps/web/src/components/auth/AuthField.tsx` | Comfortable fill uses `bg-bg-2`, not white `--color-premium-surface`. |
| `apps/web/src/components/auth/AuthLayout.tsx` | Default `tone="premium"` so the whole AuthLayout family shares the dark premium chrome. |
| `apps/web/src/routes/forgot-password.tsx` | Presentation only: comfortable email, pill CTA, success pill, error shake class. Logic unchanged. |
| `apps/web/src/routes/reset-password.tsx` | Presentation only: comfortable passwords, pill CTAs. Token/updateUser/signOut unchanged. |
| `apps/web/src/routes/verify-email.tsx` | Inherits premium AuthLayout. Resend/session/redirect unchanged. |
| `apps/web/src/components/VerifyEmailPanel.tsx` | Resend button `variant="pill"`. Copy and `onResend` unchanged. |
| `apps/web/tests/theme.test.tsx` | Brand-path unit tests + `/app` fixture so Light tests stay valid. |
| `apps/web/tests/auth.test.tsx` | AuthLayout asserts `auth-premium`. |
| `Docs/PHASE-1A-IMPLEMENTATION-REPORT.md` | This section. |

Not changed: `apps/api/**`, `packages/api-client/**`, `packages/authz/**`, `supabase/migrations/**`, Flutter, pricing/quotes/CCTV/jobs/RBAC, AppBottomNav (no theme-scoping fix required).

---

## ROUTES PERMANENTLY DARK

| Route | Shell |
|---|---|
| `/` | `.public-root` + `html.ss-brand-dark` |
| `/login` | `.auth-root.auth-premium` |
| `/register` | `.auth-root.auth-premium` |
| `/forgot-password` | `.auth-root.auth-premium` |
| `/reset-password` | `.auth-root.auth-premium` |
| `/verify-email` | `.auth-root.auth-premium` |
| `/onboarding`, `/invite/$token`, `/legal/*` | AuthLayout / public-root family (same brand-dark path rule) |

Background restored: existing `.auth-shell` radial glow + 56px technical grid + noise overlay on `#070b12`. Not a flat `#000`. Desktop auth panel is elevated `#101826` with 22px radius. Fields `#151e2c`, 54px / 14px. Primary CTA `#0b6bcb` pill 58px / 999.

---

## HOW `/app` THEME SELECTION REMAINS INDEPENDENT

- `html.dark` still follows resolved Light/Dark/System.
- `localStorage['site-secure-theme']` is never cleared or rewritten except by the existing picker.
- Brand-dark is a **separate** class. A user with Light stored can open `/login` (dark canvas, `html.dark` off, `data-theme="light"`) then `/dev/ui` or `/app` (light canvas, no `ss-brand-dark`).
- `/admin` and `/dev` are excluded from brand-dark so they keep the selectable system.

---

## FORGOT / RESET / VERIFY

**Forgot Password (`/forgot-password`)**  
Redesigned to the dark premium family: heading, comfortable LTR email, pill “שליחת קישור”, loading label, `role="alert"` invalid email, success Lottie + pill continue, link back to `/login`.  
Still calls `supabase.auth.resetPasswordForEmail(..., { redirectTo: resetPasswordRedirectUrl() })`. No change to success/error conditions.

**Reset Password (`/reset-password`)**  
Visually aligned. Invalid/expired token state uses the same shell + blue pill to request a new link. Form still requires 8 chars, match, `updateUser({ password })`, then `signOut` and navigate `/login`.

**Verify Email (`/verify-email`)**  
Same shell. Missing-email, pending copy, resend pill, change-email → `/register`, back to login. `supabase.auth.resend` and `Navigate` to `afterAuthPath` unchanged.

---

## PUBLIC HOMEPAGE

No marketing redesign. `public-root` / `public-shell` dark surfaces (`#0b0d10`) kept. Correction is theme ownership: `html.ss-brand-dark` on `/` so a stored Light preference cannot bleach the marketing page. Verified with `themeMode=system` + emulated light scheme: canvas stayed dark.

---

## NO-FLASH-OF-LIGHT HANDLING

1. Inline `<style>` in `index.html`: `html.ss-brand-dark { background-color: #070b12 }`.  
2. Blocking boot script classifies `location.pathname` **before** `/src/main.tsx`.  
3. Does not set global `html.dark` for brand routes (that would leak into `/app` Light).  
4. After CSS bundle, `html.ss-brand-dark` still wins over `html { background: var(--color-bg-0) }` because of higher specificity.  
5. SPA: `ThemeRuntime` + `applyDocumentTheme(..., pathname)`.

---

## THEME REGRESSION MATRIX

| Surface | Condition | Expected | Observed |
|---|---|---|---|
| Public `/` | system LIGHT | DARK | **PASS** — `ss-brand-dark`, public `#0b0d10`, no `html.dark` |
| Public `/` | system DARK | DARK | **PASS** — brand-dark + optional `html.dark` from stored system |
| Login | system LIGHT | DARK | **PASS** — `htmlClass=ss-brand-dark`, canvas `#070b12`, `data-theme=light` |
| Login | system DARK | DARK | **PASS** — `dark ss-brand-dark`, canvas `#070b12` |
| Register | system LIGHT/DARK | DARK | **PASS** — canvas `#070b12`, fields `#151e2c`, pill `#0b6bcb` |
| Forgot Password | LIGHT/DARK | DARK | **PASS** — same family; empty submit → `aria-invalid` + alert |
| Reset Password | LIGHT/DARK | DARK | **PASS** — invalid-token state, pill `#0b6bcb` |
| Verify Email | LIGHT/DARK | DARK | **PASS** — premium AuthLayout, pending/missing-email copy |
| Authenticated-equivalent `/dev/ui` | user LIGHT | LIGHT | **PASS** — no `ss-brand-dark`, canvas `#eef1f5`, radio בהיר |
| Authenticated-equivalent `/dev/ui` | user DARK | DARK | **PASS** — `html.dark`, canvas `#0b1220`, **no** `ss-brand-dark` |
| `/dev/ui` | SYSTEM + system LIGHT | LIGHT | **PASS** — stored `system`, resolved light |
| `/dev/ui` | SYSTEM + system DARK | DARK | **PASS** — stored `system`, resolved dark via `matchMedia` |

`/app/*` was not opened with a live workspace session in this pass (guest `/app` redirects to login). Selectable theme was verified on `/dev/ui`, which uses the same `html.dark` / `site-secure-theme` pipeline and is excluded from `isBrandDarkPath`.

---

## RTL FINDINGS

- Auth form panel remains `dir="rtl"`; shell `dir="ltr"` for the desktop split (existing).
- Email fields keep `ltr` / `ltr-meta`.
- Hebrew titles, labels, errors, CTAs, and “חזרה להתחברות” read correctly on Login / Register / Forgot.
- Password reveal stays logical `end`.
- Universal trust icons were not mirrored.
- Desktop 1280 login screenshot: RTL heading `התחברות ל־SITE SECURE`, errors on the start edge, blue pill.

---

## RESPONSIVE FINDINGS

| Surface | Viewport | Result |
|---|---|---|
| Login | 360×800 | Dark grid; field 54/14; pill 58/999; RTL; `scrollWidth=360` |
| Login | 390 | Dark; IDE device-frame showed a 22px document delta (HTML `left:22`) — form width still 390, not a stretched card |
| Login | 768 / 1280 / 1440 | No overflow; 1280 split: dark elevated panel `#101826` radius 22 |
| Register | 360 | Same family: 54/14 fields, blue pill, no overflow |
| Forgot | 360 | Same family; validation alert on empty submit |
| Public `/` | 360 and 1440 | Dark `public-root`; no overflow; system light did not lighten it |
| Reset / Verify | default + 360 metrics | Dark premium shell |

430×932 was not a separate screenshot; geometry is the same fluid AuthLayout as 390/360.

---

## ACCESSIBILITY FINDINGS

| Area | Status |
|---|---|
| Contrast on dark | Title `#e8eef6` on `#070b12`; muted `#a8b6c8`; blue CTA white on `#0b6bcb` |
| Focus-visible | Comfortable fields: 3px `#0b6bcb` ring; buttons keep outline-focus |
| Labels / `aria-invalid` / `aria-describedby` / `role="alert"` | Preserved; empty login and forgot showed Hebrew alerts |
| Enter-to-submit | Preserved (`type="submit"`) |
| Loading / disabled | Pill `aria-busy`, spinner, `loadingLabel` |
| Autofill | `autoComplete` unchanged |
| Reduced motion | Existing global collapse + no press scale |

---

## AUTH FUNCTIONAL REGRESSION

| Check | Result |
|---|---|
| Login empty validation | **PASS** (browser: invalid email + required password alerts) |
| Login / Register schema tests | **PASS** (`tests/auth.test.tsx`) |
| Forgot empty validation | **PASS** (browser: invalid email alert) |
| Forgot/Reset/Verify API calls | Unchanged in source; live reset email not sent (no new production data) |
| Login → Register / Register → Login / Forgot → Login | Links unchanged (`/register`, `/login`, `/forgot-password`) |
| Valid live login | Not run (would require a workspace session) |

---

## TESTS RUN

```bash
npm run test -w @site-secure/ui
npm run test -w @site-secure/web -- tests/auth.test.tsx tests/foundation.test.tsx tests/theme.test.tsx
npm run test -w @site-secure/web
npm run typecheck -w @site-secure/ui
npm run typecheck -w @site-secure/web
npx eslint <correction files only>   # from apps/web and packages/ui
npm run lint -w @site-secure/ui
npm run lint -w @site-secure/web
npm run build -w @site-secure/web
```

## TEST RESULTS

| Command | Result |
|---|---|
| `@site-secure/ui` vitest | **PASS** 8/8 |
| web `auth` + `foundation` + `theme` | **PASS** 47/47 |
| full `@site-secure/web` vitest | **PASS** 51 files, 353 tests |
| ui + web typecheck | **PASS** |
| eslint on correction files | **PASS** |
| `lint` `@site-secure/ui` | **PASS** |
| `lint` `@site-secure/web` | **FAIL** — same pre-existing Quote/Catalog/CCTV files as Phase 1A. **No new lint failures** from this correction. |
| `web` production build | **PASS** (chunk-size warning pre-existing) |

---

## EXPLICIT SAFETY CONFIRMATION (CORRECTION)

| Statement | True? |
|---|---|
| Public SITE SECURE pages permanently dark | **True** |
| Login / Register / Forgot / Reset / Verify permanently dark | **True** |
| Public/Auth independent of browser/system theme and saved preference | **True** |
| `/app` Light / Dark / System preserved | **True** (verified via `/dev/ui` + unit tests; live `/app` session not opened) |
| Auth behavior / RBAC / RLS unchanged | **True** |
| No backend / no new runtime dependency | **True** |
| No unrelated product screen redesign | **True** |
| No flash of light canvas on public/auth boot | **True** (path-scoped inline style + boot script) |
| Mobile RTL correct | **True** |
| Phase 1A pill/comfortable retained, adapted to dark | **True** |

---

Dark Auth/Public correction is complete. **Stopped.** No Phase 1B. Waiting for visual review.
