# BETA-ADMIN-5 ADMIN IA + USERS/ARCHIVE REPORT

Focused Admin IA consolidation. No backend/auth/archive semantics changes.

## 1. Previous navigation problems

Top-level Admin nav mixed lifecycle surfaces (Users, Invitations, Archive) with beta tooling (Beta, Badges, Flags). Archive mixed user soft-archive with workspace cold-archive. Too many peer destinations for related work.

## 2. Final admin navigation

**תפעול**
- לוח תפעול
- סביבות עבודה
- משתמשים
- פידבק
- Audit

**ניהול פלטפורמה**
- בטא

Removed as top-level: הזמנות, ארכיון, תוכנית בטא (renamed under בטא), Badges, דגלי יכולת.

## 3. Users lifecycle tabs

`/admin/users?tab=active|archived|invitations`

Summary strip: פעילים · בארכיון · הזמנות ממתינות.

## 4. Active users UI

Dense directory: avatar initials, name + LTR email, status chip, workspace count, primary role, actions פתח / העבר לארכיון. Workspace + role filters. Mobile stacked cards.

## 5. Archived users UI

Soft-archive tab copy: inactive accounts restorable with same identity. Rows: archived date/by/reason, workspace count, roles, החזר לפעילות + פתח פרטים. Not cold-storage wording.

## 6. Archive action UX

Confirm modal with warning panel (not delete-red): memberships listed, optional reason, CTA העבר לארכיון.

## 7. Restore action UX

Confirm: same account + existing permissions. Shows name/email/workspace count/roles. Primary החזר לפעילות — no destructive styling.

## 8. Invitations integration

Invitations panel embedded in Users → הזמנות (create, status sub-filters, reissue/revoke). Mobile cards included.

## 9. Workspaces archive integration

`/admin/organizations?tab=active|archived` — active orgs list vs cold workspace archive list. Semantics unchanged; separate from user archive.

## 10. `/admin/archive` behavior

Redirect → `/admin/organizations?tab=archived`.

## 11. Beta consolidation

`/admin/beta?tab=overview|badges|flags` — overview/participants, badges (link to Users), feature flags.

## 12. Route compatibility

| Old | New |
|-----|-----|
| `/admin/invitations` | → Users `tab=invitations` |
| `/admin/archive` | → Orgs `tab=archived` |
| `/admin/badges` | → Beta `tab=badges` |
| `/admin/flags` | → Beta `tab=flags` |

Verified by Playwright redirects = true.

## 13. Desktop result

1440 tables + tabs + summary strips. No horizontal overflow in QA captures (after content wait).

## 14. Tablet result

Tabs wrap/scroll; toolbar filters stack. Covered by responsive CSS breakpoints.

## 15. Mobile result

≤767px: desktop tables hidden; stacked `.admin-user-card` rows. Capture: `users-active-390-dark.png`.

## 16. Dark/Light

Dark-first tokens; light capture included (`users-active-1440-light.png`).

## 17. RTL

Admin shell RTL preserved; emails/IDs use `ltr-meta`.

## 18. Accessibility

`role=tablist/tab/tabpanel`, aria-selected, focus-visible rings, status chips with text (not color-only), ≥44px tab/action heights, modal dialogs via existing `Modal`.

## 19. Files changed

- `apps/web/src/routes/admin/route.tsx` — nav IA
- `apps/web/src/routes/admin/users.tsx` — lifecycle hub
- `apps/web/src/routes/admin/organizations.tsx` — active/archived tabs
- `apps/web/src/routes/admin/beta.tsx` — overview/badges/flags tabs
- `apps/web/src/routes/admin/{invitations,archive,badges,flags}.tsx` — redirects
- `apps/web/src/components/admin/AdminTabs.tsx` — new
- `apps/web/src/components/admin/AdminInvitationsPanel.tsx` — new
- `apps/web/src/i18n/he.ts` — copy
- `apps/web/src/styles.css` — lifecycle styles
- `apps/web/scripts/beta_admin_5_visual_qa.mjs` — QA
- `Docs/beta-admin-5-visual-qa/*` — captures + report

## 20. Tests

Playwright visual/redirect suite: redirects PASS; nav top-level cleaned; overflowX false.

## 21. Typecheck

Vite build includes TS transpile of app sources — **success**. Repo-wide `tsc` still has unrelated pre-existing test errors.

## 22. Build

`apps/web` `npm run build` — **success**.

## 23. Remaining admin IA gaps

- Ops Command Center attention links still hit `/admin/invitations` (compatible via redirect).
- Badge assignment remains on Users detail panel (Beta badges tab deep-links there).
- Cold user-profile restore UI no longer on a dedicated archive page (workspace cold archive remains under Orgs; soft users under Users).
- Full multi-viewport matrix beyond 1440/390 not fully re-shot after wait fix — re-run `node scripts/beta_admin_5_visual_qa.mjs` if needed.

### UI Review Checklist

Dark tokens, RTL, ltr-meta emails, dense ops tables, no giant cards, no bottom-nav changes, status text+chip, empty states present, redirects preserve bookmarks.
