# AUDIT FINDINGS — SITE SECURE

**Date:** 2026-10-02 · HEAD `23a8121f802ec71b27f100f938b595cb6c1e24e4`  
**Verification:** static unless noted.

| ID | Category | Severity | Description | Evidence | Verification | Impact | Follow-up |
|----|----------|----------|-------------|----------|--------------|--------|-----------|
| AUDIT-001 | Wiring | High | `ipam`, `connections`, `customer_portal` routers not included in `create_app()` | `apps/api/app/main.py` vs router files; 28 endpoints `wired=NO` | Confirmed static | HTTP features unavailable despite code/tests/FE | Mount routers or remove/disable FE |
| AUDIT-002 | Types/DB | Medium | `database.ts` missing 25 tables that migrations create | `_tables.json` vs `_tables_from_migrations.json` | Confirmed static | TS drift | Regenerate types from DB |
| AUDIT-003 | Migrations | Medium | Duplicate `0048_*` migration filenames | migrations directory listing | Confirmed static | Ambiguous apply order | Rename/linearize; verify remote |
| AUDIT-004 | Authz drift | Medium | `founding_technician` remains in catalog seat_buckets after retirement migration | `catalog.json` L7; `20260908210000_retire_founding_technician_role.sql` | Confirmed static | Inconsistent roles | Clean catalog |
| AUDIT-005 | Entitlements | Medium | Parallel features vs capabilities registries | catalog + `0050_v3_capabilities_registry.sql` | Confirmed static | Dual SoT risk | Document/enforce single effective path |
| AUDIT-006 | Billing | High (product) | No Stripe/payment webhook implementation found | search under apps/packages source | Confirmed absence in app source | Cannot treat paid activation as provider-backed | Implement provider or document admin/free-only |
| AUDIT-007 | Hygiene | Medium | Thousands of AppleDouble `._*` untracked + git pack idx warnings | `git status`, git stderr | Confirmed | Tooling/commit hazard | Clean files; fix pack |
| AUDIT-008 | Docs drift | Medium | Root README describes early scaffold; apps fully built | `README.md` vs tree | Confirmed | Misleads new engineers | Update README (future) |
| AUDIT-009 | UX/Tenant | Medium | App uses `memberships[0]` only | `routes/app/route.tsx` | Confirmed static | Wrong workspace if multi-membership | Switcher or enforce single |
| AUDIT-010 | Completeness | Medium | Service module list-only UI | `routes/app/service/index.tsx` only | Confirmed | Incomplete service ops | Detail route |
| AUDIT-011 | CI | Low | No `.github/workflows` found | glob | Confirmed | Less automated gate | Add CI or document Vercel-only |
| AUDIT-012 | Mobile | Low | `apps/mobile` missing; Expo env stubs remain | filesystem + `.env.example` | Confirmed | Dead config | Remove stubs or scaffold |
| AUDIT-013 | Security ops | Medium | Local env files present in workspace inventory | FILE_INVENTORY env rows | Presence confirmed; values not read | Sync/backup leak risk | Ensure gitignore + secret store |
| AUDIT-014 | Rate limit | Medium | Process-local rate limiter | `main.py` | Confirmed | Weak horizontal scale | Shared limiter |
| AUDIT-015 | Prior audit stale | Low | Aug 2026 audit counts obsolete | CURRENT_STATE_AUDIT.txt | Confirmed | Misleading if used alone | Prefer this pack + refresh |

## Top findings for executives

1. AUDIT-001 — unwired INF/portal APIs  
2. AUDIT-006 — billing provider absent  
3. AUDIT-002 — type/schema drift  
4. AUDIT-007 — working tree pollution  
5. AUDIT-005/004 — authz catalog drift  
6. AUDIT-009 — multi-workspace UX  
7. AUDIT-010 — service depth  
8. Lack of runtime verification in this pass (process limitation)
