-- SSP office/user join: extend site activation for authenticated users (local only).
-- Does not replace device activation. Does not create a parallel membership system.

ALTER TABLE public.ssp_sites
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'office';

ALTER TABLE public.ssp_sites
  DROP CONSTRAINT IF EXISTS ssp_sites_kind_chk;

ALTER TABLE public.ssp_sites
  ADD CONSTRAINT ssp_sites_kind_chk
    CHECK (kind IN ('office', 'ops_center', 'physical_site', 'other'));

ALTER TABLE public.ssp_site_activation_codes
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'device';

ALTER TABLE public.ssp_site_activation_codes
  DROP CONSTRAINT IF EXISTS ssp_site_activation_codes_audience_chk;

ALTER TABLE public.ssp_site_activation_codes
  ADD CONSTRAINT ssp_site_activation_codes_audience_chk
    CHECK (audience IN ('device', 'user'));

ALTER TABLE public.ssp_site_activation_codes
  ADD COLUMN IF NOT EXISTS invited_role text NOT NULL DEFAULT 'patrol_officer';

ALTER TABLE public.ssp_site_activation_codes
  DROP CONSTRAINT IF EXISTS ssp_site_activation_codes_invited_role_chk;

ALTER TABLE public.ssp_site_activation_codes
  ADD CONSTRAINT ssp_site_activation_codes_invited_role_chk
    CHECK (invited_role IN ('patrol_officer', 'patrol_manager'));

ALTER TABLE public.ssp_site_enrollments
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'device';

ALTER TABLE public.ssp_site_enrollments
  DROP CONSTRAINT IF EXISTS ssp_site_enrollments_audience_chk;

ALTER TABLE public.ssp_site_enrollments
  ADD CONSTRAINT ssp_site_enrollments_audience_chk
    CHECK (audience IN ('device', 'user'));

ALTER TABLE public.ssp_site_enrollments
  ADD COLUMN IF NOT EXISTS requested_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL;

ALTER TABLE public.ssp_site_enrollments
  ADD COLUMN IF NOT EXISTS invited_role text;

ALTER TABLE public.ssp_site_enrollments
  DROP CONSTRAINT IF EXISTS ssp_site_enrollments_invited_role_chk;

ALTER TABLE public.ssp_site_enrollments
  ADD CONSTRAINT ssp_site_enrollments_invited_role_chk
    CHECK (invited_role IS NULL OR invited_role IN ('patrol_officer', 'patrol_manager'));

CREATE INDEX IF NOT EXISTS ssp_site_enrollments_user_idx
  ON public.ssp_site_enrollments (workspace_id, requested_user_id, status)
  WHERE requested_user_id IS NOT NULL;

GRANT SELECT (
  id, workspace_id, company_pk, site_pk, status, created_by, created_at,
  expires_at, redeemed_at, revoked_at, enrollment_id, audience, invited_role
) ON TABLE public.ssp_site_activation_codes TO authenticated;

GRANT SELECT (
  id, workspace_id, company_pk, site_pk, code_id, status, device_label, user_agent,
  created_at, expires_at, decided_at, decided_by, device_id, audience,
  requested_user_id, invited_role
) ON TABLE public.ssp_site_enrollments TO authenticated;

