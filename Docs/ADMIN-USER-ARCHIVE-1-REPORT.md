# ADMIN-USER-ARCHIVE-1 REPORT

Reversible platform user soft-archive (Active ↔ Archived). Not deletion. Not workspace-member deactivate. Not cold-archive recreate.

## 1. Existing user/auth architecture

- **Auth identity:** Supabase Auth `auth.users` (UUID). Profile: `public.profiles.id` FK → `auth.users.id`.
- **Activity source of truth (pre-change):** no platform lifecycle field; membership `workspace_memberships.status` (`active|disabled`) is per-workspace only; `profiles.is_platform_admin` is platform RBAC flag.
- **Session:** web JWT → `GET /api/v1/auth/session` via `current_user` → `UserClient.get_user()` + profile + active memberships.
- **Authorize:** `require_platform_admin` reads `profiles.is_platform_admin` (UUID-gated).

## 2. Existing archive architecture

- **Cold archive:** `archive` schema / `archive_workspaces` + `archive_profiles` snapshots; admin restore recreates Auth user and attaches membership (destructive identity path for cold cases).
- **Workspace membership disable:** team deactivate — one membership, not global.

## 3. Why workspace cold archive is/isn't suitable for users

**Not suitable** for reversible user lifecycle:
- Cold path removes/consumes hot rows and restore **recreates** Auth identity.
- Spec requires same auth ID/email/profile/memberships/history.
- Soft-archive keeps the hot profile row and bans Auth reversibly.

## 4. User lifecycle model

| State | Meaning |
|------|---------|
| **active** | `profiles.archived_at IS NULL` — may authenticate and use memberships |
| **archived** | `profiles.archived_at` set — same identity; cannot use SITE SECURE until restore |

Memberships/roles/history unchanged. Distinct from membership `disabled`.

## 5. DB/schema changes

Migration `20260930210000_profile_user_archive.sql` (applied to SiteSecureV1):

- `profiles.archived_at timestamptz NULL`
- `profiles.archived_by uuid NULL` → `profiles(id)`
- `profiles.archive_reason text NULL`
- Partial index on `archived_at WHERE NOT NULL`

Lifecycle derived in API as `lifecycle_status: active|archived` (no separate enum column).

## 6. Authentication blocking

1. **GoTrue ban:** Admin `PUT /auth/v1/admin/users/{id}` with `ban_duration=876600h` on archive; `ban_duration=none` on restore.
2. **Session logout:** best-effort `POST .../admin/users/{id}/logout`.
3. **App gate:** `current_user` rejects if `profiles.archived_at` set → `403 ACCOUNT_INACTIVE`.

Login maps banned Auth errors to Hebrew inactive-account message (not “wrong password”).

## 7. Existing-session behavior

- Next protected API call using `Depends(current_user)` → **403 ACCOUNT_INACTIVE** as soon as `archived_at` is set (no wait for JWT expiry).
- Refresh tokens invalidated via admin logout when ban succeeds.
- Access-token residual: may remain cryptographically valid until expiry, but **API rejects immediately** via profile check.
- Web hydrate on `ACCOUNT_INACTIVE` clears local session and signs out locally.

## 8. Server enforcement

- Authoritative in `current_user` (all authenticated app routes using it).
- Not UI-only; not JWT custom claims only.
- Invite create (workspace + admin) blocks archived emails (`USER_ARCHIVED`).

## 9. /admin/users changes

- Status chips: פעיל / בארכיון
- Filters: הכל / פעילים / בארכיון
- Search: name, email, user ID
- Actions: פתח; העבר לארכיון / החזר לפעילות
- Confirm modals with memberships + optional reason
- Active vs archived counts separated when filter=הכל

## 10. /admin/archive changes

Three tabs (concepts separated):

1. **משתמשים בארכיון** — soft-archived hot profiles (reversible restore)
2. **סביבות בארכיון** — cold workspaces (unchanged)
3. **ארכיון קר — משתמשים** — cold profile snapshots (recreate restore; copy clarifies difference)

## 11. Archive confirmation UX

Modal shows name, email, memberships/roles, copy about preserved account/history, optional reason, explicit confirm. No email typing required.

## 12. Restore UX

- Users list + soft-users archive tab: **החזר לפעילות**
- Clears archive fields, unbans Auth, audit event
- Same credentials/account; no invite; no new identity

