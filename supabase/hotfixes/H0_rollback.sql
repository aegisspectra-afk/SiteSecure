-- מחזיר את הפרצה. להריץ רק אם H0 שבר משהו.
--
-- ROLLBACK for H0: restores the exact cloud ACLs as captured on 2026-11-15 (read-only):
--   admin_provision_workspace, grant_platform_admin, revoke_platform_admin:
--     {postgres=X, anon=X, authenticated=X, service_role=X}
--   archive_consume_profile: {postgres=X, service_role=X}  (unchanged by H0)
BEGIN;
GRANT EXECUTE ON FUNCTION public.admin_provision_workspace(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_platform_admin(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_platform_admin(uuid) TO anon, authenticated;
COMMIT;
