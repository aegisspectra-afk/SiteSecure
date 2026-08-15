# SITE SECURE UX Operating System

**Status:** Binding UX doctrine for V2. Not a moodboard.  
**SaaS / RBAC / billing product OS:** [V2-SAAS-EXPERIENCE.md](../architecture/V2-SAAS-EXPERIENCE.md)  
**Application shell / primitives / mobile bottom nav:** [V2-APP-SHELL.md](./V2-APP-SHELL.md)  
**Visual tokens:** [V2-DESIGN-SYSTEM.md](./V2-DESIGN-SYSTEM.md)  
**Web IA (authenticated `/app`):** [V2-WEB.md](../architecture/V2-WEB.md)  
**Public Web (visitor origin):** [V2-PUBLIC-WEB.md](../architecture/V2-PUBLIC-WEB.md)  
**Mobile IA:** [V2-MOBILE.md](../architecture/V2-MOBILE.md)

Psychology makes the product clearer, faster, easier, and more trustworthy. It is never used to manipulate.

**North star:** make the next action obvious.  
If a user has to ask «מה אני אמור לעשות כאן?» the screen has already failed.

---

## How this document is used

Every UX decision cascades. Do not skip layers.

```
UX Principle
      ↓
Design Rule
      ↓
Component Rule
      ↓
Screen Rule
      ↓
Interaction Rule
      ↓
Mobile Rule
```

| Layer | Question it answers |
|-------|---------------------|
| UX Principle | Why humans struggle here |
| Design Rule | What the visual system must encode |
| Component Rule | What a primitive must look and behave like |
| Screen Rule | What this page may contain, and what it must hide |
| Interaction Rule | What happens on tap, hover, error, success |
| Mobile Rule | What changes in the field (gloves, sun, one hand, offline) |

Phase 5 builds the **Design System + Login + Signup + Onboarding + Web Shell** from this cascade.  
It does **not** design Dashboard, CRM, Quotes, or Jobs as one-off screens. Those inherit the same OS later.

If a future screen needs a new pattern, add it here first. Do not invent a one-screen exception.

---

## Capability-bound UI (hard rule)

Dashboard IA, Bottom Navigation, SaaS psychology, and similar references are **UX constraints**. They are not permission to invent routes, modules, or data.

Before adding a destination, inspect in this order:

1. Current routes  
2. Roles  
3. Permissions (`can()` is UX only)  
4. Plan entitlements in `catalog.json`  
5. Real workflows the backend already supports  

Then choose at most 3–5 **live** bottom-nav items. Do not copy `סקירה / עבודות / לקוחות / שירות / עוד` if Jobs, Customers, or Service are not shipped products.

```
Architecture → real capabilities → navigation → UI polish
```

Owner home shows what exists today (team, settings, security, honest empty). It does not preview CRM.

---

## 0. Product personality

SITE SECURE is a Hebrew-first, RTL, field-first B2B operations tool for people who install CCTV, alarm, access, and networking systems.

It should feel:

- Serious, not playful
- Dense enough for an office, not cramped
- Obvious on a phone in a stairwell
- Trustworthy with money, sites, and customer data

It must not feel like: a consumer toy, a generic AI dashboard, or Aegis.

**Public Web** (visitor origin) **is** allowed to be a serious marketing site — honest sections, one primary CTA.  
**Authenticated `/app`** must not feel like that marketing landing: no hero ROI, no FAQ, no “join the pilot” inside the workspace shell.

Hebrew is the UI language. Technical tokens (SKU, IP, MAC, email, codes) stay Latin LTR (`.ltr-meta`).

---

## 1. Ethical boundary (never)

These are not “clever growth tactics.” They are forbidden.

- Fake urgency, fake scarcity, fake progress, fake reviews
- Misleading pricing or hidden fees
- Deceptive cancellation
- Hidden primary actions
- Dark patterns, confirm-shaming, disguised ads
- Checking a step that did not happen
- Inflating onboarding percent for “momentum”
- On **Public Web:** guaranteed ROI, unverified availability (e.g. 99.9%), unverified encryption/hosting/partnership/customer-count/pilot-capacity claims ([V2-PUBLIC-WEB.md](../architecture/V2-PUBLIC-WEB.md) §9)

