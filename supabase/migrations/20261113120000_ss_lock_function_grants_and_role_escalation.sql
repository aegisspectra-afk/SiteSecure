-- SITE SECURE S3-sec: lock down function EXECUTE grants and membership role escalation.
--
-- Found by the 2026-11-13 audit (docs/audit/product-health-report.md):
-- * Migrations revoked EXECUTE only FROM PUBLIC, but Supabase grants anon/authenticated
--   explicitly, so SECURITY DEFINER functions such as admin_provision_workspace (create a
--   workspace on any plan) and seed_* (any workspace_id) were callable with the anon key.
-- * ssp_memberships_write let any member update product_role (self-promotion to org_admin).
--
-- After this migration: every function in public (except pg_trgm extension members) is
-- service_role only, and `authenticated` keeps exactly the 25 functions RLS policies
-- and member-JWT RPCs need, each with search_path ''. anon executes nothing.
--
-- Rollback: tmp/rollback_20261113120000_ss_lock_function_grants_and_role_escalation.sql

-- 0) Trusted backend = service role JWT, or a direct DB session with no PostgREST JWT.
CREATE OR REPLACE FUNCTION public.ss_is_trusted_backend()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO ''
AS $function$
  SELECT COALESCE(auth.role(), '') = 'service_role'
      OR (auth.uid() IS NULL AND NULLIF(current_setting('request.jwt.claims', true), '') IS NULL);
$function$;

-- 1) Member-JWT RPCs that act on a workspace check membership; self-service plan is Solo.
CREATE OR REPLACE FUNCTION public.seed_workspace_roles(p_workspace_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  -- S3-sec: the member's JWT may seed only a workspace it belongs to.
  IF NOT public.ss_is_trusted_backend() THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '42501';
    END IF;
    IF NOT public.auth_is_member(p_workspace_id) THEN
      RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = '42501';
    END IF;
  END IF;
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
 SET search_path TO ''
AS $function$
BEGIN
  -- S3-sec: the member's JWT may seed only a workspace it belongs to.
  IF NOT public.ss_is_trusted_backend() THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '42501';
    END IF;
    IF NOT public.auth_is_member(p_workspace_id) THEN
      RAISE EXCEPTION 'PERMISSION_DENIED' USING ERRCODE = '42501';
    END IF;
  END IF;
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
 SET search_path TO ''
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
  -- S3-sec: self-service workspaces start on Solo. Other plans are provisioned by the
  -- platform (admin_provision_workspace, service role only).
  IF v_plan <> 'solo' THEN
    RAISE EXCEPTION 'INVALID_PLAN';
  END IF;
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

-- 2) Role escalation guards.
CREATE OR REPLACE FUNCTION public.ssp_memberships_guard_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.product_role IS NOT DISTINCT FROM OLD.product_role
     AND NEW.user_id = OLD.user_id
     AND NEW.workspace_id = OLD.workspace_id THEN
    RETURN NEW;
  END IF;
  IF public.ss_is_trusted_backend() THEN
    RETURN NEW;
  END IF;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.workspace_id <> OLD.workspace_id THEN
    RAISE EXCEPTION 'ROLE_CHANGE_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  -- Nobody changes their own SSP role.
  IF TG_OP = 'UPDATE' AND (NEW.user_id = v_uid OR OLD.user_id = v_uid) THEN
    RAISE EXCEPTION 'ROLE_SELF_CHANGE_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  -- Workspace owner: assigns roles, and may create (bootstrap) their own SSP membership.
  IF EXISTS (
    SELECT 1 FROM public.workspace_memberships m
    WHERE m.workspace_id = NEW.workspace_id AND m.user_id = v_uid
      AND m.status = 'active' AND m.role_key = 'owner'
  ) THEN
    RETURN NEW;
  END IF;
  IF NEW.user_id = v_uid THEN
    RAISE EXCEPTION 'ROLE_SELF_CHANGE_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  -- Otherwise only an active org_admin of the same workspace assigns roles.
  IF EXISTS (
    SELECT 1 FROM public.ssp_memberships s
    WHERE s.workspace_id = NEW.workspace_id AND s.user_id = v_uid
      AND s.status = 'active' AND s.product_role = 'org_admin'
  ) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'ROLE_CHANGE_FORBIDDEN' USING ERRCODE = '42501';
END;
$function$;

DROP TRIGGER IF EXISTS ssp_memberships_guard_role ON public.ssp_memberships;
CREATE TRIGGER ssp_memberships_guard_role
  BEFORE INSERT OR UPDATE ON public.ssp_memberships
  FOR EACH ROW EXECUTE FUNCTION public.ssp_memberships_guard_role();

