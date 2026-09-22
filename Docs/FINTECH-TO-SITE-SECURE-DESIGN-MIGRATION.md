# SITE SECURE — Fintech Template Design Migration

**Status:** read-only analysis. No product code was changed.  
**Date:** 2026-09-21  
**Sources inspected:**

- `Docs/SITE-SECURE-CODEBASE-SNAPSHOT.md`
- SITE SECURE frontend: `apps/web/src/**`, `packages/ui/**`, `packages/design-system/**`
- Flutter visual reference: `Fintech app UI/card_app/lib/**` (plus `pubspec.yaml`, `assets/`, tests)

**Architecture rule (non-negotiable):** this is a presentation-layer redesign of the existing React 19 / TypeScript / Vite / TanStack Router / TanStack Query web app. SITE SECURE does **not** become a Flutter app, a second frontend, or a banking product. Dart business logic, fake balances, fake KYC, fake payments, Visa branding, and hard-coded card products are **not** ported.

**Second-pass check:** every recommendation below was compared against `Docs/SITE-SECURE-CODEBASE-SNAPSHOT.md`. No recommended visual change is allowed to alter authorization, entitlements, API contracts, tenant isolation, financial calculations, job lifecycle, CCTV calculations, or PDF snapshot behavior. Where a Flutter pattern would tempt that, this document says **do not reuse**.

---

## How to read this document

| Term | Meaning here |
|---|---|
| Reusable | Visual / motion / interaction pattern only. Extract into SITE SECURE design tokens or `@site-secure/ui`. |
| Restyle | Existing React component keeps its API and behavior; only chrome changes. |
| New | New presentational component, justified by repeated use, no new business logic. |
| Exclude | Fintech-specific, demo-only, or would fight SITE SECURE identity / a11y / performance. |
| NOT VERIFIED | Inspected enough to know the file exists, but a numeric/visual detail was not confirmed from source. |

The Flutter project calls itself **Slate** (`pubspec.yaml` name `card_app`, `lib/main.dart` title `Slate`). It is a **UI prototype**. Login, KYC, payment, and card data are local theater. SITE SECURE already has real auth (Supabase session + FastAPI `authorize()`), real quotes, real jobs, real RBAC/RLS.

---

## 0. Template is a prototype — verified

Verified from source, not screenshots:

| Claim | Evidence | Verdict |
|---|---|---|
| Login does not authenticate | `lib/screens/login_screen.dart`: `_signIn` waits `_processing` then `Navigator.pushReplacement` to `HomeScreen`. Empty fields shake. Social buttons fire `_signIn` with no provider API. Tests in `test/login_screen_test.dart` pump `MaterialApp(home: LoginScreen())` with no backend. | **Fake login. Do not port.** |
| Home balance is hard-coded | `lib/screens/home_screen.dart` uses `AnimatedBalance` with a fixed demo amount (template comment / model path: `$22,000`). | **Fake money. Do not port the number or the “bank balance” metaphor.** |
| Transactions are demo rows | `lib/models/transaction_item.dart` + `TransactionTile` on Home. Local list, not an API. | **Reuse the row chrome, not the data.** |
| Card products are demo SKUs | `lib/models/card_tier.dart` (`CardTier.all`), metallic Visa-styled faces, ISO 7810 aspect `1.586`. | **Do not port card products, Visa, or metal gradients as SITE SECURE entities.** |
| Order / payment is a delay | `lib/screens/order_confirmation_screen.dart`: `_placeOrder` sets `_placing`, `await Future.delayed(_processing)` (2300 ms), then pushes success. Lottie preload only. | **Fake checkout. Reuse morphing CTA + success page pattern, not payment.** |
| KYC does not verify identity | `lib/screens/kyc/*` + `FaceScanner` / `IdDocumentScanner`: timed `AnimationController`s, no camera, no OCR, no liveness. `ReviewStep` morphs a seal after canned checks. `KycFlowScreen` pops `true`. | **Fake KYC. Reuse step layout / progress / success morph, not scanning as identity.** |
| Receipt is generated locally | `lib/models/order_receipt.dart` `OrderReceipt.forTier`. `ReceiptPaper` paints thermal stock. | **Reuse paper/stamp visual for document-like success (quote sent, job completed), not card receipts.** |
| Age gate is demo | `birth_date_sheet.dart` `minimumAge = 18`. | **Do not port. SITE SECURE has no consumer KYC age gate.** |

**Do not assume this template is a production fintech backend. It is not.**

---

# 1. FLUTTER TEMPLATE AUDIT

Root of meaningful source: `Fintech app UI/card_app/lib/`.

Entry: `lib/main.dart` — `MaterialApp`, `AppTheme.light()`, home `SplashScreen`, `debugShowCheckedModeBanner: false`.

## 1.1 Screens

### Splash — `lib/screens/splash_screen.dart`

- **Purpose:** branded hold, then replace with Login.
- **Visual:** dark/black field, wordmark, timed fade. (Exact painter details: inspect file; delay is short, not a product splash policy.)
- **Interaction:** none. Auto-advance.
- **SITE SECURE:** **partial.** Web already has `/login` and session restore. Do **not** add a fake splash that delays first paint. Optional: a very short branded skeleton while `getSession()` resolves — existing auth flow only.

### Login — `lib/screens/login_screen.dart`

- **Purpose:** email/password theater + social discs + sign-up link + “Forgot password?”.
- **Visual:** light scaffold `#F6F5F3`; large “Login” heading; fields height 54 / radius 14; black `PillButton`; white circular social buttons size 58; curtain / custom painter flourishes; Lottie `assets/images/loading.json` inside the button while “processing”.
- **Interaction:** press scale on CTA; empty-field shake; 2300 ms fake delay; haptic on tap (`HapticFeedback` — web has no equivalent; ignore). Social tap = same fake sign-in.
- **Reusable:** field geometry, pill CTA, loading morph, social-circle press (if we ever show a real OAuth button — SITE SECURE login is email/password + Supabase today). Shake on validation error.
- **Exclude:** fake delay, social providers as working auth, curtain as required chrome, Lottie as a login dependency.

### Home — `lib/screens/home_screen.dart`

- **Purpose:** shell: greeting, huge balance, metallic card hero, transaction list, floating `AppBottomNav` (Home / Profile).
- **Visual:** light canvas, large display type, card with `Hero`, `TransactionTile` list, bottom inset `AppBottomNav.height + 46`.
- **Interaction:** tab cross-fade (Home ↔ Profile) **without unmounting the bottom bar**; card tap → `CardSelectionScreen` via `PremiumPageRoute` + Hero; bouncing scroll.
- **Reusable:** floating black nav, staggered rise entrance, list of activity rows, large metric as **one** hero number (not a bank balance).
- **Exclude:** `$22,000`, Visa card, transaction semantics, two-tab-only IA.

### Profile — `lib/screens/profile_view.dart`

- **Purpose:** account page + door into KYC. Not a route: shell keeps the bar and cross-fades.
- **Visual:** header with avatar (`assets/images/profile.png`), name, `VerifiedBadge`; `_VerifyCard` vs `_VerifiedBanner` swapped with `AnimatedSize` 460 ms `easeOutCubic`; list of settings-like rows; 900 ms staggered `_Rise` entrance; 1500 ms `_celebrate` when verification lands.
- **Interaction:** open KYC via `MaterialPageRoute`; on `true`, delay 220 ms then celebrate + heavy haptic.
- **Reusable:** account header, verify/settings rows, celebration of a **real** SITE SECURE status (e.g. company profile complete) — not KYC.
- **Exclude:** identity-verification product, demo avatar as SITE SECURE branding.

### Card selection — `lib/screens/card_selection_screen.dart`

- **Purpose:** `PageView` carousel of metal card faces, `viewportFraction: 0.66`, spin `2π` per page driven by **scroll offset** (not a canned spin).
- **Visual:** Hero flight of `MetallicCard`; chrome/footer fade in after card lands (entrance 1100 ms, chrome 0.30–0.80, footer 0.46–1.00).
- **Interaction:** tap neighbor → `animateToPage` 560 ms `easeOutCubic`; tap center → order. Haptics.
- **Reusable (weak):** 3D carousel is **fintech-specific and expensive on web**. Do not build a card spinner. Optional later: a **static** product picker for catalog accessories — not this spin.
- **Exclude:** metal card product, Visa, scroll-driven 3D.

### Order confirmation — `lib/screens/order_confirmation_screen.dart`

- **Purpose:** review chosen tier + “pay”.
- **Visual:** Hero card, summary rows, `PillButton` that morphs 460 ms into a 58×58 loader; Lottie payment loader.
- **Interaction:** `_processing` 2300 ms fake; then `PremiumPageRoute` to success. Double-tap guarded by `_placing`.
- **Reusable:** review summary + morphing primary action + disabled-while-in-flight.
- **Exclude:** payment, card price, Lottie as required.

### Order success — `lib/screens/order_success_screen.dart`

- **Purpose:** contactless Lottie (`Contactless.json`), copy timed to the tick, then receipt.
- **Visual:** full-bleed success; animation aspect `330/300`; copy intervals 0.28–0.70 of a ~4 s controller; Lottie color delegates recolor the card metal.
- **Interaction:** after tap-point `_tap = 0.19`, continue to receipt.
- **Reusable:** dedicated success scene with delayed copy; **not** contactless hardware metaphor for SITE SECURE.
- **Exclude:** contactless Lottie, Visa metal recolor, fake `OrderReceipt.forTier`.

