# Phase B2.1 — Implementation Plan & Record

**Status:** Implementation documentation (updated with shipped decisions)  
**Date:** 2026-10-19  
**Parent audit:** Phase B2 Platform Core Readiness  

### Legend

| Marker | Meaning |
|--------|---------|
| **Fact** | Verified in repository code before change |
| **Decision** | Chosen implementation approach for B2.1 |
| **Assumption** | Reasonable inference, not re-proven in this phase |

---

## 1. Scope

| Item | In scope |
|------|----------|
| B2.1a | Fail-closed `current_user` archive verification |
| B2.1b | Session + Home refresh on `403 FEATURE_NOT_INCLUDED`; navigate to `/platform` only if product unavailable |
| B2.1c | Platform Home `refetchOnWindowFocus` |
| SSP Identity/Session contract | Documentation only (this file §6) |

**Out of scope:** `create_workspace`, Solo/dual-write, `catalog.json`, FleetMaster, migrations, SSP/FLEET extract, SSO/BFF implementation, documents↔fleet entitlement (H1).

---

## 2. Findings → desired behavior → implementation

### B2.1a — Archive check fail-open

| | |
|--|--|
| **Fact (before)** | `deps.current_user` swallowed exceptions / non-200 profile reads and continued (`deps.py`) |
| **Desired** | Active user OK; archived → `403 ACCOUNT_INACTIVE`; unverifiable archive status → `503 API_UNAVAILABLE` (not treated as success) |
| **Decision** | Require successful `profiles` GET (200) with a row; if `archived_at` set → inactive; else if transport/HTTP failure or empty/malformed → unavailable |
| **Files** | `apps/api/app/deps.py`; tests `apps/api/tests/test_current_user_archive.py` |
| **Compat** | Same error codes already used elsewhere; clients that treated silent success during outages will now see 503 |
| **Public / system impact** | **Fact:** `public_ssp` uses `service_client`, not `current_user` — public token flows unaffected. Auth login/hydrate still uses session routes that depend on `current_user` where protected — archived users get `ACCOUNT_INACTIVE` (already handled in web session). |

### B2.1b — Entitlement revoke UX

| | |
|--|--|
| **Fact** | API reloads entitlements per request; UI session/Home can stay stale until refresh |
| **Desired** | On `FEATURE_NOT_INCLUDED` only: refresh session, invalidate platform-home; if current product no longer entitled, go to `/platform`. Other 403s unchanged |
| **Decision** | Global React Query `QueryCache`/`MutationCache` `onError` + small helper; debounce; product detection from pathname + refreshed `memberships[0].features` |
| **Files** | `apps/web/src/lib/query-client.ts`, `apps/web/src/lib/entitlement-revoke.ts`, `apps/web/src/components/EntitlementRevokeBridge.tsx`, `apps/web/src/main.tsx` |
| **Compat** | Does not change login/`afterAuthPath`/onboarding targets |

### B2.1c — Platform Home focus refresh

| | |
|--|--|
| **Fact** | `platform/index.tsx` query invalidated mainly on workspace switch |
| **Desired** | Fresh products when user returns to tab; no request storms |
| **Decision** | `refetchOnWindowFocus: true` on the platform-home query (React Query default coalescing) |
| **Files** | `apps/web/src/routes/platform/index.tsx` |

---

## 3. Minimal test plan

1. Unit: `current_user` — active / archived / profiles failure / empty row.  
2. Unit: entitlement-revoke helper — FEATURE_NOT_INCLUDED vs other 403; path→product mapping.  
3. Manual/code review: platform-home refetchOnWindowFocus flag present.  
4. Run focused pytest for archive gate.

---

## 4. Remaining risks / deferred

- H1 documents/`vehicle` vs `fleet` entitlement — deferred (FleetMaster/catalog sensitive).  
- Admin audit best-effort — deferred.  
- SSO/BFF — proposal only (§6).  
- Vitest may remain blocked on Windows path with `&` — pytest preferred for API.

---

## 5. Facts vs assumptions

| Claim | Class |
|-------|--------|
| Fail-open archive check existed | **Fact** (pre-change `deps.py`) |
| SSP/Fleet APIs use `authorize`/`require` with features | **Fact** (B2 audit) |
| React Query focus refetch is sufficient for Home | **Decision** / **Assumption** that users return to tab after admin changes |
| Cookie SSO across hosts is preferred long-term | **Assumption** pending product infra choice |

---

## 6. Future Identity / Session contract (SSP extract) — design only

> **Not implemented in B2.1.** Planning record for a future separate SSP application.  
> No SSO/BFF code and no SSP app split in this phase.

### 6.1 Responsibilities (boundaries)

| Party | Owns | Must not own after extract |
|-------|------|----------------------------|
| **Platform Core** | Supabase Auth project, JWT issuer, `profiles` (incl. `archived_at`), workspaces, memberships, entitlements, Platform Home (`/platform`), Platform Admin, product assignment | Product domain tables (`ssp_*`) or public submit |
| **Site Secure** | CRM/ops APIs and UI under `/app` (non-SSP); consumes Core session | Granting/revoking product entitlements; hosting `public_ssp` |
| **SSP (future host)** | `ssp_*` data, authenticated SSP API, UI shell, **and** `public_ssp` (token unlock/submit + rate limiting) | Creating workspaces; Platform Admin; Solo onboarding |

### 6.2 User identity and JWT verification

