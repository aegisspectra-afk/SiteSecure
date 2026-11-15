# Cloud hotfixes

SQL run directly on the cloud database, outside the migration history, to close a live
security gap before the full deploy. Each file is one transaction with a guard that
aborts if the cloud does not match what was reviewed. The full fix still arrives as a
migration (here: `20261113120000_ss_lock_function_grants_and_role_escalation`).

| File | Run in cloud | What |
|---|---|---|
| `H0_lock_admin_functions.sql` | 2026-11-15 | `admin_provision_workspace`, `grant_platform_admin`, `revoke_platform_admin`, `archive_consume_profile`: EXECUTE for service_role only (anon could create paid workspaces). |
| `H0_rollback.sql` | never | Re-opens the gap. Only if H0 broke something. |

Rehearsed first on a local restore of the cloud backup (ACL-identical), with the API at
`22aac6a` smoke-tested before and after (18/18).
