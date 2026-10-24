# BACKEND DOCUMENTATION — SITE SECURE

**Scope:** `apps/api`  
**Entry:** `app/main.py` (`create_app`, `app = create_app()`)  
**Version string:** FastAPI title `SITE SECURE V2 API`, version `0.7.0`  
**Python:** `>=3.12` (`pyproject.toml`)

## 1. Application structure

```
apps/api/app/
  main.py              # app factory, CORS, rate limit, router includes
  config.py            # pydantic-settings
  deps.py              # bearer auth, current_user, authz context, entitlements
  errors.py            # ApiError + Hebrew messages
  http_supabase.py     # HTTP client helpers
  supabase_user.py     # user-JWT PostgREST
  supabase_service.py  # service-role client
  authz/               # catalog load, engine, guard, limits, usage, scope
  routers/             # HTTP routers
  catalog_import/      # import pipeline
  cctv_recommend/ cctv_sizing/ quote_rules/ system_designs/ documents/
  *.py domain helpers (quotes PDF, pricing, jobs lifecycle, IPAM helpers, …)
```

## 2. Request pipeline

1. CORS (`settings.cors_allow_origins()`).
2. Middleware assigns `request_id`, in-memory rate limit (deque per client IP; >120/min → 429 `RATE_LIMITED`).
3. Route dependency: `bearer_token` → `UserClient` → `current_user` (rejects soft-archived profiles via `profiles.archived_at`).
4. Workspace-scoped routes: load membership + `my_workspace_entitlements` via `parse_entitlements_rpc` (**fail-closed** on RPC errors).
5. `authorize()` / `require` checks permission + feature entitlement + subscription status.
6. Data access via PostgREST HTTP (not SQLAlchemy ORM).

## 3. Routers mounted in `main.py`

| Module | Mounted |
|--------|---------|
| health, auth, workspaces, workspace_settings | yes |
| feedback, telemetry, admin, team | yes |
| customers, sites, systems, search, jobs | yes |
| ops_modules (leads/projects/service/warranties/tasks/knowledge) | yes |
| quotes, quote_cpq, system_designs, catalog, catalog_import, cctv | yes |
| public_quotes, documents, dashboard | yes |

## 4. Routers NOT mounted (CRITICAL)

| File | Tags / prefix pattern | Unit tests exist? | HTTP available in create_app? |
|------|-----------------------|-------------------|-------------------------------|
| `routers/ipam.py` | `/api/v1/workspaces/{workspace_id}` IPAM | `tests/test_ipam_inf1b.py` | **NO** |
| `routers/connections.py` | asset connections / topology | `tests/test_connections_inf1c.py` | **NO** |
| `routers/customer_portal.py` | customer portal + invites | `tests/test_customer_portal.py` | **NO** |

**Classification:** BACKEND ONLY (code+tests) / **not wired to running app** until `include_router` is added. Frontend portal/IPAM UI calling these paths would fail at runtime if they expect this API process.

## 5. Domain logic highlights

| Domain | Modules | Notes |
|--------|---------|-------|
| Quotes/CPQ | `routers/quotes.py`, `quote_cpq.py`, `quote_pdf.py`, `quote_validation.py`, … | Large surface; versions, send, share, PDF |
| System design / CCTV | `system_designs.py`, `cctv.py`, `cctv_recommend`, `cctv_sizing` | Designer + recommend |
| Catalog | `catalog.py`, `catalog_import/*` | Products, packages, import commit RPC |
| Jobs | `jobs.py`, `job_lifecycle.py` | Dispatch lifecycle endpoints |
| Ops | `ops_modules.py` | Leads, projects, service-calls, warranties, tasks, knowledge |
| Sites/systems/equipment | `sites.py`, `systems.py`, `equipment_asset.py` | Equipment asset foundation |
| Documents | `documents.py` + `documents/` | Upload URL + complete + signed URL |
| Admin | `admin.py` | Orgs, users archive, beta, flags, invitations |
| Team/settings | `team.py`, `workspace_settings.py` | Members, usage, PDF templates, roles |

## 6. Error handling & logging

- `ApiError` → structured JSON `{error:{code,message,details}}` + `X-Request-Id`.
- Validation → 400 `VALIDATION_ERROR` (Hebrew message).
- Logger name `site-secure`; request latency logged in middleware.

## 7. Background / webhooks / schedules

- **In-process rate limiter only** (not Redis) — weak for multi-instance.
- No Stripe webhook handlers found in app source.
- Supabase `functions/` may host edge functions — **partial review**; not claimed as active without deploy proof.

## 8. Configuration

See `app/config.py` + `.env.example` names: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `API_PUBLIC_URL`, `WEB_PUBLIC_URL`, `APP_ENV`, `CORS_EXTRA_ORIGINS`, log level settings.

## 9. Tests

`apps/api/tests`: **70** `test_*.py` files (unit + some `live` marked).  
**Not executed** as a full suite in this audit pass.

## 10. Dependencies (declared)

fastapi, uvicorn, pydantic, pydantic-settings, httpx, python-dotenv, fpdf2, uharfbuzz, tzdata, openpyxl, python-multipart. Dev: pytest, pytest-asyncio, ruff.
