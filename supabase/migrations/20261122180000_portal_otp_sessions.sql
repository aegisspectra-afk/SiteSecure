-- OTP challenges and bearer sessions for customer portal (service-role only).

CREATE TABLE public.portal_otp_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_normalized text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 5,
  consumed_at timestamptz,
  request_ip inet,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX portal_otp_challenges_phone_idx
  ON public.portal_otp_challenges (phone_normalized, created_at DESC);

CREATE INDEX portal_otp_challenges_active_idx
  ON public.portal_otp_challenges (phone_normalized, expires_at DESC)
  WHERE consumed_at IS NULL;

CREATE TABLE public.portal_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  phone_normalized text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX portal_sessions_phone_idx ON public.portal_sessions (phone_normalized);

CREATE TABLE public.portal_session_grants (
  session_id uuid NOT NULL REFERENCES public.portal_sessions (id) ON DELETE CASCADE,
  access_id uuid NOT NULL REFERENCES public.customer_portal_access (id) ON DELETE CASCADE,
  PRIMARY KEY (session_id, access_id)
);

CREATE INDEX portal_session_grants_access_idx ON public.portal_session_grants (access_id);

ALTER TABLE public.portal_otp_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_otp_challenges FORCE ROW LEVEL SECURITY;
ALTER TABLE public.portal_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.portal_session_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_session_grants FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.portal_otp_challenges FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.portal_sessions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.portal_session_grants FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.portal_otp_challenges TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.portal_sessions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.portal_session_grants TO service_role;