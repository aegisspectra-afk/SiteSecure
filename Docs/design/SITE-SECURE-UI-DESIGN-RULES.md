# SITE SECURE — UI Design Rules

**Status:** Internal design governance for Cursor / engineering  
**Source of truth:** SITE SECURE product + tokens (not external skills)  
**Related research:** `.external-reference/ui-ux-design-pro-skill/` (MIT, study only)  
**Companion checklist:** `Docs/design/SITE-SECURE-UI-REVIEW-CHECKLIST.md`

**Mandatory for all UI work:** Before implementing any UI/UX task, read this file and the Review Checklist. If an external reference or prior prompt conflicts, **SITE SECURE rules win.** Dark mode remains first-class. Every UI task must end with: *Run the SITE SECURE UI Review Checklist before finalizing.*

This document is written **for SITE SECURE**. Principles adapted from the UI/UX Design Pro skill are labeled; anything that conflicts with product strategy is rejected here.

---

## 1. Product design principles

1. **SITE SECURE is an operational field / security SaaS** — technicians, owners, admins do real work. Density and clarity beat decoration.
2. **Intent before chrome** — every screen answers: who is here, what verb must they complete, what is the one primary action.
3. **Invisible craft** — hierarchy should be felt (squint test), not shouted with glow, giant cards, or marketing layouts inside tools.
4. **One accent with meaning** — color carries status/action; gray builds structure.
5. **Consistency over novelty** — reuse existing AppShell, tokens, patterns. Do not invent a second visual language per feature.
6. **Sameness to generic SaaS templates is failure** — but sameness to SITE SECURE’s own system is success.
7. **Permissions shape UI** — role and plan gates are product behavior, not optional polish.

---

## 2. Dark mode rules (NON-NEGOTIABLE)

Dark mode is a **product requirement**, not an open design question.

### Must

- Keep the **premium dark shell** as a first-class experience.
- Keep **existing theme tokens** and theme behavior (`ThemeRuntime` / current CSS variables).
- Support **dark and light**; never remove dark.
- Preserve dark **contrast hierarchy**: `bg-0` → `bg-1` → `bg-2` (and overlays) with readable `fg` / `fg-muted`.
- Keep selected, focus, error, success, and warning readable on dark surfaces.

### Must not

- Switch product default to light mode.
- Redesign dark surfaces into light-first layouts.
- Replace existing theme tokens because an external skill prefers light or a new oklch palette.
- Weaken dark contrast (washed text, low-opacity borders that vanish, pure black `#000` void).
- Apply any external **"Always prefer Light Mode by default"** guidance.

### External skill conflict

| External guidance | Classification |
|---|---|
| “Always prefer Light Mode by default” (`SKILL.md` Default Settings) | **NOT APPLICABLE TO SITE SECURE** — REJECT |
| Dark elevation = slightly lighter surfaces | Compatible conceptually; already reflected in SITE SECURE surface stack — do not retoken without approval |
| Avoid pure `#000` backgrounds | Compatible as critique; only change if a real a11y defect is proven |
| Generate new full palettes from CLI | REJECT for product; research-only |

---

## 3. Light mode rules

- Light mode must remain **usable and premium**, not an afterthought.
- Same information hierarchy and density as dark; only surfaces/borders flip via tokens.
- Do not invent light-only layouts that break dark.
- Borders and muted text must remain visible on light canvases.
- Validate both themes at the same breakpoints.

---

## 4. RTL

- **RTL is first-class** (Hebrew product copy and layout).
- Prefer CSS **logical properties** (`margin-inline-start`, `padding-inline-end`, `inset-inline`, etc.) over physical left/right.
- Mirror chevrons / directional icons with existing patterns (`rtl:rotate-180` where already used).
- **Technical metadata** (IDs, emails, codes, timestamps, keyboard shortcuts, money numerals as required) uses **LTR isolation** (`dir="ltr"`, `ltr-meta` / `public-mono` patterns already in the app).
- Do not force LTR on Hebrew labels or primary reading flow.

---

## 5. Typography

