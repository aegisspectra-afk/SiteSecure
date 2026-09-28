# BETA-ADMIN-1 PLATFORM ADMIN / INVITATION REPORT

**Date:** 2026-09-28  
**Scope:** Minimal secure SITE SECURE platform-admin flow for Founding Technician onboarding  
**STOP:** No broader onboarding work started  

---

## 1. Existing auth architecture

- **Identity:** Supabase Auth (`auth.users`) + `public.profiles` (1:1 on `id`)
- **Session:** `GET /api/v1/auth/session` returns memberships + `is_platform_admin` from `profiles`
- **API auth:** Bearer JWT → `UserClient` (user JWT) or `ServiceClient` (service role, server-only)
- **No second identity system** — invitations join to existing Auth users by email match

## 2. Existing membership architecture

- **Tenant scope:** `workspace_memberships(workspace_id, user_id, role_key, status)`
- **Workspace roles:** `owner`, `manager`, `sales`, `technician`, `viewer`, `administrator` (tenant-scoped)
- **Invitations (pre-existing):** `public.invitations` with `token_hash`, `expires_at`, `accepted_at`
- **Workspace Settings invites:** `POST /api/v1/workspaces/{id}/invitations` — **blocks `owner`** (unchanged)
- **Accept:** `accept_invitation(p_token)` SECURITY DEFINER RPC (authenticated)

## 3. Platform-admin implementation

- **Source of truth:** `profiles.is_platform_admin` (boolean flag) ≡ `platform_super_admin`
- **Not** a workspace role; workspace Owner does **not** become platform admin
- **Gate:** `require_platform_admin(service, user_id)` on every `/api/v1/admin/*` route
- **UI gate:** `/admin` layout denies non-admins (defense in depth; API is authoritative)

## 4. Bootstrap procedure

Controlled only — **no public “make me admin” endpoint**.

```bash
cd apps/api
# Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env
python scripts/bootstrap_platform_admin.py --email someone@example.com
# or
python scripts/bootstrap_platform_admin.py --user-id <auth-user-uuid>
# revoke:
python scripts/bootstrap_platform_admin.py --email someone@example.com --revoke
```

Uses service-role RPCs `grant_platform_admin` / `revoke_platform_admin`.  
Current production admin (verified): `aegisspectra@gmail.com` (`8421d004-c62b-444a-9dd4-3cde964fb2db`).

## 5. Admin route

- **URL:** `/admin` (existing shell) + new **`/admin/invitations`**
- **Nav:** Workspaces (Organizations), **Invitations**, Users, Beta, Badges, Feedback, Audit, Flags
- Simple `admin-shell` layout — does **not** use AppShell

## 6. Workspace creation

- **`POST /api/v1/admin/organizations`**
- Calls `admin_provision_workspace(name, plan_key)` — creates workspace + settings + counters + subscription + defaults
- **No membership** created (empty workspace for FT owner invite)
- Optional `is_beta` / `beta_program` / `internal_note` (note audited only)
- Default plan: `business`
- UI: create form on `/admin/organizations`

## 7. Invitation data model

Reuses `public.invitations` (+ new column):

| Column | Notes |
|--------|--------|
| id, workspace_id, email, role_key | as before |
| token_hash | SHA-256 hex; **never plaintext** |
| invited_by | platform admin user id |
| expires_at | default +14 days |
| accepted_at | set on accept |
| **revoked_at** | **NEW** — revoke/reissue |
| created_at | |

## 8. Token security

- `secrets.token_urlsafe(32)` → high entropy
- Store only `hashlib.sha256(token).hexdigest()`
- One-time: `accepted_at` set; reuse blocked (idempotent only if same user already member)
- Expiring: `expires_at`
- Revocable: `revoked_at`
- Original token returned **only at create/reissue**; list endpoints never include token

## 9. Invitation creation UX

`/admin/invitations`:

1. Select workspace  
2. Email  
3. Role (`owner` default for FT business; `technician` for field)  
4. Create → copy `/invite/{token}` link  

Manual send (WhatsApp/email) — **no email delivery required**.

## 10. Invitation acceptance UX

`/invite/{token}`:

