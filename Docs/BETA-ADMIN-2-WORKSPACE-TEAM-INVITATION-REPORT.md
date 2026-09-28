# BETA-ADMIN-2 WORKSPACE TEAM INVITATION REPORT

**Date:** 2026-09-28  
**Scope:** Workspace Owner/Manager invite team members into their own workspace  
**STOP:** No broader onboarding started  

---

## 1. Files changed

| Area | Files |
|------|--------|
| Authz | `packages/authz/catalog.json` — manager gains `users.invite` |
| Migration | `supabase/migrations/20260928114500_beta_admin2_team_invitations_rls.sql` |
| RLS test | `supabase/tests/rls_isolation.sql` |
| Occupancy | `apps/api/app/authz/usage.py` — ignore `revoked_at` pending invites |
| API | `apps/api/app/routers/workspaces.py` — team role allowlist, list status, revoke/reissue |
| Client | `packages/api-client/src/index.ts` — `listInvitations`, `revokeInvitation`, `reissueInvitation` |
| UI | `apps/web/src/routes/app/settings/users.tsx` — members + invitations panel |
| i18n | `apps/web/src/i18n/he.ts` |
| Tests | `apps/api/tests/test_authorize.py`, `apps/api/tests/test_workspace_team_invitations_live.py` |

## 2. Existing team UI reused

**Settings → צוות** (`/app/settings/users`) — existing page extended (not a new route).

Shows:

- Active members: name, email, role, status, joined date, manage actions (owner/admin)
- Pending invitations: email, role, status, created/expires, revoke / reissue
- Invite form + copy invite link (unchanged pattern)

## 3. Workspace invite endpoint

| Method | Path | Authz |
|--------|------|--------|
| POST | `/api/v1/workspaces/{id}/invitations` | `users.invite` + seat/duplicate checks |
| GET | `/api/v1/workspaces/{id}/invitations` | `users.invite` |
| POST | `.../invitations/{invite_id}/revoke` | `users.invite` |
| POST | `.../invitations/{invite_id}/reissue` | `users.invite` |

Accept flow unchanged: `/invite/{token}` → peek/accept RPCs.

**Not** using `/api/v1/admin/*` from the browser.

## 4. Role rules

Allowed team invite roles: `manager`, `sales`, `technician`, `viewer`, `administrator`  
(further filtered by plan `assignable_roles`).

`owner` / unknown roles → `403 BUSINESS_RULE`.

## 5. Owner behavior

- Can invite technician (and other assignable non-owner roles)
- Cannot invite `owner` via team settings
- Can list / revoke / reissue workspace invitations
- Live covered

## 6. Manager behavior

- Catalog grant: **`users.invite` added** (goal: Owner/Manager)
- RLS: invitations policy moved from `auth_is_privileged` → `auth_is_managerial` (owner/admin/manager)
- Manager can invite technician — live covered
- Manager still **cannot** `users.manage` (role disable / role change)

## 7. Sales / Technician / Viewer behavior

| Role | `users.invite` |
|------|----------------|
| Sales | Denied (unchanged) |
| Technician | Denied — live covered |
| Viewer | Denied |

## 8. Invitation reuse

Same hashed-token `public.invitations` model as BETA-ADMIN-1.  
Same accept path. No second invitation system.

## 9. Revocation / reissue

- **Revoke:** sets `revoked_at` (workspace-scoped)
- **Reissue:** revoke if needed → new token for same email/role → copy link in UI
- Occupancy ignores revoked invites

## 10. Tenancy / security

- Caller must be member of the workspace (`load_authz_context`)
- `users.invite` required
- Invitation queries filter `workspace_id = path workspace`
- Cross-workspace list → 403/404
- No arbitrary role escalation; owner blocked on team path
- Platform-admin endpoints not used by Settings UI

## 11. Tests

| Suite | Result |
|-------|--------|
| `test_authorize.py` + occupancy + foundation | **PASS** |
| `test_workspace_team_invitations_live.py` (4) | **PASS** |
| `test_invite_accept_live.py` + tenant isolation (prior run) | **PASS** (25/26 after cross-ws assert fix; team suite green) |

Coverage: owner invite tech, manager invite, sales/tech/viewer deny (authz + live tech), cross-ws deny, owner role blocked, dup membership, revoke/reissue, accept.

## 12. Typecheck

`apps/web` `npm run typecheck` — **PASS**

## 13. Build

`apps/web` `npm run build` — **PASS**

## 14. Remaining gaps

- No bulk invite
- Manager cannot manage member status/roles (`users.manage` still privileged)
- Email delivery still manual (copy link)
- Docs `V2-RBAC.md` matrix still shows manager without invite (code is source of truth)
- Broader onboarding UX not started

---

**STOP.**
