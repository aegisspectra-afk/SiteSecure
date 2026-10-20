-- SSP site activation codes, enrollment requests, linked devices, device sessions.
-- Local only. Do not apply to Cloud / Staging / Production.
-- Activation code plaintext is never stored; only SHA-256 hash.
-- Writes are service_role (or SECURITY DEFINER RPCs) only. Authenticated JWT
-- may SELECT non-secret columns; it cannot mint codes, enrollments, devices, or sessions.

ALTER TABLE public.ssp_sites
  ADD COLUMN IF NOT EXISTS admin_notes text;

ALTER TABLE public.ssp_sites
  DROP CONSTRAINT IF EXISTS ssp_sites_admin_notes_len;

ALTER TABLE public.ssp_sites
  ADD CONSTRAINT ssp_sites_admin_notes_len
  CHECK (admin_notes IS NULL OR char_length(admin_notes) <= 2000);

-- ── One-time activation codes ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ssp_site_activation_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  company_pk uuid NOT NULL REFERENCES public.ssp_companies (id) ON DELETE CASCADE,
  site_pk uuid NOT NULL REFERENCES public.ssp_sites (id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'redeemed', 'expired', 'revoked')),
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  redeemed_at timestamptz,
  revoked_at timestamptz,
  enrollment_id uuid,
  CONSTRAINT ssp_site_activation_codes_hash_uid UNIQUE (code_hash),
  CONSTRAINT ssp_site_activation_codes_hash_len CHECK (char_length(code_hash) = 64)
);

CREATE INDEX IF NOT EXISTS ssp_site_activation_codes_site_idx
  ON public.ssp_site_activation_codes (workspace_id, site_pk, status, expires_at);

ALTER TABLE public.ssp_site_activation_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ssp_site_activation_codes FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ssp_site_activation_codes_select ON public.ssp_site_activation_codes;
CREATE POLICY ssp_site_activation_codes_select ON public.ssp_site_activation_codes
  FOR SELECT TO authenticated
  USING (public.auth_is_member(workspace_id));

DROP POLICY IF EXISTS ssp_site_activation_codes_write ON public.ssp_site_activation_codes;

REVOKE ALL ON TABLE public.ssp_site_activation_codes FROM PUBLIC, anon, authenticated;
GRANT SELECT (
  id, workspace_id, company_pk, site_pk, status, created_by, created_at,
  expires_at, redeemed_at, revoked_at, enrollment_id
) ON TABLE public.ssp_site_activation_codes TO authenticated;
GRANT ALL ON TABLE public.ssp_site_activation_codes TO service_role;

COMMENT ON TABLE public.ssp_site_activation_codes IS
  'One-time SSP site activation codes. Stores hash only; plaintext shown once at issue time. Writes are service_role/RPC only.';

-- ── Enrollment requests ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ssp_site_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  company_pk uuid NOT NULL REFERENCES public.ssp_companies (id) ON DELETE CASCADE,
  site_pk uuid NOT NULL REFERENCES public.ssp_sites (id) ON DELETE CASCADE,
  code_id uuid NOT NULL REFERENCES public.ssp_site_activation_codes (id) ON DELETE RESTRICT,
  poll_token_hash text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'denied', 'cancelled', 'expired')),
  device_label text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  decided_at timestamptz,
  decided_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  device_id uuid,
  CONSTRAINT ssp_site_enrollments_poll_uid UNIQUE (poll_token_hash),
  CONSTRAINT ssp_site_enrollments_poll_len CHECK (char_length(poll_token_hash) = 64),
  CONSTRAINT ssp_site_enrollments_label_len CHECK (device_label IS NULL OR char_length(device_label) <= 80),
  CONSTRAINT ssp_site_enrollments_ua_len CHECK (user_agent IS NULL OR char_length(user_agent) <= 240)
);

CREATE INDEX IF NOT EXISTS ssp_site_enrollments_site_idx
  ON public.ssp_site_enrollments (workspace_id, site_pk, status, created_at DESC);

ALTER TABLE public.ssp_site_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ssp_site_enrollments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ssp_site_enrollments_select ON public.ssp_site_enrollments;
CREATE POLICY ssp_site_enrollments_select ON public.ssp_site_enrollments
  FOR SELECT TO authenticated
  USING (public.auth_is_member(workspace_id));