- Use SITE SECURE type stack and existing text utilities — do not import Inter/Geist “defaults” from external skills.
- Hierarchy via **size + weight + color**, not size alone.
- Operational UI body often sits around dense ~14px; marketing may be larger.
- Labels distinct from body; avoid all-caps spam.
- Tabular nums / mono for data, IDs, prices where already established.
- One clear page title; do not skip heading levels for accessibility.

---

## 6. Spacing

- Prefer a **consistent scale** (multiples of 4px conceptually). Trace new gaps to existing utilities/tokens.
- Spacing must match **density intent** (see §7), not consumer-app “air”.
- Symmetrical padding unless asymmetry has a reason (e.g. scroll affordance).
- Page sections on marketing can use larger gaps; tool screens stay tighter.

**Token note:** Conceptual refinement only. Any real token change = separate approved task.

---

## 7. Density

SITE SECURE is **not** a low-density consumer app.

| Mode | Where | Guidance |
|---|---|---|
| **Dense operational** | Quote line rows, jobs lists, project/asset tables, admin lists, FieldJob checklists | Compact row height, tight gaps (≈8–12px internal), borders-first, no giant padding |
| **Comfortable** | Settings forms, company profile, onboarding steps, feedback forms | ≈12–16px field gaps, calm sections, still not sparse marketing |
| **Compact chrome** | Toolbars, filters, secondary actions | Small controls OK if tap targets remain accessible (hit area ≥44px where needed) |

**Do not** force oversized whitespace into quote rows, jobs, project tables, asset lists, or admin lists.

External “Warmth & Approachability / generous spacing” directions: **REJECT** for operational surfaces; optional only for marketing.

---

## 8. Cards / surfaces

- Prefer **borders + surface shifts** over layered marketing shadows (aligns with “borders-only / surface shifts” craft for tools).
- Cards are containers for interaction or clear grouping — not decoration.
- Avoid nested card-in-card, glassmorphism stacks, neon borders, mesh gradients in product UI.
- Sidebar / shell: same family as canvas + subtle border (do not fragment with unrelated fills).
- Elevation: base → panel → popover → modal → toast. Keep jumps subtle.

---

## 9. Forms

- Visible labels (not placeholder-only).
- Required / error / disabled / focus states always defined.
- Validate on blur / submit — don’t wipe data on error.
- Inline errors below fields; associate with `aria-describedby` / `aria-invalid` where applicable.
- Primary save/submit one per region; destructive actions need confirmation.
- Settings: calm sections, clear save feedback (saving / saved / error).

---

## 10. Tables / lists

- Dense, scannable rows; sticky headers/filters when helpful.
- Sort/filter affordances visible; empty and loading states required.
- Mobile: horizontal scroll for truly tabular data **or** compact stacked rows — preserve key fields; don’t explode into marketing cards.
- Row hover/selected states must work in dark and light.
- Admin lists stay operational — no bento showcase layouts.

---

## 11. Navigation

- Desktop: existing AppShell / sidebar patterns.
- **Mobile Bottom Nav is frozen** — do not redesign, relocate, or “improve” it in drive-by tasks.
- Active route always indicated.
- Do not obscure content under fixed chrome (padding compensation).
- Marketing sites may use sticky top nav; product app does not adopt marketing nav patterns.

---

## 12. Dashboard

- **Actionable, not decorative.**
- Primary job: what needs attention / what to do next.
- Metrics only if they drive a decision or navigation.
- Avoid: giant KPI card grids, bento for its own sake, sparkline spam, glow, unused “insights” chrome.
- SITE SECURE already invests in command-center / attention / active work — extend that intent; don’t replace with generic SaaS dashboard templates.

---

## 13. Settings

- Calm, premium, form-forward.
- Clear section hierarchy; one job per section.
- Comfortable density; predictable save states.
- No marketing hero, no decorative motion, no neon.

---

## 14. Admin (Platform Admin)

