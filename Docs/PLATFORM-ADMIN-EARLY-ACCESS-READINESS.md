# PLATFORM ADMIN — Early Access Readiness

**Date:** 2026-09-24  
**Mode:** Targeted verification + low-risk gap fixes only  
**Owner / Platform Admin (verified):** `aegisspectra@gmail.com`  
**Evidence:** API live checks, Playwright browser QA (`Docs/platform-admin-early-access-qa/`), SiteSecureV1 DB  

**Do not redesign Admin. Migrations: NONE.**

---

## 1. Executive summary

Platform Admin **control plane is operational** for early-access administration.

| Layer | Result |
|-------|--------|
| Auth (`profiles.is_platform_admin`) | **PASS** |
| `/admin` shell + nav | **PASS** |
| Admin APIs (service-role backed, `require_platform_admin`) | **PASS** — summary returns real counts |
| Non-platform deny (UI + API) | **PASS** (403) |
| Dashboard `—` | Was **loading/error placeholder**, not missing backend |

**Live summary (SiteSecureV1 via local API as Platform Admin):**

- organizations: **558**
- beta_organizations: **0**
- users: **167**
- feedback_open: **7**

Invites are **not** created inside `/admin`. They reuse the existing workspace invite system at **`/app/settings/users`**. That is intentional architecture reuse — not a missing second invite stack.

**Ready to invite real Founding Technicians: YES**, using:

1. Dedicated workspace (prefer 1 workspace per FT)  
2. `/app/settings/users` → invite `technician` → copy `/invite/$token`  
3. `/admin/users` → Founding Technician badge + Beta participant status  
4. Feedback FAB → `/admin/feedback`

---

## 2. Existing Platform Admin architecture

```
profiles.is_platform_admin = true
  → session.is_platform_admin / platform_role = platform_super_admin
  → web /admin/* gate (route.tsx)
  → API /api/v1/admin/* require_platform_admin(service, user_id)
```

- Grant/revoke: service_role RPCs / `bootstrap_platform_admin.py` only  
- Workspace roles **never** grant Platform Admin  
- Recognition badges / beta participants are **metadata**, not authz  

Owner UUID (DB): `8421d004-c62b-444a-9dd4-3cde964fb2db` with `is_platform_admin=true`.

---

## 3. Dashboard `—` root cause

### Metrics wiring

| Metric (HE) | Field | Query | Endpoint | DB |
|-------------|-------|-------|----------|-----|
| ארגונים | `organizations` | `api.adminSummary()` | `GET /api/v1/admin/summary` | `workspaces` count |
| תוכנית בטא | `beta_organizations` | same | same | `workspaces.is_beta` |
| משתמשים | `users` | same | same | `profiles` count |
| פניות פתוחות | `feedback_open` | same | same | `feedback_reports` status ∈ {new,triage,in_progress} |

Authz: `require_platform_admin`.

### Why `—` appeared

`AdminHome` rendered:

```ts
value ?? "—"
```

with **no** `isLoading` / `isError` handling.

| State | Displayed |
|-------|-----------|
| Loading (~2–3s for summary) | `—` for all four |
| API error | `—` forever (silent) |
| Success with `0` | `0` (truthful) |
| Success with N | N |

**Classification: LOADING / ERROR PLACEHOLDER (frontend)** — not “query not implemented”, not empty data, not authz failure for Platform Admin.

Browser re-verify as Platform Admin after wait: **558 / 0 / 167 / 7**.

### Fix applied

- Loading: `…` + “טוען נתוני לוח ניהול…”  
- Error: danger message + retry (does **not** coerce errors to `0`)  
- Success: numeric including `0`  
- Operator hint linking invites to Settings → Users  

---

## 4. Organizations status

**Route:** `/admin/organizations` → **PARTIAL → improved (still PARTIAL for deep org dossier)**

| Capability | Status |
|------------|--------|
| List workspaces | **PASS** |
| Name / plan / beta enroll toggle | **PASS** |
| Status + created date | **PASS** (added; fields already on API) |
| Client search (name/plan/id) | **PASS** (added; filters test spam) |
| Open org deep page / memberships / owner | **MISSING** on Admin (see Users for memberships) |
| Billing / analytics | **NOT REQUIRED** |

Early-access need (“who uses SITE SECURE / which workspace”): **met** via orgs list + users memberships column.

