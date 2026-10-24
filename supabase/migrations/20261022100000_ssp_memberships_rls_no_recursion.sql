-- Fix ssp_memberships SELECT policy recursion (42P17).
-- The previous policy queried public.ssp_memberships inside a policy on the same
-- table, so INSERT ... RETURNING / SELECT failed and was mapped to 403.
-- Semantics are unchanged: member AND (self OR workspace managerial OR product org_admin/patrol_manager).
-- Local-only apply. Does not weaken RLS.

CREATE OR REPLACE FUNCTION public.ssp_auth_product_role(p_workspace_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.product_role
  FROM public.ssp_memberships m
  WHERE m.user_id = auth.uid()
    AND m.workspace_id = p_workspace_id
    AND m.status = 'active'
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.ssp_auth_product_role(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ssp_auth_product_role(uuid) TO authenticated;

DROP POLICY IF EXISTS ssp_memberships_select ON public.ssp_memberships;
CREATE POLICY ssp_memberships_select ON public.ssp_memberships
  FOR SELECT TO authenticated
  USING (
    public.auth_is_member(workspace_id)
    AND (
      user_id = auth.uid()
      OR public.auth_is_managerial(workspace_id)
      OR public.ssp_auth_product_role(workspace_id) IN ('org_admin', 'patrol_manager')
    )
  );

COMMENT ON FUNCTION public.ssp_auth_product_role(uuid) IS
  'SECURITY DEFINER read of the caller SSP product_role; avoids RLS recursion on ssp_memberships.';