Loss aversion, contrast, and goal gradient are allowed **only when they describe real state**.

---

## 2. Decision Fatigue

**UX Principle:** too many equivalent choices freeze action. A screen with 14 peer options has no primary action.

**Design Rule:** one visual peak. Everything else is quieter. Space and weight create the peak, not extra color.

**Component Rule:**

- One **Primary** button per view
- One **Secondary** (outline / ghost)
- Destructive is isolated, never adjacent as an equal
- Overflow lives in a menu labeled with a real verb group (`עוד פעולות`), not `⋯` alone without accessible name

**Screen Rule:**

```
Primary action
Secondary action
Advanced options → collapsed
```

Forbidden: a toolbar of six equal filled buttons. Forbidden: every table row showing five saturated pills plus three icon buttons.

**Interaction Rule:** the primary action is reachable without opening a menu. Keyboard: `Enter` submits the primary, not a hidden control.

**Mobile Rule:** the primary action is a single sticky/bottom or in-flow button ≥44px. Secondary actions sit below or in a sheet. Never three FABs.

**SITE SECURE:** Quote builder shows **שמור טיוטה** (secondary) and **שלח הצעת מחיר** (primary). Margins, payment terms, internal notes wait under **מתקדם**.

---

## 3. Goal Gradient

**UX Principle:** people finish what already looks underway. Fake percent is a lie; real remaining steps are a map.

**Design Rule:** progress shows completed / current / remaining. Never a cinematic 0→100 bar that does not map to records.

**Component Rule:** `Stepper` / `ProgressList` has three states only: done (`✓`), current (`●`), upcoming (`○`). Labels are outcomes, not system names.

**Screen Rule:** onboarding never starts at 0% if identity already exists (profile from signup counts). A step is checked only when the API says the record exists.

```
הקמת סביבת עבודה

✓ פרטי חברה
✓ פרופיל
● לקוח ראשון
○ אתר ראשון
○ הצעת מחיר ראשונה
```

**Interaction Rule:** tapping a completed step opens that record. Tapping upcoming is disabled until the previous required step exists — or is skippable with an honest label (`דלג לעת עתה`), not a silent skip that still shows a check.

**Mobile Rule:** technicians do not see company onboarding. Their gradient is the **job**: Navigate → Start → Checklist → Photos → Signature → Complete. Same ✓ / ● / ○, real job status from the API.

**SITE SECURE:** empty states continue the same gradient (“צרו את הלקוח הראשון”), not a feature tour.

---

## 4. Evaluative Ease

**UX Principle:** the brain evaluates concrete language faster than codes. Generic labels force translation.

**Design Rule:** UI copy is a verb + object in Hebrew. Status is a sentence a person would say. Machine enums stay in the API, never as the only visible text.

**Component Rule:**

- Button: verb (`שלח הצעת מחיר`), never `Action` / `Submit` / `OK`
- Status: `Status` component = small marker + Hebrew phrase, not a raw token
- Empty: what is missing + the next verb
- Error: what happened + how to continue

| Avoid | Prefer |
|-------|--------|
| צור אובייקט | צור לקוח |
| Status: PENDING_APPROVAL | ממתין לאישור הלקוח |
| Action | שלח הצעת מחיר |
| שמור | שמור טיוטה / שמור שינויים (be specific) |
| Error 403 | אין הרשאה לשלוח הצעת מחיר |
| No data | אין עבודות להיום |

**Screen Rule:** page titles name the object (`לקוחות`, `הצעת מחיר Q-00012`). Page header primary button matches the page (`לקוח חדש` on the customer list).

**Interaction Rule:** toasts repeat the same human phrase (`העבודה נסגרה`), not `OK` / `Success`.

**Mobile Rule:** even shorter. Today’s button is exactly the next job verb: `התחל עבודה` / `נווט` / `סיים עבודה`.

---

