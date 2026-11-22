-- Rollback B7 quote terms seed (does not remove user-edited workspace quotes JSON).

DROP FUNCTION IF EXISTS public.seed_quote_terms_b7(uuid);

CREATE OR REPLACE FUNCTION public.seed_workspace_defaults(p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  PERFORM public.seed_workspace_defaults_base(p_workspace_id);
  PERFORM public.seed_starter_catalog(p_workspace_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.seed_workspace_defaults(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seed_workspace_defaults(uuid) TO service_role;