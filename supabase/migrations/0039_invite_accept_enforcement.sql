-- Phase 0 / Task 01: invitation preview + atomic accept enforcement
-- (workspace active, subscription, assignable role, seat re-check).
-- Seat buckets / assignable roles mirror packages/authz/catalog.json.

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
  v_code text;
  v_uid uuid := auth.uid();
  v_ws_status text;
  v_plan text;
  v_sub_status text;
  v_bucket text;
  v_limit integer;
  v_occupied integer;
  v_bucket_roles text[];
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
    -- Idempotent: already accepted. If caller is the member, succeed; else invalid.
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

  -- Mirror packages/authz/catalog.json assignable_roles
  IF v_plan = 'solo' THEN
    IF v_inv.role_key NOT IN ('technician', 'founding_technician', 'viewer') THEN
      RAISE EXCEPTION 'ROLE_NOT_ALLOWED';
    END IF;
  ELSIF v_plan IN ('business', 'enterprise') THEN
    IF v_inv.role_key NOT IN (
      'administrator', 'manager', 'sales', 'technician', 'founding_technician', 'viewer'
    ) THEN
      RAISE EXCEPTION 'ROLE_NOT_ALLOWED';
    END IF;
  ELSE
    RAISE EXCEPTION 'ROLE_NOT_ALLOWED';
  END IF;

  -- Already a member: mark accepted, refresh last workspace (idempotent)
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

  -- Seat bucket mirror packages/authz/catalog.json seat_buckets
  IF v_inv.role_key IN ('owner', 'administrator', 'manager', 'sales') THEN
    v_bucket := 'seats_operator';
    v_bucket_roles := ARRAY['owner', 'administrator', 'manager', 'sales'];
  ELSIF v_inv.role_key IN ('technician', 'founding_technician', 'viewer') THEN
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

  -- Authoritative accept-time seat check: active members in bucket only.
  -- (Pending invites reserve seats at create-time; accept must block if members already at cap.)
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

  IF v_inv.role_key = 'founding_technician' THEN
    v_code := 'SS-FT-' || lpad(public.next_code(v_inv.workspace_id, 'ft')::text, 3, '0');
  END IF;

  INSERT INTO public.workspace_memberships (
    workspace_id, user_id, role_key, technician_code, program_type, program_started_at
  )
  VALUES (
    v_inv.workspace_id,
    v_uid,
    v_inv.role_key,
    v_code,
    CASE WHEN v_inv.role_key = 'founding_technician' THEN 'founding_technician' ELSE NULL END,
    CASE WHEN v_inv.role_key = 'founding_technician' THEN now() ELSE NULL END
  );

  UPDATE public.invitations SET accepted_at = now() WHERE id = v_inv.id;

  UPDATE public.profiles
  SET last_workspace_id = v_inv.workspace_id
  WHERE id = v_uid;

  RETURN v_inv.workspace_id;
END;
$$;

REVOKE ALL ON FUNCTION public.invitation_preview(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.invitation_preview(text) TO authenticated;

REVOKE ALL ON FUNCTION public.accept_invitation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_invitation(text) TO authenticated;