## 5. Affordances and Signifiers

**UX Principle:** people do not read instructions first. They read whether something looks usable.

**Design Rule:** if it is clickable it looks clickable. If it is disabled it looks disabled. If it is selected the UI shows selected — not by color alone.

**Component Rule:**

| State | Must show |
|-------|-----------|
| Button | Fill or outline + verb + hover/press elevation or tone |
| Disabled | Reduced contrast **and** not-allowed cursor; if it blocks the goal, a reason (`חסר לקוח`) |
| Selected (nav, tabs, radio, row) | Weight + background + (optional) indicator. Never color-only |
| Clickable card / row | Hover/focus, cursor, and a chevron or title-as-link |
| Input | Visible field, label outside the placeholder |
| Expandable | Chevron that rotates with `aria-expanded` |
| Focus | Visible ring. Do not remove outlines |
| Switch / checkbox | Track/box change plus label; not color-only |

**Screen Rule:** do not put a help paragraph where the control can speak. Do not make a whole dashboard card clickable without a signifier.

**Interaction Rule:** hover is a hint, not the only hint (touch has no hover). Pressed state ≤150ms visual. Disabled controls do not submit.

**Mobile Rule:** hit target ≥44px. No hover-only affordance. Selected tab: filled icon + label weight, not a tiny underline the sun will wash out.

---

## 6. Visual Hierarchy

**UX Principle:** without a rank order, everything shouts and nothing is read.

**Design Rule:** every screen declares five ranks before layout:

1. Primary information  
2. Secondary information  
3. Supporting information  
4. Primary action  
5. Secondary actions  

Tools: size, position, space, weight. Color is last. Not everything is a card. Not everything is a badge.

**Component Rule:** `PageHeader` = title (rank 1) + one primary action (rank 4). Tables: first column is the object name; status is secondary; row actions are supporting until hover/focus/swipe.

**Screen Rule:**

| Screen | Rank 1 | Rank 4 |
|--------|--------|--------|
| Login | SITE SECURE + sign-in | התחבר |
| Onboarding | current step name | the step’s submit |
| Shell | current section | page primary |
| Customer list | who they are | לקוח חדש |
| Quote | customer + total gross | שלח הצעת מחיר |
| Today (mobile) | next job | Start / Navigate / Complete |

**Interaction Rule:** focus order follows rank: header action, then main content, then secondary.

**Mobile Rule:** rank 1 occupies the top of the viewport. Rank 4 is the obvious tap. Supporting info is behind a second screen or accordion.

---

## 7. Grid and Spacing

**UX Principle:** uneven gaps feel accidental; accidental UI feels untrustworthy (especially near money).

**Design Rule:** spacing scale only: **4, 8, 12, 16, 24, 32, 48, 64**. No 13px “optical” exceptions in product UI.

Group related. Separate unrelated. Whitespace is hierarchy.

Do not force a 12-column grid on every page. Allowed layouts:

- Auth: dark enterprise console (auth-only; product UI stays light until a later dark pass). Desktop is LTR chrome — identity ~62% + access console ~38% (form max ~400px). The identity side shows an illustrative Site File surface, not marketing claims. Mobile: identity strip, then form, then a compact preview.
- List + detail
- Table page
- Dossier (stacked sections)
- Builder (header + lines + sticky totals)
- Settings (stacked forms)

**Component Rule:** form fields stack at 16; field groups at 24; page padding 16–24; section breaks 32.

**Screen Rule:** do not mix card padding 12 with card padding 28 on the same page. Shell sidebar and main share the same scale.

**Interaction Rule:** moving focus does not jump layout. Loading skeletons occupy the same spacing as real content.

**Mobile Rule:** more air, not a shrunk table. Horizontal padding 16. Stack, don’t squeeze columns. Thumb zone: primary action in the lower half when it is a workflow screen.

---

## 8. Typography

**UX Principle:** type is the product’s voice. Mixed sizes feel like mixed authors.

**Design Rule:** Heebo (Hebrew UI) + Inter (Latin / technical). Roles, not one-off sizes:

| Role | Size | Weight | Line-height |
|------|------|--------|-------------|
| Page title | 22–24px | 650 | 1.25 |
| Section | 16–18px | 600 | 1.35 |
| Body | 14px | 400 | 1.5 |
| Table / dense | 13px | 400 | 1.4 |
| Caption | 12px | 400 | 1.35 |
| Label | 12–13px | 500 | 1.3 |

**Component Rule:** buttons 14/500. Status text 13/500. Do not put page-title size on a modal.

**Screen Rule:** one page title. Section titles only when the page has distinct regions. Do not bold entire paragraphs.

**Interaction Rule:** tabular figures for money and codes. Totals in the quote header are larger than line prices, never the reverse.

**Mobile Rule:** body may stay 16px for field readability. Do not ship 11px captions as the only job address.

---

## 9. Color Theory

**UX Principle:** color codes meaning. Too many hues destroy meaning.

**Design Rule:** KEEP primary `#0b6bcb`. Semantic set is small: action, danger, warning, success, ink, muted, line, surface.

Ink for text. Primary for the action and selected emphasis. Danger only for destructive/error. Warning for SLA / expiring. Success for completed / approved.

**Do not use color as the only signifier.**

**Component Rule:** primary button uses action color. Secondary does not. Status uses a small marker + text; not five saturated pills in a row.

**Screen Rule:** a page may use primary + one semantic (e.g. a warning banner). Rainbow dashboards fail.

**Interaction Rule:** error fields: border danger + text, not red-only placeholder. Links in body use underline or weight, not blue-only.

**Mobile Rule:** outdoor contrast first. Primary on white (light) or high-contrast surface (dark). Never thin light-blue text on sky photos.

---

## 10. Dark Mode

**UX Principle:** dark mode is a surface system, not an invert filter.

**Design Rule:** tokens exist from day one even if Phase 5 ships light as default.

Layers: `bg-0` canvas, `bg-1` surface, `bg-2` elevated. Contrast via surface shift. Borders quieter. Shadows weaker. Primary is not neon on black.

**Component Rule:** the same component maps to tokens; no `if (dark) { hex }`. Overlays dim `bg-0`, they do not paint a new brand.

**Screen Rule:** never ship a light modal on a dark shell or the reverse.

**Interaction Rule:** theme follows OS unless the user pinned a preference in profile. Switching theme does not remount the app or lose form state.

**Mobile Rule:** field night work is a real case. Dark must keep status markers distinguishable without relying on glow.

---

## 11. Shadows and Elevation

**UX Principle:** shadow suggests lift. If you notice the shadow first, it is decoration.

**Design Rule:** radius 6px controls, 8px panels — not 24px blobs.

Light: card `0 1px 2px rgb(15 23 42 / 6%)`. Popover slightly stronger. Dark: border + surface, not glow.

**Component Rule:** buttons do not use heavy drop shadows. Modals/drawers use overlay + modest elevation. Tables are flat.

**Screen Rule:** do not stack card-in-card-in-card. Dossier sections are separators, not nested shadows.

**Interaction Rule:** hover may add a *slight* lift on clickable cards; focus uses the ring, not a bigger shadow.

**Mobile Rule:** almost no shadow. Separation = space + hairline. Sheets use a grab handle + scrim.

---

## 12. Icons

**UX Principle:** icons are signifiers, not illustrations.

**Design Rule:** Lucide only for UI chrome. No emoji. No random brand-new icon set per screen.

**Component Rule:** icon + label for primary nav and primary buttons until the icon is universally known (search, close, back). Icon-only requires `aria-label`.

**Screen Rule:** do not lead every list row with a decorative icon. Status is a marker, not a mascot.

**Interaction Rule:** 16–20px in UI chrome; 24px in mobile tab bar. They do not animate except a chevron rotate.

**Mobile Rule:** tab icons always have a Hebrew label. Outdoor: filled selected vs outline unselected.

---

## 13. Button States

**UX Principle:** a control that does not change when used does not feel real.

**Design Rule:** every button implements: default, hover, press, focus, disabled, loading.

