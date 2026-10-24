# SITE SECURE — UI Review Checklist

Use this checklist before merging UI work.  
Rules source: `Docs/design/SITE-SECURE-UI-DESIGN-RULES.md`  
SITE SECURE remains the source of truth. External skills do not override dark mode or product architecture.

**Required closing step for every UI prompt / task:**  
`Run the SITE SECURE UI Review Checklist before finalizing.`

Fail any bold item below → fix before considering the task done.

---

## Theme & brand

- [ ] **Dark mode preserved** — premium dark shell still works; no light-default switch
- [ ] **Light mode works** — same hierarchy/density; no broken contrast
- [ ] Existing **theme tokens** reused (`--color-bg-*`, `--color-fg*`, borders, action/danger/success) — no unofficial palette swap
- [ ] Dark **contrast hierarchy** intact (surfaces, muted text, borders still readable)
- [ ] Selected / focus / error / success / warning readable in **both** themes

## Layout & language

- [ ] **RTL works** — logical properties; mirrored affordances; no broken padding/alignment
- [ ] **LTR metadata isolated** — IDs, emails, codes, shortcuts, technical mono use `dir="ltr"` / `ltr-meta` where appropriate
- [ ] **Responsive** at **1440 / 1032 / 768 / 390 / 360** (no clipped primary actions)
- [ ] **No overflow** — no unintended horizontal page scroll; tables scroll intentionally if needed
- [ ] Content not hidden under fixed chrome (header / Bottom Nav safe areas)

## Navigation & permissions

- [ ] **Bottom Nav untouched** — no redesign, reorder experiments, or replacement in this task unless explicitly scoped
- [ ] Active route / section indicated
- [ ] **Role permissions respected** — actions hidden/disabled correctly; no privileged UI leaks

## Hierarchy & density

- [ ] One clear **primary action** per region
- [ ] **Density appropriate** — dense for tables/quotes/jobs/admin; comfortable for settings; not consumer-sparse in tools
- [ ] **No giant cards** / low-information marketing panels in operational UI
- [ ] **No unnecessary gradients**, glow, mesh, glassmorphism, neon
- [ ] **No generic SaaS layout** clone (bento-for-show, purple template, Inter-slate demo look)

## Components & states

- [ ] Forms: visible labels; focus; disabled; validation without wiping data
- [ ] Tables/lists: scannable; hover/selected; sort/filter if promised
- [ ] **Empty state** present and actionable when relevant
- [ ] **Loading state** present (no empty flash)
- [ ] **Error state** present with recovery path
- [ ] Saving / success feedback where mutations exist

## Accessibility

- [ ] **Keyboard** operable for new interactive controls
- [ ] **Focus-visible** rings visible on dark and light
- [ ] Modal/drawer: focus trap + restore focus on close (when applicable)
- [ ] Icon-only controls have accessible names
- [ ] Status not color-only
- [ ] `prefers-reduced-motion` respected if motion was added
- [ ] Touch targets adequate on mobile (~44px hit area for primary controls)

## Motion

- [ ] Operational screens: **minimal motion** only
- [ ] No parallax, typewriter, continuous decorative animation, or attention-stealing transitions in product tools

## Scope discipline

- [ ] Did not modify Bottom Nav / theme provider / tokens unless the task explicitly approved it
- [ ] Did not apply external skill “light by default” or regenerate a foreign design system
- [ ] Quote Builder / Dashboard / Admin remain tools — not marketing surfaces

## Sign-off

| Item | Result |
|---|---|
| Area touched | |
| Themes checked (dark / light) | |
| Breakpoints checked | |
| RTL checked | |
| Reviewer / agent | |
| Date | |

---

*Fail any bold item above → fix before merge.*
