-- HOTFIX H1 (cloud, before the full deploy). Same pattern as H0.
--
-- Set A: write without any caller check, or read another workspace's data, and nothing
--        outside the database calls them (no API/Web call at 22aac6a; internal callers are
--        all SECURITY DEFINER): EXECUTE for service_role only.
-- Set B: legitimately called by the API with the user's JWT (role authenticated), never by
--        anon: EXECUTE removed from PUBLIC and anon only; authenticated keeps it.
--
-- One transaction. The guard aborts with nothing applied if any listed function is missing
-- or the result is not exactly as expected. Role escalation in workspace_memberships is NOT
-- covered here (needs a trigger; migration 20261113120000 has it).

BEGIN;

SET LOCAL lock_timeout = '5s';

DO $$
DECLARE
  v_set_a text[] := ARRAY[
    'next_code(uuid,text)',
    'seed_workspace_defaults(uuid)',
    'seed_workspace_defaults_pre_accessories(uuid)',
    'ssp_public_submit(uuid,jsonb,jsonb,jsonb,text)',
    '_workspace_member_occupancy(uuid)',
    '_workspace_plan_limit(uuid,text)',
    '_workspace_storage_used_bytes(uuid)'
  ];
  v_set_b text[] := ARRAY[
    'seed_workspace_roles(uuid)',
    'seed_workspace_pdf_templates(uuid)',
    'create_workspace(text,text)',
    'accept_invitation(text)',
    'accept_customer_portal_invite(text)',
    'catalog_import_commit(uuid,jsonb)',
    'system_design_apply_owned(uuid,uuid,uuid,integer,uuid,uuid,uuid,jsonb,boolean,text,text)',
    'write_audit_log(uuid,text,text,uuid,jsonb)'
  ];
  v_sig text;
BEGIN
  FOREACH v_sig IN ARRAY v_set_a || v_set_b LOOP
    IF to_regprocedure('public.' || v_sig) IS NULL THEN
      RAISE EXCEPTION 'H1 aborted: function public.% not found (cloud differs from the reviewed state)', v_sig;
    END IF;
  END LOOP;

  FOREACH v_sig IN ARRAY v_set_a LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', v_sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', v_sig);
    RAISE NOTICE 'H1 set A (service_role only): %', v_sig;
  END LOOP;

  FOREACH v_sig IN ARRAY v_set_b LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', v_sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', v_sig);
    RAISE NOTICE 'H1 set B (no anon): %', v_sig;
  END LOOP;
END
$$;

DO $$
DECLARE
  v_bad text;
BEGIN
  SELECT string_agg(sig, ', ') INTO v_bad FROM (
    SELECT p.oid::regprocedure::text AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('next_code', 'seed_workspace_defaults', 'seed_workspace_defaults_pre_accessories',
                        'ssp_public_submit', '_workspace_member_occupancy', '_workspace_plan_limit',
                        '_workspace_storage_used_bytes')
      AND (has_function_privilege('anon', p.oid, 'EXECUTE')
        OR has_function_privilege('authenticated', p.oid, 'EXECUTE')
        OR NOT has_function_privilege('service_role', p.oid, 'EXECUTE'))
    UNION ALL
    SELECT p.oid::regprocedure::text
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('seed_workspace_roles', 'seed_workspace_pdf_templates', 'create_workspace',
                        'accept_invitation', 'accept_customer_portal_invite', 'catalog_import_commit',
                        'system_design_apply_owned', 'write_audit_log')
      AND (has_function_privilege('anon', p.oid, 'EXECUTE')
        OR NOT has_function_privilege('authenticated', p.oid, 'EXECUTE')
        OR NOT has_function_privilege('service_role', p.oid, 'EXECUTE'))
  ) x;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'H1 verification failed for: %', v_bad;
  END IF;
END
$$;

COMMIT;
