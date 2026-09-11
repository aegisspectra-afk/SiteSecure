-- Auth contract P1: technician field scope, founding_technician never an RBAC role, customer visibility.

-- 1) Customer visibility follows full site visibility (job/project/service assignment paths).
CREATE OR REPLACE FUNCTION public.auth_customer_visible(p_workspace_id uuid, p_customer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.auth_is_member(p_workspace_id)
    AND (
      NOT public.auth_is_assigned_scope(p_workspace_id)
      OR public.auth_assigned(p_workspace_id, 'customer', p_customer_id)
      OR EXISTS (
        SELECT 1 FROM public.sites s
        WHERE s.workspace_id = p_workspace_id
          AND s.customer_id = p_customer_id
          AND s.deleted_at IS NULL
          AND public.auth_site_visible(p_workspace_id, s.id)
      )
    );
$$;

-- 2) Remove legacy founding_technician quote-update privilege (badge is not an RBAC role).
DROP POLICY IF EXISTS quotes_update ON public.quotes;
CREATE POLICY quotes_update ON public.quotes FOR UPDATE TO authenticated
  USING (
    public.auth_is_managerial(workspace_id)
    OR owner_user_id = auth.uid()
  )
  WITH CHECK (
    public.auth_is_managerial(workspace_id)
    OR owner_user_id = auth.uid()
  );

-- 3) Normalize any residual founding_technician memberships (badge via text[]).
WITH moved AS (
  UPDATE public.workspace_memberships m
  SET
    role_key = 'technician',
    workspace_role_key = CASE
      WHEN m.workspace_role_key = 'founding_technician' THEN 'technician'
      ELSE COALESCE(m.workspace_role_key, 'technician')
    END,
    program_type = COALESCE(NULLIF(m.program_type, ''), 'founding_technician'),
    updated_at = now()
  WHERE m.role_key = 'founding_technician'
     OR m.workspace_role_key = 'founding_technician'
  RETURNING m.user_id
)
UPDATE public.profiles p
SET recognition_badges = (
  SELECT ARRAY(
    SELECT DISTINCT x
    FROM unnest(COALESCE(p.recognition_badges, '{}'::text[]) || ARRAY['founding_technician']::text[]) AS x
  )
)
WHERE p.id IN (SELECT user_id FROM moved);

UPDATE public.invitations
SET role_key = 'technician'
WHERE role_key = 'founding_technician'
  AND accepted_at IS NULL;

-- 4) Rehydrate system technician grants from API catalog on next ensure_workspace_roles.
UPDATE public.workspace_roles
SET grants = '[]'::jsonb, updated_at = now()
WHERE is_system = true
  AND key = 'technician'
  AND base_role_key = 'technician';