### Receipt — `lib/screens/receipt_screen.dart` + `lib/widgets/receipt/*`

- **Purpose:** thermal slip + PAID stamp.
- **Visual:** `ReceiptPaper.width = 300`, stock `#FAF8F3`, ink `#1B1A18`, torn-foot teeth `7`, barcode, monospace amounts, Google Fonts serif/mono (offline fallback to platform).
- **Reusable:** “document that just printed” for **quote PDF sent** or **job completed** — SITE SECURE already has real PDFs. Do not fake a thermal receipt as source of truth.
- **Exclude:** barcode-as-payment, PAID stamp as accounting (quotes use real states: `draft|sent|accepted|rejected|expired|cancelled`).

### KYC flow shell — `lib/screens/kyc/kyc_flow_screen.dart`

- **Purpose:** 4-step `PageView`: Your details → Document → Face check → Review. Labels in `KycFlowScreen.stepLabels`.
- **Visual:** dark KYC canvas (`AppColors.black` / `KycColors`), light status bar icons, side pad `width * 0.055`, `KycProgress` at top.
- **Interaction:** `_goTo` 560 ms `easeInOutCubicEmphasized`; back disabled after seal (`canGoBack = _step > 0 && _step < 3`); pop returns `_verified`.
- **Reusable:** multi-step dark or light **wizard chrome** for onboarding / install checklist **presentation**. SITE SECURE job lifecycle steps are **server-side** and must stay `scheduled → en_route → arrived → in_progress → completed`.
- **Exclude:** identity KYC product; locking back after a fake seal.

### KYC personal info — `lib/screens/kyc/personal_info_step.dart`

- **Purpose:** name + DOB via `KycField` + date sheet.
- **Reusable:** stacked fields, sheet picker chrome.
- **Exclude:** DOB/age 18–100 as SITE SECURE policy.

### KYC document scan — `lib/screens/kyc/document_scan_step.dart`

- **Purpose:** animated ID card beam down (0.08–0.50) then up (to 0.74), readout height 130.
- **Reusable:** **almost none** as a scanner. Optional: a **progress readout** under a real upload (`<input type="file">`) for site photos — not a fake ID scan.
- **Exclude:** fake OCR, ID card illustration as KYC.

### KYC face scan — `lib/screens/kyc/face_scan_step.dart`

- **Purpose:** ring ticks + 3 beam sweeps; readout height 160; scan 0.06–0.84.
- **Reusable:** none for production identity. Optional abstract “working” ring for a **real** long request (PDF generate) — CSS, not canvas mesh.
- **Exclude:** face mesh, liveness theater, camera permission UX we do not have.

### KYC review — `lib/screens/kyc/review_step.dart`

- **Purpose:** canned checks then `VerificationSeal` morphs to tick; shine; `VerifiedBadge`.
- **Reusable:** one continuous processing→success morph (do not tear down the spinner and mount a new checkmark).
- **Exclude:** fake security check labels as if SITE SECURE verified a passport.

## 1.2 Widgets

| Widget | File | Purpose | Visual | Interaction | SITE SECURE |
|---|---|---|---|---|---|
| `AppBottomNav` | `lib/widgets/app_bottom_nav.dart` | Floating tab bar | Height **68**, puck **60**, black capsule, white circular puck, icon 22 / 24 active | Puck **slides** 440 ms `easeOutCubic` (animates `left`, not a re-layout only); scale 0.2 → 1.08 → 1 | **Reuse heavily on mobile.** Keep SITE SECURE’s real nav model (Today/Dashboard/Customers/… + More/Work). |
| `PillButton` | `lib/widgets/pill_button.dart` | Primary CTA | Height **58**, radius **29**, black fill, white label 16/w600; loading → circle 58 + Lottie | Scale **0.97** / 200 ms; `IgnorePointer` while loading | **Reuse as Button variant `pill`.** CSS spinner, not Lottie. Keep `min-h-11` a11y floor. |
| `TransactionTile` | `lib/widgets/transaction_tile.dart` | List row | 44 leading circle, title + muted subtitle, trailing tabular amount, hairline `#EDEDED` | Tap (home list) | **Reuse as `ActivityRow`.** Amounts only where SITE SECURE already shows money (quotes). Jobs: status + time, not fake currency. |
| `AnimatedBalance` | `lib/widgets/animated_balance.dart` | Counting number | Display size, tabular | 1700 ms count-up | **Do not use for money.** Optional count-up for **non-financial** dashboard counts (open jobs) with `prefers-reduced-motion` skip. |
| `MetallicCard` | `lib/widgets/metallic_card.dart` | ISO card face | Aspect **1.586**, CustomPainter metal, Visa | Hero tag | **Exclude product.** Optional later: a **non-Visa** “premium panel” using CSS gradient — not a payment card. |
| `CardHero` | `lib/widgets/card_hero.dart` | Hero wrapper | Flight between home/selection/confirm | Flutter Hero | **Web: skip Hero.** CSS is enough. Do not add a FLIP library in wave 1. |
| `AnimatedCheck` | `lib/widgets/animated_check.dart` | Stroke tick | Draws on success | Tied to controller | **Reuse as CSS stroke or existing SuccessState icon.** |
| `VerifiedBadge` | `lib/widgets/verified_badge.dart` | Small verified chip | Accent `#4A9EDA` | Celebrate | **Restyle `Badge`/`Status`.** Not KYC. |
| `SocialSignInButton` | `lib/widgets/social_sign_in_button.dart` | Round OAuth | 58 disc, white, shadow 14/6 → 6/2 pressed; logo sizes 23–26 | Scale **0.9** / 180 ms `easeOut`; `Semantics(button: true)` | **Pattern only** if we add real OAuth later. Today: exclude Facebook/Google/Apple marks from product UI. |
| `KycField` | `lib/widgets/kyc/kyc_field.dart` | Dark input | h **54**, r **14**, fill 8% white, rim 10% white, focus rim 0.55 white | Focus animation | **Restyle `Field`/`Input` variant**, including dark auth screens. |
| `KycButton` | `lib/widgets/kyc/kyc_button.dart` | KYC CTA | Accent fill, onAccent `#0B1220` | Same pill family | Map to primary/pill on dark surfaces. |
| `KycProgress` | `lib/widgets/kyc/kyc_progress.dart` | Step meter | Segmented bar | Animates with step | **New `StepProgress`** wrapping/extending `ProgressList`. |
| `KycRise` / `KycStepLayout` | `lib/widgets/kyc/kyc_layout.dart` | Step furniture | Title 27/w600 ls -0.9 white; subtitle 14.5/w500 muted; rise offset 0.18 / 0.08 / 0.30 | Staggered fade+slide | **Reusable layout primitive** for FieldJob / onboarding copy. |
| `kycSwitchIn/Out` | same | AnimatedSwitcher curves | In `Interval(0.45,1,easeOut)`; out `Interval(0.55,1,easeIn)` | Prevents overlapping status text | **CSS** `animation` on status line. |
| `Shine` | `lib/widgets/kyc/shine.dart` | Specular sweep | Gradient sweep | Celebrate | Use sparingly (success only). GPU `transform` + opacity. |
| `ScanBeam` | `lib/widgets/kyc/scan_beam.dart` | Beam primitive | Line + glow | Driven by scan controllers | **Exclude** from product. Expensive canvas. |
| `FaceScanner` | `lib/widgets/kyc/face_scanner.dart` | Face theater | Tick ring, sweep, **dot mesh** lit by beam distance | Continuous spin | **Exclude.** JS/canvas loops. |
| `IdDocumentScanner` | `lib/widgets/kyc/id_document_scanner.dart` | ID theater | Dual paint + clip to beam | Pulse brackets | **Exclude.** |
| `ScanReadout` | `lib/widgets/kyc/scan_readout.dart` | % + status | Tabular %, AnimatedSwitcher 360 ms | Scanning vs verified | Reuse **readout typography** under real progress (PDF, upload). |
| `VerificationSeal` | `lib/widgets/kyc/verification_seal.dart` | Process→success | Dashed rings collapse, disc overshoots, tick | One widget both states | **Reuse morph idea** with CSS; keep existing `SuccessState`. |
| `BirthDateSheet` | `lib/widgets/kyc/birth_date_sheet.dart` | Wheel date | Transparent sheet, barrier black 0.62, three wheels | Confirm via `KycButton` | **Reuse sheet chrome** for date/time on mobile (job schedule display). Do **not** port 18–100 age policy. Prefer native `<input type="date">` on desktop. |
| `ReceiptPaper` | `lib/widgets/receipt/receipt_paper.dart` | Thermal slip | 300 wide, torn foot, mono 11 | Stamp animation | Visual metaphor only. |
| `PaidStamp` | `lib/widgets/receipt/paid_stamp.dart` | Rubber stamp | Rotated word | Lands after paper | Optional “נשלח” / “הושלם” stamp — **must reflect real quote/job state**, never invent PAID. |
| `VisaLogo` | `lib/widgets/visa_logo.dart` | Brand mark | Official Visa | — | **Exclude. Do not ship.** |
| `ContactlessWaves` | `lib/widgets/contactless_waves.dart` | NFC waves | Painter | — | **Exclude.** |

## 1.3 Theme