- Operational: orgs, users, flags, feedback, audit.
- Dense tables/lists; clear status badges; LTR for IDs/timestamps.
- Role-gated actions obvious and safe.
- Reject landing-page aesthetics and glassmorphism.

---

## 15. Quote Builder

- **Working tool, not a marketing surface.**
- Dense line editing, summary clarity, primary actions obvious.
- Preserve LTR isolation for numbers/metadata.
- No parallax, typewriter, orbit graphics, or oversized feature cards inside CPQ.
- Empty/loading/error must not block understanding of line state.

---

## 16. Mobile

- Breakpoints that matter: **1440 / 1032 / 768 / 390 / 360** (plus tablet cliff ~1032 already product-sensitive).
- Bottom Nav frozen; content must not collide with it.
- Tap targets: aim ~44×44 CSS px for primary controls.
- No overflow / horizontal page scroll unless intentional (tables).
- Stack sections; preserve hierarchy without giant empty regions.

---

## 17. Empty / loading / error states

Every data surface needs:

| State | Rule |
|---|---|
| Loading | Skeleton or calm spinner; preserve layout; don’t flash empty |
| Empty | Explain what’s missing + one clear next action when permitted |
| Error | Human message + retry/path forward; don’t lose form data |
| Saving | Disable double-submit; show progress/saved |

Empty states may be slightly warmer in onboarding; still functional-first.

---

## 18. Accessibility

- WCAG 2.2 AA contrast target for text and critical controls (dark and light).
- Keyboard: Tab order = visual order; `:focus-visible` rings; Escape closes overlays; focus trap in modals; restore focus on close.
- Labels for inputs; `aria-label` on icon-only buttons; live regions for urgent errors/status.
- Don’t rely on color alone for status — pair with text/icon.
- Respect `prefers-reduced-motion`.
- Adapt a11y patterns to **RTL + dark**: focus rings visible on dark; logical reading order; LTR islands announced sensibly.

---

## 19. Motion

**Operational default: minimal motion.**

| Allowed | Avoid |
|---|---|
| Subtle color/border transitions (~100–150ms) | Parallax |
| Drawer/modal enter/exit (~200–250ms), opacity/transform only | Decorative continuous animation |
| Non-blocking microfeedback | Typewriter effects |
| True loading indicators | Attention-stealing page transitions |
| | Orbit / breathe-glow / scroll-reveal cascades in tools |

Marketing / onboarding may be looser (see Brainwave study) but still respect reduced motion and SITE SECURE brand (no neon AI clichés).

**Do not** add Framer Motion / parallax libraries to the product SPA for decoration.

---

## 20. Anti-patterns

- Light-first redesigns or “default light” from external skills
- Generic SaaS: purple gradients, glassmorphism, bento-everywhere, Inter+slate template look
- Giant cards / low information density in tools
- Unnecessary gradients, glow, mesh backgrounds in product UI
- Decorative motion in Quote Builder / Dashboard / Jobs / Sites / Assets / Settings / Admin
- Redesigning Bottom Nav
- Replacing SITE SECURE tokens without an approved token task
- Placeholder-only forms; missing empty/error/loading
- Physical left/right CSS that breaks RTL
- Forcing Hebrew metadata into LTR or technical IDs into RTL without isolation
- Copying Brainwave / skill CLI generated systems into production
- Running external skill CLI against SITE SECURE to “regenerate” the design system

---

## Principle classification (from UI/UX Design Pro skill)

### A. ADOPT (fits directly)

- Intent-first: who / verb / feel
- Invisible craft / squint test / focal primary action
- Text hierarchy levels; border progression; control states (default/hover/active/focus/disabled)
- Forms: labels, blur validation, preserve data on error
- Tables: dense structure, sticky filters, loading/empty/error
- Keyboard + focus-visible + modal focus management
- Touch target sizing guidance
- `prefers-reduced-motion`
- Logical CSS properties for i18n
- Critique checklist discipline (composition, states, hierarchy)
- Dark-mode elevation idea (lighter raised surfaces) as **critique language**, not a token rewrite
- Borders-first depth for dense tools

### B. ADAPT (useful with SITE SECURE constraints)

