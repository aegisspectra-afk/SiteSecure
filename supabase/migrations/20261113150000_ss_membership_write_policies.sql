-- SITE SECURE S3b: SSP membership write policies.
--
-- ssp_memberships_write was FOR ALL USING auth_is_member(workspace_id): any member could change
-- another member's status or department, or delete memberships, through PostgREST.
-- Now INSERT/UPDATE/DELETE are limited to the workspace owner and active SSP org_admins of the
-- same workspace. ssp_memberships has no self-editable profile fields (name/phone live in
-- profiles, which keeps its own self-update policy), so other members get no write access.
-- The S3 role trigger still applies on top (nobody changes their own role).
--
-- Rollback: supabase/rollbacks/rollback_20261113150000_ss_membership_write_policies.sql

DROP POLICY IF EXISTS ssp_memberships_write ON public.ssp_memberships;

CREATE POLICY ssp_memberships_insert ON public.ssp_memberships
  FOR INSERT TO authenticated
  WITH CHECK (public.auth_is_member(workspace_id) AND (public.auth_role(workspace_id) = 'owner' OR public.ssp_auth_product_role(workspace_id) = 'org_admin'));

CREATE POLICY ssp_memberships_update ON public.ssp_memberships
  FOR UPDATE TO authenticated
  USING (public.auth_is_member(workspace_id) AND (public.auth_role(workspace_id) = 'owner' OR public.ssp_auth_product_role(workspace_id) = 'org_admin'))
  WITH CHECK (public.auth_is_member(workspace_id) AND (public.auth_role(workspace_id) = 'owner' OR public.ssp_auth_product_role(workspace_id) = 'org_admin'));

CREATE POLICY ssp_memberships_delete ON public.ssp_memberships
  FOR DELETE TO authenticated
  USING (public.auth_is_member(workspace_id) AND (public.auth_role(workspace_id) = 'owner' OR public.ssp_auth_product_role(workspace_id) = 'org_admin'));

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
    -- S3b: the owner may create their own SSP membership only when they have none.
    IF TG_OP = 'INSERT' AND NEW.user_id = v_uid AND EXISTS (
      SELECT 1 FROM public.ssp_memberships s
      WHERE s.workspace_id = NEW.workspace_id AND s.user_id = v_uid
    ) THEN
      RAISE EXCEPTION 'SSP_MEMBERSHIP_EXISTS' USING ERRCODE = '42501';
    END IF;
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

REVOKE ALL ON FUNCTION public.ssp_memberships_guard_role() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ssp_memberships_guard_role() TO service_role;
