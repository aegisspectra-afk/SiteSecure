-- Align my_workspace_entitlements with auth_feature override semantics.
-- Effective feature = COALESCE(workspace override.enabled, plan feature under active subscription).
-- Set-based aggregation (same boolean as auth_feature) so session N memberships stays practical.

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

  -- Equivalent to: features f WHERE auth_feature(workspace, f.key)
  -- COALESCE(override.enabled, plan has feature under active/trialing/manual sub).
  SELECT coalesce(array_agg(eff.key ORDER BY eff.key), ARRAY[]::text[])
  INTO v_features
  FROM (
    SELECT f.key
    FROM public.features f
    LEFT JOIN public.workspace_feature_overrides o
      ON o.workspace_id = p_workspace_id
     AND o.feature_key = f.key
    LEFT JOIN public.subscriptions s
      ON s.workspace_id = p_workspace_id
     AND s.status IN ('trialing', 'active', 'manual')
    LEFT JOIN public.plan_features pf
      ON pf.plan_key = s.plan_key
     AND pf.feature_key = f.key
    WHERE COALESCE(o.enabled, (pf.feature_key IS NOT NULL))
  ) eff;

  RETURN jsonb_build_object(
    'plan_key', v_plan,
    'status', v_status,
    'features', to_jsonb(v_features)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.my_workspace_entitlements(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_workspace_entitlements(uuid) TO authenticated;

COMMENT ON FUNCTION public.my_workspace_entitlements(uuid) IS
  'Member-readable effective entitlements: plan features with workspace_feature_overrides applied (same semantics as auth_feature).';
