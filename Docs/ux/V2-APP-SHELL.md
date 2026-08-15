# SITE SECURE V2 — Application Shell, Dashboard Primitives & Mobile Navigation

**Status:** Binding product specification  
**Product OS:** [V2-SAAS-EXPERIENCE.md](../architecture/V2-SAAS-EXPERIENCE.md)  
**Dashboard screen rule:** [V2-DASHBOARD-SPEC.md](./V2-DASHBOARD-SPEC.md)  
**Visual tokens:** [V2-DESIGN-SYSTEM.md](./V2-DESIGN-SYSTEM.md)  
**UX cascade:** [V2-UX-PSYCHOLOGY.md](./V2-UX-PSYCHOLOGY.md)  
**Native mobile IA:** [V2-MOBILE.md](../architecture/V2-MOBILE.md)  
**Web IA:** [V2-WEB.md](../architecture/V2-WEB.md)

This document is **not** a visual redesign brief. It is the operating specification for the authenticated shell, reusable UI primitives, and mobile bottom navigation.

Narrative examples (`FREE`, `PRO`, `הוספת לקוח`, Jobs / Customers in the tab bar) are **targets**. Production may only expose **implemented, entitled, authorized** destinations. Catalog plans remain `solo` / `business` / `enterprise`.

Bottom Navigation is a **UX OS principle**. Do not treat this file as a request to design a new bar or to fill it with future modules. Destinations are derived from live routes only. See [V2-UX-PSYCHOLOGY.md](./V2-UX-PSYCHOLOGY.md) § Capability-bound UI.

---

## 0. North star

Every screen answers: Where am I? What is important? What needs attention? What can I do? What should I do next?

> Make the next action obvious.

---

## 1. Application shell

Authenticated `/app` is a stable operating environment:

| Breakpoint | Structure |
|------------|-----------|
| Desktop `lg+` | Sidebar spine + header + main |
| Tablet | Collapsible sidebar / sheet |
| Phone (web SPA) | Header + main + **bottom navigation** |
| Native Expo | Same IA as bottom navigation; see [V2-MOBILE.md](../architecture/V2-MOBILE.md) |

The sidebar is the structural spine on desktop. It is **not** copied wholesale onto the phone.

**Sidebar contains:** product identity (SITE SECURE), workspace + role + plan, grouped navigation (icon + short Hebrew label), settings/help toward the bottom. Optional search and notifications only when those systems exist.

**Active state:** at least two signals (weight/background **and** an edge or icon treatment). Never color alone.

**Do not** put Back, Forward, Logo, or Logout in primary navigation. Logout lives in the profile menu.

**Workspace context** must always be visible. The user must never be unsure which workspace they are in.

**Header:** greeting / page context, workspace, operational status, profile. One page-level primary action belongs in the page, not a crowded header.

Settings, security, billing, help, and legal are **low-frequency**. They must not compete with operations.

---

## 2. Navigation rules (all surfaces)

One configuration. Permission-aware, feature-aware, plan-aware. No second nav system. No placeholder modules. No “coming soon.”

Conceptual groups (show only when live):

- סקירה
- OPERATIONS — לקוחות, אתרים, עבודות, קריאות שירות, לוח שנה
- DOCUMENTS — הצעות מחיר, מסמכים
- ASSETS — ציוד, מלאי
- ANALYTICS — דוחות
- ADMINISTRATION — צוות, תפקידים, אבטחה, הגדרות, ניהול תוכנית

Nested navigation when modules grow. Do not create dozens of top-level items.

---

## 3. Dashboard primitives

Compose screens from four primitives. Do not invent a unique layout per page.

1. **Lists / tables** — scan and operate on related records. Tables may search, filter, sort, paginate, select, bulk-act, and hide columns **when the data supports it**. Dense, 13–14px, one visible row action; secondary behind **עוד פעולות**. Bulk actions appear only after selection.
2. **Cards** — summaries, charts, grouped controls, important status. Not the default. Never card-in-card-in-card. Controlled radius (8px), restrained shadow.
3. **Forms** — task-oriented. Basic first, advanced collapsed.
4. **Tabs** — related views of the **same** object (Site: overview / systems / jobs / documents). Not unrelated modules.

**Popovers:** lightweight, click-away, not complex workflows.  
**Modals:** blocking create/edit/confirm; Save or Cancel.  
**New page:** large persistent operational records, with Back / breadcrumb.  
**Toasts:** lightweight success/warning/recoverable error — not decisions.