Primary / secondary / ghost / danger are visually distinct at a glance.

**Component Rule:** loading replaces the label with a spinner **and keeps width** (no jump). Disabled is not merely 80% opacity on a still-clickable control. Destructive requires a confirm only when the action is irreversible (delete workspace, not “remove line item” if undo exists).

**Screen Rule:** one primary per view (Decision Fatigue). The header primary matches the page goal.

**Interaction Rule:** double-submit is prevented by loading state (API idempotency is still required later for sync). Success does not leave the spinner on.

**Mobile Rule:** press state must be visible in sunlight. Haptic optional; visual required.

---

## 14. Feedback

**UX Principle:** action without feedback feels broken; the user repeats the tap and duplicates work.

**Design Rule:** four data states are first-class: **loading, empty, error, success**. They are not afterthoughts.

**Component Rule:**

- `Skeleton` matches layout, not a generic gray block
- `EmptyState`: Hebrew explanation + one next action
- `ErrorState`: human message + retry if retry helps
- `Toast`: short, one line, not a modal

**Screen Rule:** never a blank white main. Technician empty Today: `אין עבודות להיום` + who to contact (manager), not a blank map.

**Interaction Rule:**

| Action | Feedback |
|--------|----------|
| Save draft | `נשמר` (inline or quiet toast) |
| Send quote | success + next step (`ממתין לאישור הלקוח`) |
| Complete job | `העבודה נסגרה` then next job if any |
| Permission deny | Hebrew from API envelope, not a raw 403 |
| Offline (mobile) | pending / failed / synced — never silent success |

**Mobile Rule:** sync status is visible on Today. Failed outbox is a tappable error, not a red dot with no words.

---

## 15. Micro-interactions

**UX Principle:** small motion confirms cause and effect. Decoration burns trust and battery.

**Design Rule:** 150–200ms opacity/transform. No bounce. Honor `prefers-reduced-motion` (instant state change).

**Component Rule:** allowed: chevron rotate, toast in, checkbox tick, stepper check, subtle “saved” fade. Forbidden: gradient blobs, looping hero motion, confetti, emoji bursts.

**Screen Rule:** page transitions are fade/short slide at most. Do not choreograph the dashboard.

**Interaction Rule:** motion has a purpose: saved, uploaded, copied, completed, synced, assigned, approved.

**Mobile Rule:** no motion that competes with walking. Reduced motion default if the OS asks.

---

## 16. Progressive Disclosure

**UX Principle:** experts want power; everyone else wants to finish. Showing both at full volume helps neither.

**Design Rule:** Basic vs Advanced. Advanced is collapsed, labeled in Hebrew, not a gear icon with no name.

**Component Rule:** `Disclosure` / accordion with clear heading. Settings: personal → workspace → dangerous last and isolated.

**Screen Rule:**

| Flow | Basic | Behind מתקדם |
|------|-------|----------------|
| Quote | customer, site, lines, total, send | cost/margin, exotic discounts, internal notes, payment terms |
| Customer | name, phone, type | legal name, tax id, billing address |
| Job | title, site, when, assignee | project, service-call link, internal notes |
| Onboarding | workspace name | timezone/VAT (smart-defaulted, still editable) |

**Interaction Rule:** opening Advanced does not reset Basic. Totals stay visible while Advanced is open.

**Mobile Rule:** field job is already a sequence; do not dump desktop Advanced onto the phone. Capture (photo, signature) is in-flow, not a settings clone.

---

## 17. Smart Defaults

**UX Principle:** blank forms punish users for data the product already has.

**Design Rule:** never start empty when a parent object exists. Defaults stay editable. Defaults are not hidden permissions.

**Component Rule:** inputs show the default value, not a placeholder pretending to be the value.

**Screen Rule:**

- New site under a customer → hint address from billing if present
- New quote → customer, site, VAT% from workspace, currency ILS
- New job from a service call → site, customer copied
- Technician creating field work → assignee = self
- Signup → locale `he`, no silent workspace

