-- Workforce Intelligence: least-privilege RLS.
-- Uses the existing workspace_roles.grants + role_permissions catalog, not a parallel RBAC.
-- Employee/membership writes are API-only (service_role). Direct PostgREST inserts cannot
-- provision Auth users and are revoked from authenticated.
-- Additive. Does not enable the product. Do not apply on production without explicit approval.

CREATE OR REPLACE FUNCTION public.auth_has_workspace_grant(p_workspace_id uuid, p_permission text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_ws_role text;
  v_grants jsonb;
  v_base text;
BEGIN
  IF p_workspace_id IS NULL OR p_permission IS NULL OR length(trim(p_permission)) = 0 THEN
    RETURN false;
  END IF;
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;
  IF NOT public.auth_is_member(p_workspace_id) THEN
    RETURN false;
  END IF;

  SELECT
    CASE WHEN m.role_key = 'founding_technician' THEN 'technician' ELSE m.role_key END,
    CASE
      WHEN COALESCE(m.workspace_role_key, m.role_key) = 'founding_technician' THEN 'technician'
      ELSE COALESCE(NULLIF(m.workspace_role_key, ''), m.role_key)
    END
  INTO v_role, v_ws_role
  FROM public.workspace_memberships m
  WHERE m.workspace_id = p_workspace_id
    AND m.user_id = auth.uid()
    AND m.status = 'active'
  LIMIT 1;

  IF v_role IS NULL THEN
    RETURN false;
  END IF;
  IF v_role = 'owner' OR v_ws_role = 'owner' THEN
    RETURN true;
  END IF;

  SELECT wr.grants, wr.base_role_key
  INTO v_grants, v_base
  FROM public.workspace_roles wr
  WHERE wr.workspace_id = p_workspace_id
    AND wr.key = v_ws_role
  LIMIT 1;

  IF v_grants IS NOT NULL
     AND jsonb_typeof(v_grants) = 'array'
     AND jsonb_array_length(v_grants) > 0 THEN
    IF v_grants @> '["*"]'::jsonb THEN
      RETURN true;
    END IF;
    RETURN v_grants @> to_jsonb(p_permission);
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.role_permissions rp
    WHERE rp.role_key = COALESCE(NULLIF(v_base, ''), v_role)
      AND rp.permission_key = p_permission
  );
END;
$$;

COMMENT ON FUNCTION public.auth_has_workspace_grant(uuid, text) IS
  'RLS helper: workspace_roles.grants when non-empty, else role_permissions catalog. Owner always true. Not a second permission system.';