| File | Purpose |
|---|---|
| `lib/theme/app_colors.dart` | `AppColors`, `KycColors`, card face gradients |
| `lib/theme/app_theme.dart` | `ThemeData` light, Plus Jakarta Sans, type ramp |

## 1.4 Models (demo data — do not port as domain)

| File | What it is | SITE SECURE |
|---|---|---|
| `lib/models/card_tier.dart` | Local card SKUs + metal colors | Exclude |
| `lib/models/transaction_item.dart` | Demo ledger rows | Row chrome only |
| `lib/models/order_receipt.dart` | `forTier` local receipt | Exclude data; paper visual optional |

## 1.5 Navigation / routes

| Pattern | File | Notes |
|---|---|---|
| Splash → Login replace | `splash_screen.dart` | Not a router; `pushReplacement` |
| Login → Home replace | `login_screen.dart` | No session |
| Home ↔ Profile | `home_screen.dart` | **Indexed stack / opacity**, bar stays |
| Home → Card selection | `PremiumPageRoute` + Hero | |
| Selection → Confirm → Success → Receipt | stacked `Navigator` | Prototype stack, not deep links |
| Profile → KYC | `MaterialPageRoute<bool>` | Returns verified flag |

`lib/utils/premium_page_route.dart`: custom page route, **520 ms**, fade + scale from **0.96 → 1** (verified from file comments / implementation in prior inspection). Prefer CSS view transitions later; **not** a new router.

SITE SECURE must keep **TanStack Router** file routes. Do not introduce Flutter-style imperative stacks for app IA.

## 1.6 Forms, sheets, buttons, cards, lists, success, loading, transitions

Covered in tables above. Additional:

- **Hairline separators** `#EDEDED` between rows — reuse.
- **Side padding** `media.size.width * 0.055` (~20 px at 360, ~21 at 390, ~24 at 430) — reuse as a **mobile** page gutter token, not desktop.
- **Bottom safe spacer** `AppBottomNav.height + 46` so lists clear the floating bar — reuse; SITE SECURE already has `--ops-bottom-nav-offset`.
- **BouncingScrollPhysics** — iOS rubber band. On web, native overflow is enough; do not polyfill bounce.
- **Haptics** — `HapticFeedback.light/medium/heavy/selectionClick`. Web: optional `navigator.vibrate` **only** behind a user-gesture and a setting; default **off**. Hebrew field-service use does not require it.
- **SystemUiOverlayStyle** light/dark status bar — web: `theme-color` / existing appearance settings only.

---

# 2. TEMPLATE DESIGN TOKENS

Extracted from Flutter source. Do not guess. SITE SECURE must **adapt** these into its own system (keep Heebo + action blue `#0b6bcb` as brand). Values below are **template facts**.

## 2.1 Colors — `lib/theme/app_colors.dart`

| Token | Value | Role |
|---|---|---|
| `AppColors.black` | `#000000` | Nav capsule, primary pill, KYC canvas |
| `AppColors.white` | `#FFFFFF` | Type on black, social discs, puck |
| `AppColors.darkSurface` | `#0E0E0E` | Elevated dark |
| `AppColors.scaffoldLight` | `#F6F5F3` | Light app canvas (warm, not slate-blue) |
| `AppColors.hairline` | `#EDEDED` | Row borders |
| `AppColors.textMuted` | `#8A8A8A` | Secondary text on light |
| `AppColors.cardInk` | `#1A1A1A` | Dark type on card / receipt mix |
| `AppColors.positive` | `#12B76A` | Credit / success |
| `AppColors.negative` | `#E5484D` | Debit / error |
| `AppColors.verified` | `#4A9EDA` | KYC/verified accent (sky, **not** SITE SECURE action blue) |

**KycColors** (same file):

| Token | Value / mix | Role |
|---|---|---|
| accent | `#4A9EDA` | KYC primary |
| inkMuted | `#8B9CB3` | Dark-theme secondary |
| fieldFill | white **8%** | Input fill |
| fieldRim | white **10%** | Input border |
| fieldFocus | white **0.55** | Focus ring |
| onAccent | `#0B1220` | Text on accent buttons |

**Receipt — `receipt_paper.dart`:**

| Token | Value |
|---|---|
| stock | `#FAF8F3` |
| ink | `#1B1A18` |
| inkSoft | `#7A776F` |

**Card face gradients** (`card_tier.dart` / `AppColors`): silver / gold / black metal stops — **fintech-specific. Do not add as SITE SECURE brand ramps.**

**SITE SECURE mapping (intent, not implemented):**

- Keep `packages/design-system` action `#0b6bcb` as **the** brand action color.
- Optionally add a **warm canvas** token inspired by `#F6F5F3` as `bg` alternative — product decision, must still pass contrast.
- Do **not** replace action blue with template black as the only CTA on desktop SaaS (black pills are excellent on **mobile** primary actions; desktop keeps denser secondary buttons).
- Success/danger: template `#12B76A` / `#E5484D` vs SITE SECURE `#067647` / `#b42318` (light). **Do not silently swap financial/error semantics.** If hues are adjusted, update tokens once and re-check contrast + status chips. Quote totals and job states stay data-driven.

## 2.2 Radius

| Use | Value | Source |
|---|---|---|
| Pill CTA | **29** (half of 58) | `PillButton` |
| Field | **14** | `KycField` |
| Social / puck circle | **50%** of 58 / 60 | SocialSignInButton / AppBottomNav |
| Card panel (home) | visually ~20–24 | Home / metallic — **NOT VERIFIED** as a named token (painter, not `BorderRadius` constant in theme) |
| Receipt tooth | **7** | torn foot depth, not a UI radius |

SITE SECURE today: `tokens.json` control **6** / panel **8**, but `apps/web/src/styles.css` ops override control/panel to **3px**. That sharp ops look is the opposite of the template. Migration should **raise** radius on mobile chrome without breaking dense tables (tables can stay tighter).

## 2.3 Spacing

| Pattern | Value | Source |
|---|---|---|
| Horizontal page gutter (mobile) | **5.5% of width** | Login, Home, Profile, KYC |
| List top after header | **24** | Profile `ListView` |
| Nav clearance | **68 + 46** | Home/Profile padding bottom |
| Type stack title→subtitle | **8** | `KycStepLayout` |
| Field stack | typical 12–16 | Login form — **NOT VERIFIED** as a single constant |
| Design-system space scale (SITE SECURE) | 4, 8, 12, 16, 24, 32, 48, 64 | `tokens.json` — **keep this scale**; map 5.5% gutter to a token like `page-gutter-mobile: clamp(16px, 5.5vw, 24px)` |

## 2.4 Typography

**Template (`app_theme.dart`):** Plus Jakarta Sans.

| Style | Size | Weight | Tracking / height |
|---|---|---|---|
| displayLarge | 34 | 800 | letterSpacing **-1.2** |
| titleLarge | 22 | 700 | |
| KYC title | 27 | 600 | height 1.15, ls **-0.9** |
| KYC subtitle | 14.5 | 500 | height 1.45 |
| bodyLarge | 16 | 500 | |
| Pill label | 16 | 600 | |
| labelLarge | 13 | 600 | ls **0.2** |
| Receipt mono | 11 | 400/500 | Google Fonts mono |

**SITE SECURE (`tokens.json`):** Heebo (UI), Inter (Latin), pageTitle 24/650, section 18/600, body 14/400, dense 13, caption 12, label 13/500.

**Do not replace Heebo.** Hebrew-first. Optionally use **one** display size 28–32 on mobile Dashboard/Today hero only. Latin SKUs/serials stay `font-mono` as today.

## 2.5 Shadows / hairlines

| Token | Template | Notes |
|---|---|---|
| Hairline | `#EDEDED` 1px | Prefer over heavy shadows on lists |
| Social rest | black 5% / blur 14 / y 6 | |
| Social pressed | black 2% / blur 6 / y 2 | |
| Nav capsule | soft shadow under black bar | Exact blur **NOT VERIFIED** as a named constant |
| SITE SECURE card shadow | `0 1px 2px rgb(15 23 42 / 6%)` | ops theme currently `shadow-card: none` |

Template is **hairline-first**, shadow-second. Match that on mobile cards. Desktop tables stay border-based.

## 2.6 Control / icon / nav dimensions

| Item | Value | Source |
|---|---|---|
| Pill / social height | **58** | PillButton, SocialSignInButton |
| Field height | **54** | KycField |
| Nav bar height | **68** | `AppBottomNav.height` |
| Nav puck | **60** | `AppBottomNav` |
| Leading list icon circle | **44** | TransactionTile |
| Nav icon | 22 inactive / 24 active | AppBottomNav |
| SITE SECURE hit target | **44** | `tokens.json` `hitTargetMin` |
| SITE SECURE Button | `min-h-11` (44) | `Button.tsx` |
| SITE SECURE bottom nav offset | `3.75rem + safe-area` | `styles.css` `--ops-bottom-nav-offset` |

58 px CTAs are **larger** than SITE SECURE’s 44. On mobile primary actions, 52–58 is appropriate. Do not force 58 px on every desktop toolbar button.

## 2.7 Motion tokens (template)

