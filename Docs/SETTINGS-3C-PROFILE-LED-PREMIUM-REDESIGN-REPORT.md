# SETTINGS-3C PROFILE-LED PREMIUM REDESIGN REPORT

Checkpoint complete. Settings is now a profile-led hub matching the reference grammar (identity + grouped rows + Edit Profile), while staying dark-first, RTL, RBAC-true, and SETTINGS-3B-honest. Bottom Nav untouched.

---

## 1. Files changed

**New**
- `apps/web/src/routes/app/settings/profile.tsx`
- `apps/web/src/routes/app/settings/general.tsx` (workspace General moved off hub)
- `apps/web/tests/settings-hub.test.tsx`
- `Docs/SETTINGS-3C-PROFILE-LED-PREMIUM-REDESIGN-REPORT.md`

**Updated**
- `apps/web/src/routes/app/settings/index.tsx` → Settings Hub
- `apps/web/src/components/settings/SettingsShell.tsx` → new IA, icons, rail profile, hub rows
- `apps/web/src/components/AccountAvatarPicker.tsx` → neutral style labels
- `apps/web/src/routes/app/settings/company.tsx` → save CTA class
- `apps/web/src/i18n/he.ts`
- `apps/web/src/styles.css` → hub / profile / rail / form radius
- `apps/web/tests/settings-shell.test.tsx`
- `apps/web/tests/settings-expansion.test.ts`
- `apps/web/src/routeTree.gen.ts` (generated)

## 2. Settings landing redesign

`/app/settings` is the hub for anyone with `settings.view`:
- title הגדרות
- large circular avatar, name, email, role, workspace
- primary CTA עריכת פרופיל
- permission-filtered grouped rows (icon + label + chevron)
- mobile: hub fills the page (aside chrome hidden)
- desktop: rail + content overview

## 3. Profile route

`/app/settings/profile` — Edit Profile page with back to hub, avatar affordance, fields, full-width save.

## 4. Profile data used

| Field | Source | Editable |
|---|---|---|
| full_name | `profiles` via `PATCH /me` | yes |
| phone | `profiles` via `PATCH /me` | yes |
| email | auth session | read-only |
| role | membership `role_key` | read-only |
| workspace | membership name | read-only |
| avatar | existing metadata + local cache | yes (picker) |

No birthday / gender / username / upload.

## 5. Avatar move

Removed from General. Lives on Profile (`תמונת פרופיל`). Neutral labels: סגנון א / סגנון ב. Same persistence (Supabase metadata + cache). No photo upload.

## 6. Appearance placement

Under **פרופיל וחשבון**. Route/behavior/theme persistence unchanged (`settings.view`).

## 7. Security placement

Under **פרופיל וחשבון**. Honest signals + forgot-password link preserved. No MFA/session UI added.

## 8. General cleanup

Moved to `/app/settings/general`. Workspace-only: name, timezone, VAT, read-only ILS. No avatar.

## 9. Company/branding result

Functionality unchanged. Form radius / save CTA aligned to reference grammar. No giant-card inflation.

## 10. Commercial settings result

Quotes / Numbering / PDF templates: SETTINGS-3B behavior intact; shell/nav only.

## 11. Operations result

Sites + Notifications honesty from 3B preserved.

## 12. Team/access result

Team / Roles / Audit remain functional list/matrix pages; grouped under צוות וגישה (Audit moved here per IA).

## 13. Advanced/system result

System remains compact meta page under מתקדם.

## 14. Desktop

Rail (≥900px): title + compact profile + Edit Profile + grouped icon nav. Content max-width ~50rem (~800px).

## 15. Tablet

Uses existing 900px breakpoint strategy for rail vs mobile select/hub.

## 16. Mobile

Hub = native profile/settings list; section pages = dedicated content + mobile select (includes hub option). Row height ~52–56px. Bottom Nav clearance unchanged (AppShell untouched).

## 17. Dark mode

SITE SECURE tokens only; dark remains first-class. No light-first switch.

## 18. Light mode

Same components/tokens; supported.

## 19. RTL

RTL shell; chevron mirrors for LTR; email/timezone/phone use `ltr-meta`.

## 20. Accessibility

Focus rings on rows/CTAs/avatar; 44px+ targets; radiogroup avatar picker; save success/error roles; labels on inputs.

## 21. Role visibility

| Role | Hub | Profile/Appearance | Security | Workspace/Commercial | Team |
|---|---|---|---|---|---|
| Owner/Admin | yes | yes | yes | yes | yes |
| Manager | yes | yes | yes | no | users (+ roles if granted) |
| Sales/Tech/Viewer | yes | yes | no | no | no |

Inaccessible rows hidden (not disabled).

## 22. Save UX

Profile/General/Company/Quotes/etc. keep dirty / saving / success / failure. Notifications still non-savable honesty page.

## 23. Tests

`settings-shell`, `settings-expansion`, `settings-hub` — **22 passed**.

## 24. Typecheck

No errors in SETTINGS-3C source files. Full `web:typecheck` still has pre-existing unrelated test TS failures.

## 25. Build

`npm run web:build` — **pass**.

## 26. Remaining gaps

- No visual QA screenshots at all listed viewports in this checkpoint (manual browser QA recommended).
- Avatar is still illustration picker, not camera upload (by design).
- Tablet mid-widths rely on 900px breakpoint; no new dedicated 768–850 layout beyond that.
- Company/Team/PDF studio not fully redesigned field-by-field — grammar applied via shell + form tokens.

**STOP — do not start SETTINGS-3D automatically.**
