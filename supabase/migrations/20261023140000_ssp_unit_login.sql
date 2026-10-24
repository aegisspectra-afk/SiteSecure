-- SSP rotating unit-login codes + operational unit sessions.
-- Local only. Do not apply to Cloud / Staging / Production.
-- Plaintext is never granted to authenticated JWT. Redeem uses SHA-256 hash.
-- Writes are service_role (or SECURITY DEFINER RPCs) only.

-- ── Rotating one-time unit codes (10 minute TTL, issued by managers) ─────────

CREATE TABLE IF NOT EXISTS public.ssp_unit_login_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  company_pk uuid NOT NULL REFERENCES public.ssp_companies (id) ON DELETE CASCADE,
  site_pk uuid NOT NULL REFERENCES public.ssp_sites (id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  display_code text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'redeemed', 'expired', 'revoked', 'superseded')),
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  redeemed_at timestamptz,
  revoked_at timestamptz,
  CONSTRAINT ssp_unit_login_codes_hash_uid UNIQUE (code_hash),
  CONSTRAINT ssp_unit_login_codes_hash_len CHECK (char_length(code_hash) = 64),
  CONSTRAINT ssp_unit_login_codes_display_len CHECK (
    display_code IS NULL OR char_length(display_code) BETWEEN 8 AND 16
  )
);

CREATE INDEX IF NOT EXISTS ssp_unit_login_codes_site_idx
  ON public.ssp_unit_login_codes (workspace_id, site_pk, status, expires_at);

CREATE UNIQUE INDEX IF NOT EXISTS ssp_unit_login_codes_one_active_uid
  ON public.ssp_unit_login_codes (site_pk)
  WHERE status = 'active';

ALTER TABLE public.ssp_unit_login_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ssp_unit_login_codes FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ssp_unit_login_codes_select ON public.ssp_unit_login_codes;
CREATE POLICY ssp_unit_login_codes_select ON public.ssp_unit_login_codes
  FOR SELECT TO authenticated
  USING (public.auth_is_member(workspace_id));

DROP POLICY IF EXISTS ssp_unit_login_codes_write ON public.ssp_unit_login_codes;

REVOKE ALL ON TABLE public.ssp_unit_login_codes FROM PUBLIC, anon, authenticated;
GRANT SELECT (
  id, workspace_id, company_pk, site_pk, status, created_by, created_at,
  expires_at, redeemed_at, revoked_at
) ON TABLE public.ssp_unit_login_codes TO authenticated;
GRANT ALL ON TABLE public.ssp_unit_login_codes TO service_role;

COMMENT ON TABLE public.ssp_unit_login_codes IS
  'Rotating SSP unit login codes. Hash used for redeem; display_code is service_role-only and cleared on consume.';

-- ── Operational unit sessions (not a user JWT; hash only) ────────────────────

CREATE TABLE IF NOT EXISTS public.ssp_unit_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  company_pk uuid NOT NULL REFERENCES public.ssp_companies (id) ON DELETE CASCADE,
  site_pk uuid NOT NULL REFERENCES public.ssp_sites (id) ON DELETE CASCADE,
  code_id uuid NOT NULL REFERENCES public.ssp_unit_login_codes (id) ON DELETE RESTRICT,
  token_hash text NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'revoked', 'expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  last_seen_at timestamptz,
  CONSTRAINT ssp_unit_sessions_token_uid UNIQUE (token_hash),
  CONSTRAINT ssp_unit_sessions_token_len CHECK (char_length(token_hash) = 64),
  CONSTRAINT ssp_unit_sessions_code_uid UNIQUE (code_id)
);

CREATE INDEX IF NOT EXISTS ssp_unit_sessions_site_idx
  ON public.ssp_unit_sessions (workspace_id, site_pk, status, expires_at);

ALTER TABLE public.ssp_unit_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ssp_unit_sessions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ssp_unit_sessions_select ON public.ssp_unit_sessions;
CREATE POLICY ssp_unit_sessions_select ON public.ssp_unit_sessions
  FOR SELECT TO authenticated
  USING (public.auth_is_member(workspace_id));

DROP POLICY IF EXISTS ssp_unit_sessions_write ON public.ssp_unit_sessions;

REVOKE ALL ON TABLE public.ssp_unit_sessions FROM PUBLIC, anon, authenticated;
GRANT SELECT (
  id, workspace_id, company_pk, site_pk, code_id, status, created_at,
  expires_at, revoked_at, last_seen_at
) ON TABLE public.ssp_unit_sessions TO authenticated;
GRANT ALL ON TABLE public.ssp_unit_sessions TO service_role;

COMMENT ON TABLE public.ssp_unit_sessions IS
  'Limited SSP unit operational sessions. Hash only; FastAPI validates every request. Not a GoTrue JWT.';

ALTER TABLE public.ssp_form_submissions
  ADD COLUMN IF NOT EXISTS unit_session_id uuid REFERENCES public.ssp_unit_sessions (id) ON DELETE SET NULL;

-- ── Atomic redeem: one session per live code, even under concurrency ─────────

CREATE OR REPLACE FUNCTION public.ssp_redeem_unit_login_code(
  p_code_hash text,
  p_token_hash text,
  p_session_expires_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  c public.ssp_unit_login_codes%ROWTYPE;
  s_id uuid;
  now_ts timestamptz := now();
  site_active boolean;
BEGIN
  IF p_code_hash IS NULL OR char_length(p_code_hash) <> 64 THEN
    RETURN jsonb_build_object('ok', false);
  END IF;
  IF p_token_hash IS NULL OR char_length(p_token_hash) <> 64 THEN
    RETURN jsonb_build_object('ok', false);
  END IF;
  IF p_session_expires_at IS NULL OR p_session_expires_at <= now_ts THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  SELECT * INTO c
  FROM public.ssp_unit_login_codes
  WHERE code_hash = p_code_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  IF c.status <> 'active' OR c.expires_at <= now_ts THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  SELECT is_active INTO site_active
  FROM public.ssp_sites
  WHERE id = c.site_pk AND workspace_id = c.workspace_id
  FOR UPDATE;

  IF NOT COALESCE(site_active, false) THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  INSERT INTO public.ssp_unit_sessions (
    workspace_id, company_pk, site_pk, code_id, token_hash, status, expires_at, last_seen_at
  ) VALUES (
    c.workspace_id, c.company_pk, c.site_pk, c.id, p_token_hash, 'active',
    p_session_expires_at, now_ts
  )
  RETURNING id INTO s_id;

  UPDATE public.ssp_unit_login_codes
  SET status = 'redeemed',
      redeemed_at = now_ts,
      display_code = NULL
  WHERE id = c.id AND status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SSP_UNIT_REDEEM_RACE'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'session_id', s_id,
    'code_id', c.id,
    'workspace_id', c.workspace_id,
    'company_pk', c.company_pk,
    'site_pk', c.site_pk,
    'expires_at', p_session_expires_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ssp_redeem_unit_login_code(text, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ssp_redeem_unit_login_code(text, text, timestamptz) TO service_role;

COMMENT ON FUNCTION public.ssp_redeem_unit_login_code(text, text, timestamptz) IS
  'Atomically consumes an active unused SSP unit login code into one operational session. Invoker must be service_role. Failure shape is uniform {ok:false}.';
