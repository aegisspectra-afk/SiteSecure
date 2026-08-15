-- RLS isolation cases for SITE SECURE V2.
-- Behavioral JWT cases live in apps/api/tests/test_tenant_isolation.py (pytest -m live).
-- This file asserts the policies that make those cases possible.

SELECT pol.polname
FROM pg_policy pol
JOIN pg_class rel ON rel.oid = pol.polrelid
JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
WHERE nsp.nspname = 'public'
  AND pol.polname IN (
    'memberships_select_member',
    'memberships_insert_privileged',
    'memberships_update_privileged',
    'memberships_delete_privileged',
    'invitations_all_privileged',
    'profiles_select_self',
    'profiles_select_coworkers',
    'workspaces_select_member',
    'workspaces_update_privileged',
    'audit_logs_select'
  )
ORDER BY pol.polname;
