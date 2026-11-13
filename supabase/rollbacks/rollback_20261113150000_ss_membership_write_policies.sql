-- ROLLBACK for 20261113150000_ss_membership_write_policies.sql: restores the pre-S3b local state.
BEGIN;

DROP POLICY IF EXISTS ssp_memberships_insert ON public.ssp_memberships;
DROP POLICY IF EXISTS ssp_memberships_update ON public.ssp_memberships;
DROP POLICY IF EXISTS ssp_memberships_delete ON public.ssp_memberships;
CREATE POLICY ssp_memberships_write ON public.ssp_memberships FOR ALL TO authenticated USING (auth_is_member(workspace_id)) WITH CHECK (auth_is_member(workspace_id));

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

REVOKE ALL ON FUNCTION public.ssp_memberships_guard_role() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ssp_memberships_guard_role() TO service_role;

DELETE FROM supabase_migrations.schema_migrations WHERE version = '20261113150000';
COMMIT;
