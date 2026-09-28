-- BETA-ADMIN-1: invitation revoke + admin workspace provision + accept owner/revoked checks

ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz;

CREATE INDEX IF NOT EXISTS invitations_workspace_status_idx
  ON public.invitations (workspace_id, created_at DESC);

COMMENT ON COLUMN public.invitations.revoked_at IS
  'BETA-ADMIN-1: set when platform/workspace admin revokes a pending invite.';

-- Platform Admin: create empty beta workspace (no membership). Service role only.
CREATE OR REPLACE FUNCTION public.admin_provision_workspace(
  p_name text,
  p_plan_key text DEFAULT 'business'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_plan text;
BEGIN
  IF p_name IS NULL OR length(trim(p_name)) < 2 THEN
    RAISE EXCEPTION 'INVALID_NAME';
  END IF;

  v_plan := COALESCE(NULLIF(trim(p_plan_key), ''), 'business');
  IF NOT EXISTS (SELECT 1 FROM public.plans WHERE key = v_plan) THEN
    RAISE EXCEPTION 'INVALID_PLAN';
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

  INSERT INTO public.subscriptions (workspace_id, plan_key, status)
  VALUES (v_id, v_plan, 'active');

  PERFORM public.seed_workspace_defaults(v_id);

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_provision_workspace(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_provision_workspace(text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.invitation_preview(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash text;
  v_inv public.invitations%ROWTYPE;
  v_ws public.workspaces%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  IF p_token IS NULL OR length(btrim(p_token)) < 16 THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;

  v_hash := public.token_sha256(p_token);

  SELECT * INTO v_inv
  FROM public.invitations i
  WHERE i.token_hash = v_hash;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;

  IF v_inv.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'revoked');
  END IF;

  IF v_inv.accepted_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'already_accepted');
  END IF;

  IF v_inv.expires_at <= now() THEN
    RETURN jsonb_build_object('status', 'expired');
  END IF;

  SELECT * INTO v_ws
  FROM public.workspaces w
  WHERE w.id = v_inv.workspace_id;

  IF NOT FOUND OR v_ws.status IS DISTINCT FROM 'active' THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;

  RETURN jsonb_build_object(
    'status', 'valid',
    'workspace_id', v_inv.workspace_id,
    'workspace_name', v_ws.name,
    'role_key', v_inv.role_key,
    'email', v_inv.email,
    'expires_at', v_inv.expires_at
  );
END;
$$;

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
  v_uid uuid := auth.uid();
  v_ws_status text;
  v_plan text;
  v_sub_status text;
  v_members integer;
  v_technicians integer;
  v_max_members integer;
  v_max_technicians integer;
  v_role text;
  v_owner_count integer;
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

  IF v_inv.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'INVITE_REVOKED';
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
  IF v_role = 'founding_technician' THEN
    v_role := 'technician';
  END IF;

  -- Owner invite only when workspace has no active owner (platform bootstrap).
  IF v_role = 'owner' THEN
    SELECT count(*)::integer INTO v_owner_count
    FROM public.workspace_memberships m
    WHERE m.workspace_id = v_inv.workspace_id
      AND m.role_key = 'owner'
      AND coalesce(m.status::text, 'active') = 'active';
    IF v_owner_count > 0 THEN
      RAISE EXCEPTION 'ROLE_NOT_ALLOWED';
    END IF;
  ELSIF v_plan = 'solo' THEN
    IF v_role NOT IN ('manager', 'technician', 'viewer') THEN
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

  SELECT o.members, o.technicians INTO v_members, v_technicians
  FROM public._workspace_member_occupancy(v_inv.workspace_id) o;

  v_max_members := public._plan_limit_or_zero(v_plan, 'max_members');
  v_max_technicians := public._plan_limit_or_zero(v_plan, 'max_technicians');

  IF v_max_members > 0 AND (v_members - 1) >= v_max_members THEN
    RAISE EXCEPTION 'PLAN_LIMIT_REACHED';
  END IF;

  IF v_role = 'technician' AND v_max_technicians > 0 AND (v_technicians - 1) >= v_max_technicians THEN
    RAISE EXCEPTION 'PLAN_LIMIT_REACHED';
  END IF;

  INSERT INTO public.workspace_memberships (
    workspace_id, user_id, role_key, technician_code, program_type, program_started_at
  )
  VALUES (
    v_inv.workspace_id,
    v_uid,
    v_role,
    NULL,
    NULL,
    NULL
  );

  UPDATE public.invitations SET accepted_at = now() WHERE id = v_inv.id;

  UPDATE public.profiles
  SET last_workspace_id = v_inv.workspace_id
  WHERE id = v_uid;

  RETURN v_inv.workspace_id;
END;
$$;

COMMENT ON FUNCTION public.accept_invitation(text) IS
  'Atomic invite accept with revoke check, seat limits, and owner bootstrap when no owner exists.';

COMMENT ON FUNCTION public.admin_provision_workspace(text, text) IS
  'BETA-ADMIN-1: service-role provision of workspace without membership (invite owner next).';
