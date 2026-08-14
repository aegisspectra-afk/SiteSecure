-- RLS helpers. SECURITY DEFINER, locked search_path.
-- Membership table is the source of truth — not JWT app_metadata.

CREATE OR REPLACE FUNCTION public.auth_workspace_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.workspace_id
  FROM public.workspace_memberships m
  JOIN public.workspaces w ON w.id = m.workspace_id
  WHERE m.user_id = auth.uid()
    AND m.status = 'active'
    AND w.status = 'active';
$$;

CREATE OR REPLACE FUNCTION public.auth_is_member(p_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.auth_workspace_ids() ids
    WHERE ids = p_workspace_id
  );
$$;

CREATE OR REPLACE FUNCTION public.auth_role(p_workspace_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.role_key
  FROM public.workspace_memberships m
  WHERE m.workspace_id = p_workspace_id
    AND m.user_id = auth.uid()
    AND m.status = 'active'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.auth_role_in(p_workspace_id uuid, p_keys text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.auth_role(p_workspace_id), '') = ANY (p_keys)
    OR (
      public.auth_role(p_workspace_id) = 'founding_technician'
      AND 'technician' = ANY (p_keys)
      AND 'founding_technician' <> ALL (p_keys)
    );
$$;

COMMENT ON FUNCTION public.auth_role_in(uuid, text[]) IS
  'founding_technician satisfies technician-only lists unless founding_technician is also listed (then exact).';

CREATE OR REPLACE FUNCTION public.auth_is_privileged(p_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.auth_role_in(
    p_workspace_id,
    ARRAY['owner', 'administrator']
  );
$$;

CREATE OR REPLACE FUNCTION public.auth_is_managerial(p_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.auth_role_in(
    p_workspace_id,
    ARRAY['owner', 'administrator', 'manager']
  );
$$;

CREATE OR REPLACE FUNCTION public.auth_is_assigned_scope(p_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.auth_role(p_workspace_id) IN ('technician', 'founding_technician');
$$;

REVOKE ALL ON FUNCTION public.auth_workspace_ids() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_is_member(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_role(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_role_in(uuid, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_is_privileged(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_is_managerial(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_is_assigned_scope(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.auth_workspace_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_is_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_role_in(uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_is_privileged(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_is_managerial(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_is_assigned_scope(uuid) TO authenticated;

-- Workspace policies now that helpers exist

CREATE POLICY workspaces_select_member
  ON public.workspaces
  FOR SELECT
  TO authenticated
  USING (public.auth_is_member(id));

CREATE POLICY workspaces_update_privileged
  ON public.workspaces
  FOR UPDATE
  TO authenticated
  USING (public.auth_is_privileged(id))
  WITH CHECK (public.auth_is_privileged(id));

CREATE POLICY workspace_settings_select_member
  ON public.workspace_settings
  FOR SELECT
  TO authenticated
  USING (public.auth_is_member(workspace_id));

CREATE POLICY workspace_settings_update_privileged
  ON public.workspace_settings
  FOR UPDATE
  TO authenticated
  USING (public.auth_is_privileged(workspace_id))
  WITH CHECK (public.auth_is_privileged(workspace_id));

CREATE POLICY workspace_counters_select_member
  ON public.workspace_counters
  FOR SELECT
  TO authenticated
  USING (public.auth_is_member(workspace_id));

CREATE POLICY memberships_select_member
  ON public.workspace_memberships
  FOR SELECT
  TO authenticated
  USING (public.auth_is_member(workspace_id));

CREATE POLICY memberships_insert_privileged
  ON public.workspace_memberships
  FOR INSERT
  TO authenticated
  WITH CHECK (public.auth_is_privileged(workspace_id));

CREATE POLICY memberships_update_privileged
  ON public.workspace_memberships
  FOR UPDATE
  TO authenticated
  USING (public.auth_is_privileged(workspace_id))
  WITH CHECK (public.auth_is_privileged(workspace_id));

CREATE POLICY memberships_delete_privileged
  ON public.workspace_memberships
  FOR DELETE
  TO authenticated
  USING (public.auth_is_privileged(workspace_id));

CREATE POLICY invitations_all_privileged
  ON public.invitations
  FOR ALL
  TO authenticated
  USING (public.auth_is_privileged(workspace_id))
  WITH CHECK (public.auth_is_privileged(workspace_id));

-- Coworkers can see teammate profile names
CREATE POLICY profiles_select_coworkers
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.workspace_memberships me
      JOIN public.workspace_memberships them
        ON them.workspace_id = me.workspace_id
      WHERE me.user_id = auth.uid()
        AND me.status = 'active'
        AND them.user_id = profiles.id
        AND them.status = 'active'
    )
  );

-- Explicit workspace create. No silent tenant. Caller becomes owner.
CREATE OR REPLACE FUNCTION public.create_workspace(p_name text, p_plan_key text DEFAULT 'solo')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;
  IF p_name IS NULL OR length(trim(p_name)) < 2 THEN
    RAISE EXCEPTION 'INVALID_NAME';
  END IF;

  INSERT INTO public.workspaces (name)
  VALUES (trim(p_name))
  RETURNING id INTO v_id;

  INSERT INTO public.workspace_settings (workspace_id) VALUES (v_id);
  INSERT INTO public.workspace_counters (workspace_id, kind, last_value)
  VALUES
    (v_id, 'site', 0),
    (v_id, 'quote', 0),
    (v_id, 'job', 0),
    (v_id, 'warranty', 0),
    (v_id, 'ft', 0);

  INSERT INTO public.workspace_memberships (workspace_id, user_id, role_key)
  VALUES (v_id, v_uid, 'owner');

  UPDATE public.profiles
  SET last_workspace_id = v_id
  WHERE id = v_uid;

  -- subscription row is added in 0008 when plans exist; function replaced there.

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_workspace(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_workspace(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_code(uuid, text) TO authenticated;
