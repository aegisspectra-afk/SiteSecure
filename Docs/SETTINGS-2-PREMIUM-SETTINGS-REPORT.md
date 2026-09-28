# SETTINGS-2 PREMIUM SETTINGS REPORT

**Date:** 2026-09-28  
**Mode:** Audit first → focused IA/UX polish  
**Scope:** `/app/settings` information architecture, grouping, save UX, role-aware nav, responsive shell  
**Out of scope (untouched):** Platform Admin, Quote Builder, pricing engine, Infrastructure, dashboard layout, Bottom Nav, auth/RLS/billing/invitations architecture

---

## 1. Existing settings audit

Settings already had a shell + many routes (`general`, `company`, `appearance`, `quotes`, `numbering`, `pdf-templates`, `sites`, `notifications`, `users`, `roles`, `security`, `system`, `audit`).

**Problems found:**
- Flat nav (dense, weak conceptual grouping)
- Landing `/app/settings` = General form only; aside lacked a clear “settings center” lead
- General mixed workspace identity + VAT + avatar in one flat block
- Avatar copy was gender-first (`גבר/אישה`)
- Save UX inconsistent (some pages always enabled save; weak/missing error states)
- System label vague; Security title English (“Security Center”)
- Company page missing i18n keys for preview section (runtime/type hole)

**Already solid:** route-relative links, `RequirePermission`, sticky aside ≥900px, content `max-width: 48rem`, mobile select nav.

---

## 2. Navigation grouping

Hebrew grouped nav (desktop labels + mobile `<optgroup>`):

| Group | Items |
|---|---|
| **חשבון וסביבה** | כללי · פרטי חברה ומיתוג · מראה |
| **מסחרי** | הצעות מחיר · מספור · תבניות מסמכים |
| **תפעול** | אתרים · התראות |
| **צוות וגישה** | צוות · תפקידים והרשאות · אבטחה |
| **מתקדם** | הגדרות מערכת · יומן ביקורת |

Routes unchanged. No speculative pages.

---

## 3. Landing page changes

Preferred **B**: General remains default content at `/app/settings`.

Aside head:
- **הגדרות**
- **ניהול סביבת העבודה, החברה, ההצעות, הצוות והעדפות המערכת.**

If user lacks `workspace.edit`, `SettingsEntryRedirect` sends them to the first permitted settings page (e.g. Manager → צוות / אבטחה).

---

## 4. General settings structure

Split into:
- **סביבת עבודה** — name, timezone (`ltr-meta`)
- **פיננסים** — VAT + locked currency `₪ · ILS`
- **פרופיל אישי** — avatar picker (separate from workspace identity)

Link hint to Company & Branding for legal/logo fields.

---

## 5. Profile avatar changes

Assets unchanged (`man`/`woman` IDs in localStorage).

Wording:
- Label: **תמונת פרופיל**
- Choices: **איור 1** / **איור 2**
- Hint: local-only, not synced across devices

No backend profile persistence invented.

---

## 6. Save behavior

Dirty-state + disabled save + loading + success + visible failure on:
- General, Company, Quotes, Numbering, Sites, Notifications

Appearance/Theme remains local immediate apply.  
PDF templates keep existing per-template editor save (already sophisticated).  
No global form framework.

**Gap:** no `beforeunload` guard when navigating away with dirty fields (practical defer).

---

## 7. Role-aware settings

Nav items **hidden** (not merely disabled) based on `can` / `canAny`:

| Role | Typical settings access |
|---|---|
| **Owner / Admin** | Full groups when features allow (`workspace.edit`, team, audit) |
| **Manager** | צוות (`users.view`) + אבטחה (`settings.general`); **no** `workspace.edit` → no General/Commercial/Ops edit pages |
| **Sales / Technician / Viewer** | Catalog grants only `settings.view` → **no** settings management nav items; app nav settings entry also gated |

Company gate: `workspace.edit` **or** `settings.branding`.

---

## 8. Company/branding separation

- **General:** operational workspace defaults (name, TZ, VAT, currency lock)
- **Company:** legal/display name, BN, address, logo, brand colors, bank/payment for documents

No data-model merge; hint on General points to Company. No duplicated editable fields beyond intentional display-name vs workspace-name (different stores).

---

## 9. Quote settings audit

Supported today:
- Default validity days
- Payment terms
- Show VAT on quotes
- PDF notes/terms text

UI lead + apply hint: values load as defaults on new quotes; per-quote override remains.

**Gaps (documented, not invented):**
- Approval workflow toggles not present
- Default PDF template picker not on Quotes page (lives under תבניות מסמכים)
- Auto-apply path depends on existing API quote-create prefs (payment_terms / validity wired in prefs JSON; backend PDF uses `payment_terms` when template lacks it)

---

## 10. Numbering

Prefixes for quotes / projects / site files with **example** strings (`PREFIX00001`).  
Copy clarifies next sequence is server-owned; UI edits prefix only.  
No destructive reset control exposed.