- **Unauthenticated:** public peek shows SITE SECURE invite + workspace name + email + role → Login / Register  
- **Authenticated:** peek + Accept → membership → dashboard/today  
- Wrong account: clear mismatch + sign out

Endpoints:

- `GET /api/v1/invitations/public-peek` (no auth)
- `GET /api/v1/invitations/peek` (auth)
- `POST /api/v1/invitations/accept` (auth)

## 11. Existing-user behavior

- No second Auth user created
- After login with matching email → accept creates **membership only**
- Live-covered via technician reissue accept path

## 12. Role assignment

- Admin explicitly selects `role_key` (never inferred from email alone)
- **Owner invite:** allowed by platform admin only when workspace has **zero active owners**
- Workspace Settings API still **blocks owner invites**
- Accept RPC allows `owner` only when no active owner exists (bootstrap)

## 13. Revocation / reissue

- **Revoke:** `POST /api/v1/admin/invitations/{id}/revoke` → sets `revoked_at`
- **Reissue:** revoke (if pending) + create new token; copy new link
- Statuses: `pending` | `accepted` | `expired` | `revoked`

## 14. Security / authz

| Action | Authz |
|--------|--------|
| Create workspace / invite / revoke / reissue | Platform admin, server-side |
| Accept invite | Authenticated user + token validation + email match |
| Public peek | Token-only; no membership creation |
| Service role | Server-only (`ServiceClient`); never in browser |

Cross-workspace escalation blocked: membership always tied to invitation’s `workspace_id`.

## 15. RLS / tenancy

- Invitations remain privileged / service-role for admin mutations
- Accept / preview RPCs are SECURITY DEFINER with explicit checks
- Occupancy helper excludes `revoked_at` pending invites
- Workspace roles unchanged; tenancy rules untouched

## 16. Audit events

`platform_admin_events`:

- `admin_workspace_created`
- `admin_invitation_created`
- `admin_invitation_revoked`
- `invitation_accepted` (on accept API)

## 17. Tests

| Suite | Result |
|-------|--------|
| `tests/test_beta_admin_invitations.py` | **PASS** |
| `tests/test_beta_admin_invitations_live.py` | **PASS** (provision, owner/tech invite, hash, wrong email, revoke, reissue, expire, dup membership, owner blocked) |
| `tests/test_invite_accept_live.py` | **PASS** |
| `tests/test_platform_admin_live.py` | **PASS** |
| `tests/test_api_foundation.py` + platform unit | **PASS** |

Coverage mapping (§19): 1–15 exercised via unit + live (normal user deny, admin access, create WS/invites, hash, accept/expire/revoke/reuse, wrong email, existing user, dup membership, owner cannot platform-invite).

## 18. Typecheck

`apps/web` `npm run typecheck` — **PASS**

## 19. Build

`apps/web` `npm run build` — **PASS**

## 20. Migrations

Applied to project `rhxqqudlngimhplvndmz`:

1. `20260928112000_beta_admin_invitations.sql` — `revoked_at`, `admin_provision_workspace`, accept/preview updates  
2. `20260928113000_beta_admin_invite_occupancy_public_peek.sql` — revoke-aware occupancy, `invitation_public_preview`

## 21. Remaining beta-admin gaps

- No automated email delivery (intentional for checkpoint)
- No bulk invite / CSV import
- No platform-admin “impersonate user”
- Admin memberships list is minimal (no last-sign-in yet)
- Founding Technician product onboarding polish (post-accept) **not** started — STOP per brief

## 22. Exact Founding Technician onboarding steps

1. Bootstrap / confirm SITE SECURE platform admin (`bootstrap_platform_admin.py` if needed)  
2. Sign in → open **`/admin`**  
3. **Organizations** → create beta workspace (name + plan)  
4. **Invitations** → select workspace → email → role **`owner`** → Create → **copy link**  
5. Send link manually (WhatsApp / email)  
6. Founding Technician opens `/invite/{token}` → sees workspace/role/email → **Sign up or Login** with invited email  
7. **Accept** → enters SITE SECURE workspace (dashboard/today)  
8. Optional: invite field techs with role **`technician`** the same way  

No DB edits. No manually created passwords. No developer intervention after bootstrap.

---

**STOP.** Broader onboarding not started.