-- Mirrors the API rule (routers/team.py patch_member): nobody changes their own workspace
-- role, and only an owner assigns or removes the owner role.
CREATE OR REPLACE FUNCTION public.workspace_memberships_guard_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF NEW.role_key IS NOT DISTINCT FROM OLD.role_key
     AND NEW.workspace_role_key IS NOT DISTINCT FROM OLD.workspace_role_key
     AND NEW.user_id = OLD.user_id
     AND NEW.workspace_id = OLD.workspace_id THEN
    RETURN NEW;
  END IF;
  IF public.ss_is_trusted_backend() THEN
    RETURN NEW;
  END IF;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED' USING ERRCODE = '42501';
  END IF;
  IF NEW.workspace_id <> OLD.workspace_id OR NEW.user_id <> OLD.user_id THEN
    RAISE EXCEPTION 'ROLE_CHANGE_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF NEW.user_id = v_uid THEN
    RAISE EXCEPTION 'ROLE_SELF_CHANGE_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  IF (NEW.role_key = 'owner' OR OLD.role_key = 'owner') AND NOT EXISTS (
    SELECT 1 FROM public.workspace_memberships m
    WHERE m.workspace_id = NEW.workspace_id AND m.user_id = v_uid
      AND m.status = 'active' AND m.role_key = 'owner'
  ) THEN
    RAISE EXCEPTION 'OWNER_ASSIGN_RESTRICTED' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS workspace_memberships_guard_role ON public.workspace_memberships;
CREATE TRIGGER workspace_memberships_guard_role
  BEFORE UPDATE ON public.workspace_memberships
  FOR EACH ROW EXECUTE FUNCTION public.workspace_memberships_guard_role();

-- 3) EXECUTE: nothing for PUBLIC/anon/authenticated, service_role keeps everything.
DO $grants$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind IN ('f', 'p')
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END;
$grants$;

-- 4) What a signed-in member legitimately needs: RLS helpers + member-JWT RPCs.
GRANT EXECUTE ON FUNCTION public.accept_invitation(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_assigned(uuid, public.assignment_resource_type, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_can_access_department(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_customer_visible(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_feature(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_has_workspace_grant(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_is_assigned_scope(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_is_managerial(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_is_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_is_platform_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_is_privileged(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_job_visible(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_role_in(uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_site_visible(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.catalog_import_commit(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_workspace(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.invitation_preview(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_workspace_entitlements(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seed_workspace_pdf_templates(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seed_workspace_roles(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ssp_auth_product_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.system_design_quote_visible(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.workforce_can_read_rule_catalog() TO authenticated;
GRANT EXECUTE ON FUNCTION public.write_audit_log(uuid, text, text, uuid, jsonb) TO authenticated;

-- 5) search_path '' on every function authenticated can execute (bodies are fully qualified).
ALTER FUNCTION public.accept_invitation(text) SET search_path TO '';
ALTER FUNCTION public.auth_assigned(uuid, public.assignment_resource_type, uuid) SET search_path TO '';
ALTER FUNCTION public.auth_can_access_department(uuid, uuid) SET search_path TO '';
ALTER FUNCTION public.auth_customer_visible(uuid, uuid) SET search_path TO '';
ALTER FUNCTION public.auth_feature(uuid, text) SET search_path TO '';
ALTER FUNCTION public.auth_has_workspace_grant(uuid, text) SET search_path TO '';
ALTER FUNCTION public.auth_is_assigned_scope(uuid) SET search_path TO '';
ALTER FUNCTION public.auth_is_managerial(uuid) SET search_path TO '';
ALTER FUNCTION public.auth_is_member(uuid) SET search_path TO '';
ALTER FUNCTION public.auth_is_platform_admin() SET search_path TO '';
ALTER FUNCTION public.auth_is_privileged(uuid) SET search_path TO '';
ALTER FUNCTION public.auth_job_visible(uuid, uuid) SET search_path TO '';
ALTER FUNCTION public.auth_role(uuid) SET search_path TO '';
ALTER FUNCTION public.auth_role_in(uuid, text[]) SET search_path TO '';
ALTER FUNCTION public.auth_site_visible(uuid, uuid) SET search_path TO '';
ALTER FUNCTION public.catalog_import_commit(uuid, jsonb) SET search_path TO '';
ALTER FUNCTION public.invitation_preview(text) SET search_path TO '';
ALTER FUNCTION public.my_workspace_entitlements(uuid) SET search_path TO '';
ALTER FUNCTION public.ssp_auth_product_role(uuid) SET search_path TO '';
ALTER FUNCTION public.system_design_quote_visible(uuid, uuid) SET search_path TO '';
ALTER FUNCTION public.workforce_can_read_rule_catalog() SET search_path TO '';
ALTER FUNCTION public.write_audit_log(uuid, text, text, uuid, jsonb) SET search_path TO '';

-- 6) New functions are not exposed automatically.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;
-- The PUBLIC EXECUTE default is global; a per-schema REVOKE cannot remove it.
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- 7) S2 quote policies apply to signed-in members only.
ALTER POLICY quote_items_write ON public.quote_items TO authenticated;
ALTER POLICY quote_sections_write ON public.quote_sections TO authenticated;
ALTER POLICY quotes_update ON public.quotes TO authenticated;
