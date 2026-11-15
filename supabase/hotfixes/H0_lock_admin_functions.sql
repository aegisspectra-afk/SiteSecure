-- HOTFIX H0 (cloud, before the full deploy): admin/grant functions are service_role only.
--
-- Scope: public functions named admin_*, grant_*, plus revoke_platform_admin and
-- archive_consume_profile. The API at 22aac6a calls them only with the service role
-- (admin.py: service.rpc; scripts/bootstrap_platform_admin.py: service key).
-- Nothing else changes. Migration 20261113120000 later does the full lockdown.
--
-- Everything runs in ONE transaction. The guard aborts (nothing applied) if the set of
-- matching functions is not exactly the 4 reviewed ones, or if the result is not as expected.

BEGIN;

SET LOCAL lock_timeout = '5s';

DO $$
DECLARE
  r record;
  v_found text[] := '{}';
  v_expected text[] := ARRAY[
    'admin_provision_workspace(text,text)',
    'archive_consume_profile(uuid)',
    'grant_platform_admin(uuid)',
    'revoke_platform_admin(uuid)'
  ];
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig,
           replace(p.oid::regprocedure::text, 'public.', '') AS short
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND (p.proname LIKE 'admin\_%' ESCAPE '\'
        OR p.proname LIKE 'grant\_%' ESCAPE '\'
        OR p.proname IN ('revoke_platform_admin', 'archive_consume_profile'))
    ORDER BY 2
  LOOP
    v_found := v_found || r.short;
  END LOOP;

  IF v_found IS DISTINCT FROM v_expected THEN
    RAISE EXCEPTION 'H0 aborted: matching functions % differ from the reviewed set %', v_found, v_expected;
  END IF;

  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND replace(p.oid::regprocedure::text, 'public.', '') = ANY (v_expected)
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
    RAISE NOTICE 'H0 locked %', r.sig;
  END LOOP;
END
$$;

-- Verify inside the same transaction; any failure rolls everything back.
DO $$
DECLARE
  v_bad text;
BEGIN
  SELECT string_agg(p.oid::regprocedure::text, ', ')
  INTO v_bad
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN ('admin_provision_workspace', 'archive_consume_profile', 'grant_platform_admin', 'revoke_platform_admin')
    AND (has_function_privilege('anon', p.oid, 'EXECUTE')
      OR has_function_privilege('authenticated', p.oid, 'EXECUTE')
      OR NOT has_function_privilege('service_role', p.oid, 'EXECUTE'));
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'H0 verification failed for: %', v_bad;
  END IF;
END
$$;

COMMIT;