1. **Issuer:** Single Supabase Auth project (Platform Core). SSP does not run a separate IdP.  
2. **Authenticated routes:** Bearer JWT validated the same way Core does today (`user_client` / Auth `get_user`). Reject missing/invalid → `401 UNAUTHENTICATED`.  
3. **Archive gate:** After identity resolve, check `profiles.archived_at` **fail-closed** (B2.1a semantics): archived → `403 ACCOUNT_INACTIVE`; lookup failure → `503 API_UNAVAILABLE`.  
4. **Public token routes:** No end-user JWT; token + optional access code; rate-limited; service role only inside SSP boundary (§6.5).

### 6.3 Active workspace and membership (server)

1. Client may prefer a workspace (cookie/header/`last_workspace_id`), but **server is authoritative**.  
2. Every tenant-scoped SSP request must bind to a `workspace_id` that is:  
   - an **active** membership for the user;  
   - workspace status **active** (else `TENANT_INACTIVE`).  
3. Do not trust client-only “active workspace” without membership re-check per request.  
4. After extract, SSP may call Core session/introspect endpoints or share the same DB views (`my_workspace_entitlements`) — either way, membership check stays server-side.

### 6.4 Entitlement and permissions per request

1. **Entitlement:** `ssp` must be in effective features for that workspace (same source of truth as Core: entitlements + overrides). Missing → `403 FEATURE_NOT_INCLUDED`.  
2. **Permission:** Fine-grained `authorize` / role grants for `ssp.*` actions (e.g. `ssp.forms.view`). Entitlement alone is not enough.  
3. **UI:** On `FEATURE_NOT_INCLUDED`, refresh session + Platform Home data; if SSP product unavailable, navigate to Platform Home host (mirrors B2.1b). Other 403s (e.g. `PERMISSION_DENIED`) do **not** auto-redirect.  
4. **RLS / tenant isolation** on `ssp_*` remains mandatory.

### 6.5 Lifecycle events

| Event | API | Client / cross-host |
|-------|-----|---------------------|
| Workspace suspended | `TENANT_INACTIVE` | Leave SSP shell → Platform Home |
| Membership removed / inactive | Membership denial | Leave product; clear workspace-scoped cache |
| User archived / disabled | `ACCOUNT_INACTIVE` | Block protected routes; force re-auth UX |
| Product entitlement revoked | `FEATURE_NOT_INCLUDED` | Refresh entitlements; `/platform` (or Core Home URL) only if SSP gone |
| Logout | Invalidate Auth session | Clear SSP + Core cookies/storage; no dangling Bearer |
| Session refresh | Re-fetch user + memberships + features | Coalesce; avoid navigation loops (debounce like B2.1b) |
| Host handoff | N/A | Prefer shared Auth session (Option A/B below); **never** put JWT in URL |

### 6.6 Cross-host session options (**Proposal**)

| Option | Pros | Cons |
|--------|------|------|
| **A. Shared parent-domain cookie + same Supabase project** | One login; minimal new infra; matches current stacked SPA | Cookie domain + CSRF discipline; both apps on related DNS |
| **B. BFF issues HttpOnly session cookie per app** | Token not in JS; per-app hardening | More ops; session sync/logout fan-out |
| **C. Token in URL / postMessage** | Easy demo | **Rejected** — security (no JWT in URL) |

**Initial recommendation:** Option **A** while both apps share one Supabase project and a common parent domain; revisit BFF (**B**) if apps move to unrelated domains or stricter cookie isolation is required.

### 6.7 `public_ssp` and rate limiting must move with SSP

After extract, Site Secure must not retain a privileged path into SSP public submit. Move together:

- Public unlock/submit routes and RPCs  
- Access-code / IP rate limiting (today in-process; documented under rate-limit notes)  
- `ServiceClient` / service-role usage for those routes  

Authenticated SSP admin/builder APIs move with the product; Core keeps only entitlement assignment.

### 6.8 Missing before extract (checklist)

- [ ] Decide Option A vs B (open decision O4 from B1).  
- [ ] Versioned session/entitlement DTO if hosts diverge.  
- [ ] Deploy unit for SSP API including public routes + rate limit.  
- [ ] Platform Home `entry_path` points at SSP origin.  
- [ ] Shared logout contract across hosts.  
- [ ] No change to Solo/`create_workspace` as part of extract.

---

## 7. Implementation changelog

| Date | Change |
|------|--------|
| 2026-10-19 | Document created; B2.1a/b/c implemented per decisions above |
| 2026-10-19 | Tests: `pytest tests/test_current_user_archive.py` → **5 passed**; vite-node `scripts/smoke-entitlement-revoke.mts` → **OK**. Full vitest suite not run (Windows path `&` breaks setupFiles resolution). |

## 8. Shipped file list

| Path | Role |
|------|------|
| `Docs/architecture/PHASE_B2_1_IMPLEMENTATION.md` | Plan + SSP contract + record |
| `apps/api/app/deps.py` | B2.1a fail-closed archive |
| `apps/api/tests/test_current_user_archive.py` | B2.1a unit tests |
| `apps/web/src/lib/entitlement-revoke.ts` | B2.1b helpers |
| `apps/web/src/lib/entitlement-revoke.test.ts` | Vitest (blocked locally by path) |
| `apps/web/scripts/smoke-entitlement-revoke.mts` | B2.1b/c smoke runner |
| `apps/web/src/lib/query-client.ts` | Query/Mutation onError bridge hook |
| `apps/web/src/components/EntitlementRevokeBridge.tsx` | Session refresh + optional `/platform` |
| `apps/web/src/routes/__root.tsx` | Mount bridge |
| `apps/web/src/routes/platform/index.tsx` | B2.1c `refetchOnWindowFocus` |