| Token | Value | Source |
|---|---|---|
| Press scale (pill) | 0.97 / **200 ms** | PillButton |
| Press scale (social) | 0.9 / **180 ms** `easeOut` | SocialSignInButton |
| Nav puck | **440 ms** `easeOutCubic` | AppBottomNav |
| Page route | **520 ms** fade+scale 0.96 | PremiumPageRoute |
| Carousel page | **560 ms** `easeOutCubic` | Card selection / KYC pages |
| KYC page curve | `easeInOutCubicEmphasized` | KycFlowScreen |
| Entrance Home/KYC | **900–1100 ms** staggered intervals | Home, Profile, Card, Confirm |
| Profile celebrate | **1500 ms** | ProfileView |
| AnimatedSize verify card | **460 ms** `easeOutCubic` | ProfileView |
| Button morph to loader | **460 ms** | Order confirmation |
| Fake processing | **2300 ms** | Login / order — **do not copy duration as UX for real APIs** |
| Balance count | **1700 ms** | AnimatedBalance |
| Success Lottie driver | **~4000 ms** | OrderSuccessScreen (composition may override) |
| Scan readout switch | **360 ms** | ScanReadout |
| Verify delay after KYC pop | **220 ms** | ProfileView |
| SITE SECURE motion today | **160 ms** | `tokens.json` `motion.durationMs` |

SITE SECURE should **extend** motion tokens (press 180–200, nav 400–440, entrance 400–700) without making every view take 1+ seconds. Real network time replaces 2300 ms theater.

**Curves to name in CSS:** `--ease-out-cubic: cubic-bezier(0.33, 1, 0.68, 1)` (approx. Flutter `easeOutCubic`). Flutter `easeInOutCubicEmphasized` ≈ Material emphasized easing; use `cubic-bezier(0.32, 0.72, 0, 1)` as a stand-in — **NOT VERIFIED** as Flutter’s exact cubic.

---

# 3. MOTION SYSTEM

Prefer **CSS transitions/animations**. Do not add Lottie, rive, or Framer Motion unless a later phase proves CSS cannot do the morph. Template uses `lottie` for login/payment/contactless — that is **not** a reason to add the dependency.

| Flutter animation | Source | Closest React/CSS | Notes |
|---|---|---|---|
| Entrance fade + rise (`KycRise`, Home `_Rise`) | kyc_layout, home, profile | `@keyframes rise { from { opacity:0; transform: translateY(12px) } }` + `animation-delay` per child | Use `12–18%` of a short distance, not 18% of viewport. `prefers-reduced-motion: reduce` → opacity only or off. |
| Fade | FadeTransition | `transition: opacity 200ms` | Default for tab cross-fade. |
| Scale-on-press | AnimatedScale 0.97 / 0.9 | `active:scale-[0.97]` on `<button>` | **Must stay on real buttons**, not `div` + click. |
| AnimatedSwitcher (status text) | kycSwitchIn/Out | Two-step opacity keyframes so outgoing hits 0 before incoming | Do not overlap two status strings (RTL still needs this). |
| Hero | CardHero | **Skip** in first waves. Optional later: View Transitions API on supported browsers only. | Do not add a JS FLIP library for cards. |
| Page transitions | PremiumPageRoute 520 ms 0.96 scale | Optional `::view-transition` or simple opacity on `<Outlet>` | TanStack Router stays. Do not wrap every navigation in 520 ms. |
| Navigation puck | AppBottomNav left tween 440 ms | CSS `transform: translateX(...)` on a single puck element; **do not animate `left`** (layout). Measure tab widths after RTL. | Puck position is **logical**; see §7. |
| Loading morph (pill → circle) | PillButton / order confirm | CSS `width`/`border-radius` transition **or** keep spinner inside pill (safer a11y) | Morphing width is tricky with Hebrew labels of varying length. Prefer **spinner inside pill** (already in `Button.tsx`) for wave 1; morph later if labels are short. |
| Lottie loader | `assets/images/loading.json` | CSS `LoaderCircle` already in Button | **Do not import the JSON into the web app** unless legal/design later explicitly wants that file as a static asset. |
| Success Lottie contactless | `Contactless.json` | CSS check + existing `SuccessState` | Exclude NFC metaphor. |
| KYC progress bar | KycProgress | `transform: scaleX` on segments | Progress value from **real** step index, not fake scan %. |
| Scan beam / face mesh | FaceScanner, IdDocumentScanner | **Do not implement.** | rAF loops + canvas = jank on Android Chrome. |
| Shine | shine.dart | CSS gradient `transform: translateX` once | Success only. |
| Counting balance | AnimatedBalance | **Skip money.** Optional `requestAnimationFrame` count for job counts, cancelled by reduced-motion. | Never animate quote ILS totals as a ticker (misread risk). |
| Receipt stamp | PaidStamp | CSS scale+rotate once | Copy must be real status. |
| Profile celebrate 1500 ms | ProfileView | CSS on badge | Only when a **real** flag flips. |
| Scroll-driven card spin | CardSelectionScreen | **Do not implement.** | |

**Haptics:** ignore by default.

---

# 4. COMPONENT TRANSLATION MAP

| Flutter component | Flutter file | Visual purpose | SITE SECURE equivalent | Target React component | Target file/package | Reuse / New / Restyle | Risk | Notes |
|---|---|---|---|---|---|---|---|---|
| AppBottomNav | `lib/widgets/app_bottom_nav.dart` | Floating black bar + sliding puck | Mobile tab bar | `AppBottomNav` | `apps/web/src/components/AppBottomNav.tsx` + `styles.css` `.ops-bottom-nav` | Restyle | Medium | **Keep** `isNavSelected`, More/Work sheets, RBAC-filtered items. Visual only. |
| PillButton | `lib/widgets/pill_button.dart` | Full-width black pill CTA | Primary mobile action | `Button` variant `pill` | `packages/ui/src/Button.tsx` | Restyle / extend | Low | Keep `loading`, `aria-busy`, min height ≥44. No Lottie. |
| SocialSignInButton | `lib/widgets/social_sign_in_button.dart` | Round pressable icon | Optional icon button | `CircleIconButton` | `packages/ui` (new) | New if ≥3 uses | Low | Do not ship FB/Google/Apple assets. |
| TransactionTile | `lib/widgets/transaction_tile.dart` | Leading glyph + title + meta + trailing | Activity, job row, quote row (mobile) | `ActivityRow` / `PremiumListRow` | `packages/ui` + `ActivityList.tsx` | New + restyle consumers | Low | Trailing is status/time/ILS **from API**, never demo money. |
| AnimatedBalance | `lib/widgets/animated_balance.dart` | Hero number | Dashboard KPI | `MetricCard` value slot | dashboard widgets | New presentational | Medium if used on money | No count-up on ILS. |
| MetallicCard | `lib/widgets/metallic_card.dart` | Payment card | — | — | — | Exclude | High (brand/legal) | No Visa. |
| CardHero | `lib/widgets/card_hero.dart` | Shared-element flight | — | — | — | Exclude (wave 1–6) | Medium perf | |
| KycField | `lib/widgets/kyc/kyc_field.dart` | Tall rounded field | Forms | `Input` / `FieldShell` variant | `packages/ui/src/Field.tsx` | Restyle | Low | Preserve labels, errors, `id`. |
| KycButton | `lib/widgets/kyc/kyc_button.dart` | Accent CTA on dark | Auth / wizard | `Button` | `packages/ui` | Restyle | Low | |
| KycProgress | `lib/widgets/kyc/kyc_progress.dart` | Segmented steps | Wizards, FieldJob **display** of current server state | `StepProgress` | extend `ProgressList.tsx` | New / extend | **High if wired wrong** | Must **display** job/quote state, not invent next state. |
| KycStepLayout | `lib/widgets/kyc/kyc_layout.dart` | Title / body / pinned footer | Mobile step pages | layout wrapper | `packages/ui` or `apps/web/src/components` | New | Low | |
| KycRise | same | Stagger enter | Page sections | CSS classes | `packages/design-system` / `styles.css` | New CSS | Low | |
| VerificationSeal / AnimatedCheck | kyc + `animated_check.dart` | Process→success | Save/complete | `SuccessState` | `packages/ui/src/Feedback.tsx` | Restyle | Low | |
| VerifiedBadge | `verified_badge.dart` | Small verified | Status | `Badge` / `Status` | `Display.tsx` | Restyle | Low | |
| Scan* / FaceScanner | kyc/ | Fake biometrics | — | — | — | Exclude | High (misleading UX) | |
| BirthDateSheet | `birth_date_sheet.dart` | Bottom sheet wheels | Mobile pickers | `Drawer` / new `BottomSheet` | `Overlay.tsx` | Extend | Low | Native date on desktop. |
| ReceiptPaper / PaidStamp | receipt/ | Printed slip | Document success | optional presentational | later | Optional | Medium | Must not look like a fiscal receipt unless it is a real PDF. |
| Shine | `shine.dart` | Sweep | Success | CSS | styles | Optional | Low | |
| VisaLogo / ContactlessWaves | widgets/ | Card brands | — | — | — | Exclude | Legal | |
| PageView carousel | card_selection | 3D picker | — | — | — | Exclude | Perf | |

---

# 5. SCREEN MAPPING

Do **not** force fintech semantics onto SITE SECURE.

