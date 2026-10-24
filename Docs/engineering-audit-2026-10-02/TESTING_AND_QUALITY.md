# TESTING AND QUALITY — SITE SECURE

**Date:** 2026-10-02  
**Policy this audit:** non-destructive; no dependency install/upgrade; **did not run** full test suites.

## 1. Test inventory (filesystem)

| Suite | Path | Count | Runner |
|-------|------|------:|--------|
| Web unit/component | `apps/web/tests/**/*.{ts,tsx}` | 103 | Vitest (`npm run test` in web / root `web:test`) |
| UI package | `packages/ui/tests` | present | Vitest |
| API | `apps/api/tests/test_*.py` | 70 | pytest (`pyproject.toml`) |
| SQL RLS | `supabase/tests/rls_isolation.sql` | 1+ | Supabase SQL |

API markers include `live` (requires connected V2 Supabase + user JWTs) — **not run here**.

## 2. Quality scripts declared

| Script | Command | Executed this audit? |
|--------|---------|----------------------|
| web:test | ui + web vitest | **No** |
| web:lint | eslint | **No** |
| web:typecheck | tsc | **No** |
| web:build | vite build | **No** (dist/ exists from prior builds — stale artifact only) |
| API pytest | pytest | **No** |
| ruff | configured | **No** |

## 3. Coverage themes (by filename sampling)

Web: CCTV designer phases, quote builder UX, settings, sites/assets/IPAM/topology UI, warranties, navigation, theme, auth-related.  
API: quotes/CPQ, authz/quotas, catalog import, CCTV recommend, IPAM/connections/portal **unit** tests (even though routers unwired), admin, jobs, etc.

## 4. Classification reminder

Existence of tests ≠ VERIFIED WORKING for product features. Tests not executed → product status remains **IMPLEMENTED — NOT FULLY VERIFIED** unless other proof.

## 5. CI

`.github/workflows`: **NOT FOUND** in repo root scan this pass. Quality gates may rely on Vercel build + local discipline.

## 6. Prior certification docs

Many `Docs/BETA_*`, `Docs/beta-e2e-*`, gate reports claim historical runs. Those are **historical claims** relative to older commits — not re-validated against HEAD `23a8121f…`.

## 7. What is required to complete verification

1. Clean AppleDouble pollution (or ignore) for reliable git.
2. Install deps from lockfile (operator action) without upgrading.
3. Run `npm run web:typecheck && npm run web:test`.
4. Run API unit pytest without live markers.
5. Optionally run `live` tests against non-prod Supabase with test users.
6. Mount/unmount decision for ipam/connections/customer_portal then add HTTP smoke.
7. Compare live schema to migrations (read-only).