Empty / loading / error / success are product states. Skeletons over blank screens. Human Hebrew, not `Error 403`.

Charts only when they answer a real operational question with a real metric, timeframe, and labels. No vanity KPI walls. Date ranges only if the backend supports them.

Optimistic UI only for fast, reversible, low-risk actions. Never for irreversible or security-critical work without confirmation.

---

## 4. Mobile bottom navigation — first-class IA

The bottom bar is the **primary top-level navigation** on small screens. It is not a row of decorative buttons and not a miniature sidebar.

It must communicate: where I can go, which destinations matter, where I am, what needs attention (only with real badges), what the next common action is.

**Preferred: 3–5 destinations. Absolute max: 6.** Prefer fewer.

### 4.1 What may sit in the bar

High-frequency operational destinations that **exist**.

Good candidates when live: סקירה / היום, עבודות, לוח שנה, לקוחות, שירות, **עוד**.

**Forbidden in the bar:** Help, Legal, Privacy, Terms, Logout, advanced settings, security configuration, billing, Back, Forward, Logo.

A central creation CTA is allowed only for a genuinely frequent, live workflow. Do not add one because it looks attractive. There is no create-customer/job CTA until those modules exist.

### 4.2 Role recommendations (when those modules exist)

| Role | Suggested primary |
|------|-------------------|
| Technician | היום, עבודות, לוח שנה, לקוחות, עוד |
| Manager | סקירה, עבודות, צוות, לוח שנה, עוד |
| Owner | סקירה, עבודות, לקוחות, דוחות, עוד |

These are **not** hardcoded. Actual items come from centralized nav + `can()` + plan features + live routes.

Until CRM/Jobs/Calendar exist, the honest web bar is **home + עוד** (עוד only if overflow destinations exist). Do not invent Jobs or Customers to fill the bar.

### 4.3 Global vs contextual

Bottom nav stays stable across screens of the same role. Site-level tabs (Overview / Systems / Jobs) are **page** tabs, not a mutating global bar.

**עוד** holds remaining authorized destinations, organized — not a junk drawer. It must not randomly change item sets between screens.

### 4.4 Visual and interaction

| Rule | Requirement |
|------|-------------|
| Icon | ~24px, Lucide, one family. Inactive outline; active stronger (color **and** weight; fill if the icon set supports it) |
| Label | 10–12px, one line, short Hebrew. Clarifies the icon; does not explain the module |
| Tap target | **≥ 44×44px** (hit area ≠ glyph size) |
| Safe area | Sit **above** `env(safe-area-inset-bottom)`. Never under the home indicator |
| Contrast | Active strongest; inactive secondary **and readable**. No rainbow-per-tab. Active uses brand primary `#0b6bcb` |
| Surface | Subtle 1px border or soft separation. Not a floating mega-card |
| Badges | Only real attention the user is allowed to see. No badge fatigue. No leaking names/counts across permissions |
| Motion | Immediate tap feedback, 150–200ms, no bounce/glow/pulse. Honor `prefers-reduced-motion` |
| Offline | Nav remains usable; never fake a completed server write |

Thumb-friendly: outdoors, gloves, one hand, walking, equipment rooms. Validate on small / standard / large phones, not only a resized desktop browser.

### 4.5 Security

Navigation visibility is UX. Backend `authorize()` + RLS remain the boundary.

Badges, previews, and labels must not expose unauthorized resources.

Do not hardcode `role ===` in screens. Extend `appNav` / `bottomNav`.

### 4.6 Native vs web

- **Web SPA (`< lg`):** implement this bar against **live** `/app` routes now.
- **Expo:** same configuration when the native app ships. Do not create a second nav catalog.
- Do **not** start Expo, CRM, or Jobs UI from this document alone.

---

## 5. Implementation order for this slice

1. Inspect current shell and `appNav`.
2. Keep one nav source.
3. Web bottom bar from live routes.
4. Overflow → עוד (existing drawer).
5. Desktop sidebar: icon + label, obvious active state.
6. Native tab bar later, same helper.

---

## 6. Definition of done (shell / nav)

- User knows where they are within two seconds
- Primary destinations are the frequent ones that exist
- Low-frequency admin is not in the bottom bar
- Tap targets ≥ 44px; Safe Area respected
- RBAC and entitlements filter nav; server still enforces
- No unfinished modules, no fake badges, no second nav system