DROP POLICY IF EXISTS ssp_site_enrollments_write ON public.ssp_site_enrollments;

REVOKE ALL ON TABLE public.ssp_site_enrollments FROM PUBLIC, anon, authenticated;
GRANT SELECT (
  id, workspace_id, company_pk, site_pk, code_id, status, device_label, user_agent,
  created_at, expires_at, decided_at, decided_by, device_id
) ON TABLE public.ssp_site_enrollments TO authenticated;
GRANT ALL ON TABLE public.ssp_site_enrollments TO service_role;

ALTER TABLE public.ssp_site_activation_codes
  DROP CONSTRAINT IF EXISTS ssp_site_activation_codes_enrollment_fk;

ALTER TABLE public.ssp_site_activation_codes
  ADD CONSTRAINT ssp_site_activation_codes_enrollment_fk
  FOREIGN KEY (enrollment_id) REFERENCES public.ssp_site_enrollments (id) ON DELETE SET NULL;

-- ── Linked devices ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ssp_site_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  company_pk uuid NOT NULL REFERENCES public.ssp_companies (id) ON DELETE CASCADE,
  site_pk uuid NOT NULL REFERENCES public.ssp_sites (id) ON DELETE CASCADE,
  enrollment_id uuid REFERENCES public.ssp_site_enrollments (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'revoked')),
  device_label text,
  approved_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  approved_at timestamptz,
  last_seen_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ssp_site_devices_label_len CHECK (device_label IS NULL OR char_length(device_label) <= 80)
);

CREATE INDEX IF NOT EXISTS ssp_site_devices_site_idx
  ON public.ssp_site_devices (workspace_id, site_pk, status);

CREATE UNIQUE INDEX IF NOT EXISTS ssp_site_devices_enrollment_uid
  ON public.ssp_site_devices (enrollment_id)
  WHERE enrollment_id IS NOT NULL;

ALTER TABLE public.ssp_site_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ssp_site_devices FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ssp_site_devices_select ON public.ssp_site_devices;
CREATE POLICY ssp_site_devices_select ON public.ssp_site_devices
  FOR SELECT TO authenticated
  USING (public.auth_is_member(workspace_id));

DROP POLICY IF EXISTS ssp_site_devices_write ON public.ssp_site_devices;

REVOKE ALL ON TABLE public.ssp_site_devices FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.ssp_site_devices TO authenticated;
GRANT ALL ON TABLE public.ssp_site_devices TO service_role;

ALTER TABLE public.ssp_site_enrollments
  DROP CONSTRAINT IF EXISTS ssp_site_enrollments_device_fk;

ALTER TABLE public.ssp_site_enrollments
  ADD CONSTRAINT ssp_site_enrollments_device_fk
  FOREIGN KEY (device_id) REFERENCES public.ssp_site_devices (id) ON DELETE SET NULL;

-- ── Device sessions (not a user JWT; hash only) ──────────────────────────────

CREATE TABLE IF NOT EXISTS public.ssp_site_device_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  company_pk uuid NOT NULL REFERENCES public.ssp_companies (id) ON DELETE CASCADE,
  site_pk uuid NOT NULL REFERENCES public.ssp_sites (id) ON DELETE CASCADE,
  device_id uuid NOT NULL REFERENCES public.ssp_site_devices (id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'revoked', 'expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  last_seen_at timestamptz,
  CONSTRAINT ssp_site_device_sessions_token_uid UNIQUE (token_hash),
  CONSTRAINT ssp_site_device_sessions_token_len CHECK (char_length(token_hash) = 64)
);

CREATE INDEX IF NOT EXISTS ssp_site_device_sessions_device_idx
  ON public.ssp_site_device_sessions (device_id, status, expires_at);

CREATE UNIQUE INDEX IF NOT EXISTS ssp_site_device_sessions_one_active_uid
  ON public.ssp_site_device_sessions (device_id)
  WHERE status = 'active';

