-- D1 — landing beta CTA signups (platform marketing, not tenant leads).

CREATE TABLE IF NOT EXISTS public.marketing_beta_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  phone text NOT NULL,
  business_name text NOT NULL,
  technician_count text NOT NULL,
  trade_focus text NOT NULL,
  source text NOT NULL DEFAULT 'landing',
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'contacted', 'closed')),
  internal_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER marketing_beta_signups_set_updated_at
  BEFORE UPDATE ON public.marketing_beta_signups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS marketing_beta_signups_status_idx
  ON public.marketing_beta_signups (status, created_at DESC);

ALTER TABLE public.marketing_beta_signups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_beta_signups FORCE ROW LEVEL SECURITY;

CREATE POLICY marketing_beta_signups_admin_select
  ON public.marketing_beta_signups
  FOR SELECT
  TO authenticated
  USING (public.auth_is_platform_admin());

CREATE POLICY marketing_beta_signups_admin_update
  ON public.marketing_beta_signups
  FOR UPDATE
  TO authenticated
  USING (public.auth_is_platform_admin())
  WITH CHECK (public.auth_is_platform_admin());

REVOKE ALL ON TABLE public.marketing_beta_signups FROM PUBLIC, anon;
GRANT SELECT, UPDATE ON TABLE public.marketing_beta_signups TO authenticated;
GRANT ALL ON TABLE public.marketing_beta_signups TO service_role;

COMMENT ON TABLE public.marketing_beta_signups IS
  'Public marketing beta intake from landing — admin queue only (D1).';