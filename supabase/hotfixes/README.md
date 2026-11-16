# Cloud hotfixes

SQL run directly on the cloud database, outside the migration history, to close a live
security gap before the full deploy. Each file is one transaction with a guard that
aborts if the cloud does not match what was reviewed. The full fix still arrives as a
migration (here: `20261113120000_ss_lock_function_grants_and_role_escalation`).

| File | Run in cloud | What |
|---|---|---|
| `H0_lock_admin_functions.sql` | 2026-11-15 | `admin_provision_workspace`, `grant_platform_admin`, `revoke_platform_admin`, `archive_consume_profile`: EXECUTE for service_role only (anon could create paid workspaces). |
| `H0_rollback.sql` | never | Re-opens the gap. Only if H0 broke something. |
| `H1_lock_unguarded_functions.sql` | 2026-11-15 | Set A (service_role only): `next_code`, `seed_workspace_defaults*`, `ssp_public_submit`, `_workspace_member_occupancy`, `_workspace_plan_limit`, `_workspace_storage_used_bytes`. Set B (no anon; authenticated keeps): `seed_workspace_roles`, `seed_workspace_pdf_templates`, `create_workspace`, `accept_invitation`, `accept_customer_portal_invite`, `catalog_import_commit`, `system_design_apply_owned`, `write_audit_log`. Anon-executable functions 59 -> 44. |
| `H1_rollback.sql` | never | Re-opens the gap. Only if H1 broke something. |
| `H2_membership_role_guard.sql` | 2026-11-16 | Backport of the `workspace_memberships_guard_role` trigger and `ss_is_trusted_backend()` from `20261113120000` (byte-identical): no one changes their own role, only an owner assigns or removes owner; service role unrestricted. |
| `H2_rollback.sql` | never | Removes the trigger. Only if H2 broke something. |

Each was rehearsed first on a local restore of the cloud backup (ACL-identical), with the
API at `22aac6a` smoke-tested before and after (H0: 18/18; H1: 21/21 plus H0's 18/18; H2: escalation blocked, owner management intact).
