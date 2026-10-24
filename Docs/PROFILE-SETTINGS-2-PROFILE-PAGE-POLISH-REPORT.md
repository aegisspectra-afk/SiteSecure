# PROFILE-SETTINGS-2 PROFILE PAGE POLISH REPORT

Date: 2026-09-30  
Area: `/app/settings/profile`

## 1. Files changed

- `apps/web/src/routes/app/settings/profile.tsx` — identity / sections / save / gated security links
- `apps/web/src/i18n/he.ts` — profile polish copy (`settingsProfile*`, avatar change wording, `settingsSaveChanges`)
- `apps/web/src/styles.css` — `.settings-profile*` hierarchy, readonly rows, actions, avatar states
- `apps/web/tests/profile-settings-2.test.tsx` — unit coverage
- `apps/web/scripts/profile_settings_2_qa.mjs` — viewport capture helper
- `Docs/profile-settings-2-qa/*` — screenshots + `report.json`
- `Docs/PROFILE-SETTINGS-2-PROFILE-PAGE-POLISH-REPORT.md` — this report

## 2. Header/subtitle

- Title: **עריכת פרופיל**
- Lead: **פרטי החשבון האישיים שלך ב־SITE SECURE**
- Back to hub retained; no hero

## 3. Identity block

- Circular avatar
- Full name or **הוסיפו שם מלא**
- Email (LTR)
- Role chip · workspace name  
- Uses actual `roleLabel` only (no Platform Admin headline)

## 4. Avatar UX

- Existing `AccountAvatarPicker` kept
- Open/selected border + focus-visible
- Caption **שינוי איור** (not upload language)
- Panel labelled **תמונת פרופיל**
- Keyboard radiogroup unchanged

## 5. Empty-name handling

- Placeholder identity title when missing
- Hint: add full name so it appears where the user is identified
- Optional phone hint only when empty
- No completion % / gamification

## 6. Editable fields

Section **פרטים אישיים**:

- שם מלא
- טלפון  

Persistence: existing `PATCH /me` → `profiles.full_name` / `profiles.phone`

## 7. Read-only account fields

Section **פרטי חשבון** — metadata rows with lock affordance (not editable inputs):

- דוא״ל (LTR)
- תפקיד
- סביבת עבודה  

No mutation of email / role / workspace from this page.

## 8. Account/security actions

Section **חשבון ואבטחה**:

- **מעבר להגדרות אבטחה** → `/app/settings/security` (only if `settings.general` | `workspace.edit`)
- **איפוס סיסמה** → `/forgot-password`  

No MFA/session controls; Security page not duplicated.

## 9. Save UX

- CTA copy: **שמור שינויים**
- Disabled when unchanged (or missing full name)
- Saving label via `he.saving`
- Success flash / error alert; retry after failure
- Real `patchMe` only — no fake success

## 10. Desktop result

Settings rail + content panel preserved. Profile max-width ~46rem (~736px). Fields do not stretch full viewport. Identity centered within content.

## 11. Mobile result

430 / 390 / 360: stacked sections, save CTA reachable without sticky overlay, Bottom Nav unchanged, no horizontal overflow (live QA).

## 12. Dark/Light

Token surfaces only; both themes captured. No gradients/glow.

## 13. RTL

RTL shell; email LTR isolation; phone input uses `ltr-meta`.

## 14. Accessibility

- Labels on inputs
- Avatar controls keyboard + `aria-expanded` / `aria-controls`
- Readonly rows as `<dl>`
- Save success/error with `role="status"` / `role="alert"`
- ≥44px targets on primary actions / caption / links

## 15. Role/RBAC check

- Page still gated by `settings.view` (personal)
- Security settings link permission-gated; password reset always available
- Role/workspace display-only; catalog untouched

## 16. Tests

- Vitest `profile-settings-2.test.tsx` — **4/4 passed** (identity, empty-name, dirty save → `patchMe`, technician hides security link)
- Playwright QA (`Docs/profile-settings-2-qa/report.json`): hierarchy, save copy, illustration wording, RTL, disabled save, no overflow across breakpoints × themes

## 17. Typecheck

No errors in profile-related files. Repo-wide `tsc` still has pre-existing unrelated failures.

## 18. Build

`apps/web` production build — **succeeded**.

## 19. Remaining profile gaps

- No photo upload (illustration styles only — intentional)
- Full name still required to save (existing validation)
- QA owner account currently has empty `full_name` (fallback/hint visible — useful proof)
- No last-login / MFA / session management on this page

---

## SITE SECURE UI Review Checklist (sign-off)

| Item | Result |
|---|---|
| Area touched | `/app/settings/profile` polish |
| Themes checked (dark / light) | Pass — Playwright both |
| Breakpoints checked | 1440 / 1032 / 768 / 430 / 390 / 360 — no overflow |
| RTL checked | Pass |
| Dark mode preserved | Pass |
| Bottom Nav untouched | Pass |
| Role permissions respected | Pass (security link gated) |
| No giant cards / gradients / glow | Pass |
| Focus-visible / ≥44px CTAs | Pass |
| Reviewer / agent | Auto (Composer) |
| Date | 2026-09-30 |

**Bold checklist items:** pass for this scoped change.
