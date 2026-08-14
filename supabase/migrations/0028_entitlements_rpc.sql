-- Member-readable entitlements so FastAPI authorize() does not need the service role.

CREATE OR REPLACE FUNCTION public.my_workspace_entitlements(p_workspace_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan text;
  v_status text;
  v_features text[];
BEGIN
  IF NOT public.auth_is_member(p_workspace_id) THEN
    RETURN NULL;
  END IF;

  SELECT s.plan_key, s.status::text
  INTO v_plan, v_status
  FROM public.subscriptions s
  WHERE s.workspace_id = p_workspace_id;

  IF v_plan IS NULL THEN
    v_plan := 'solo';
    v_status := 'active';
  END IF;

  SELECT coalesce(array_agg(pf.feature_key), ARRAY[]::text[])
  INTO v_features
  FROM public.plan_features pf
  WHERE pf.plan_key = v_plan;

  RETURN jsonb_build_object(
    'plan_key', v_plan,
    'status', v_status,
    'features', to_jsonb(v_features)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.my_workspace_entitlements(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_workspace_entitlements(uuid) TO authenticated;
