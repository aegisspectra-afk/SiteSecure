# V2 Design System

**Status:** Visual and interaction source of truth  
**Behavior / psychology:** [V2-UX-PSYCHOLOGY.md](./V2-UX-PSYCHOLOGY.md) — SITE SECURE UX Operating System  
**Packages:** `packages/design-system` (tokens), `packages/ui` (web components)  
**Identity:** KEEP V1 brand primary `#0b6bcb` (steel blue). Do not invent a new palette.

Tokens and primitives implement the Operating System. Do not restyle a screen in a way that contradicts that cascade.

---

## 1. Brand

| Token | Value | Meaning |
|-------|-------|---------|
| Primary | `#0b6bcb` | Trust, primary action |
| Primary hover | `#095aa9` | |
| Primary active | `#084f93` | |
| Ink | `#0f172a` | Text |
| Muted | `#475569` | Secondary text |
| Line | `#e2e8f0` | Borders |
| Surface | `#ffffff` | Page |
| Surface muted | `#f8fafc` | Sidebar / zebra |
| Danger | `#b42318` | Destructive, errors |
| Warning | `#b54708` | SLA, expiring |
| Success | `#067647` | Complete, approved |
| Info | `#0b6bcb` | Neutral information uses ink + line, not extra rainbow |

Semantic names in code: `color-action`, `color-danger`, `color-warning`, `color-success`, `color-fg`, `color-fg-muted`, `color-border`, `color-bg`, `color-bg-subtle`.

Do not use color as the only signifier.

---

## 2. Color ramps

Primary: `50–900` generated from `#0b6bcb` (document exact hex in CSS `@theme` when implemented).  
Neutrals: slate-like, not blue-gray candy.

Dark mode (architected from day one, light is default):

- Background layers: `bg-0` canvas, `bg-1` surface, `bg-2` elevated
- Contrast via surface, not inverted primary
- Borders quieter than light mode
- Shadows weaker; elevation = surface shift

If we ship light-only in an early phase, **tokens still exist** so we do not invert later.

---

## 3. Typography

Fonts: **Heebo** (Hebrew UI), **Inter** (Latin/technical). Load with `size-adjust` to reduce swap.

| Role | Size | Weight | Line-height |
|------|------|--------|-------------|
| Page title | 22–24px | 650 | 1.25 |
| Section | 16–18px | 600 | 1.35 |
| Body | 14px | 400 | 1.5 |
| Table / dense | 13px | 400 | 1.4 |
| Caption | 12px | 400 | 1.35 |
| Label | 12–13px | 500 | 1.3 |

Avoid a zoo of sizes. Dashboard is compact but not cramped.

LTR islands: `.ltr-meta` for SKU, IP, MAC, email, codes.

---

## 4. Spacing

Scale (px): **4, 8, 12, 16, 24, 32, 48, 64**.

No ad-hoc 13px gaps. Group related; separate unrelated. Whitespace is a tool.

Do not force a 12-column grid on every page. Use:

- List + detail
- Table pages
- Dossier (stacked sections)
- Builder (header + lines + sticky totals)

---

## 5. Radius, shadow, elevation

Radius: 6px controls, 8px panels. Not 24px “friendly blobs”.

Light shadows:

- Card: very subtle (`0 1px 2px rgb(15 23 42 / 6%)`)
- Popover: slightly stronger
- If you notice the shadow first, it is too strong

Dark: prefer border + surface, not glow.

---

## 6. Icons and buttons

Lucide only for UI chrome. No emoji icons.

Button states: default, hover, active, disabled, loading.  
Primary vs secondary vs ghost vs danger — visually distinct.

Labels are verbs. Loading replaces the label with a spinner + keeps width to avoid jump.

---

## 7. Components (web `packages/ui`)

Ship few, real components:

Button, Input, Textarea, Select, Checkbox, Dialog, Sheet, Dropdown, Tabs, Table, Pagination, PageHeader, EmptyState, Skeleton, Toast, Badge (sparse), Status (dot + text, not a rainbow pill wall).

Quote builder and Site File may have feature components in `apps/web`, using these primitives.

---

## 8. Status language

Statuses use text + a small semantic marker:

- Draft / Sent / Viewed / Approved / Rejected / Expired / Cancelled (quotes)
- Scheduled / En route / In progress / Completed (jobs)

Do not encode status as a number. Do not use five saturated pills in a row.

---

## 9. Density

Web management: comfortable-dense (table rows ~40px).  
Mobile: larger hit targets (min 44px), more whitespace, one primary button.

---

## 10. Motion

150–200ms opacity/transform. No bounce. Honor reduced motion.

---

## 11. Accessibility

- Contrast: WCAG AA for text
- Focus visible
- Named buttons
- Dialogs trap focus
- Form errors linked via `aria-describedby`

---

## 12. Implementation note

Tokens are the source. Tailwind `@theme` maps them for web. RN `ThemeProvider` maps the same JSON for mobile. Do not hardcode `#0b6bcb` in random components after tokens exist.