Noise: hundreds of disposable test workspaces — operational hygiene, not a code blocker.

---

## 5. Users status

**Route:** `/admin/users` → **PASS (management surface)**

| Need | Status |
|------|--------|
| List / search email·name | **PASS** |
| Memberships (role · workspace) | **PASS** |
| Platform Admin column | **PASS** |
| Founding Technician badge toggle | **PASS** |
| Beta participant status + workspace + cohort | **PASS** (`Founding Technicians — 2026`) |
| Secrets / passwords / JWT | **Not exposed** |

No dangerous secret surfaces found.

---

## 6. Invitation status

**Platform Admin does not create invites on `/admin`.**

| Step | Where | Status |
|------|-------|--------|
| Create invitation | `/app/settings/users` (`users.invite`) | **PASS** |
| Email + role (technician etc.) | Settings form | **PASS** |
| Founding Technician as **role_key** | Rejected by authz / DB trigger | **CORRECT** — use badge after |
| Copy invite link | Settings shows `/invite/$token` | **PASS** |
| Accept | `/invite/$token` peek/accept | **PASS** |
| List pending / resend / revoke invite tokens | Thin / incomplete on Admin | **PARTIAL** |
| Disable membership | Settings `users.manage` active↔disabled | **PASS** |

**Do not build a parallel Platform invite architecture.** Reuse Settings invites.

Operator path:

1. Enter target workspace as owner/admin (`memberships[0]` constraint — one active workspace context)  
2. Settings → Users → invite technician  
3. Copy link  
4. `/admin/users` → badge + beta  

---

## 7. Founding Technician program status

| Concern | Finding |
|---------|---------|
| Authz role | **Retired** — `founding_technician` remapped to `technician` |
| Recognition | `profiles.recognition_badges` includes `founding_technician` |
| Program row | `beta_participants` + cohort `Founding Technicians — 2026` |
| Admin assign | `/admin/users` badges + beta; `/admin/beta` list/filter |
| `/admin/badges` | Pointer page → Users (**SCAFFOLDED helper**, OK) |
| App visibility | `UserAccountMenu` shows Founding badge when present |
| Authz shortcut | **None** — badge ≠ permissions; commercial deny intact in tests |

**Program definition (reuse existing):**

- Name: Founding Technicians / טכנאים מייסדים  
- Base role: `technician`  
- Identity: recognition badge + beta participant  
- Meaning: early cohort + recognition + feedback — **not** super-admin  

---

## 8. Badges status

**PASS** for grant/clear via `/admin/users`.  
`/admin/badges` is explanatory only → navigate to Users.

Allowed badges: `founding_technician`, `verified_technician`, `early_access`, `partner`.

---

## 9. QA onboarding status

**PASS with policy (no new QA role):**

| Policy | Support |
|--------|---------|
| Individual Auth account | Existing signup/invite |
| Dedicated QA workspace | Create workspace as owner / enroll beta optional |
| Normal membership role | owner/admin/technician as needed |
| Optional badge | e.g. `early_access` or none |
| No Platform Admin | Enforce — never grant `is_platform_admin` |
| No RLS bypass | Default |

---

## 10. Feedback status

| Piece | Status |
|-------|--------|
| App FAB `FeedbackCenter` | **PASS** (also mounted on `/admin` shell) |
| Create (`POST /feedback`) | Authenticated + workspace |
| Admin queue `/admin/feedback` | **PASS** — list, status, internal notes |
| Flag `feedback_center` | Enabled beta + production |

Loop: Technician → FAB → Platform Admin triage → **PASS**.

---

## 11. Audit status

`/admin/audit` merges platform admin events + recent workspace audit (read-only).

| Event class | Coverage |
|-------------|----------|
| Platform badge / beta patches | Written via `write_platform_admin_event` |
| Workspace invite create/accept | Workspace audit (when actors are in-tenant) |
| Invite revoke | Thin |
| Platform Admin grant/revoke | Bootstrap/RPC path — not day-to-day UI |

**Launch-critical:** enough visibility for ops actions; not a full SIEM. **PARTIAL** but usable.

---

## 12. Feature Flags status

`/admin/flags` — **real**, global flags (`feedback_center`, `ops_insights`) with beta/production toggles.

- Server-backed table; not authz  
- Suitable for coarse staged rollout  
- **Do not** use as permission system  

**PASS** for current scope.

---