**Interaction Rule:** changing the customer on a quote may update site options; it does not silently overwrite lines.

**Mobile Rule:** new photo inherits job/site/workspace path. Timestamp and GPS if available are metadata, not a form the tech must fill first.

---

## 18. Contrast Effect

**UX Principle:** people judge options relative to neighbors. A fake “most popular” plan is social proof we invented.

**Design Rule:** compare **real** alternatives: current vs next, draft vs sent, assigned vs unassigned.

**Component Rule:** plan cards show current plan, next plan, what changes. Recommendation is labeled as such, not as fake popularity.

**Screen Rule:** billing/upgrade: “התוכנית הנוכחית אינה כוללת ניהול מלאי.” Then: what they have, what they lack, what upgrade adds. Honest.

Quote: customer total is always visible; cost/margin only if permitted — that contrast is access control, not a tease.

**Interaction Rule:** selecting a plan highlights the delta list, not a flashing badge.

**Mobile Rule:** technicians do not see plan contrast. They see job contrast: overdue vs on-time, required checklist vs optional.

---

## 19. Loss Aversion (ethical)

**UX Principle:** people work to avoid losing what they have. Threatening fake loss is abuse.

**Design Rule:** describe real limits. Do not manufacture fear.

**Component Rule:** feature-gated empty: explain the gap, then the allowed next step (upgrade **or** continue without that feature).

**Screen Rule:** not «קנו PRO עכשיו!». Yes: the current plan does not include inventory. Solo invite limits are explained when the owner picks a blocked role.

**Interaction Rule:** blocking an action uses `FEATURE_NOT_INCLUDED` / `PERMISSION_DENIED` Hebrew from the API, then a single path forward.

**Mobile Rule:** do not upsell on Today. If a feature is absent, the nav item is absent.

---

## 20. Reciprocity and endowment (IKEA)

**UX Principle:** people value what they just built. A long wizard before any value feels like unpaid labor.

**Design Rule:** a usable workspace after few fields (name, timezone, VAT default). Inventory, branding PDF, API later.

**Component Rule:** empty states offer **the next business object**, not a product tour carousel.

**Screen Rule:** first customer → first site → first quote → first job. That is the gift: their business appearing in the tool.

**Interaction Rule:** creating the workspace lands on the next real step, not a fireworks dashboard.

**Mobile Rule:** a technician invited in skips company endowment; their first value is the first assigned job on Today.

---

## 21. Role-specific next action

**UX Principle:** “home” is not one screen. It is the next action for **this** role.

**Design Rule:** shell home is filtered by role and features. Hidden nav is not security (`authorize()` + RLS remain).

| Role | Home should push |
|------|------------------|
| Owner / admin | Attention list (quotes waiting, unassigned jobs) |
| Sales | Quotes to send / follow up |
| Manager | Unassigned jobs, SLA |
| Technician / FT | Start / navigate / complete the current job |
| Viewer | Read-only lists; no fake primary that 403s |

**Component Rule:** `<Can>` hides; the API still denies. Never show **שלח הצעת מחיר** if `quotes.send` is false — and if a stale UI shows it, the error is Hebrew, not a crash.

**Screen Rule:** Dashboard answers only: what happened, what matters, what needs attention, what to do next. No vanity KPIs.

**Interaction Rule:** clicking an attention row goes to the object, not to a report.

**Mobile Rule:** Today is the home. There is no management dashboard on the phone.

---

## 22. Flagship flows (later modules inherit this)

Do not build these in Phase 5. When they are built, they already have a contract.

**Quote builder:** always know what I am creating, the customer total, what the customer sees, margin if allowed, and the next verb (save draft / send). Totals from the server.

**Site File:** technical dossier; scan, don’t hunt. Definition lists, not a wall of cards. One primary per tab.

**Field job:** one obvious next tap. Sequence, not a desktop clone.

**Customer 360:** the relationship story. Primary action depends on state (create quote, create job, open site).

---

## 23. Foundation screens (Phase 5 scope)

These are the **only** product screens Phase 5 may introduce. Each must pass the cascade and the checklist in §25.

