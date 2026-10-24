# TECHNICAL DEBT AND RISKS — SITE SECURE

**Facts vs recommendations separated.** Date: 2026-10-02

## A. Facts (with evidence)

| ID | Description | Evidence | Impact | Severity |
|----|-------------|----------|--------|----------|
| TD-001 | Three routers implemented + tested but not `include_router` in `main.py` | `main.py` vs `ipam.py`/`connections.py`/`customer_portal.py` | Features unreachable via HTTP | High |
| TD-002 | `database.ts` missing 25 migration tables | types vs CREATE TABLE extract | Type drift; AI/FE mistakes | Medium |
| TD-003 | Duplicate migration prefix `0048_*` (+ related `0049`) | migrations dir | Apply-order risk | Medium |
| TD-004 | AppleDouble `._*` mass + pack idx errors | git status / git stderr | Tooling noise; accidental commit risk | Medium |
| TD-005 | README still describes early “clean rebuild / apps not scaffolded” while apps are large | root `README.md` | Onboarding confusion | Low |
| TD-006 | Folder name SiteSecureV1 vs API “V2” branding | paths vs `main.py` title | Naming confusion | Low |
| TD-007 | `founding_technician` still in catalog seat_buckets after retirement migration | catalog.json + migration | Role drift | Medium |
| TD-008 | Dual feature/capability entitlement systems | catalog + 0050 | Inconsistent gates | Medium |
| TD-009 | In-memory rate limiter | `main.py` | Weak multi-instance | Medium |
| TD-010 | No payment provider integration | static search | Cannot claim paid billing | High (product) |
| TD-011 | apps/mobile missing despite env stubs | filesystem | Dead config | Low |
| TD-012 | Prior PRODUCT_STATUS / CURRENT_STATE audits outdated counts | 2026-08/09 docs vs now | Doc drift | Medium |
| TD-013 | Large Docs QA PNG trees in workspace | Docs/*-qa | Repo size / inventory noise | Low |
| TD-014 | Service call detail UI missing | routes | Incomplete module | Medium |
| TD-015 | Multi-workspace uses memberships[0] only | `app/route.tsx` | Wrong-tenant UX risk if multi-member | Medium |

## B. Recommendations (NOT implemented)

1. **Critical:** Decide mount vs delete for ipam/connections/customer_portal; wire or remove FE calls.
2. **Security/stability:** Regenerate `database.ts` from live schema; add CI drift check.
3. **Hygiene:** Remove AppleDouble files from working tree; fix git pack pollution.
4. **Docs:** Refresh root README to match monorepo reality; point to this audit pack.
5. **Product:** Clarify billing path (provider vs admin grants vs free).
6. **Authz:** Align founding_technician + capabilities vs features single SoT.
7. **Testing:** Run unit suites on clean tree; add HTTP smoke for newly mounted routers.

## C. POTENTIALLY UNUSED (not proven dead)

- Some dashboard snapshot components (historical claim).
- Schema tables without API (notifications, service_contracts, after_action_reports, …).
- Root zip design packs / Fintech reference (excluded from runtime).
- API local `_q00012_*` / `_rtl_*` QA artifacts.

Do not delete solely based on this list.