-- 5) Accept invitation: never persist founding_technician as a workspace role.
CREATE OR REPLACE FUNCTION public.accept_invitation(p_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash text := public.token_sha256(p_token);
  v_inv public.invitations%ROWTYPE;
  v_email text;
  v_code text;
  v_uid uuid := auth.uid();
  v_ws_status text;
  v_plan text;
  v_sub_status text;
  v_bucket text;
  v_limit integer;
  v_occupied integer;
  v_bucket_roles text[];
  v_role text;
  v_program text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  IF p_token IS NULL OR length(btrim(p_token)) < 16 THEN
    RAISE EXCEPTION 'INVITE_INVALID';
  END IF;

  SELECT COALESCE(u.email, '') INTO v_email
  FROM auth.users u
  WHERE u.id = v_uid;

  SELECT * INTO v_inv
  FROM public.invitations i
  WHERE i.token_hash = v_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVITE_INVALID';
  END IF;

  IF v_inv.accepted_at IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.workspace_memberships m
      WHERE m.workspace_id = v_inv.workspace_id AND m.user_id = v_uid
    ) THEN
      UPDATE public.profiles
      SET last_workspace_id = v_inv.workspace_id
      WHERE id = v_uid;
      RETURN v_inv.workspace_id;
    END IF;
    RAISE EXCEPTION 'INVITE_ALREADY_ACCEPTED';
  END IF;

  IF v_inv.expires_at <= now() THEN
    RAISE EXCEPTION 'INVITE_EXPIRED';
  END IF;

  IF lower(v_inv.email) <> lower(v_email) THEN
    RAISE EXCEPTION 'INVITE_EMAIL_MISMATCH';
  END IF;

  SELECT w.status::text INTO v_ws_status
  FROM public.workspaces w
  WHERE w.id = v_inv.workspace_id
  FOR UPDATE;

  IF v_ws_status IS NULL OR v_ws_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'TENANT_INACTIVE';
  END IF;

  SELECT s.plan_key, s.status::text
  INTO v_plan, v_sub_status
  FROM public.subscriptions s
  WHERE s.workspace_id = v_inv.workspace_id
  FOR UPDATE;

  IF v_plan IS NULL THEN
    v_plan := 'solo';
    v_sub_status := 'active';
  END IF;

  IF v_sub_status NOT IN ('trialing', 'active', 'manual') THEN
    RAISE EXCEPTION 'SUBSCRIPTION_INVALID';
  END IF;

  v_role := v_inv.role_key;
  v_program := NULL;
  IF v_role = 'founding_technician' THEN
    v_role := 'technician';
    v_program := 'founding_technician';
  END IF;

  IF v_plan = 'solo' THEN
    IF v_role NOT IN ('technician', 'viewer') THEN
      RAISE EXCEPTION 'ROLE_NOT_ALLOWED';
    END IF;
  ELSIF v_plan IN ('business', 'enterprise') THEN
    IF v_role NOT IN (
      'administrator', 'manager', 'sales', 'technician', 'viewer'
    ) THEN
      RAISE EXCEPTION 'ROLE_NOT_ALLOWED';
    END IF;
  ELSE
    RAISE EXCEPTION 'ROLE_NOT_ALLOWED';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.workspace_memberships m
    WHERE m.workspace_id = v_inv.workspace_id AND m.user_id = v_uid
  ) THEN
    UPDATE public.invitations SET accepted_at = now() WHERE id = v_inv.id;
    UPDATE public.profiles
    SET last_workspace_id = v_inv.workspace_id
    WHERE id = v_uid;
    RETURN v_inv.workspace_id;
  END IF;

  IF v_role IN ('owner', 'administrator', 'manager', 'sales') THEN
    v_bucket := 'seats_operator';
    v_bucket_roles := ARRAY['owner', 'administrator', 'manager', 'sales'];
  ELSIF v_role IN ('technician', 'viewer') THEN
    v_bucket := 'seats_field';
    v_bucket_roles := ARRAY['technician', 'founding_technician', 'viewer'];
  ELSE
    RAISE EXCEPTION 'ROLE_NOT_ALLOWED';
  END IF;

  SELECT pl.limit_value INTO v_limit
  FROM public.plan_limits pl
  WHERE pl.plan_key = v_plan AND pl.limit_key = v_bucket;

  IF v_limit IS NULL THEN
    v_limit := 0;
  END IF;

  IF v_limit > 0 THEN
    SELECT count(*)::integer INTO v_occupied
    FROM public.workspace_memberships m
    WHERE m.workspace_id = v_inv.workspace_id
      AND m.status = 'active'
      AND m.role_key = ANY (v_bucket_roles);

    IF v_occupied >= v_limit THEN
      RAISE EXCEPTION 'PLAN_LIMIT_REACHED';
    END IF;
  END IF;

  INSERT INTO public.workspace_memberships (
    workspace_id, user_id, role_key, workspace_role_key, technician_code, program_type, program_started_at
  )
  VALUES (
    v_inv.workspace_id,
    v_uid,
    v_role,
    v_role,
    v_code,
    v_program,
    CASE WHEN v_program IS NOT NULL THEN now() ELSE NULL END
  );

  UPDATE public.invitations SET accepted_at = now() WHERE id = v_inv.id;

  UPDATE public.profiles
  SET last_workspace_id = v_inv.workspace_id
  WHERE id = v_uid;

  RETURN v_inv.workspace_id;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_invitation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_invitation(text) TO authenticated;

COMMENT ON FUNCTION public.accept_invitation(text) IS
  'Accept workspace invite. Legacy founding_technician invite maps to technician role only; badge is platform-managed.';
