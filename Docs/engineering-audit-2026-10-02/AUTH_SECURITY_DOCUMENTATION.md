# AUTH & SECURITY DOCUMENTATION — SITE SECURE

**Mode:** Static review only — no exploitation, no production penetration, no secret values.  
**Date:** 2026-10-02

## 1. Authentication (CURRENT STATE)

| Flow | Evidence | Status |
|------|----------|--------|
| Register | `apps/web/src/routes/register.tsx` + Supabase Auth | IMPLEMENTED — NOT FULLY VERIFIED live |
| Login | `routes/login.tsx` | same |
| Logout | session helpers / Supabase signOut (web) | same |
| Email verification | `verify-email.tsx` | same |
| Password reset | `forgot-password.tsx`, `reset-password.tsx` | same |
| Session API | `GET` auth session in `routers/auth.py` | mounted |
| Soft-archive gate | `deps.current_user` checks `profiles.archived_at` | IMPLEMENTED in code |
| Platform admin | `profiles.is_platform_admin` + `/admin` | IMPLEMENTED in code |

Tokens: Supabase JWT in `Authorization: Bearer`. Service role used only in API process (`SUPABASE_SERVICE_ROLE_KEY`) — must never ship to Vercel web (documented in README / `.env.example`).

## 2. Authorization model

### Roles (`packages/authz/catalog.json`)

System roles: `owner`, `administrator`, `manager`, `sales`, `technician`, `viewer`.  
`founding_technician` still appears in `seat_buckets.seats_field` but migrations include `20260908210000_retire_founding_technician_role.sql` — **catalog vs DB retirement drift** (AUDIT-004).

### Permissions & grants

Catalog lists permission keys (`dashboard.view`, `quotes.*`, `crm.*`, …) and per-role grants (`owner: ["*"]`, administrator long list, …).  
API engine: `apps/api/app/authz/engine.py` + `guard.py`.  
Web: `can()` style checks from `@site-secure/authz` for UX — **not a security boundary**.

### Plans / features

Plans in catalog keys: `solo`, `business`, `enterprise` (labels Free/Pro/Enterprise).  
Features gated via entitlements RPC + `permission_feature` map.  
API `parse_entitlements_rpc` **fail-closed** on RPC failure (does not invent base-plan features).

### Capabilities (V3 registry)

Migration `0050_v3_capabilities_registry.sql` + tables `capabilities` / `plan_capabilities`. Relationship to catalog `features` — dual vocabulary; treat as **multiple related sources** (AUDIT-005). Intended single entitlement source is architectural goal; current code still uses plan features + overrides + capabilities tables.

## 3. Roles × access matrix (catalog grants — abbreviated)

| Role | Typical access (from catalog grants) | Forbidden / limited |
|------|--------------------------------------|---------------------|
| owner | `*` | — |
| administrator | Broad ops + settings + quotes cost + users/roles | workspace.delete / billing may differ — check catalog |
| manager | Broad ops without full workspace destroy | roles.manage / some billing |
| sales | CRM/quotes oriented | field complete? check grants list |
| technician | Field/jobs/sites scoped | commercial isolation migrations 0046/0047 |
| viewer | Read-heavy | mutate |

**Full grant lists:** see `packages/authz/catalog.json` `grants` object.  
**Enforcement:** API `authorize` + RLS. FE hide ≠ deny.

## 4. Tenant isolation

| Control | Present? | Notes |
|---------|----------|-------|
| workspace_id in routes | Yes | `/api/v1/workspaces/{workspace_id}/...` |
| Membership check | Yes | `load_authz_context` |
| Client-supplied workspace trust | Must be validated server-side — code path exists; live bypass proof NOT done | |
| RLS | Yes in migrations | Live effectiveness NOT VERIFIED this pass |
| Cross-tenant automated tests | `supabase/tests/rls_isolation.sql` + some API live tests exist | **Not executed here** |
| Multi-workspace UX | Partial — `memberships[0]` only | Product risk / confusion |

## 5. Billing / subscription security

- `subscriptions` table + status used in authorize path.
- **No Stripe/payment webhook verification code found** in app source.
- Workspace creation historically sets active subscription (prior audits) — treat paid `active` without provider confirmation as **business/process risk** if still true (re-verify `workspaces.py` create path before claiming). **NOT re-line-audited in full this pass** → mark suspicion AUDIT-006.

## 6. Security findings (static)

| ID | Severity | Finding | Evidence | Verified exploit? |
|----|----------|---------|----------|-------------------|
| SEC-001 | High | IPAM / connections / customer_portal routers not mounted — if FE calls them, broken; if alternate deploy mounts old code, confusion | `main.py` vs router files | No — config defect |
| SEC-002 | Medium | In-memory rate limit not shared across instances | `main.py` middleware | Suspicion |
| SEC-003 | Medium | Service-role use for privileged quote/public paths — requires tight authorize discipline | service client modules | Not exploited |
| SEC-004 | Medium | Storage ACL historically coarser than document RBAC | migration `0023` + docs router | Suspicion from prior audit; not re-proven |
| SEC-005 | Low–Med | `database.ts` stale — type-safety gap for new tables | types vs migrations | Config/quality |
| SEC-006 | Medium | Local `.env` files present on disk in workspace — secret leakage via backups/sync risk | inventory env files | Do not open values |
| SEC-007 | Low | AppleDouble `._*` flood + pack idx warnings — supply-chain/hygiene | git status | Integrity annoyance |
| SEC-008 | Medium | Dual entitlement vocabularies (features vs capabilities) may cause inconsistent gates | catalog + 0050 | Suspicion |
| SEC-009 | Low | CORS `allow_methods=["*"]`, `allow_headers=["*"]` with credentialed origins | `main.py` | Depends on origin allowlist correctness |
| SEC-010 | Info | Public quote token endpoints intentionally unauthenticated | `public_quotes.py` | By design — token secrecy critical |

## 7. Frontend route guards

- `/app/*`: session + workspace required (`app/route.tsx`).
- `/admin/*`: platform admin gate in `admin/route.tsx` (verify on read — treat as IMPLEMENTED — NOT FULLY VERIFIED).
- Hidden nav items ≠ authorization.

## 8. What was not done

- No live cross-tenant IDOR testing.
- No password brute-force testing.
- No dependency CVE scan execution.
- No production log review.