| Flutter screen / pattern | Useful SITE SECURE target | What to reuse | What NOT to reuse |
|---|---|---|---|
| Splash | Session restore / login first paint | Quiet branded canvas | Timed marketing splash, fake delay |
| Login | `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email` | Pill CTA, tall fields, error shake, loading on **real** `signInWithPassword` | Fake 2300 ms, social login as working, curtain requirement, Lottie |
| Home | `/app/dashboard` (managers) + `/app/today` (technicians) | Hero metric, activity list, floating nav, staggered enter | Bank balance, Visa card, demo transactions, two-tab IA |
| Profile | `/app/settings` (mobile) + user menu | Header, row list, celebration for **real** completion | KYC door, fake verified identity |
| Card selection | Catalog **mobile** browse (later) | Horizontal snap **cards of products** (photos from catalog API) | Metal Visa, 3D spin, card tiers |
| Order confirmation | Quote send confirm / job complete confirm | Summary rows + morphing CTA bound to **real mutation** | Payment processing theater, card price |
| Order success | After quote send, job completed, PDF ready | Dedicated success + next actions (existing buttons) | Contactless Lottie, fake receipt number |
| Receipt | Public quote `/q/$token`, PDF preview chrome | Paper-like panel, mono SKUs | PAID stamp unless quote `accepted`; barcode |
| KYC personal info | Onboarding `/onboarding`, company settings | Field stack + sheet | Passport name/DOB as KYC |
| Document scan | Site photo / attachment upload (if already exists) | Progress readout | Fake ID scan, pretending OCR |
| Face scan | — | — | Entire pattern |
| Review (seal) | End of FieldJob complete / onboarding done | Continuous success morph | Fake “document authentic” checks |

---

# 6. SITE SECURE ROUTE MIGRATION MAP

Routes from `apps/web/src/routes/**`. Classification is **visual risk**, not a license to change loaders/APIs.

Legend: **business logic coupling** = how easy it is to accidentally touch mutations, authz, or money.

### SAFE FIRST WAVE

| Current route | Current component | Proposed visual pattern | Flutter refs | Logic coupling | Mobile | Desktop | Regression risks |
|---|---|---|---|---|---|---|---|
| `/login` | `routes/login.tsx` | Warm canvas, pill submit, tall fields | LoginScreen, PillButton, KycField | **Auth API must stay.** Only chrome. | Full-screen template-like | Centered column, not stretched card | Session, errors, Hebrew, keyboard |
| `/register` | `register.tsx` | Same field/CTA language | Login | Auth + org create — **chrome only** | Same | Same | Duplicate email, invite |
| `/forgot-password` `/reset-password` `/verify-email` | corresponding routes | Same | Login | Auth | Same | Same | Token flows |
| `/app/dashboard` **chrome only** | `dashboard.tsx` + widgets | Metric + activity rows | Home, TransactionTile | Widgets already fetch real APIs | Hero + list, no tables | KPI row + existing widgets | Entitlement-hidden widgets must remain hidden |
| `/dev/ui` | `dev/ui.tsx` | Playground for new variants | — | None | — | Showcase | Do not ship to prod users |

### SECOND WAVE

| Current route | Current component | Proposed visual pattern | Flutter refs | Logic coupling | Mobile | Desktop | Regression risks |
|---|---|---|---|---|---|---|---|
| `/app` shell | `routes/app/route.tsx` + nav components | Floating nav, page gutter | AppBottomNav, Home shell | Nav items from RBAC — **do not change filter** | Puck bar | Keep side/top nav; share colors/type | Technician vs manager items, More/Work |
| `/app/today` | `today.tsx` + TodayList | Job rows as tiles | TransactionTile, KycStepLayout | Job list API; **no new actions** | Card list | Comfortable list or compact table | Assigned-only scope |
| `/app/customers` index | `customers/index.tsx` | Mobile rows; desktop table | TransactionTile | List/search APIs | Rows + search | Table | Isolation |
| `/app/sites` index | `sites/index.tsx` | Same | same | same | Rows | Table | Isolation |
| `/app/tasks` | `tasks/index.tsx` | Rows | same | Task APIs | Rows | Table | Permissions |
| `/app/leads` index | `leads/index.tsx` | Rows | same | Lead APIs | Rows | Table | Permissions |
| `/app/service` | `service/index.tsx` | Rows | same | Service calls | Rows | Table | Numbering/display only |
| `/app/quotes` **index** | `quotes/index.tsx` | Mobile rows with **real** totals | TransactionTile | List + status; **no pricing** | Status chips + ILS trailing | Keep table | Status labels vs state machine |
| `/app/warranties` | `warranties/index.tsx` | Rows | same | List | Rows | Table | |
| `/app/knowledge` | `knowledge/index.tsx` | Article list chrome | Home list | Content | Cards | Two-pane | |
| `/app/settings/*` (company, appearance, notifications, numbering, security **display**) | settings routes | Profile-like rows | ProfileView | Mostly forms; **no authz engine** | Sheets/rows | Two-column forms | Appearance must not break RTL |
| `/legal/*` | legal routes | Typography only | — | None | Readable | Readable | |

### REQUIRES CARE

| Current route | Current component | Proposed visual pattern | Flutter refs | Logic coupling | Mobile | Desktop | Regression risks |
|---|---|---|---|---|---|---|---|
| `/app/today` **actions** | TodayList | Pills for existing transitions | PillButton | **Job lifecycle** | Large targets | Same actions | Illegal transitions, technician scope |
| `/app/jobs/$jobId` FieldJob | `jobs/$jobId.tsx` | Step **display** + pill actions | KycProgress, PillButton, SuccessState | **Lifecycle + reports + photos** | Step UI reflecting server state | Two-column | Completing, photos, quotas |
| `/app/customers/$customerId` | customer detail | Profile header + sections | ProfileView | Customer mutations | Stacked | Header + tabs | Isolation |
| `/app/sites/$siteId` | site detail | Same | Profile | Site mutations | Stacked | Header + tabs | Isolation |
| `/app/leads/$leadId` | lead detail | Same | — | Lead mutations | Stacked | Form | |
| `/app/projects/*` | projects | Cards/list | — | Project APIs | Cards | Table | |
| `/app/catalog` | `catalog.tsx` | Product cards (not metal Visa) | Card selection **layout only** | Catalog + technician **no catalog** entitlement | Cards | Dense table/grid | Hidden SKUs, prices |
| `/app/quotes/new` and `$quoteId` **list chrome / header only** | quote routes | Headers, status chip | Status, PillButton | Coupled to builder | — | — | Easy to leak into builder |
| `/q/$token` `/public/quotes/$token` | public quote | Paper-like read view | ReceiptPaper **texture only** | Public token; **no auth** | Readable | Readable | Token leakage, accept/reject if present |
| `/onboarding` | `onboarding.tsx` | Step layout | KycFlow **chrome** | Org setup | Steps | Steps | Must not become KYC |
| `/invite/$token` | invite | Login-like | Login | Membership | — | — | Grants |
| `/admin/*` | admin routes | Sharper SaaS, same tokens | — | Super-admin | Optional | Dense tables | Audit, orgs, flags |

### HIGH RISK / LATER

| Current route | Current component | Proposed visual pattern | Flutter refs | Logic coupling | Mobile | Desktop | Regression risks |
|---|---|---|---|---|---|---|---|
| `/app/quotes/$quoteId` QuoteBuilder | quote editor | **Do not redesign yet.** See §16 | Order confirmation is **not** a CPQ | pricing, VAT, CCTV, snapshot, send | Never force phone tables | Dense SaaS | Money, state machine, PDF |
| `/app/quotes/$quoteId.preview` | preview | Later, paper chrome | Receipt | Snapshot | — | — | Snapshot immutability |
| `/app/settings/pdf-templates` PDF Studio | pdf-templates | Later | Receipt paper | Template builder | Poor fit for phone | Desktop-first | PDF output |
| `/app/settings/roles` | roles | Later | Profile rows | **RBAC editor** | Avoid | Desktop | Grants, technician isolation |
| `/app/settings/users` | users | Later | — | Invites/roles | — | Table | Privilege escalation |
| `/app/settings/quotes` CPQ settings | quotes settings | Later | — | Quote defaults | — | Forms | VAT/numbering |
| `/admin/organizations` `/admin/users` `/admin/audit` `/admin/flags` `/admin/beta` `/admin/badges` `/admin/feedback` | admin | Token polish only | — | Platform | — | Tables | Cross-tenant |

`/app/index.tsx` redirects by role — **visual NA; do not change redirect logic.**

---

# 7. RTL ADAPTATION

The template is **LTR English**. SITE SECURE is **Hebrew-first RTL** (`dir` from existing i18n). Every pattern below must be adapted. Do **not** blindly `scaleX(-1)` icons whose meaning is universal (play, checkmark, warning, lock, camera, user).

| Pattern | RTL rule |
|---|---|
| Page flow | CSS logical properties: `padding-inline`, `margin-inline`, `inset-inline-start`. Do not copy Flutter `left` padding. |
| Icon direction | Chevrons for “next/back” **must flip** (`chevron-left` in LTR “back” becomes inline-start). |
| Back arrows | Use `ArrowRight` in RTL if it means back — follow existing `he` nav, not Flutter’s leading-left back. |
| Lists | Leading glyph = **inline-start**; trailing amount/status = **inline-end**. |
| Amounts | ILS: `he-IL` number format as today. Tabular nums. Do not put `-` debit coloring on quotes. |
| Phone numbers | Keep LTR isolates (`dir="ltr"` / `unicode-bidi: isolate`) as existing patterns. Do not reverse digits. |
| SKUs / serials / emails | `dir="ltr"` isolate + mono. |
| Dates | `he-IL` locale as today. Do not port English month wheels (`Jan`…). |
| Mixed Hebrew/English | Existing Heebo + Inter stack. Display titles stay Heebo. |
| Tables | Desktop tables: sticky first column still **inline-start**. Do not mirror column order incorrectly. |
| Bottom navigation | Puck `translateX` from **inline-start**. Item order follows existing SITE SECURE Hebrew nav order, **not** Flutter Home|Profile. |
| Drawers / sheets | `Drawer` already exists. Sheet handle top-center (universal). Confirm button full-width. Barrier 62% black is fine. |
| Shine / beams | If ever used, sweep **inline-start → inline-end**. |
| Scale-on-press | Universal. |
| Hero numbers | Align start for labels, end for KPIs if that matches current dashboard — **keep current dashboard alignment conventions** unless a dedicated visual pass says otherwise. |

