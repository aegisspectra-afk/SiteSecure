-- מחזיר את הפרצה. להריץ רק אם H1 שבר משהו.
--
-- ROLLBACK for H1: restores the cloud ACLs as captured on 2026-11-15 (read-only).
BEGIN;
-- had an explicit PUBLIC grant before H1
GRANT EXECUTE ON FUNCTION public.next_code(uuid, text) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._workspace_member_occupancy(uuid) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._workspace_plan_limit(uuid, text) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._workspace_storage_used_bytes(uuid) TO PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seed_workspace_roles(uuid) TO PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seed_workspace_pdf_templates(uuid) TO PUBLIC, anon;
-- explicit role grants only before H1
GRANT EXECUTE ON FUNCTION public.seed_workspace_defaults(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seed_workspace_defaults_pre_accessories(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ssp_public_submit(uuid, jsonb, jsonb, jsonb, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_workspace(text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.accept_invitation(text) TO anon;
GRANT EXECUTE ON FUNCTION public.accept_customer_portal_invite(text) TO anon;
GRANT EXECUTE ON FUNCTION public.catalog_import_commit(uuid, jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.system_design_apply_owned(uuid, uuid, uuid, integer, uuid, uuid, uuid, jsonb, boolean, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.write_audit_log(uuid, text, text, uuid, jsonb) TO anon;
COMMIT;
