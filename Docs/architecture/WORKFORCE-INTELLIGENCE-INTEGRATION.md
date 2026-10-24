# Workforce Intelligence — integration plan

**Status:** Stage 0 audit complete; Stage 1 foundation in code.  
**Date:** 2026-10-20  
**Verified against:** repository code + live Supabase project `rhxqqudlngimhplvndmz`  
**Do not treat older docs as source of truth.**

## Decisions locked for implementation

| Topic | Decision |
|-------|----------|
| Tenant | `workspaces.id` — no parallel org/tenant model |
| Identity | Existing Supabase Auth + `profiles` + `workspace_memberships` |
| Product shape | Platform product like SSP/FLEET: feature `workforce`, entry `/app/workforce` |
| CRM `public.sites` | Installation files. **Do not** store posting locations there |
| SSP `ssp_sites` / `ssp_memberships` | Operational patrol product. **Do not** make them WI source of truth |
| Public `/register` | **Keep** for Site Secure owner onboarding. WI has no self-signup |
| Username | Operational unique field on `workforce_employees`. Login stays email+password |
| Production | No cloud migration / G1 enablement without explicit approval |
| V3 `workforce_people` | Never created. WI uses `workforce_employees` instead |

## Live G1

- Active workspace named `G1`, `business_type=security_company`, plan `solo`.
- One active owner membership.
- A second `G1` workspace is `suspended`.
- Solo optional products are fail-closed. Fleet override is already `enabled=false` on G1.
- Enable WI for G1 later with Platform Admin product override after the migration is applied in a controlled environment.

## Stage 1 (this change)

- Catalog feature + permissions.
- DB tables with RLS (`workforce_regions`, `workforce_sites`, `workforce_positions`, `workforce_employees`, `workforce_memberships`).
- Solo default override `workforce=false` (SQL `create_workspace` + API `SOLO_DEFAULT_DISABLED`).
- Product registry card.
- API: summary + employee list (real empty data, not mocks).
- Web product shell: dashboard + employees.

## Later stages

2. Create employee+user (Auth Admin, compensation, restricted workspace role).  
3. Sites, templates, availability, manual calendar.  
4. OR-Tools optimizer behind FastAPI.  
5. Approve/publish + employee portal + swaps.  
6. Tool-calling AI assistant + reports.  
7. G1 pilot on staging, then production override.

## Explicit non-goals for Stage 1

- No employee create/password API.
- No OR-Tools, no LLM.
- No public register removal.
- No production `apply_migration`.