## 13. Multi-workspace behavior

Platform archive disables the user globally. Memberships remain (including `active`). Workspace deactivate remains a separate, per-membership control.

## 14. Owner safeguards

Before archive: if user is sole **active Owner** of any **active** workspace → `403 ARCHIVE_OWNER_ORPHAN` with workspace names. No silent orphaning.

## 15. Platform-admin safeguards

- Cannot archive self → `ARCHIVE_SELF`
- Cannot archive last non-archived platform admin → `ARCHIVE_LAST_ADMIN`

## 16. Invitation behavior

**Chosen:** block invite creation when email matches an archived profile; instruct restore first (`USER_ARCHIVED`). No second Auth identity. Accept path also blocked because archived users cannot establish app session.

## 17. Password recovery behavior

- **Archived:** Auth ban + `ACCOUNT_INACTIVE` on session/API — recovery must not grant working app access. Preferred UX maps ban to inactive message.
- **Restored:** ban cleared; existing recovery flow works normally.

## 18. Audit events

`platform_admin_events`:

- `platform_user_archived` — target user/email, actor, reason, membership_count (+ sample memberships)
- `platform_user_restored` — target user/email, actor, previous archive metadata, membership_count  

No passwords/tokens logged.

## 19. Counts/seat behavior

- Admin summary `users` = **active** profiles only; new `users_archived` count.
- Founding-technician badge count excludes archived profiles.
- Seat/billing architecture unchanged this checkpoint; archived users still occupy membership rows (memberships not removed). Document: seats count memberships, not soft-archive status, unless billing rules change later.

## 20. Security tests

| Check | Result |
|-------|--------|
| Non-platform-admin archive/restore | Routes use `require_platform_admin` → 403 |
| Direct API enforcement | `current_user` ACCOUNT_INACTIVE |
| Cross-workspace isolation | Unchanged RLS/authz |
| Restore privilege escalation | Only clears archive; does not grant admin/roles |

Unit tests: `apps/api/tests/test_user_archive.py` — **9 passed**.

## 21. Responsive QA

Implemented with compact tables, truncate+title for long emails, wrap action buttons, modal max-width. Checklist applied (dark tokens, RTL, ltr-meta emails, no giant cards, archive ≠ destructive red). Full viewport screenshot matrix not run in this agent turn — recommend manual 1440/1032/768/390/360 pass on `/admin/users` and `/admin/archive`.

## 22. Tests

- Unit: lifecycle, ACCOUNT_INACTIVE, invite email block, self/last-admin/owner-orphan, archive↔restore mock roundtrip, current_user reject — **9/9 pass**.
- Live Browser A/B session invalidation: not executed here; behavior documented in §7.

## 23. Typecheck

Web `tsc` has pre-existing unrelated errors; **no errors** in changed admin/users, admin/archive, auth-errors, session, he strings for this feature. API modules import cleanly.

## 24. Build

`apps/web` `vite build` — **success**.

## 25. Remaining gaps

- Live dual-browser session QA not executed in this pass.
- Live password-recovery against a banned archived user not executed (logic + unit coverage only).
- Soft-user “פתח פרטים” deep detail panel deferred (open via Users list).
- Cold restore still recreates Auth (pre-existing; intentionally separate).

---

## FINAL ANSWERS

**A. Does archived user keep exactly the same auth identity?**  
Yes — same `auth.users` / `profiles.id` / email; no delete/recreate.

**B. Can an archived user log in or use an existing session?**  
No for login (Auth ban + inactive message). Existing sessions: protected APIs return 403 ACCOUNT_INACTIVE immediately; web signs out on hydrate.

**C. Does restore let the same account log in again?**  
Yes — clears archive fields, unbans Auth; same credentials.

**D. Are memberships/roles/history preserved?**  
Yes — not deleted or rewritten on archive/restore.

**E. Can archive orphan an active workspace?**  
No — blocked with `ARCHIVE_OWNER_ORPHAN` when the user is the last active Owner.

**F. Can password reset bypass archive?**  
No intended path: ban + server `ACCOUNT_INACTIVE` gate; restored users recover normally.

**G. Can a non-platform-admin archive/restore a user?**  
No — `require_platform_admin` on archive/restore endpoints.