-- Device consume must not redeem a user-join code.
CREATE OR REPLACE FUNCTION public.ssp_consume_activation_code(
  p_code_hash text,
  p_poll_token_hash text,
  p_device_label text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  c public.ssp_site_activation_codes%ROWTYPE;
  e_id uuid;
  now_ts timestamptz := now();
  enroll_exp timestamptz := now() + interval '30 minutes';
BEGIN
  IF p_code_hash IS NULL OR char_length(p_code_hash) <> 64 THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  SELECT * INTO c
  FROM public.ssp_site_activation_codes
  WHERE code_hash = p_code_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  IF COALESCE(c.audience, 'device') <> 'device' THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  IF c.status <> 'active' OR c.expires_at <= now_ts THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  INSERT INTO public.ssp_site_enrollments (
    workspace_id, company_pk, site_pk, code_id, poll_token_hash, status,
    device_label, user_agent, expires_at, audience
  ) VALUES (
    c.workspace_id, c.company_pk, c.site_pk, c.id, p_poll_token_hash, 'pending',
    NULLIF(btrim(COALESCE(p_device_label, '')), ''),
    NULLIF(left(btrim(COALESCE(p_user_agent, '')), 240), ''),
    enroll_exp,
    'device'
  )
  RETURNING id INTO e_id;

  UPDATE public.ssp_site_activation_codes
  SET status = 'redeemed',
      redeemed_at = now_ts,
      enrollment_id = e_id
  WHERE id = c.id AND status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SSP_CONSUME_RACE'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'enrollment_id', e_id,
    'code_id', c.id,
    'workspace_id', c.workspace_id,
    'company_pk', c.company_pk,
    'site_pk', c.site_pk
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ssp_consume_activation_code(text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ssp_consume_activation_code(text, text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.ssp_request_site_user_join(
  p_code_hash text,
  p_user_id uuid,
  p_user_agent text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  c public.ssp_site_activation_codes%ROWTYPE;
  e_id uuid;
  now_ts timestamptz := now();
  enroll_exp timestamptz := now() + interval '30 minutes';
  role_key text;
BEGIN
  IF p_code_hash IS NULL OR char_length(p_code_hash) <> 64 OR p_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  SELECT * INTO c
  FROM public.ssp_site_activation_codes
  WHERE code_hash = p_code_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  IF COALESCE(c.audience, 'device') <> 'user' THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  IF c.status <> 'active' OR c.expires_at <= now_ts THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.ssp_site_members m
    WHERE m.site_pk = c.site_pk AND m.user_id = p_user_id
  ) THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.ssp_site_enrollments e
    WHERE e.site_pk = c.site_pk
      AND e.requested_user_id = p_user_id
      AND e.status = 'pending'
  ) THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  role_key := COALESCE(c.invited_role, 'patrol_officer');
  IF role_key NOT IN ('patrol_officer', 'patrol_manager') THEN
    role_key := 'patrol_officer';
  END IF;

  INSERT INTO public.ssp_site_enrollments (
    workspace_id, company_pk, site_pk, code_id, poll_token_hash, status,
    user_agent, expires_at, audience, requested_user_id, invited_role
  ) VALUES (
    c.workspace_id, c.company_pk, c.site_pk, c.id,
    encode(sha256((p_user_id::text || now_ts::text)::bytea), 'hex'),
    'pending',
    NULLIF(left(btrim(COALESCE(p_user_agent, '')), 240), ''),
    enroll_exp,
    'user',
    p_user_id,
    role_key
  )
  RETURNING id INTO e_id;

  UPDATE public.ssp_site_activation_codes
  SET status = 'redeemed',
      redeemed_at = now_ts,
      enrollment_id = e_id
  WHERE id = c.id AND status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SSP_USER_JOIN_RACE'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'enrollment_id', e_id,
    'code_id', c.id,
    'workspace_id', c.workspace_id,
    'company_pk', c.company_pk,
    'site_pk', c.site_pk
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ssp_request_site_user_join(text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ssp_request_site_user_join(text, uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.ssp_approve_site_user_join(
  p_enrollment_id uuid,
  p_decided_by uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  e public.ssp_site_enrollments%ROWTYPE;
  now_ts timestamptz := now();
  site_active boolean;
  code_status text;
  role_key text;
BEGIN
  IF p_enrollment_id IS NULL OR p_decided_by IS NULL THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  SELECT * INTO e
  FROM public.ssp_site_enrollments
  WHERE id = p_enrollment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  IF COALESCE(e.audience, 'device') <> 'user' OR e.requested_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  IF e.status <> 'pending' OR e.expires_at <= now_ts THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  SELECT s.is_active INTO site_active
  FROM public.ssp_sites s
  WHERE s.id = e.site_pk
  FOR UPDATE;

  IF NOT COALESCE(site_active, false) THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  SELECT c.status INTO code_status
  FROM public.ssp_site_activation_codes c
  WHERE c.id = e.code_id
  FOR UPDATE;

  IF code_status IS NULL OR code_status NOT IN ('redeemed', 'active') THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  INSERT INTO public.ssp_site_members (workspace_id, site_pk, user_id)
  VALUES (e.workspace_id, e.site_pk, e.requested_user_id)
  ON CONFLICT (site_pk, user_id) DO NOTHING;

  role_key := COALESCE(e.invited_role, 'patrol_officer');
  IF role_key NOT IN ('patrol_officer', 'patrol_manager') THEN
    role_key := 'patrol_officer';
  END IF;

  INSERT INTO public.ssp_memberships (
    workspace_id, company_pk, user_id, product_role, status, created_by
  ) VALUES (
    e.workspace_id, e.company_pk, e.requested_user_id, role_key, 'active', p_decided_by
  )
  ON CONFLICT (company_pk, user_id) DO NOTHING;

  UPDATE public.ssp_site_enrollments
  SET status = 'approved',
      decided_at = now_ts,
      decided_by = p_decided_by
  WHERE id = e.id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SSP_USER_APPROVE_RACE'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'enrollment_id', e.id,
    'user_id', e.requested_user_id,
    'workspace_id', e.workspace_id,
    'company_pk', e.company_pk,
    'site_pk', e.site_pk
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ssp_approve_site_user_join(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ssp_approve_site_user_join(uuid, uuid) TO service_role;