---

## 11. PDF templates

Lead updated: template controls quote PDF structure (header, logo, terms, signature); default used on document generation.  
Existing editor/default/status flow unchanged. Link from Company preview → PDF templates.

---

## 12. Team

`/app/settings/users` remains operational team area: members, pending invites, roles, invite/revoke/reissue (permission-gated). No Platform Admin duplication.

---

## 13. Security

Security Center signals API unchanged.  
Title localized to **אבטחה**; lead clarified as evidence-based status only.  
No invented MFA/session/password UI beyond what API signals expose.

---

## 14. System/advanced

Group label: **מתקדם**  
Item label: **הגדרות מערכת** (workspace name, plan, role, status + links to Security/Audit)  
No platform-admin controls.

---

## 15. Visual hierarchy

Uses existing settings design tokens: compact sections, group labels, controlled panel width (`48rem`), no giant cards / gradient chrome.

---

## 16. Desktop

≥900px: sticky nav rail + main panel; active link with inset accent bar (RTL-aware).

---

## 17. Tablet

768–899: mobile select (avoids cramped dual column).  
900 / 1024 / 1032: sidebar + content. CSS already in `styles.css`.

---

## 18. Mobile

360 / 390: category `<select>` with optgroups, one-column forms, Bottom Nav preserved, panel padding accounts for clearance. No horizontal overflow patterns introduced.

---

## 19. RTL

RTL shell retained. Email / timezone / currency / prefixes use `ltr-meta`.

---

## 20. Accessibility

- Label↔control: Input components + `htmlFor` on mobile nav select
- Selected nav: `aria-current="page"`
- Avatar: radiogroup + `aria-checked` + keyboard arrows
- Errors: `role="alert"`; success: `role="status"`
- Disabled save: `title` explains no changes

---

## 21. localhost/origin audit

Settings routes/components: **no** hardcoded `localhost` / `127.0.0.1` / absolute origins. Router-relative `/app/settings…` only. Covered by shell test.

---

## 22. Files changed

Primary SETTINGS-2 touch set:
- `apps/web/src/components/settings/SettingsShell.tsx`
- `apps/web/src/routes/app/settings/index.tsx`
- `apps/web/src/routes/app/settings/company.tsx`
- `apps/web/src/routes/app/settings/quotes.tsx`
- `apps/web/src/routes/app/settings/numbering.tsx`
- `apps/web/src/routes/app/settings/sites.tsx`
- `apps/web/src/routes/app/settings/notifications.tsx`
- `apps/web/src/routes/app/settings/system.tsx` (label via i18n)
- `apps/web/src/i18n/he.ts`
- `apps/web/src/components/AccountAvatarPicker.tsx` (existing; copy via i18n)
- `apps/web/tests/settings-shell.test.tsx`
- `apps/web/tests/settings-expansion.test.ts`
- `apps/web/src/styles.css` (settings shell groups — prior/current)

---

## 23. Tests

```
vitest run tests/settings-shell.test.tsx tests/settings-expansion.test.ts
→ 14 passed
```

Coverage includes: grouped nav, landing copy, role permission matrix, prefs round-trip, relative links / no localhost.

---

## 24. Typecheck

Full `tsc` workspace still reports **pre-existing** errors outside settings (customers directory, dashboard tests, quote-stage tests, etc.).

**Settings-related type errors fixed** (added missing `companyPreview*` i18n keys).

---

## 25. Build

`vite build` for `@site-secure/web` — **PASS** (production bundle written to `apps/web/dist`).  
`npm run build` also runs `tsc --noEmit` and fails on pre-existing non-settings errors.

---

## 26. Remaining settings gaps

1. Dirty-nav leave confirmation (`beforeunload` / in-app guard)
2. Sites/Notifications dirty polish done; Appearance is local-only (OK)
3. Manager cannot edit workspace commercial settings by catalog (policy; not expanded here)
4. Sales/Tech/Viewer have no personal-only settings surface beyond what app shell allows
5. Quote approval / default-template controls not present — do not invent
6. Next numbering counter not shown (server sequence) — intentional
7. Security still signal-list only (no password/MFA management UI)
8. Full visual regression matrix (1440→360 dark/light) best verified on deployed URL after Vercel

---

## 27. Vercel deploy

**Status: BLOCKED (auth)**

Attempted `npx vercel deploy --prod --yes` against linked project `site-secure` (`prj_m4ANeJuQz8p99apBD1QsWE8GKert`).

Result: **No existing credentials** (`vercel whoami` → please run `vercel login` or pass `--token`). Local `~/Library/Application Support/com.vercel.cli/auth.json` is empty `{}`.

`vite build` succeeded locally (`apps/web/dist` ready). Production deploy cannot proceed from this agent environment until an operator re-authenticates Vercel CLI or provides `VERCEL_TOKEN`.

Target production URL (existing): https://site-secure-umber.vercel.app

---

**STOP.** No SETTINGS-3 started.
