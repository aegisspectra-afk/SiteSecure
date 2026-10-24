# PROFILE-SETTINGS-3 APPEARANCE MERGE REPORT

Date: 2026-09-30  
Area: `/app/settings/profile` + Settings nav + `/app/settings/appearance`

## 1. Files changed

- `apps/web/src/routes/app/settings/profile.tsx` — **העדפות אישיות** + `ThemePicker`
- `apps/web/src/routes/app/settings/appearance.tsx` — redirect → profile
- `apps/web/src/components/settings/SettingsShell.tsx` — removed **מראה** nav item
- `apps/web/src/i18n/he.ts` — prefs heading + device-local theme hint
- `apps/web/tests/profile-settings-3.test.tsx` — redirect + copy
- `apps/web/tests/profile-settings-2.test.tsx` — prefs section present
- `apps/web/tests/settings-hub.test.tsx` — appearance removed from nav
- `apps/web/tests/settings-expansion.test.ts` — device-local copy
- `Docs/PROFILE-SETTINGS-3-APPEARANCE-MERGE-REPORT.md` — this report

## 2. Profile Appearance section

Section **העדפות אישיות** on Profile (outside the save form):

- Reuses existing `ThemePicker` (`id="settings-profile-theme"`)
- Label **ערכת נושא** with options בהיר / כהה / מערכת
- Hint: ההעדפה נשמרת במכשיר זה בלבד ואינה משפיעה על משתמשים אחרים.

## 3. Theme behavior

Unchanged: same `ThemePicker` → `setThemeMode` / `useTheme` / localStorage persistence. No token, provider, or palette edits.

## 4. Navigation change

Profile/account group is now:

- פרופיל אישי  
- אבטחה (when permitted)

**מראה** removed; no replacement nav item.

## 5. Appearance redirect

`/app/settings/appearance` `beforeLoad` → `redirect({ to: "/app/settings/profile", replace: true })`. No duplicate editable Appearance UI.

## 6. Account-menu behavior

`ThemePicker` in `UserAccountMenu` kept as quick-access. Same persistence source of truth — no conflicting state.

## 7. Role access

Theme sits on Profile (`settings.view`). No `workspace.edit` required. Workspace RBAC unchanged.

## 8. Dark-mode regression

Dark-first + light/system preserved. This task only relocated the control. Theme unit tests still pass (14).

## 9. Mobile

Compact segmented control; no oversized preview cards; works within existing Profile layout (390/360 density unchanged). Bottom Nav untouched.

## 10. Accessibility

Existing ThemePicker radiogroup, keyboard arrows, focus-visible, selected state retained. Device hint is plain supporting text.

## 11. Tests

- `profile-settings-3` — **2/2**
- `profile-settings-2` — **4/4** (includes prefs)
- `settings-hub` — **1/1** (no appearance)
- `settings-expansion` — pass
- `theme.test.tsx` — **14/14**

## 12. Typecheck

No errors in touched profile/appearance/SettingsShell files. Repo-wide pre-existing unrelated `tsc` debt remains.

## 13. Build

`apps/web` production build — **succeeded**.

---

## SITE SECURE UI Review Checklist (sign-off)

| Item | Result |
|---|---|
| Area touched | Profile theme merge; Appearance redirect; nav cleanup |
| Themes checked (dark / light) | Pass — existing ThemePicker + theme tests |
| Breakpoints | Compact control in existing Profile shell |
| RTL | Pass (ThemePicker RTL-aware) |
| Dark mode preserved | Pass — NON-NEGOTIABLE upheld |
| Bottom Nav untouched | Pass |
| Role permissions respected | Pass |
| No giant cards / gradients / glow | Pass |
| Focus-visible / keyboard | Pass (existing picker) |
| Reviewer / agent | Auto (Composer) |
| Date | 2026-09-30 |

**Bold checklist items:** pass for this scoped change.
