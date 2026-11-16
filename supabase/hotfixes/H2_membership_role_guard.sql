-- HOTFIX H2 (cloud, before the full deploy): backport ONLY the workspace_memberships role
-- guard from migration 20261113120000_ss_lock_function_grants_and_role_escalation.
--
-- Closes: an administrator could make themselves, or any member, an owner by updating
-- workspace_memberships directly through PostgREST (RLS checks only that the caller is
-- privileged, not which role they set).
-- Rule (same as the API, routers/team.py patch_member): nobody changes their own workspace
-- role, and only an owner assigns or removes the owner role. Trusted backend (service role,
-- or a direct DB session with no PostgREST JWT) is not restricted.
--
-- Both function bodies are byte-identical to 20261113120000, so the later migration
-- replaces them without a conflict. One transaction; the guard aborts on any mismatch.

BEGIN;

SET LOCAL lock_timeout = '5s';

DO $$
BEGIN
  IF to_regclass('public.workspace_memberships') IS NULL THEN
    RAISE EXCEPTION 'H2 aborted: public.workspace_memberships not found';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.workspace_memberships'::regclass
             AND tgname = 'workspace_memberships_guard_role' AND NOT tgisinternal) THEN
    RAISE NOTICE 'H2: trigger already present; it will be replaced with the reviewed version';
  END IF;
  IF to_regprocedure('public.ss_is_trusted_backend()') IS NOT NULL THEN
    RAISE NOTICE 'H2: ss_is_trusted_backend() already present; it will be replaced with the reviewed version';
  END IF;
END
$$;

-- From 20261113120000 section 0.
CREATE OR REPLACE FUNCTION public.ss_is_trusted_backend()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO ''
AS $function$
  SELECT COALESCE(auth.role(), '') = 'service_role'
      OR (auth.uid() IS NULL AND NULLIF(current_setting('request.jwt.claims', true), '') IS NULL);
$function$;

-- From 20261113120000 section 2.
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

-- Neither function is a client API; triggers and SECURITY DEFINER callers run as owner.
REVOKE EXECUTE ON FUNCTION public.workspace_memberships_guard_role() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.workspace_memberships_guard_role() TO service_role;
REVOKE EXECUTE ON FUNCTION public.ss_is_trusted_backend() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ss_is_trusted_backend() TO authenticated, service_role;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.workspace_memberships'::regclass
                 AND tgname = 'workspace_memberships_guard_role' AND tgenabled = 'O' AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'H2 verification failed: trigger missing or disabled';
  END IF;
  IF has_function_privilege('anon', 'public.workspace_memberships_guard_role()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.ss_is_trusted_backend()', 'EXECUTE') THEN
    RAISE EXCEPTION 'H2 verification failed: anon can execute a new function';
  END IF;
END
$$;

COMMIT;