- 4px spacing scale → map to existing utilities; don’t invent parallel tokens casually
- Typography modular scale → keep SITE SECURE fonts; borrow hierarchy thinking only
- Density modes → map to Dense / Comfortable / Compact chrome (this doc)
- Container queries → already used in places (e.g. dash canvas); expand carefully
- Motion duration scale → allow only the minimal subset in §19
- Semantic token layering concepts → refine only via approved token work
- APCA / contrast audits → use to **find defects**, not to replace palette
- Dashboard metric patterns → only when actionable
- Marketing landing patterns → public site / onboarding only

### C. REJECT / NOT APPLICABLE

- **Light mode by default**
- Warmth & Approachability / generous whitespace for operational screens
- Generating new palettes / type pairings / “signature” systems that replace SITE SECURE
- Bento-as-default dashboard topology
- Spatial UI / XR gaze targets as product requirements
- Glassmorphism, cyberpunk, liquid glass style packs in product
- Landing scroll-reveal, orbit, breathe-glow in operational app
- Pure white card aesthetics as the product metaphor
- Skill CLI install/execution as part of SITE SECURE build
- Any guidance that weakens dark shell or Bottom Nav freeze

---

## Dark Mode Compatibility (skill vs SITE SECURE)

### Compatible

- Raised surfaces slightly lighter than canvas
- White-alpha borders on dark; black-alpha on light (conceptually)
- Text opacity / muted hierarchy (map to `fg` / `fg-muted`)
- Semantic success/warning/danger with non-color cues
- Inset-feeling inputs vs surrounding surface
- Focus rings with accent + offset

### Incompatible / NOT APPLICABLE

- Prefer light theme by default
- Rebuilding neutrals in oklch as a mandatory migration
- Industry palette tables that push playful/warm consumer looks into field ops tools
- “Generate CSS tokens (80+)” and replace `--color-bg-*` / `--color-fg*`

### Preserve existing dark shell

1. Do not change `styles.css` theme tokens in drive-by UI tasks.
2. Use existing `var(--color-*)` and utility classes.
3. If contrast fails WCAG on a specific control, fix that control with token-consistent mixes — escalate full palette changes.
4. Selected / focus / error / success must remain visible on `bg-0`/`bg-1`/`bg-2`.

---

## Design token review (no changes in this task)

Useful **concepts** from the skill (not implementations):

| Concept | Recommendation |
|---|---|
| Spacing scale | Keep conceptual 4px rhythm; no new token file unless approved |
| Radius scale | Stay with existing radii; avoid 24–32px marketing radii in tools |
| Typography scale | Hierarchy thinking OK; keep current fonts |
| Elevation | Prefer surface + border; soft shadows for overlays only |
| Border hierarchy | default / subtle / strong / focus — already echoed in patterns |
| Semantic states | success / warning / danger / action — keep current names |

**Any actual token change requires a separate approved task.**

---

## Product-area guidance summary

| Area | Helps | Do not import | Already correct direction |
|---|---|---|---|
| Dashboard | Action hierarchy, calm metrics, states | Bento, glow, decorative charts | Command/attention/active work focus |
| Quote Builder | Dense forms/tables, clear primary action | Marketing cards, motion | Working CPQ tool density |
| Settings | Comfortable forms, save states | Heroes, gradients | Calm premium settings |
| Platform Admin | Dense tables, status clarity | SaaS landing chrome | Operational admin lists |
| Site / Asset dossier | Hierarchy, metadata LTR, empty states | Giant marketing panels | Dossier as system of record |
| Jobs / Today | Dense lists, next action | Decorative empty illustrations overload | Field-first workflows |
| Mobile | Tap targets, no overflow, Bottom Nav | New nav paradigms | Frozen Bottom Nav + responsive shells |
| Marketing / onboarding | Intent, CTA clarity, restrained motion | Neon AI clichés, light-default | Separate from operational density |

---

*End of rules. For task gates, use `SITE-SECURE-UI-REVIEW-CHECKLIST.md`.*
