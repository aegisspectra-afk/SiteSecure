# BETA 0.1.6 — Technician commercial list isolation hotfix

**Tag target:** `beta-0.1.6`  
**Base:** `beta-0.1.5` / `dde129b` (unchanged)

## Problem

Technician `GET /quotes` and `GET /catalog/products` returned **200** with commercial data (`list_price`, quote list rows).

## Root cause

Live `workspace_roles` / `role_permissions` still carried legacy technician grants (`quotes.view`, `catalog.view`). API `resolve_role_grants` treats non-empty workspace grants as authoritative; empty grants were also rehydrated from a stale API catalog image matching migration `0008`.

`packages/authz/catalog.json` already denied commercial grants for technician; production DB/API grant resolution did not.

## Fix

1. Migrations `0047` + `0048`: delete commercial `role_permissions`; set system technician `workspace_roles.grants` to field-only list; seed new workspaces with non-empty field grants (blocks stale catalog rehydrate).
2. API `strip_technician_commercial_grants` in `resolve_role_grants` (defense in depth).
3. `APP_VERSION = 0.1.6-beta`
4. Frontend nav already permission-gated (`quotes.view` / `catalog.view`) — no redesign.

## Verification (production API)

Focused matrix: technician quotes/catalog list+detail+create **403**; jobs/sites field access **PASS**; owner quotes/catalog **PASS**.  
Prior smoke workspace: quotes/catalog **403**; jobs/sites **200**.  
P2 job-only site upload: unchanged (documented, not fixed).

## Deploy notes

- DB migrations applied to active Supabase project.
- Redeploy API image so strip helper + current catalog ship with the service.
- Redeploy web so `APP_VERSION` shows `0.1.6-beta`.