**Do not mirror:** checkmarks, status dots, PDF page previews, map pins (if any), CCTV diagrams, logos.

---

# 8. MOBILE STRATEGY (~360 / 390 / 430)

Use the Flutter project **heavily** here. Do **not** force desktop tables onto phones.

**Gutter:** `clamp(16px, 5.5vw, 24px)` ≈ 20 / 21 / 24 px at 360 / 390 / 430.

**Nav:** floating capsule, height ~68 + safe-area, puck 56–60, clearance `--ops-bottom-nav-offset` updated to match new height. **Same items and selection rules.**

| Surface | 360 | 390 | 430 | Pattern |
|---|---|---|---|---|
| AppBottomNav | 4–5 items max visible; More overflow unchanged | same | same | Black capsule, white puck, 44+ hit |
| Today | One column job cards; status chip; **existing** lifecycle buttons as pills stacked | slightly more type | two-line subtitle fits | No table |
| Dashboard | Hero KPI (real widget data) + `ActivityRow` list; hide dense charts or stack | same | same | Entitlements still hide blocks |
| Customers / Sites / Service / Tasks / Quotes list | Search + rows (glyph, title, meta, trailing status) | same | same | Quotes trailing = **real** total from list DTO |
| FieldJob | Title, customer, **stepper reflecting server status**, pills for **allowed** actions only | same | more room for photos | See §15 |

**Press states:** `active:scale-[0.97]` on pills. **Loading:** existing Button spinner on the real mutation. **Success:** brief `SuccessState` then stay on the real next screen (Today list, job completed view) — no fake receipt stack.

---

# 9. DESKTOP STRATEGY (1024 / 1280 / 1440+)

The template is a **phone app**. Stretching `TransactionTile` to 1440 looks like a bank marketing page, not a CPQ tool.

| Width | Approach |
|---|---|
| 1024 | Shared tokens (hairline, type, radius). Optional compact side nav. Lists may still be cards for technician; tables for catalog/quotes if role is office. |
| 1280 | Standard SaaS: side or top nav (existing), **tables**, filters, split panes. |
| 1440+ | Max content width for reading; **tables keep using the extra columns** (SKU, stock, VAT, technicians). |

**Preserve productivity for:** tables (`packages/ui` Table), catalog, CPQ QuoteBuilder, PDF Studio, RBAC matrix, admin.

**Translate language, not layout:**

- Hairline borders, calmer surfaces, slightly larger radius on **cards/modals**, not on every `<td>`.
- Primary modal CTAs can be pills; toolbar actions stay compact `Button` secondary/ghost.
- No floating black nav on desktop (it fights density and keyboard). Keep current desktop nav; reuse **color + type + focus**.
- No 5.5% side gutter on 1440 (wastes 80px+ per side). Use existing page padding.

---

# 10. DESIGN SYSTEM PLAN

**Prefer extending:**

- `packages/design-system` (`tokens.json` + emitted CSS variables)
- `packages/ui` (Button, Field, Card, Status, Feedback, Overlay, ProgressList, Table, TabsHeader)

**Do not** create a parallel `apps/web/src/fintech.css` architecture or a second component library.

**Token work (future, not this document’s implementation):**

1. Add motion tokens (press, nav, enter) next to `motion.durationMs: 160`.
2. Add radius tokens: `radius.pill`, `radius.field`, keep `control` for dense tables.
3. Optional `color.canvasWarm` — product decision; default stay until contrast QA.
4. Keep Heebo / Inter / mono.
5. Keep action blue.

**Consolidate later from `apps/web/src/styles.css` (do not do it now):**

- `.ops-card`, `.ops-bottom-nav*`, `.ops-page`, quote/catalog one-offs that duplicate Card/Button
- Duplicate `--radius-*` override (3px ops vs tokens 6/8) — **resolve in a dedicated token PR**, because it will visually change almost every control
- Status chips defined locally vs `Status` in `Display.tsx`

`styles.css` is large (thousands of lines). Consolidation is **Phase 1–2 follow-on**, not a rewrite of QuoteBuilder classes in the same PR.

---

# 11. NEW COMPONENT CANDIDATES

Only if **repeated** (≥2–3 surfaces). Presentational. No data fetching inside.

| Candidate | Why justified | Not justified if |
|---|---|---|
| `PremiumCard` | Mobile dashboard, today, settings groups | If `Card` + className is enough after token radius bump |
| `MetricCard` | Dashboard KPIs (existing widgets) | Do not invent new metrics |
| `ActivityRow` / `PremiumListRow` | Activity, today, customers, quotes list mobile | Don’t fork per entity with copy-paste |
| `ActionPill` | Alias of `Button variant="pill"` — **prefer Button variant**, not a second component | Separate component only if API diverges |
| `CircleIconButton` | Nav adjacent, sheet close, icon-only | Must be `<button>` |
| `FloatingMobileNav` | If `AppBottomNav` stays app-specific, keep it in `apps/web`; extract only if storybook needs it | Don’t move RBAC into `packages/ui` |
| `BottomSheet` | Birth-date pattern; filters; More already uses overlay | Extend `Drawer` if it already matches |
| `StepProgress` | FieldJob display, onboarding, KYC-like chrome | Must not own job state |
| `StatusChip` | If `Status`/`Badge` cannot express quote/job tones | Prefer extending `Status` |
| `SuccessState` | **Already exists** in Feedback.tsx — restyle, don’t duplicate | |
| `SectionHeader` | Profile/Home section labels | `PageHeader` exists — extend |

**Do not create:** `MetallicCard`, `VisaLogo`, `FaceScanner`, `AnimatedBalance` as money, `ReceiptBarcode`.

---

# 12. EXISTING COMPONENTS TO RESTYLE (NOT REPLACE)

| Component | File | Extend how |
|---|---|---|
| `Button` | `packages/ui/src/Button.tsx` | Add `pill` variant; optional `size="lg"`; keep primary/secondary/ghost/danger; keep loading/`aria-*` |
| `Card` | `Display.tsx` | Radius/shadow via tokens; optional `padding="compact"` |
| `Badge` / `Status` | `Display.tsx` | Tighter hairline; job/quote tones already data-driven |
| `FieldShell` `Input` `Select` `Textarea` | `Field.tsx` | Height/radius/focus rim variant `comfortable` for mobile/auth |
| `EmptyState` `ErrorState` `LoadingBlock` `SuccessState` `Skeleton` | `Feedback.tsx` | Typography + motion; keep semantics |
| `Drawer` `Modal` `Dropdown` `Tooltip` `ToastViewport` | `Overlay.tsx` | Barrier opacity; sheet radius; **focus trap stays** |
| `ProgressList` | `ProgressList.tsx` | Visual segments; steps still passed in |
| `Table` | `Table.tsx` | Do not pill-ify cells |
| `PageHeader` `Tabs` | `TabsHeader.tsx` | Type ramp |
| `Checkbox` `Radio` `Switch` | `Controls.tsx` | Focus rings; sizes |
| `AppBottomNav` | `apps/web` | Visual shell only |
| `NavIcon` | `apps/web` | Colors for puck contrast (white on black) |

---

# 13. DASHBOARD CONCEPT (text only)

**Not coded.** Uses **only** information current dashboard widgets already show (see snapshot / `apps/web/src/components/dashboard/*`). Do **not** invent APIs.

**Hierarchy (mobile, template-inspired):**

1. **Greeting / context** — workspace name + user, not “available balance”.
2. **One hero metric** — pick the **most relevant existing** KPI already rendered (e.g. open jobs or quotes awaiting — whichever the current dashboard already queries). If multiple widgets exist, **one** is visually hero; others become smaller `MetricCard`s. **No fake $22,000.**
3. **Primary action** — existing `NewQuoteButton` if `canCreateQuote`; otherwise omit (RBAC).
4. **Activity list** — existing `ActivityList` items: `title_he`, `occurred_at`, `entity_type` / `entity_id` links. Visual = `ActivityRow` (glyph by entity type, time trailing). Empty = existing `GettingStarted` copy.
5. **Secondary widgets** — existing cards stacked (quotes snapshot, etc.) as `PremiumCard`, not a metal Visa.

**Desktop:** same tokens; hero becomes a **row of MetricCards**; activity beside or below; **tables/widgets keep density**. No carousel of cards.

**Technician:** dashboard may already redirect to Today (`/app/index` role redirect). Do not show office KPIs the API does not return for that role.

---

# 14. TODAY / TECHNICIAN CONCEPT (text only)

**Preserve job lifecycle actions exactly** (`scheduled → en_route → arrived → in_progress → completed` and whatever the UI already exposes as allowed).

**Mobile layout:**

