-- G-030 / R-009: platform-admin bootstrap hygiene.
--
-- Historical (do not edit): 0036_beta_feedback.sql seeded
--   UPDATE profiles SET is_platform_admin = true WHERE email = 'aegisspectra@gmail.com'
-- That email seed is NOT repeated here and is not part of runtime authorization.
--
-- Runtime authority remains: profiles.is_platform_admin for auth.uid() / JWT sub
-- (see auth_is_platform_admin + apps/api/app/platform.py). Workspace roles never grant this.
--
-- Clean environments: no automatic first-user admin. Operators grant via
-- apps/api/scripts/bootstrap_platform_admin.py (service_role) or the RPCs below.
-- Existing is_platform_admin = true rows are intentionally preserved.

COMMENT ON COLUMN public.profiles.is_platform_admin IS
  'Platform operator grant bound to auth user UUID. Not a workspace RBAC role. '
  'Mutations require service_role (trigger protect_platform_admin_flag). '
  'Bootstrap: apps/api/scripts/bootstrap_platform_admin.py — not email-seeded at runtime.';

CREATE OR REPLACE FUNCTION public.grant_platform_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated int;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id required';
  END IF;

  UPDATE public.profiles
  SET is_platform_admin = true
  WHERE id = p_user_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RAISE EXCEPTION 'profile not found';
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_platform_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated int;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id required';
  END IF;

  UPDATE public.profiles
  SET is_platform_admin = false
  WHERE id = p_user_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RAISE EXCEPTION 'profile not found';
  END IF;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_platform_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_platform_admin(uuid) FROM PUBLIC;
-- Invoked only with the service_role JWT (PostgREST / operator scripts).
GRANT EXECUTE ON FUNCTION public.grant_platform_admin(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.revoke_platform_admin(uuid) TO service_role;

COMMENT ON FUNCTION public.grant_platform_admin(uuid) IS
  'Service-role only. Grants platform admin by auth user UUID. Idempotent.';
COMMENT ON FUNCTION public.revoke_platform_admin(uuid) IS
  'Service-role only. Revokes platform admin by auth user UUID.';