ALTER TABLE public.ssp_site_device_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ssp_site_device_sessions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ssp_site_device_sessions_select ON public.ssp_site_device_sessions;
CREATE POLICY ssp_site_device_sessions_select ON public.ssp_site_device_sessions
  FOR SELECT TO authenticated
  USING (public.auth_is_member(workspace_id));

DROP POLICY IF EXISTS ssp_site_device_sessions_write ON public.ssp_site_device_sessions;

REVOKE ALL ON TABLE public.ssp_site_device_sessions FROM PUBLIC, anon, authenticated;
GRANT SELECT (
  id, workspace_id, company_pk, site_pk, device_id, status, created_at,
  expires_at, revoked_at, last_seen_at
) ON TABLE public.ssp_site_device_sessions TO authenticated;
GRANT ALL ON TABLE public.ssp_site_device_sessions TO service_role;

-- Submissions may attribute a device (person is not proven by the device).
ALTER TABLE public.ssp_form_submissions
  ADD COLUMN IF NOT EXISTS device_id uuid REFERENCES public.ssp_site_devices (id) ON DELETE SET NULL;

ALTER TABLE public.ssp_form_submissions
  ADD COLUMN IF NOT EXISTS device_session_id uuid REFERENCES public.ssp_site_device_sessions (id) ON DELETE SET NULL;

-- One anonymous/device submission per site assignment (once cadence). User submits
-- remain unique on (site_assignment_id, submitted_by) from 20261020120000.
CREATE UNIQUE INDEX IF NOT EXISTS ssp_submissions_site_assign_anon_uid
  ON public.ssp_form_submissions (site_assignment_id)
  WHERE site_assignment_id IS NOT NULL AND submitted_by IS NULL;

-- ── Atomic consume: one enrollment per live code, even under concurrency ─────

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

  IF c.status <> 'active' OR c.expires_at <= now_ts THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  INSERT INTO public.ssp_site_enrollments (
    workspace_id, company_pk, site_pk, code_id, poll_token_hash, status,
    device_label, user_agent, expires_at
  ) VALUES (
    c.workspace_id, c.company_pk, c.site_pk, c.id, p_poll_token_hash, 'pending',
    NULLIF(btrim(COALESCE(p_device_label, '')), ''),
    NULLIF(left(btrim(COALESCE(p_user_agent, '')), 240), ''),
    enroll_exp
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

COMMENT ON FUNCTION public.ssp_consume_activation_code(text, text, text, text) IS
  'Atomically redeems an active unused SSP activation code into a pending enrollment. Invoker must be service_role. Failure shape is uniform {ok:false}.';

-- ── Atomic approve: lock enrollment, insert device, mark approved ─────────────

CREATE OR REPLACE FUNCTION public.ssp_approve_site_enrollment(
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
  d_id uuid;
  now_ts timestamptz := now();
  site_active boolean;
  code_status text;
BEGIN
  IF p_enrollment_id IS NULL THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  SELECT * INTO e
  FROM public.ssp_site_enrollments
  WHERE id = p_enrollment_id
  FOR UPDATE;

  IF NOT FOUND THEN
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

  INSERT INTO public.ssp_site_devices (
    workspace_id, company_pk, site_pk, enrollment_id, status,
    device_label, approved_by, approved_at
  ) VALUES (
    e.workspace_id, e.company_pk, e.site_pk, e.id, 'active',
    e.device_label, p_decided_by, now_ts
  )
  RETURNING id INTO d_id;

  UPDATE public.ssp_site_enrollments
  SET status = 'approved',
      decided_at = now_ts,
      decided_by = p_decided_by,
      device_id = d_id
  WHERE id = e.id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SSP_APPROVE_RACE'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'enrollment_id', e.id,
    'device_id', d_id,
    'workspace_id', e.workspace_id,
    'company_pk', e.company_pk,
    'site_pk', e.site_pk
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ssp_approve_site_enrollment(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ssp_approve_site_enrollment(uuid, uuid) TO service_role;

COMMENT ON FUNCTION public.ssp_approve_site_enrollment(uuid, uuid) IS
  'Atomically approves a pending SSP enrollment and creates the site device. Invoker must be service_role. Does not check manager JWT; caller must authorize first.';
