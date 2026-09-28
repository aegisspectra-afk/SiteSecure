-- SaaS Phase 1: USER-LOCKED Free seat model
-- max_members (all active members + reserved invites) + max_technicians (technician role only).
-- Pending invites reserve capacity via INSERT trigger (race-safe with subscription row lock).
-- Does not deactivate existing over-cap members; only blocks new consumption.

INSERT INTO public.plan_limits (plan_key, limit_key, limit_value) VALUES
  ('solo', 'max_members', 3),
  ('solo', 'max_technicians', 2),
  ('business', 'max_members', 15),
  ('business', 'max_technicians', 10),
  ('enterprise', 'max_members', 0),
  ('enterprise', 'max_technicians', 0)
ON CONFLICT (plan_key, limit_key) DO UPDATE
SET limit_value = EXCLUDED.limit_value;

-- Keep legacy seat bucket keys aligned as soft mirrors for older SQL readers.
-- Authoritative invite/accept enforcement uses max_members / max_technicians below.
INSERT INTO public.plan_limits (plan_key, limit_key, limit_value) VALUES
  ('solo', 'seats_operator', 3),
  ('solo', 'seats_field', 2),
  ('business', 'seats_operator', 15),
  ('business', 'seats_field', 10),
  ('enterprise', 'seats_operator', 0),
  ('enterprise', 'seats_field', 0)
ON CONFLICT (plan_key, limit_key) DO UPDATE
SET limit_value = EXCLUDED.limit_value;

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'system'
    CHECK (source IN ('system', 'billing', 'admin_override')),
  ADD COLUMN IF NOT EXISTS override_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS override_reason text;

COMMENT ON COLUMN public.subscriptions.source IS
  'system = create_workspace/backfill; billing = provider; admin_override = Platform Admin (prefer expiry).';

CREATE OR REPLACE FUNCTION public._plan_limit_or_zero(p_plan text, p_limit_key text)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT pl.limit_value FROM public.plan_limits pl
     WHERE pl.plan_key = p_plan AND pl.limit_key = p_limit_key),
    0
  );
$$;

CREATE OR REPLACE FUNCTION public._workspace_member_occupancy(p_workspace_id uuid)
RETURNS TABLE(members integer, technicians integer)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH active AS (
    SELECT m.role_key, lower(COALESCE(p.email, '')) AS email
    FROM public.workspace_memberships m
    LEFT JOIN public.profiles p ON p.id = m.user_id
    WHERE m.workspace_id = p_workspace_id
      AND m.status = 'active'
  ),
  member_emails AS (
    SELECT email FROM active WHERE email <> ''
  ),
  pending AS (
    SELECT DISTINCT ON (lower(i.email))
      i.role_key,
      lower(i.email) AS email
    FROM public.invitations i
    WHERE i.workspace_id = p_workspace_id
      AND i.accepted_at IS NULL
      AND i.expires_at > now()
      AND lower(i.email) NOT IN (SELECT email FROM member_emails)
    ORDER BY lower(i.email), i.created_at ASC
  ),
  occupied AS (
    SELECT role_key FROM active
    UNION ALL
    SELECT role_key FROM pending
  )
  SELECT
    (SELECT count(*)::integer FROM occupied) AS members,
    (SELECT count(*)::integer FROM occupied
     WHERE role_key IN ('technician', 'founding_technician')) AS technicians;
$$;

CREATE OR REPLACE FUNCTION public.enforce_invitation_seat_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan text;
  v_members integer;
  v_technicians integer;
  v_max_members integer;
  v_max_technicians integer;
  v_role text;
BEGIN
  -- Serialize per workspace via subscription (or workspace) row.
  IF EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.workspace_id = NEW.workspace_id) THEN
    PERFORM 1 FROM public.subscriptions s WHERE s.workspace_id = NEW.workspace_id FOR UPDATE;
    SELECT s.plan_key INTO v_plan FROM public.subscriptions s WHERE s.workspace_id = NEW.workspace_id;
  ELSE
    PERFORM 1 FROM public.workspaces w WHERE w.id = NEW.workspace_id FOR UPDATE;
    v_plan := 'solo';
  END IF;

  v_plan := COALESCE(v_plan, 'solo');
  v_role := NEW.role_key;
  -- Retired role_key: count as technician for quota only.
  IF v_role = 'founding_technician' THEN
    v_role := 'technician';
  END IF;

  SELECT o.members, o.technicians INTO v_members, v_technicians
  FROM public._workspace_member_occupancy(NEW.workspace_id) o;

  v_max_members := public._plan_limit_or_zero(v_plan, 'max_members');
  v_max_technicians := public._plan_limit_or_zero(v_plan, 'max_technicians');

  IF v_max_members > 0 AND v_members >= v_max_members THEN
    RAISE EXCEPTION 'PLAN_LIMIT_REACHED:member_quota_exceeded:%:%', v_max_members, v_members
      USING ERRCODE = 'P0001';
  END IF;

  IF v_role = 'technician' AND v_max_technicians > 0 AND v_technicians >= v_max_technicians THEN
    RAISE EXCEPTION 'PLAN_LIMIT_REACHED:technician_quota_exceeded:%:%', v_max_technicians, v_technicians
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS invitations_enforce_seat_quota ON public.invitations;
CREATE TRIGGER invitations_enforce_seat_quota
  BEFORE INSERT ON public.invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_invitation_seat_quota();

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
  IF v_role = 'founding_technician' THEN
    v_role := 'technician';
  END IF;

  -- Mirror packages/authz/catalog.json assignable_roles (Phase 1 Free allows manager).
  IF v_plan = 'solo' THEN
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

  -- Accept consumes the pending invite row: occupancy excludes this invite after accept,
  -- so compare against members excluding this invitation's reservation.
  SELECT o.members, o.technicians INTO v_members, v_technicians
  FROM public._workspace_member_occupancy(v_inv.workspace_id) o;

  -- Occupancy still includes this pending invite; accepting replaces reservation with membership.
  -- Block only when *other* occupants already saturate the cap (members-1 / techs-1).
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
  'Atomic invite accept with max_members/max_technicians enforcement (SaaS Phase 1).';
