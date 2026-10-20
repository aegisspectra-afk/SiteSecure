# SSP V1 — Isolated staging live verification plan

**Status:** Prepared only. Do **not** claim pass until executed against an isolated non-production Supabase project with migrations applied in order:

1. `20261019140000_ssp_digital_forms_v1.sql`
2. `20261019160000_ssp_forms_hardening.sql`

## Prerequisites

- Two independent workspaces (A and B), each with an owner/manager JWT.
- Feature `ssp` present in entitlements for both (via plan_features after migration).
- FastAPI pointed at the isolated project (service role never in browser).
- No production credentials in shell history or reports.

## Idempotency semantics under test

- Blank/absent `idempotency_key` → new submission each success (until limit).
- Same non-empty key on same assignment → `replayed: true`, same `id`, count not incremented twice.

## Checklist

| # | Case | Expect |
|---|------|--------|
| 1 | Manager A creates form, publishes, creates assignment | 201; plaintext token shown once |
| 2 | Public GET with correct token (no code) | Form definition; **no** `workspace_id` / hashes / `assignment_id` |
| 3 | Public GET with wrong token | 404; no workspace leak |
| 4 | Revoke assignment then GET/submit | 404 |
| 5 | Assignment with `expires_at` in the past | 404 |
| 6 | Wrong access code | 403; after 12 fails → 429 |
| 7 | Submit valid answers | 201; `submitted_at` server time |
| 8 | Retry same `idempotency_key` | 201/`replayed: true`; same id; count unchanged |
| 9 | Concurrent submits with `max_submissions=1` (no key / distinct keys) | Exactly one success; others 400 limit/completed |
| 10 | Manager A lists/gets submission | 200; answers visible |
| 11 | Manager B get A's submission id / A's workspace path | 403/404 |
| 12 | Authenticated JWT PATCH published `ssp_form_versions.status` | Denied (RLS/trigger) |
| 13 | Service-role publish draft→published via API | Succeeds |
| 14 | Public response body inspection | No token_hash, access_code_hash, workspace_id, other submissions |

## Suggested automation entry

When live env is approved, add `pytest -m live` cases under `apps/api/tests/test_ssp_live_isolation.py` (not created until credentials/process are approved). Until then run unit suites only.