- Title: היום / existing `he` string
- List of assigned jobs as large rows: customer, site, window, **status chip from server**
- Tap → existing `/app/jobs/$jobId`
- Inline actions (if Today already has them): same mutations, **PillButton** / `min-h-11+`
- Empty state: existing copy
- Nav: Today selected in restyled `AppBottomNav`

**Do not:** add a fake map from the Flutter template (there is none); add KYC; show quote builder; show catalog if technician is denied; count-up money.

**Motion:** list rise on first paint; status chip color change on successful mutation; spinner on the **pressed** action only.

---

# 15. FIELD JOB CONCEPT (text only)

FieldJob can inherit **presentation** from KYC layout **without** becoming a wizard that owns state.

| Template idea | How to inherit safely |
|---|---|
| Large touch targets | Lifecycle buttons `min-h-12` / pill, full width on 360 |
| Pill actions | `Button variant="pill"` for the **single primary allowed** transition; secondary ghost for the rest |
| Step progression | `StepProgress` **bound to `job.status`** (and only statuses the API uses). Tapping a future step does **nothing** unless the product already allows it. No local “scan complete → next”. |
| Premium cards | Customer, site, equipment, notes in `PremiumCard` |
| Motion | Rise on sections; success morph when **complete** mutation returns |
| Success feedback | Restyle `SuccessState`; then remain on completed job view / back to Today as today |

**Do not change:** who can transition, payload, photos, reports, quotas, audit.

**Do not add:** face scan, ID scan, fake percent readout as if the job were “verifying”.

---

# 16. QUOTE BUILDER SAFETY PLAN (no implementation)

QuoteBuilder is **high risk**. Do **not** redesign it in early phases.

**Separate before any large visual rewrite:**

| Layer | Contains | Visual rewrite allowed? |
|---|---|---|
| Visual chrome | Page padding, headers, fonts, card radius | Yes, **late**, in isolation |
| Presentational | Line row layout, status chip, buttons | Yes if props stay the same |
| Orchestration | React Query hooks, route loaders | **No** in a CSS PR |
| Mutations | send, accept, line CRUD | **No** |
| Pricing | `pricing.py` + displayed totals | **Display only**; never recompute in CSS/JS beyond existing client |
| CCTV | `cctv_sizing` / `cctv_recommend` | **No** visual PR should retune formulas |
| PDF | snapshot, `quote_pdf.py`, preview | Chrome around iframe/canvas only |
| Send/share | existing endpoints | Button restyle only |

**Procedure:** (1) screenshot + Playwright/RTL tests on totals and state chips, (2) restyle `Button`/`Field` **globally** first so QuoteBuilder inherits tokens without a dedicated rewrite, (3) only then a QuoteBuilder chrome PR that does not touch hooks.

Order Confirmation in Flutter (fake pay) is **not** a map of CPQ.

---

# 17. TEST / REGRESSION STRATEGY

Before **each** wave, run the relevant existing suites. Do not wait until Phase 8.

| Area | Existing protection (from snapshot / repo) | Extra before a visual wave |
|---|---|---|
| Auth | Session tests, login route | Manual: login/logout, expired session |
| RBAC | `packages/authz` tests, API 403s | Visual: buttons still **absent** not just disabled, where product hides them |
| Custom roles | roles UI + API tests | Don’t restyle roles until Phase 8 |
| Technician isolation | dispatch/jobs tests, RLS | Today/FieldJob still assigned-only |
| Workspace isolation | FastAPI isolation tests | Lists don’t leak |
| Responsive nav | web tests for bottom nav if present | Puck + More/Work still work at 360/768/1280 |
| Quote totals | pricing tests, quote API tests | Never assert Flutter `$22,000` |
| Quote states | API state machine tests | Chips match states |
| CCTV | TS + Python tests | Untouched |
| Job lifecycle | `test_dispatch_ops` / jobs tests | Actions still gated |
| PDF | PDF tests | Preview still snapshot |
| Public quote | public token tests | Layout only |
| RTL | i18n / playwright if present | Screenshots 360 RTL |

If a visual PR cannot run API tests, it **must not** change files under `apps/api`, `packages/api-client` contracts, or QuoteBuilder hooks.

Flutter’s own `test/login_screen_test.dart` / `kyc_flow_test.dart` test **demo UI**, not SITE SECURE. Do not import them.

---

# 18. ACCESSIBILITY

Flutter `GestureDetector` + `Semantics(button: true)` on social discs is a reminder: **web must use `<button>` / `<a>`**.

| Requirement | Template | React rule |
|---|---|---|
| Keyboard | Weak (app-like) | Tab order, `focus-visible:outline-focus` already on Button/Field — **keep** |
| Focus | Custom rims | Never remove outlines for “clean card” look |
| Semantic buttons | Mixed | No `div onClick` for nav/CTA |
| Aria | Some labels on social | Preserve Hebrew `aria-label`s (`he.navMobile`, loading labels) |
| Reduced motion | Not a first-class Flutter setting here | `@media (prefers-reduced-motion: reduce)` disable rise/scale/puck slide (instant move is OK) |
| Contrast | Black/white pills are strong; muted `#8A8A8A` on `#F6F5F3` needs WCAG check | **Verify** before adopting muted gray on warm canvas |
| Screen readers | Custom painters are invisible | Don’t port CustomPainter-only info (metal sheen, scan mesh) as the only status |
| Loading | IgnorePointer | `disabled` + `aria-busy` (already in Button) |

**Do not copy:** overlapping `AnimatedSwitcher` text without hiding the outgoing node from AT (`aria-hidden` on exiting).

---

# 19. PERFORMANCE

| Flutter effect | Web risk | Prefer |
|---|---|---|
| Face mesh / scan beam / dual document paint | Canvas + rAF | **Don’t port** |
| Lottie 4s success + login loop | Decode + main-thread | CSS spinner / static SVG |
| Scroll-driven 3D card spin | Composite + JS scroll | **Don’t port** |
| Hero flights | Layout thrash | Skip |
| Animating `left` on nav puck | Layout | `transform: translate3d` |
| 900–1100 ms staggered enter on every navigation | Feels slow on repeat visits | First paint only, or 200–400 ms |
| Google Fonts runtime in receipt | Network/CLS | Keep self-hosted Heebo/Inter |
| Heavy box-shadow on every row | Paint | Hairlines |
| Counting ticker | JS loop | CSS or skip |

**Prefer:** opacity, `transform`, GPU. **Avoid:** JS animation loops, per-frame `setState` equivalents (`setState` on scroll in card selection).

---

# 20. ASSET PLAN

Purchased assets under `Fintech app UI/card_app/assets/`. **Do not copy build artifacts.** Legal: purchased UI kit — reuse only what we explicitly adopt; **do not** ship Visa.

| Source file | Purpose | Reuse in SITE SECURE? | Fintech-specific / exclude? |
|---|---|---|---|
| `assets/images/visa.svg` | Visa wordmark | **No** | Exclude |
| `assets/images/Contactless.json` | NFC success Lottie | **No** (metaphor + cost) | Exclude |
| `assets/images/source/Contactless_original.json` | Source Lottie | **No** | Exclude |
| `assets/images/loading.json` | Button loader | **Not by default** | Prefer CSS; exclude unless a later legal-cleared micro-animation is wanted |
| `assets/images/source/loading.json` | Source | **No** | Exclude from web app |
| `assets/images/social/facebook.svg` | Facebook mark | **No** (not in current auth) | Exclude |
| `assets/images/social/google.svg` | Google mark | **No** unless real Google OAuth is a product decision | Exclude for now |
| `assets/images/social/apple.svg` | Apple mark | **No** | Exclude |
| `assets/images/profile.png` | Demo avatar | **No** as product identity | Exclude (placeholder only if needed in Storybook, not production) |
| `assets/icon/app_icon.png` | Slate app icon | **No** | Exclude (SITE SECURE has its own brand) |
| `assets/icon/app_icon_foreground.png` | Adaptive icon | **No** | Exclude |

**Do not copy** Flutter `web/icons/Icon-*.png` into SITE SECURE PWA without a brand pass.

Plus Jakarta Sans: **do not add** as the Hebrew UI font. Heebo stays.

---

# 21. REPOSITORY HYGIENE

The purchased directory currently contains generated/build artifacts. **Do not delete in this analysis.** Long-term they should **not** live in git.

| Path | Why exclude from long-term VCS |
|---|---|
| `Fintech app UI/__MACOSX/` | Finder zip junk |
| `Fintech app UI/card_app/build/` | Flutter build output |
| `Fintech app UI/card_app/.dart_tool/` | Pub tool cache (if present) |
| `card_app.dart_tool-version` (sibling file at `Fintech app UI/`) | Tool stamp |
| `ios/Pods/`, `ios/.symlinks/`, `ios/Flutter/ephemeral/` | CocoaPods / generated |
| `macos/Flutter/ephemeral/` | Generated |
| `android/.gradle/`, `android/app/build/` | Gradle (if present under build) |
| `linux/flutter/ephemeral/`, `windows/flutter/ephemeral/` | Generated |
| IDE: `card_app.iml`, `.idea/` if any | IDE |
| `ios/Runner/GeneratedPluginRegistrant.*` | Generated (Flutter may still expect them in templates — **NOT VERIFIED** whether the vendor zip requires them; still should not pollute SITE SECURE’s product git policy) |

**Keep for reference (source only):** `lib/`, `assets/` (until assets are decided), `pubspec.yaml`, `test/` (as proof of demo behavior), `README.md`.

