-- ROLLBACK for 20261113120000_ss_lock_function_grants_and_role_escalation.sql: restores the exact pre-migration local state.
BEGIN;

ALTER POLICY quote_items_write ON public.quote_items TO public;
ALTER POLICY quote_sections_write ON public.quote_sections TO public;
ALTER POLICY quotes_update ON public.quotes TO public;

ALTER DEFAULT PRIVILEGES GRANT EXECUTE ON FUNCTIONS TO PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated;

DROP TRIGGER IF EXISTS ssp_memberships_guard_role ON public.ssp_memberships;
DROP TRIGGER IF EXISTS workspace_memberships_guard_role ON public.workspace_memberships;

CREATE OR REPLACE FUNCTION public.seed_workspace_roles(p_workspace_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.workspace_roles (workspace_id, key, label_he, description, is_system, is_locked, base_role_key, grants)
  VALUES
    (p_workspace_id, 'owner', 'בעלים', 'בעלים — גישה מלאה. לא ניתן לצמצם.', true, true, 'owner', '["*"]'::jsonb),
    (p_workspace_id, 'administrator', 'מנהל מערכת', 'ניהול סביבה, משתמשים והגדרות.', true, false, 'administrator', '[]'::jsonb),
    (p_workspace_id, 'manager', 'תפעול', 'תפעול שטח, פרויקטים ותיקי אתר.', true, false, 'manager', '[]'::jsonb),
    (p_workspace_id, 'sales', 'מכירות', 'מכירות, לידים והצעות מחיר.', true, false, 'sales', '[]'::jsonb),
    (
      p_workspace_id,
      'technician',
      'טכנאי',
      'עבודות שטח ושירות.',
      true,
      false,
      'technician',
      $tech$[
        "dashboard.view",
        "calendar.view",
        "calendar.edit",
        "settings.view",
        "crm.view",
        "projects.view",
        "jobs.view",
        "jobs.start",
        "jobs.complete",
        "service.view",
        "service.create",
        "service.edit",
        "service.close",
        "sites.view",
        "sites.edit",
        "systems.view",
        "systems.edit",
        "documents.view",
        "documents.upload",
        "warranties.view",
        "warranties.issue",
        "knowledge.view"
      ]$tech$::jsonb
    ),
    (p_workspace_id, 'viewer', 'צפייה בלבד', 'צפייה בלבד בכל המודולים הפתוחים.', true, false, 'viewer', '[]'::jsonb),
    (
      p_workspace_id,
      'workforce_member',
      'עובד Workforce',
      'גישת פורטל כוח אדם בלבד. ללא CRM או מוצרים אחרים.',
      true,
      true,
      'workforce_member',
      $wf$["settings.view", "workforce.portal.view"]$wf$::jsonb
    )
  ON CONFLICT (workspace_id, key) DO NOTHING;
END;
$function$;

CREATE OR REPLACE FUNCTION public.seed_workspace_pdf_templates(p_workspace_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF EXISTS (SELECT 1 FROM public.pdf_document_templates WHERE workspace_id = p_workspace_id) THEN
    RETURN;
  END IF;
  INSERT INTO public.pdf_document_templates (workspace_id, name, doc_type, status, is_default, config)
  VALUES (
    p_workspace_id,
    'הצעת מחיר — סטנדרט',
    'quote',
    'active',
    true,
    jsonb_build_object(
      'primaryColor', '#0b6bcb',
      'secondaryColor', '#0f172a',
      'showLogo', true,
      'showCompanyAddress', true,
      'showPaymentTerms', true,
      'showTechnicalNotes', true,
      'showCustomerSignature', true,
      'showQuoteValidity', true,
      'headerCompany', true,
      'headerContact', true,
      'headerLogo', true,
      'bodyCustomerSite', true,
      'bodyLineItems', true,
      'bodyTotals', true,
      'footerPayment', true,
      'footerNotes', true,
      'footerSignature', true,
      'footerPageNumber', true,
      'notes', 'ההצעה כוללת אספקה, התקנה והדרכה בסיסית.',
      'paymentTerms', 'שוטף + 30 · מקדמה 40% עם אישור ההצעה'
    )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_workspace(p_name text, p_plan_key text DEFAULT 'solo'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
  v_uid uuid := auth.uid();
  v_plan text;
  v_feature text;
  v_meta jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  v_meta := COALESCE(auth.jwt() -> 'app_metadata', '{}'::jsonb);
  IF COALESCE(v_meta ->> 'workforce_only', '') IN ('true', 't', '1')
     OR COALESCE(v_meta ->> 'provisioned_via', '') = 'workforce' THEN
    RAISE EXCEPTION 'WORKFORCE_USER_CANNOT_CREATE_WORKSPACE';
  END IF;

  IF p_name IS NULL OR length(trim(p_name)) < 2 THEN
    RAISE EXCEPTION 'INVALID_NAME';
  END IF;

  v_plan := COALESCE(NULLIF(p_plan_key, ''), 'solo');
  IF NOT EXISTS (SELECT 1 FROM public.plans WHERE key = v_plan) THEN
    RAISE EXCEPTION 'INVALID_PLAN';
  END IF;

  INSERT INTO public.workspaces (name)
  VALUES (trim(p_name))
  RETURNING id INTO v_id;

  INSERT INTO public.workspace_settings (workspace_id) VALUES (v_id);
  INSERT INTO public.workspace_counters (workspace_id, kind, last_value)
  VALUES
    (v_id, 'site', 0),
    (v_id, 'quote', 0),
    (v_id, 'job', 0),
    (v_id, 'warranty', 0),
    (v_id, 'ft', 0);

  INSERT INTO public.workspace_memberships (workspace_id, user_id, role_key)
  VALUES (v_id, v_uid, 'owner');

  INSERT INTO public.subscriptions (workspace_id, plan_key, status)
  VALUES (v_id, v_plan, 'active');

  IF v_plan = 'solo' THEN
    FOREACH v_feature IN ARRAY ARRAY['fleet', 'ssp', 'workforce']::text[]
    LOOP
      IF EXISTS (
        SELECT 1
        FROM public.plan_features pf
        WHERE pf.plan_key = v_plan
          AND pf.feature_key = v_feature
      ) THEN
        IF NOT EXISTS (
          SELECT 1 FROM public.features f WHERE f.key = v_feature
        ) THEN
          RAISE EXCEPTION 'PRODUCT_DEFAULTS_UNAVAILABLE';
        END IF;

        INSERT INTO public.workspace_feature_overrides (workspace_id, feature_key, enabled)
        VALUES (v_id, v_feature, false);
      END IF;
    END LOOP;
  END IF;

  PERFORM public.seed_workspace_defaults(v_id);

  UPDATE public.profiles
  SET last_workspace_id = v_id
  WHERE id = v_uid;

  RETURN v_id;
END;
$function$;

DROP FUNCTION IF EXISTS public.ssp_memberships_guard_role();
DROP FUNCTION IF EXISTS public.workspace_memberships_guard_role();
DROP FUNCTION IF EXISTS public.ss_is_trusted_backend();

ALTER FUNCTION public.accept_invitation(text) SET search_path TO public;
ALTER FUNCTION public.auth_assigned(uuid, public.assignment_resource_type, uuid) SET search_path TO public;
ALTER FUNCTION public.auth_can_access_department(uuid, uuid) SET search_path TO public;
ALTER FUNCTION public.auth_customer_visible(uuid, uuid) SET search_path TO public;
ALTER FUNCTION public.auth_feature(uuid, text) SET search_path TO public;
ALTER FUNCTION public.auth_has_workspace_grant(uuid, text) SET search_path TO public;
ALTER FUNCTION public.auth_is_assigned_scope(uuid) SET search_path TO public;
ALTER FUNCTION public.auth_is_managerial(uuid) SET search_path TO public;
ALTER FUNCTION public.auth_is_member(uuid) SET search_path TO public;
ALTER FUNCTION public.auth_is_platform_admin() SET search_path TO public;
ALTER FUNCTION public.auth_is_privileged(uuid) SET search_path TO public;
ALTER FUNCTION public.auth_job_visible(uuid, uuid) SET search_path TO public;
ALTER FUNCTION public.auth_role(uuid) SET search_path TO public;
ALTER FUNCTION public.auth_role_in(uuid, text[]) SET search_path TO public;
ALTER FUNCTION public.auth_site_visible(uuid, uuid) SET search_path TO public;
ALTER FUNCTION public.catalog_import_commit(uuid, jsonb) SET search_path TO public;
ALTER FUNCTION public.invitation_preview(text) SET search_path TO public;
ALTER FUNCTION public.my_workspace_entitlements(uuid) SET search_path TO public;
ALTER FUNCTION public.ssp_auth_product_role(uuid) SET search_path TO public;
ALTER FUNCTION public.system_design_quote_visible(uuid, uuid) SET search_path TO public;
ALTER FUNCTION public.workforce_can_read_rule_catalog() RESET search_path;
ALTER FUNCTION public.write_audit_log(uuid, text, text, uuid, jsonb) SET search_path TO public;

-- Exact previous EXECUTE ACLs.
REVOKE ALL ON FUNCTION accept_customer_portal_invite(text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION accept_customer_portal_invite(text) TO anon;
GRANT EXECUTE ON FUNCTION accept_customer_portal_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION accept_customer_portal_invite(text) TO service_role;
REVOKE ALL ON FUNCTION accept_invitation(text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION accept_invitation(text) TO anon;
GRANT EXECUTE ON FUNCTION accept_invitation(text) TO authenticated;
GRANT EXECUTE ON FUNCTION accept_invitation(text) TO service_role;
REVOKE ALL ON FUNCTION admin_provision_workspace(text,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION admin_provision_workspace(text,text) TO anon;
GRANT EXECUTE ON FUNCTION admin_provision_workspace(text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_provision_workspace(text,text) TO service_role;
REVOKE ALL ON FUNCTION archive_consume_profile(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION archive_consume_profile(uuid) TO service_role;
REVOKE ALL ON FUNCTION auth_assigned(uuid,assignment_resource_type,uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth_assigned(uuid,assignment_resource_type,uuid) TO anon;
GRANT EXECUTE ON FUNCTION auth_assigned(uuid,assignment_resource_type,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION auth_assigned(uuid,assignment_resource_type,uuid) TO service_role;
REVOKE ALL ON FUNCTION auth_can_access_department(uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth_can_access_department(uuid,uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION auth_can_access_department(uuid,uuid) TO anon;
GRANT EXECUTE ON FUNCTION auth_can_access_department(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION auth_can_access_department(uuid,uuid) TO service_role;
REVOKE ALL ON FUNCTION auth_customer_visible(uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth_customer_visible(uuid,uuid) TO anon;
GRANT EXECUTE ON FUNCTION auth_customer_visible(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION auth_customer_visible(uuid,uuid) TO service_role;
REVOKE ALL ON FUNCTION auth_feature(uuid,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth_feature(uuid,text) TO anon;
GRANT EXECUTE ON FUNCTION auth_feature(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION auth_feature(uuid,text) TO service_role;
REVOKE ALL ON FUNCTION auth_fleet_department_ids(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth_fleet_department_ids(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION auth_fleet_department_ids(uuid) TO anon;
GRANT EXECUTE ON FUNCTION auth_fleet_department_ids(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION auth_fleet_department_ids(uuid) TO service_role;
REVOKE ALL ON FUNCTION auth_has_workspace_grant(uuid,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth_has_workspace_grant(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION auth_has_workspace_grant(uuid,text) TO service_role;
REVOKE ALL ON FUNCTION auth_is_assigned_scope(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth_is_assigned_scope(uuid) TO anon;
GRANT EXECUTE ON FUNCTION auth_is_assigned_scope(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION auth_is_assigned_scope(uuid) TO service_role;
REVOKE ALL ON FUNCTION auth_is_managerial(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth_is_managerial(uuid) TO anon;
GRANT EXECUTE ON FUNCTION auth_is_managerial(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION auth_is_managerial(uuid) TO service_role;
REVOKE ALL ON FUNCTION auth_is_member(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth_is_member(uuid) TO anon;
GRANT EXECUTE ON FUNCTION auth_is_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION auth_is_member(uuid) TO service_role;
REVOKE ALL ON FUNCTION auth_is_platform_admin() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth_is_platform_admin() TO anon;
GRANT EXECUTE ON FUNCTION auth_is_platform_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION auth_is_platform_admin() TO service_role;
REVOKE ALL ON FUNCTION auth_is_privileged(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth_is_privileged(uuid) TO anon;
GRANT EXECUTE ON FUNCTION auth_is_privileged(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION auth_is_privileged(uuid) TO service_role;
REVOKE ALL ON FUNCTION auth_job_visible(uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth_job_visible(uuid,uuid) TO anon;
GRANT EXECUTE ON FUNCTION auth_job_visible(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION auth_job_visible(uuid,uuid) TO service_role;
REVOKE ALL ON FUNCTION auth_role_in(uuid,text[]) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth_role_in(uuid,text[]) TO anon;
GRANT EXECUTE ON FUNCTION auth_role_in(uuid,text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION auth_role_in(uuid,text[]) TO service_role;
REVOKE ALL ON FUNCTION auth_role(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth_role(uuid) TO anon;
GRANT EXECUTE ON FUNCTION auth_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION auth_role(uuid) TO service_role;
REVOKE ALL ON FUNCTION auth_site_visible(uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth_site_visible(uuid,uuid) TO anon;
GRANT EXECUTE ON FUNCTION auth_site_visible(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION auth_site_visible(uuid,uuid) TO service_role;
REVOKE ALL ON FUNCTION auth_workspace_ids() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth_workspace_ids() TO anon;
GRANT EXECUTE ON FUNCTION auth_workspace_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION auth_workspace_ids() TO service_role;
REVOKE ALL ON FUNCTION beta_participants_touch_updated_at() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION beta_participants_touch_updated_at() TO PUBLIC;
GRANT EXECUTE ON FUNCTION beta_participants_touch_updated_at() TO anon;
GRANT EXECUTE ON FUNCTION beta_participants_touch_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION beta_participants_touch_updated_at() TO service_role;
REVOKE ALL ON FUNCTION block_founding_technician_role() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION block_founding_technician_role() TO PUBLIC;
GRANT EXECUTE ON FUNCTION block_founding_technician_role() TO anon;
GRANT EXECUTE ON FUNCTION block_founding_technician_role() TO authenticated;
GRANT EXECUTE ON FUNCTION block_founding_technician_role() TO service_role;
REVOKE ALL ON FUNCTION catalog_import_commit(uuid,jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION catalog_import_commit(uuid,jsonb) TO anon;
GRANT EXECUTE ON FUNCTION catalog_import_commit(uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION catalog_import_commit(uuid,jsonb) TO service_role;
REVOKE ALL ON FUNCTION create_workspace(text,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION create_workspace(text,text) TO anon;
GRANT EXECUTE ON FUNCTION create_workspace(text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION create_workspace(text,text) TO service_role;
REVOKE ALL ON FUNCTION enforce_customer_quota() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION enforce_customer_quota() TO PUBLIC;
GRANT EXECUTE ON FUNCTION enforce_customer_quota() TO anon;
GRANT EXECUTE ON FUNCTION enforce_customer_quota() TO authenticated;
GRANT EXECUTE ON FUNCTION enforce_customer_quota() TO service_role;
REVOKE ALL ON FUNCTION enforce_document_storage_quota() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION enforce_document_storage_quota() TO PUBLIC;
GRANT EXECUTE ON FUNCTION enforce_document_storage_quota() TO anon;
GRANT EXECUTE ON FUNCTION enforce_document_storage_quota() TO authenticated;
GRANT EXECUTE ON FUNCTION enforce_document_storage_quota() TO service_role;
REVOKE ALL ON FUNCTION enforce_invitation_seat_quota() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION enforce_invitation_seat_quota() TO PUBLIC;
GRANT EXECUTE ON FUNCTION enforce_invitation_seat_quota() TO anon;
GRANT EXECUTE ON FUNCTION enforce_invitation_seat_quota() TO authenticated;
GRANT EXECUTE ON FUNCTION enforce_invitation_seat_quota() TO service_role;
REVOKE ALL ON FUNCTION enforce_quote_quota() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION enforce_quote_quota() TO PUBLIC;
GRANT EXECUTE ON FUNCTION enforce_quote_quota() TO anon;
GRANT EXECUTE ON FUNCTION enforce_quote_quota() TO authenticated;
GRANT EXECUTE ON FUNCTION enforce_quote_quota() TO service_role;
REVOKE ALL ON FUNCTION grant_platform_admin(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION grant_platform_admin(uuid) TO anon;
GRANT EXECUTE ON FUNCTION grant_platform_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION grant_platform_admin(uuid) TO service_role;
REVOKE ALL ON FUNCTION handle_new_user() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION handle_new_user() TO PUBLIC;
GRANT EXECUTE ON FUNCTION handle_new_user() TO anon;
GRANT EXECUTE ON FUNCTION handle_new_user() TO authenticated;
GRANT EXECUTE ON FUNCTION handle_new_user() TO service_role;
REVOKE ALL ON FUNCTION invitation_preview(text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION invitation_preview(text) TO anon;
GRANT EXECUTE ON FUNCTION invitation_preview(text) TO authenticated;
GRANT EXECUTE ON FUNCTION invitation_preview(text) TO service_role;
REVOKE ALL ON FUNCTION invitation_public_preview(text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION invitation_public_preview(text) TO anon;
GRANT EXECUTE ON FUNCTION invitation_public_preview(text) TO authenticated;
GRANT EXECUTE ON FUNCTION invitation_public_preview(text) TO service_role;
REVOKE ALL ON FUNCTION jobs_set_number() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION jobs_set_number() TO PUBLIC;
GRANT EXECUTE ON FUNCTION jobs_set_number() TO anon;
GRANT EXECUTE ON FUNCTION jobs_set_number() TO authenticated;
GRANT EXECUTE ON FUNCTION jobs_set_number() TO service_role;
REVOKE ALL ON FUNCTION my_workspace_entitlements(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION my_workspace_entitlements(uuid) TO anon;
GRANT EXECUTE ON FUNCTION my_workspace_entitlements(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION my_workspace_entitlements(uuid) TO service_role;
REVOKE ALL ON FUNCTION next_code(uuid,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION next_code(uuid,text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION next_code(uuid,text) TO anon;
GRANT EXECUTE ON FUNCTION next_code(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION next_code(uuid,text) TO service_role;
REVOKE ALL ON FUNCTION peek_customer_portal_invite(text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION peek_customer_portal_invite(text) TO anon;
GRANT EXECUTE ON FUNCTION peek_customer_portal_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION peek_customer_portal_invite(text) TO service_role;
REVOKE ALL ON FUNCTION peek_invitation(text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION peek_invitation(text) TO anon;
GRANT EXECUTE ON FUNCTION peek_invitation(text) TO authenticated;
GRANT EXECUTE ON FUNCTION peek_invitation(text) TO service_role;
REVOKE ALL ON FUNCTION plan_capabilities_validate_row() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION plan_capabilities_validate_row() TO PUBLIC;
GRANT EXECUTE ON FUNCTION plan_capabilities_validate_row() TO anon;
GRANT EXECUTE ON FUNCTION plan_capabilities_validate_row() TO authenticated;
GRANT EXECUTE ON FUNCTION plan_capabilities_validate_row() TO service_role;
REVOKE ALL ON FUNCTION _plan_limit_or_zero(text,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION _plan_limit_or_zero(text,text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION _plan_limit_or_zero(text,text) TO anon;
GRANT EXECUTE ON FUNCTION _plan_limit_or_zero(text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION _plan_limit_or_zero(text,text) TO service_role;
REVOKE ALL ON FUNCTION protect_last_owner() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION protect_last_owner() TO PUBLIC;
GRANT EXECUTE ON FUNCTION protect_last_owner() TO anon;
GRANT EXECUTE ON FUNCTION protect_last_owner() TO authenticated;
GRANT EXECUTE ON FUNCTION protect_last_owner() TO service_role;
REVOKE ALL ON FUNCTION protect_platform_admin_flag() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION protect_platform_admin_flag() TO PUBLIC;
GRANT EXECUTE ON FUNCTION protect_platform_admin_flag() TO anon;
GRANT EXECUTE ON FUNCTION protect_platform_admin_flag() TO authenticated;
GRANT EXECUTE ON FUNCTION protect_platform_admin_flag() TO service_role;
REVOKE ALL ON FUNCTION protect_recognition_badges() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION protect_recognition_badges() TO PUBLIC;
GRANT EXECUTE ON FUNCTION protect_recognition_badges() TO anon;
GRANT EXECUTE ON FUNCTION protect_recognition_badges() TO authenticated;
GRANT EXECUTE ON FUNCTION protect_recognition_badges() TO service_role;
REVOKE ALL ON FUNCTION protect_workspace_beta_fields() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION protect_workspace_beta_fields() TO PUBLIC;
GRANT EXECUTE ON FUNCTION protect_workspace_beta_fields() TO anon;
GRANT EXECUTE ON FUNCTION protect_workspace_beta_fields() TO authenticated;
GRANT EXECUTE ON FUNCTION protect_workspace_beta_fields() TO service_role;
REVOKE ALL ON FUNCTION quote_items_scrub_catalog_cost() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION quote_items_scrub_catalog_cost() TO anon;
GRANT EXECUTE ON FUNCTION quote_items_scrub_catalog_cost() TO authenticated;
GRANT EXECUTE ON FUNCTION quote_items_scrub_catalog_cost() TO service_role;
REVOKE ALL ON FUNCTION quotes_set_number() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION quotes_set_number() TO PUBLIC;
GRANT EXECUTE ON FUNCTION quotes_set_number() TO anon;
GRANT EXECUTE ON FUNCTION quotes_set_number() TO authenticated;
GRANT EXECUTE ON FUNCTION quotes_set_number() TO service_role;
REVOKE ALL ON FUNCTION revoke_platform_admin(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION revoke_platform_admin(uuid) TO anon;
GRANT EXECUTE ON FUNCTION revoke_platform_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION revoke_platform_admin(uuid) TO service_role;
REVOKE ALL ON FUNCTION seed_workspace_defaults_pre_accessories(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION seed_workspace_defaults_pre_accessories(uuid) TO anon;
GRANT EXECUTE ON FUNCTION seed_workspace_defaults_pre_accessories(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION seed_workspace_defaults_pre_accessories(uuid) TO service_role;
REVOKE ALL ON FUNCTION seed_workspace_defaults(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION seed_workspace_defaults(uuid) TO anon;
GRANT EXECUTE ON FUNCTION seed_workspace_defaults(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION seed_workspace_defaults(uuid) TO service_role;
REVOKE ALL ON FUNCTION seed_workspace_pdf_templates(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION seed_workspace_pdf_templates(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION seed_workspace_pdf_templates(uuid) TO anon;
GRANT EXECUTE ON FUNCTION seed_workspace_pdf_templates(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION seed_workspace_pdf_templates(uuid) TO service_role;
REVOKE ALL ON FUNCTION seed_workspace_roles(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION seed_workspace_roles(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION seed_workspace_roles(uuid) TO anon;
GRANT EXECUTE ON FUNCTION seed_workspace_roles(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION seed_workspace_roles(uuid) TO service_role;
REVOKE ALL ON FUNCTION service_calls_set_number() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION service_calls_set_number() TO PUBLIC;
GRANT EXECUTE ON FUNCTION service_calls_set_number() TO anon;
GRANT EXECUTE ON FUNCTION service_calls_set_number() TO authenticated;
GRANT EXECUTE ON FUNCTION service_calls_set_number() TO service_role;
REVOKE ALL ON FUNCTION set_updated_at() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION set_updated_at() TO PUBLIC;
GRANT EXECUTE ON FUNCTION set_updated_at() TO anon;
GRANT EXECUTE ON FUNCTION set_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION set_updated_at() TO service_role;
REVOKE ALL ON FUNCTION sites_ft_auto_assign() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION sites_ft_auto_assign() TO PUBLIC;
GRANT EXECUTE ON FUNCTION sites_ft_auto_assign() TO anon;
GRANT EXECUTE ON FUNCTION sites_ft_auto_assign() TO authenticated;
GRANT EXECUTE ON FUNCTION sites_ft_auto_assign() TO service_role;
REVOKE ALL ON FUNCTION sites_set_code() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION sites_set_code() TO PUBLIC;
GRANT EXECUTE ON FUNCTION sites_set_code() TO anon;
GRANT EXECUTE ON FUNCTION sites_set_code() TO authenticated;
GRANT EXECUTE ON FUNCTION sites_set_code() TO service_role;
REVOKE ALL ON FUNCTION ssp_approve_site_enrollment(uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION ssp_approve_site_enrollment(uuid,uuid) TO service_role;
REVOKE ALL ON FUNCTION ssp_approve_site_user_join(uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION ssp_approve_site_user_join(uuid,uuid) TO service_role;
REVOKE ALL ON FUNCTION ssp_auth_product_role(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION ssp_auth_product_role(uuid) TO anon;
GRANT EXECUTE ON FUNCTION ssp_auth_product_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION ssp_auth_product_role(uuid) TO service_role;
REVOKE ALL ON FUNCTION ssp_consume_activation_code(text,text,text,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION ssp_consume_activation_code(text,text,text,text) TO service_role;
REVOKE ALL ON FUNCTION ssp_form_versions_immutability() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION ssp_form_versions_immutability() TO PUBLIC;
GRANT EXECUTE ON FUNCTION ssp_form_versions_immutability() TO anon;
GRANT EXECUTE ON FUNCTION ssp_form_versions_immutability() TO authenticated;
GRANT EXECUTE ON FUNCTION ssp_form_versions_immutability() TO service_role;
REVOKE ALL ON FUNCTION ssp_public_submit(uuid,jsonb,jsonb,jsonb,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION ssp_public_submit(uuid,jsonb,jsonb,jsonb,text) TO anon;
GRANT EXECUTE ON FUNCTION ssp_public_submit(uuid,jsonb,jsonb,jsonb,text) TO authenticated;
GRANT EXECUTE ON FUNCTION ssp_public_submit(uuid,jsonb,jsonb,jsonb,text) TO service_role;
REVOKE ALL ON FUNCTION ssp_redeem_unit_login_code(text,text,timestamp with time zone) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION ssp_redeem_unit_login_code(text,text,timestamp with time zone) TO service_role;
REVOKE ALL ON FUNCTION ssp_request_site_user_join(text,uuid,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION ssp_request_site_user_join(text,uuid,text) TO service_role;
REVOKE ALL ON FUNCTION ssp_submissions_enforce_once() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION ssp_submissions_enforce_once() TO service_role;
REVOKE ALL ON FUNCTION system_design_apply_owned(uuid,uuid,uuid,integer,uuid,uuid,uuid,jsonb,boolean,text,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION system_design_apply_owned(uuid,uuid,uuid,integer,uuid,uuid,uuid,jsonb,boolean,text,text) TO service_role;
REVOKE ALL ON FUNCTION system_design_quote_visible(uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION system_design_quote_visible(uuid,uuid) TO anon;
GRANT EXECUTE ON FUNCTION system_design_quote_visible(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION system_design_quote_visible(uuid,uuid) TO service_role;
REVOKE ALL ON FUNCTION token_sha256(text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION token_sha256(text) TO anon;
GRANT EXECUTE ON FUNCTION token_sha256(text) TO authenticated;
GRANT EXECUTE ON FUNCTION token_sha256(text) TO service_role;
REVOKE ALL ON FUNCTION warranties_set_number() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION warranties_set_number() TO PUBLIC;
GRANT EXECUTE ON FUNCTION warranties_set_number() TO anon;
GRANT EXECUTE ON FUNCTION warranties_set_number() TO authenticated;
GRANT EXECUTE ON FUNCTION warranties_set_number() TO service_role;
REVOKE ALL ON FUNCTION warranties_set_public_token_hash() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION warranties_set_public_token_hash() TO PUBLIC;
GRANT EXECUTE ON FUNCTION warranties_set_public_token_hash() TO anon;
GRANT EXECUTE ON FUNCTION warranties_set_public_token_hash() TO authenticated;
GRANT EXECUTE ON FUNCTION warranties_set_public_token_hash() TO service_role;
REVOKE ALL ON FUNCTION workforce_can_read_rule_catalog() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION workforce_can_read_rule_catalog() TO PUBLIC;
GRANT EXECUTE ON FUNCTION workforce_can_read_rule_catalog() TO anon;
GRANT EXECUTE ON FUNCTION workforce_can_read_rule_catalog() TO authenticated;
GRANT EXECUTE ON FUNCTION workforce_can_read_rule_catalog() TO service_role;
REVOKE ALL ON FUNCTION workforce_instruments_prevent_inplace_rewrite() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION workforce_instruments_prevent_inplace_rewrite() TO PUBLIC;
GRANT EXECUTE ON FUNCTION workforce_instruments_prevent_inplace_rewrite() TO anon;
GRANT EXECUTE ON FUNCTION workforce_instruments_prevent_inplace_rewrite() TO authenticated;
GRANT EXECUTE ON FUNCTION workforce_instruments_prevent_inplace_rewrite() TO service_role;
REVOKE ALL ON FUNCTION workforce_lock_workspace_id() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION workforce_lock_workspace_id() TO PUBLIC;
GRANT EXECUTE ON FUNCTION workforce_lock_workspace_id() TO anon;
GRANT EXECUTE ON FUNCTION workforce_lock_workspace_id() TO authenticated;
GRANT EXECUTE ON FUNCTION workforce_lock_workspace_id() TO service_role;
REVOKE ALL ON FUNCTION workforce_rule_is_active_legal_block(text,text,text,timestamp with time zone,timestamp with time zone,timestamp with time zone) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION workforce_rule_is_active_legal_block(text,text,text,timestamp with time zone,timestamp with time zone,timestamp with time zone) TO PUBLIC;
GRANT EXECUTE ON FUNCTION workforce_rule_is_active_legal_block(text,text,text,timestamp with time zone,timestamp with time zone,timestamp with time zone) TO anon;
GRANT EXECUTE ON FUNCTION workforce_rule_is_active_legal_block(text,text,text,timestamp with time zone,timestamp with time zone,timestamp with time zone) TO authenticated;
GRANT EXECUTE ON FUNCTION workforce_rule_is_active_legal_block(text,text,text,timestamp with time zone,timestamp with time zone,timestamp with time zone) TO service_role;
REVOKE ALL ON FUNCTION workforce_rules_prevent_inplace_rewrite() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION workforce_rules_prevent_inplace_rewrite() TO PUBLIC;
GRANT EXECUTE ON FUNCTION workforce_rules_prevent_inplace_rewrite() TO anon;
GRANT EXECUTE ON FUNCTION workforce_rules_prevent_inplace_rewrite() TO authenticated;
GRANT EXECUTE ON FUNCTION workforce_rules_prevent_inplace_rewrite() TO service_role;
REVOKE ALL ON FUNCTION _workspace_member_occupancy(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION _workspace_member_occupancy(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION _workspace_member_occupancy(uuid) TO anon;
GRANT EXECUTE ON FUNCTION _workspace_member_occupancy(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION _workspace_member_occupancy(uuid) TO service_role;
REVOKE ALL ON FUNCTION _workspace_plan_limit(uuid,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION _workspace_plan_limit(uuid,text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION _workspace_plan_limit(uuid,text) TO anon;
GRANT EXECUTE ON FUNCTION _workspace_plan_limit(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION _workspace_plan_limit(uuid,text) TO service_role;
REVOKE ALL ON FUNCTION _workspace_storage_used_bytes(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION _workspace_storage_used_bytes(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION _workspace_storage_used_bytes(uuid) TO anon;
GRANT EXECUTE ON FUNCTION _workspace_storage_used_bytes(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION _workspace_storage_used_bytes(uuid) TO service_role;
REVOKE ALL ON FUNCTION write_audit_log(uuid,text,text,uuid,jsonb) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION write_audit_log(uuid,text,text,uuid,jsonb) TO anon;
GRANT EXECUTE ON FUNCTION write_audit_log(uuid,text,text,uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION write_audit_log(uuid,text,text,uuid,jsonb) TO service_role;

DELETE FROM supabase_migrations.schema_migrations WHERE version = '20261113120000';
COMMIT;