REVOKE ALL ON FUNCTION public.auth_has_workspace_grant(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_has_workspace_grant(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.auth_has_workspace_grant(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_has_workspace_grant(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.workforce_lock_workspace_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.workspace_id IS DISTINCT FROM OLD.workspace_id THEN
    RAISE EXCEPTION 'WORKSPACE_ID_IMMUTABLE';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS workforce_regions_lock_workspace ON public.workforce_regions;
CREATE TRIGGER workforce_regions_lock_workspace
  BEFORE UPDATE ON public.workforce_regions
  FOR EACH ROW EXECUTE FUNCTION public.workforce_lock_workspace_id();

DROP TRIGGER IF EXISTS workforce_sites_lock_workspace ON public.workforce_sites;
CREATE TRIGGER workforce_sites_lock_workspace
  BEFORE UPDATE ON public.workforce_sites
  FOR EACH ROW EXECUTE FUNCTION public.workforce_lock_workspace_id();

DROP TRIGGER IF EXISTS workforce_positions_lock_workspace ON public.workforce_positions;
CREATE TRIGGER workforce_positions_lock_workspace
  BEFORE UPDATE ON public.workforce_positions
  FOR EACH ROW EXECUTE FUNCTION public.workforce_lock_workspace_id();

DROP TRIGGER IF EXISTS workforce_employees_lock_workspace ON public.workforce_employees;
CREATE TRIGGER workforce_employees_lock_workspace
  BEFORE UPDATE ON public.workforce_employees
  FOR EACH ROW EXECUTE FUNCTION public.workforce_lock_workspace_id();

DROP TRIGGER IF EXISTS workforce_memberships_lock_workspace ON public.workforce_memberships;
CREATE TRIGGER workforce_memberships_lock_workspace
  BEFORE UPDATE ON public.workforce_memberships
  FOR EACH ROW EXECUTE FUNCTION public.workforce_lock_workspace_id();

-- ── Directory lookups (regions / sites / positions) ──────────────────────────

DROP POLICY IF EXISTS workforce_regions_select ON public.workforce_regions;
DROP POLICY IF EXISTS workforce_regions_write ON public.workforce_regions;
DROP POLICY IF EXISTS workforce_regions_insert ON public.workforce_regions;
DROP POLICY IF EXISTS workforce_regions_update ON public.workforce_regions;
DROP POLICY IF EXISTS workforce_regions_delete ON public.workforce_regions;

CREATE POLICY workforce_regions_select ON public.workforce_regions
  FOR SELECT TO authenticated
  USING (
    public.auth_is_member(workspace_id)
    AND public.auth_feature(workspace_id, 'workforce')
    AND (
      public.auth_has_workspace_grant(workspace_id, 'workforce.view')
      OR public.auth_has_workspace_grant(workspace_id, 'workforce.sites.view')
      OR public.auth_has_workspace_grant(workspace_id, 'workforce.employees.view')
    )
  );

CREATE POLICY workforce_regions_insert ON public.workforce_regions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_is_member(workspace_id)
    AND public.auth_feature(workspace_id, 'workforce')
    AND public.auth_has_workspace_grant(workspace_id, 'workforce.sites.manage')
  );

CREATE POLICY workforce_regions_update ON public.workforce_regions
  FOR UPDATE TO authenticated
  USING (
    public.auth_is_member(workspace_id)
    AND public.auth_feature(workspace_id, 'workforce')
    AND public.auth_has_workspace_grant(workspace_id, 'workforce.sites.manage')
  )
  WITH CHECK (
    public.auth_is_member(workspace_id)
    AND public.auth_feature(workspace_id, 'workforce')
    AND public.auth_has_workspace_grant(workspace_id, 'workforce.sites.manage')
  );

CREATE POLICY workforce_regions_delete ON public.workforce_regions
  FOR DELETE TO authenticated
  USING (
    public.auth_is_member(workspace_id)
    AND public.auth_feature(workspace_id, 'workforce')
    AND public.auth_has_workspace_grant(workspace_id, 'workforce.sites.manage')
  );

DROP POLICY IF EXISTS workforce_sites_select ON public.workforce_sites;
DROP POLICY IF EXISTS workforce_sites_write ON public.workforce_sites;
DROP POLICY IF EXISTS workforce_sites_insert ON public.workforce_sites;
DROP POLICY IF EXISTS workforce_sites_update ON public.workforce_sites;
DROP POLICY IF EXISTS workforce_sites_delete ON public.workforce_sites;

CREATE POLICY workforce_sites_select ON public.workforce_sites
  FOR SELECT TO authenticated
  USING (
    public.auth_is_member(workspace_id)
    AND public.auth_feature(workspace_id, 'workforce')
    AND (
      public.auth_has_workspace_grant(workspace_id, 'workforce.view')
      OR public.auth_has_workspace_grant(workspace_id, 'workforce.sites.view')
      OR public.auth_has_workspace_grant(workspace_id, 'workforce.employees.view')
    )
  );

CREATE POLICY workforce_sites_insert ON public.workforce_sites
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_is_member(workspace_id)
    AND public.auth_feature(workspace_id, 'workforce')
    AND public.auth_has_workspace_grant(workspace_id, 'workforce.sites.manage')
  );

CREATE POLICY workforce_sites_update ON public.workforce_sites
  FOR UPDATE TO authenticated
  USING (
    public.auth_is_member(workspace_id)
    AND public.auth_feature(workspace_id, 'workforce')
    AND public.auth_has_workspace_grant(workspace_id, 'workforce.sites.manage')
  )
  WITH CHECK (
    public.auth_is_member(workspace_id)
    AND public.auth_feature(workspace_id, 'workforce')
    AND public.auth_has_workspace_grant(workspace_id, 'workforce.sites.manage')
  );

CREATE POLICY workforce_sites_delete ON public.workforce_sites
  FOR DELETE TO authenticated
  USING (
    public.auth_is_member(workspace_id)
    AND public.auth_feature(workspace_id, 'workforce')
    AND public.auth_has_workspace_grant(workspace_id, 'workforce.sites.manage')
  );

DROP POLICY IF EXISTS workforce_positions_select ON public.workforce_positions;
DROP POLICY IF EXISTS workforce_positions_write ON public.workforce_positions;
DROP POLICY IF EXISTS workforce_positions_insert ON public.workforce_positions;
DROP POLICY IF EXISTS workforce_positions_update ON public.workforce_positions;
DROP POLICY IF EXISTS workforce_positions_delete ON public.workforce_positions;

CREATE POLICY workforce_positions_select ON public.workforce_positions
  FOR SELECT TO authenticated
  USING (
    public.auth_is_member(workspace_id)
    AND public.auth_feature(workspace_id, 'workforce')
    AND (
      public.auth_has_workspace_grant(workspace_id, 'workforce.view')
      OR public.auth_has_workspace_grant(workspace_id, 'workforce.sites.view')
      OR public.auth_has_workspace_grant(workspace_id, 'workforce.employees.view')
    )
  );

CREATE POLICY workforce_positions_insert ON public.workforce_positions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_is_member(workspace_id)
    AND public.auth_feature(workspace_id, 'workforce')
    AND public.auth_has_workspace_grant(workspace_id, 'workforce.sites.manage')
  );

CREATE POLICY workforce_positions_update ON public.workforce_positions
  FOR UPDATE TO authenticated
  USING (
    public.auth_is_member(workspace_id)
    AND public.auth_feature(workspace_id, 'workforce')
    AND public.auth_has_workspace_grant(workspace_id, 'workforce.sites.manage')
  )
  WITH CHECK (
    public.auth_is_member(workspace_id)
    AND public.auth_feature(workspace_id, 'workforce')
    AND public.auth_has_workspace_grant(workspace_id, 'workforce.sites.manage')
  );

CREATE POLICY workforce_positions_delete ON public.workforce_positions
  FOR DELETE TO authenticated
  USING (
    public.auth_is_member(workspace_id)
    AND public.auth_feature(workspace_id, 'workforce')
    AND public.auth_has_workspace_grant(workspace_id, 'workforce.sites.manage')
  );

-- ── Employees + product memberships: reads by grant, writes API-only ─────────

DROP POLICY IF EXISTS workforce_employees_select ON public.workforce_employees;
DROP POLICY IF EXISTS workforce_employees_write ON public.workforce_employees;
DROP POLICY IF EXISTS workforce_employees_insert ON public.workforce_employees;
DROP POLICY IF EXISTS workforce_employees_update ON public.workforce_employees;
DROP POLICY IF EXISTS workforce_employees_delete ON public.workforce_employees;

CREATE POLICY workforce_employees_select ON public.workforce_employees
  FOR SELECT TO authenticated
  USING (
    public.auth_is_member(workspace_id)
    AND public.auth_feature(workspace_id, 'workforce')
    AND (
      public.auth_has_workspace_grant(workspace_id, 'workforce.employees.view')
      OR (
        public.auth_has_workspace_grant(workspace_id, 'workforce.portal.view')
        AND user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS workforce_memberships_select ON public.workforce_memberships;
DROP POLICY IF EXISTS workforce_memberships_write ON public.workforce_memberships;
DROP POLICY IF EXISTS workforce_memberships_insert ON public.workforce_memberships;
DROP POLICY IF EXISTS workforce_memberships_update ON public.workforce_memberships;
DROP POLICY IF EXISTS workforce_memberships_delete ON public.workforce_memberships;

CREATE POLICY workforce_memberships_select ON public.workforce_memberships
  FOR SELECT TO authenticated
  USING (
    public.auth_is_member(workspace_id)
    AND public.auth_feature(workspace_id, 'workforce')
    AND (
      public.auth_has_workspace_grant(workspace_id, 'workforce.employees.view')
      OR (
        public.auth_has_workspace_grant(workspace_id, 'workforce.portal.view')
        AND user_id = auth.uid()
      )
    )
  );

REVOKE INSERT, UPDATE, DELETE ON TABLE public.workforce_employees FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.workforce_memberships FROM authenticated;
GRANT SELECT ON TABLE public.workforce_employees TO authenticated;
GRANT SELECT ON TABLE public.workforce_memberships TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.workforce_employees TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.workforce_memberships TO service_role;

COMMENT ON POLICY workforce_employees_select ON public.workforce_employees IS
  'List/directory requires workforce.employees.view. Portal users see only their own row. Writes go through FastAPI service_role.';
COMMENT ON POLICY workforce_memberships_select ON public.workforce_memberships IS
  'Same visibility as employees. Direct writes by authenticated are revoked.';