Platform runner trees (`ios/`, `android/`, `macos/`, `windows/`, `linux/`, `web/`) are **not needed** to extract a web design system. They bloat the repo. Defer deletion to an explicit hygiene PR.

---

# 22. PHASED IMPLEMENTATION PLAN

Conservative. Each phase is a **presentation** slice. Stop if a PR needs `apps/api`, migrations, `catalog.json`, or `api-client` contract changes — that means the phase is scoped wrong.

### Phase 0 — Baseline and regression protection

- **Files:** none of product UI required; test commands / screenshots / this document already done
- **Components:** none
- **Risk:** Low
- **Tests:** auth, RBAC, quotes pricing, jobs lifecycle, isolation — record as gate
- **Done:** failing tests known; QuoteBuilder not in flight for visual; Flutter treated as prototype

### Phase 1 — Design tokens + UI primitives

- **Files likely:** `packages/design-system/**`, `packages/ui/src/Button.tsx`, `Field.tsx`, `Display.tsx`, `Feedback.tsx`, `packages/ui/src/index.ts`, additive CSS variables (design-system emit and/or small `styles.css` additions)
- **Components:** Button pill, Card radius, Input comfortable, SuccessState
- **Risk:** Low–medium (global radius change can shift tables — prefer **new tokens** used opt-in, not flipping ops `3px` globally yet)
- **Tests:** `dev/ui`, Button loading a11y, visual login optional
- **Done:** tokens documented in code; Heebo remains; action blue remains; no API changes

### Phase 2 — Application shell / navigation

- **Files:** `apps/web/src/components/AppBottomNav.tsx`, nav CSS in `styles.css`, maybe `NavIcon`, `app/route.tsx` **layout classNames only**
- **Components:** restyled bottom nav; desktop nav color alignment
- **Risk:** Medium (selection bugs, RTL puck)
- **Tests:** nav selection, More/Work, technician vs manager items, 360/768/1280
- **Done:** same routes, same RBAC items, better chrome

### Phase 3 — Dashboard + Today

- **Files:** `routes/app/dashboard.tsx`, `components/dashboard/**` (especially `ActivityList.tsx`), `routes/app/today.tsx`, Today list presentational
- **Components:** MetricCard, ActivityRow
- **Risk:** Medium (hiding widgets must still follow entitlements)
- **Tests:** dashboard queries unchanged; today list assigned-only
- **Done:** looks “premium”; data identical

### Phase 4 — Low/medium-risk modules

- **Files:** customers/sites/tasks/leads/service **index** pages, login/register chrome, settings **appearance/company** chrome
- **Components:** PremiumListRow consumers
- **Risk:** Medium
- **Tests:** list isolation, search, RTL
- **Done:** mobile lists not tables; desktop tables remain where dense

### Phase 5 — FieldJob

- **Files:** `routes/app/jobs/$jobId.tsx` and job presentational children
- **Components:** StepProgress **display**, pill actions
- **Risk:** High
- **Tests:** full lifecycle, photos, technician 403s
- **Done:** same transitions; larger targets

### Phase 6 — Quotes list / Catalog

- **Files:** `quotes/index.tsx`, `catalog.tsx` presentational
- **Components:** rows/cards
- **Risk:** High on catalog prices display; list totals must match API
- **Tests:** technician catalog denial; quote list amounts
- **Done:** no builder changes

### Phase 7 — QuoteBuilder

- **Files:** quote editor **chrome only** after §16 split
- **Components:** inherited tokens
- **Risk:** **Highest**
- **Tests:** pricing, VAT, CCTV, states, PDF snapshot, send
- **Done:** identical calculations; prettier chrome

### Phase 8 — PDF Studio / Roles / Admin

- **Files:** `pdf-templates.tsx`, `roles.tsx`, `admin/**`
- **Components:** tokens only
- **Risk:** Highest for roles
- **Tests:** RBAC matrix, PDF render, admin isolation
- **Done:** dense UI preserved

---

# 23. DO-NOT-BREAK CHECKLIST

Copied from the codebase snapshot constraints and expanded for this visual program.

**Never modify in this redesign program:**

- `apps/api/**` behavior (especially `pricing.py`, `quote_pdf.py`, `quote_snapshot.py`, `job_lifecycle.py`, CCTV recommend/sizing)
- `supabase/migrations/**`
- `packages/authz/catalog.json`
- `packages/api-client` **contracts** (types/endpoints/errors)
- `packages/authz/engine.py` (or TS equivalent) permission decisions

**Never change:**

- Authentication behavior (Supabase session, cookies, verify/reset)
- Authorization / `authorize()` results
- Permission grants / custom roles
- Technician assigned scope
- Commercial / workspace isolation
- Quote calculations / VAT
- Quote state machine
- Job state machine
- PDF snapshot immutability
- CCTV calculations
- Quota enforcement
- Audit behavior

**Never:**

- Migrate to Flutter or add a second frontend architecture
- Port Dart demo logic or hard-coded balances/transactions/cards
- Port fake login / fake KYC / fake face or document scanning
- Ship Visa / card-network branding
- Recompute money in the UI
- Drive FieldJob steps from animation completion
- Hide/show nav items except via existing RBAC helpers
- Flip RTL by mirroring universal icons
- Add Lottie/Framer as a default dependency in Phase 1

**If uncertain:** write **NOT VERIFIED** and leave the behavior as-is.

---

# 24. FIRST IMPLEMENTATION SPRINT (do not implement in this task)

**Goal:** prove the new visual language **without** touching high-risk business logic.

**Scope (one small sprint):**

1. **Design tokens (additive):** motion + radius.pill + optional canvas/hairline CSS variables. Do **not** globally replace ops `3px` radius yet.
2. **UI primitives:** `Button` variant `pill` (CSS spinner, scale-on-press, keep a11y); `Card` optional class; `Input` `comfortable` variant (height ~52–54, radius 14, stronger focus).
3. **Mobile navigation visual shell:** restyle `.ops-bottom-nav` toward floating capsule + puck **using CSS transform**; **do not** change item lists, More/Work, or selection helpers.
4. **One dashboard widget:** restyle `ActivityList` to ActivityRow chrome (hairline, 44 glyph, time trailing). **Same props / same links / same empty state / same `canCreateQuote` gate.**

**Explicitly out of sprint:** QuoteBuilder, FieldJob mutations, catalog, PDF Studio, roles, login API, Lottie, Visa, KYC, new routes, `api-client`, API, migrations.

### Files this first sprint is **allowed** to change

- `packages/design-system/src/tokens.json`
- Any **existing** design-system emit/build files that already turn tokens into CSS (if touching them is required for tokens to exist) — do not add a new package
- `packages/ui/src/Button.tsx`
- `packages/ui/src/Field.tsx`
- `packages/ui/src/Display.tsx` (Card only, additive)
- `packages/ui/src/index.ts` (only if exporting a new variant type)
- `apps/web/src/styles.css` (**additive** nav + token hooks; no QuoteBuilder restyle)
- `apps/web/src/components/AppBottomNav.tsx` (classNames / structure for puck **presentation**; keep links/buttons/ARIA)
- `apps/web/src/components/dashboard/ActivityList.tsx` (markup/classes only)
- `apps/web/src/routes/dev/ui.tsx` (showcase pill/field/nav if that page already exists as a playground)

### Files this first sprint is **not** allowed to change

- Everything under `apps/api/**`
- `supabase/migrations/**`
- `packages/authz/catalog.json`
- `packages/api-client/**` (except if a type-only re-export is somehow required — it is **not**)
- Quote builder components and `routes/app/quotes/$quoteId.tsx` editor
- `routes/app/jobs/$jobId.tsx`
- Auth route **logic** (`login.tsx` handlers) — login **chrome** is second sprint
- Flutter directory (reference only)

**Definition of done:** 360px RTL: pill button + comfortable field visible on `/dev/ui`; bottom nav looks closer to Slate but still SITE SECURE Hebrew labels and destinations; dashboard activity list looks like premium rows; technician/manager nav membership unchanged; no new network calls; `prefers-reduced-motion` disables press-scale if implemented.

---

## Second pass vs `Docs/SITE-SECURE-CODEBASE-SNAPSHOT.md`

| Snapshot constraint | Migration plan check |
|---|---|
| React 19 + Vite + TanStack Router/Query | Unchanged; Flutter is reference only |
| FastAPI + Supabase session + RLS | Unchanged |
| `authorize()` authoritative | Nav restyle must use existing item filters |
| Technician no quotes/catalog | Dashboard/Today/catalog phases cannot “show for beauty” |
| Money in `pricing.py` | No AnimatedBalance on ILS; QuoteBuilder late |
| Job lifecycle server-side | FieldJob stepper is display; pills call existing actions |
| CCTV TS+Python | Never in visual PRs |
| PDF snapshots | Receipt visual must not replace snapshot |
| Hebrew RTL | §7 required on every chrome PR |
| `styles.css` monolith | Consolidate later, not in sprint 1 global radius flip |
| Dispatch/WIP not mixed | Visual program is separate from ops commits |

**No recommended visual change requires changing authorization, entitlements, business logic, API contracts, tenant isolation, financial calculations, job lifecycle, CCTV, or PDF behavior.** If a future PR cannot meet that bar, it is out of scope for this migration.

---

*End of analysis. Implementation starts only when a later task explicitly allows the first sprint file list.*