## 13. Platform authz verification

| Actor | `/admin` UI | `/api/v1/admin/summary` |
|-------|-------------|-------------------------|
| Platform Admin | ALLOW | 200 |
| Technician (Phase1B QA) | Denied copy | **403** |
| Owner / admin / manager / FT badge | Must not elevate | Engine + flag independent |

All admin router handlers call `require_platform_admin`.

**NON-PLATFORM ADMIN DENY: PASS**

---

## 14. Early Access operator journey

| Step | Status |
|------|--------|
| Login as Platform Admin | **PASS** |
| Open `/admin` | **PASS** |
| Truthful dashboard numbers | **PASS** (after fix; was confusing during load) |
| Organizations identify workspaces | **PASS** |
| Create/select target workspace | **PARTIAL** — create via `/app`; Admin lists only |
| Invite technician | **PASS** via Settings (not Admin) |
| Base role technician | **PASS** |
| Mark Founding Technician | **PASS** badge + beta on `/admin/users` |
| Copy/send invitation | **PASS** |
| Accept + login | **PASS** |
| Correct workspace | **PASS** if single membership (multi-ws caveat) |
| See recognition | **PASS** |
| Assign Job / Today / FieldJob | **PASS** (existing ops) |
| Send feedback | **PASS** |
| See in `/admin/feedback` | **PASS** |
| Revoke/disable access | **PASS** via Settings membership disable |

**EARLY ACCESS END-TO-END: PARTIAL** (invite UX lives in tenant Settings; multi-workspace switcher deferred) but **launch-capable**.

---

## 15. Multi-workspace constraint

Product uses `memberships[0]` / last-workspace hints — **no switcher in this task**.

Safe rollout:

- Each Founding Technician → **exactly one** operational workspace  
- QA → dedicated QA workspace  
- Platform Admin uses `/admin` independently of tenant selection  

Unsafe: inviting FT into a workspace while operator’s browser context is another membership without awareness.

---

## 16. Actual blockers

### Hard blockers before first FT

**NONE** (architecture complete).

### Soft / operational

1. Org list polluted with test workspaces — use search  
2. Invite UX not inside `/admin` — follow Settings path  
3. Summary latency ~3s — now shows loading instead of fake `—`  
4. Multi-workspace ambiguity — keep 1 workspace per invitee  

---

## 17. Low-risk fixes made

1. **`/admin` dashboard:** loading / error / truthful `0` / retry; invite operator hint → Settings → Users  
2. **`/admin/organizations`:** status + created columns; client search; loading/error/empty; correct “לא בטא” label (was misusing empty-beta copy)  

No migrations. No authz/RLS/bootstrap changes. No invite redesign.

---

## 18. Deferred items

- Platform-native invite console  
- Org detail / memberships drill-down on Admin  
- Invite resend/revoke Admin UI  
- Workspace switcher  
- Cleaning disposable test tenants  
- MFA enforcement (recommend separately for owner)  
- Service Call V1 (product next after early-access ops)  

---

## 19. Migration requirement

**NONE**

Existing invitations, memberships, beta_participants, recognition_badges, feedback_reports, audit, and feature_flags support the launch requirement.

---

## 20. External-user launch readiness

**YES** — with the documented operator procedure (Settings invite + Admin badge/beta).

Recommend MFA on `aegisspectra@gmail.com` outside this task.

---

## 21. Exact next task

**Invite the first Founding Technician in a dedicated workspace:** Settings → Users → role `technician` → copy invite link → after accept, `/admin/users` grant Founding Technician badge + Beta `active` cohort `Founding Technicians — 2026`.

---

## Route classification (browser 1440 / 390)

| Route | Class |
|-------|--------|
| `/admin` | **COMPLETE** (post-fix) |
| `/admin/organizations` | **PARTIAL** (list+beta; no deep dossier) |
| `/admin/users` | **COMPLETE** for early-access user/badge/beta ops |
| `/admin/beta` | **PARTIAL** (list/filter/org enroll; edit via Users) |
| `/admin/badges` | **SCAFFOLDED** pointer → Users |
| `/admin/feedback` | **COMPLETE** |
| `/admin/audit` | **PARTIAL** (read-only, useful) |
| `/admin/flags` | **COMPLETE** for current flags |

QA artifacts: `Docs/platform-admin-early-access-qa/`.

---

*End of report. Protected systems untouched.*
