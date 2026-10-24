# O4 Decision Record — Cross-app authentication (SSP)

**Status:** Decided for near-term SSP host (B4.3)  
**Date:** 2026-10-19  
**Full analysis:** `PHASE_B4_SSP_EXTRACTION.md` §10  

## Decision

**Adopt Option B — explicit login per app using the existing Supabase Auth project (anon client + Bearer JWT to FastAPI).**

Do **not** implement a shared Cookie/BFF gateway (Option A) in the next SSP implementation phases unless production domain and ops prerequisites in §10.5 are closed and a separate approval is granted.

## Why (evidence summary)

| Fact | Location |
|------|----------|
| Sessions persist in `localStorage` / `sessionStorage`, not HttpOnly cookies | `apps/web/src/lib/remember-device.ts`; `apps/ssp` default Supabase storage |
| No BFF / session-gateway service exists in the monorepo | API is FastAPI + direct Bearer; no session cookie middleware found |
| JWT validation and membership/entitlement/`authorize` are per-request on the API | `deps.current_user`, `load_authz_context`, SSP routers |
| Dev CORS auto-allows `5173` / `8081`, not `5174` | `apps/api/app/config.py` `parse_cors_origins` |
| B4.2 already ships explicit login on `apps/ssp` | `apps/ssp/src/routes/LoginPage.tsx` |

## Hard constraints (unchanged)

- No JWT/session tokens in URLs  
- No `service_role` in browser bundles  
- UI session / `GET /auth/session` never replaces per-request server authorization  

## Supersedes

Clarifies B2.1 §6.6 “initial recommendation Option A” for the **current** multi-origin reality: without a verified shared parent domain and cookie/BFF design, Option B is the binding near-term choice. Parent-domain cookie or BFF remains a **future upgrade path**, not the O4 selection for B4.3–B4.4.