### Login

- Rank 1: SITE SECURE identity (not Aegis)
- Rank 4: `התחבר`
- Secondary: `הרשמה`, `שכחתי סיסמה`
- Errors: Hebrew, field-level + form-level
- No workspace picker yet; no silent create

### Signup

- Few fields. Smart default locale `he`
- Password rules visible before failure
- After signup: session → onboarding if no membership

### Onboarding

- Explicit `create_workspace` only
- Goal gradient with **real** checks
- Primary: complete the current step
- Skip only where the architecture allows, labeled honestly

### Web shell

- RTL sidebar, selected nav obvious (weight + background, not color alone)
- Page header pattern: title + one primary
- User + workspace name
- Collapse on tablet; this is not the technician product
- `<Can>` + feature flags hide nav; placeholders for unbuilt modules are **absent**

### Shared states in the system, not per screen

Loading, empty, error, success — as components — used by auth and shell first so CRM can inherit later.

---

## 24. Component inventory (Phase 5 builds these, not 40 pages)

Visual specs live in [V2-DESIGN-SYSTEM.md](./V2-DESIGN-SYSTEM.md). Behavior specs live **here**. A component does not ship without both.

```
SITE SECURE DESIGN SYSTEM
│
├── Typography
├── Colors
├── Spacing
├── Radius
├── Shadows
├── Icons
│
├── Button
├── Input
├── Select
├── Checkbox
├── Radio
├── Switch
├── Card
├── Table
├── Badge          (sparse)
├── Status         (marker + Hebrew)
├── Tabs
├── Modal
├── Drawer
├── Dropdown
├── Tooltip
├── Toast
│
├── Loading / Skeleton
├── Empty State
├── Error State
└── Success State
```

Plus shell pieces: `PageHeader`, `Sidebar`, `Can`.

Each interactive primitive must document states: default, hover, press, focus, disabled, loading/error where applicable.

---

## 25. Screen review checklist (mandatory)

Every shipped screen is reviewed against:

1. User goal  
2. Primary action  
3. Secondary actions  
4. Cognitive load  
5. Affordances  
6. Signifiers  
7. Visual hierarchy  
8. Smart defaults  
9. Progressive disclosure  
10. Feedback  
11. Error prevention  
12. Empty state  
13. Loading state  
14. Success state  
15. Mobile behavior  
16. Accessibility  
17. Responsive behavior  
18. Micro-interactions  

**Fail the screen** if the primary action is not identifiable in two seconds.  
**Fail the screen** if a disabled control looks enabled.  
**Fail the screen** if progress is fake.  
**Fail the screen** if copy is an enum or `Action`.  
**Fail the screen** if color is the only selected/error signifier.

---

## 26. Anti-patterns (AI-looking UI)

Do not ship:

- Emoji as UI
- Giant gradient blobs / glassmorphism
- Repeated KPIs / meaningless charts
- Giant rounding / badge spam
- Random avatars / decorative dashboards
- Unnecessary modals
- Hover-only clickability
- Equal-weight button rows
- Placeholder nav for unbuilt modules
- English-only chrome in a Hebrew product
- Aegis branding on SITE SECURE auth

SITE SECURE should feel like a serious operations tool for alarm and CCTV businesses.

---

## 27. Phase 5 consumption contract

When (and only when) the human says **Proceed to Phase 5**, implementation order is:

1. Tokens (`packages/design-system`) from [V2-DESIGN-SYSTEM.md](./V2-DESIGN-SYSTEM.md)  
2. Primitives (`packages/ui`) with full states, RTL, a11y  
3. Auth pages: Login → Signup → forgot/reset  
4. Onboarding with real goal gradient  
5. Web shell + `<Can>` + empty/loading/error patterns  
6. Stop. Do not build Dashboard/CRM/Quotes/Jobs screens until the foundation is accepted.

Mobile Foundation is Phase 6 and uses the **same** tokens and this OS. It does not restyle the brand.

This document is the UX source of truth. A prettier one-off Login that violates the cascade is a regression, not progress.
