-- Beta program, product feedback (all members), feature flags, platform admin.

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS is_beta boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS beta_enrolled_at timestamptz,
  ADD COLUMN IF NOT EXISTS beta_program text;

ALTER TABLE public.workspaces
  DROP CONSTRAINT IF EXISTS workspaces_beta_program_chk;

ALTER TABLE public.workspaces
  ADD CONSTRAINT workspaces_beta_program_chk
  CHECK (
    beta_program IS NULL OR beta_program IN ('early', 'private', 'public')
  );

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_platform_admin boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.auth_is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT p.is_platform_admin
      FROM public.profiles p
      WHERE p.id = auth.uid()
    ),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.auth_is_platform_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_is_platform_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.protect_platform_admin_flag()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.is_platform_admin IS DISTINCT FROM OLD.is_platform_admin THEN
    IF auth.role() IS DISTINCT FROM 'service_role' AND auth.uid() IS NOT NULL THEN
      RAISE EXCEPTION 'cannot change is_platform_admin';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_platform_admin ON public.profiles;
CREATE TRIGGER profiles_protect_platform_admin
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_platform_admin_flag();

CREATE OR REPLACE FUNCTION public.protect_workspace_beta_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (
    NEW.is_beta IS DISTINCT FROM OLD.is_beta
    OR NEW.beta_enrolled_at IS DISTINCT FROM OLD.beta_enrolled_at
    OR NEW.beta_program IS DISTINCT FROM OLD.beta_program
  ) THEN
    IF auth.role() IS DISTINCT FROM 'service_role' AND auth.uid() IS NOT NULL THEN
      RAISE EXCEPTION 'cannot change beta enrollment from a workspace session';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS workspaces_protect_beta ON public.workspaces;
CREATE TRIGGER workspaces_protect_beta
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.protect_workspace_beta_fields();

CREATE TABLE IF NOT EXISTS public.feedback_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id text NOT NULL UNIQUE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  report_type text NOT NULL CHECK (report_type IN ('bug', 'feature', 'general')),
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'blocker')),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'triage', 'in_progress', 'resolved', 'wont_fix')),
  title text NOT NULL,
  body text NOT NULL,
  page_url text,
  user_agent text,
  viewport text,
  role_key text,
  plan_key text,
  is_beta boolean NOT NULL DEFAULT false,
  screenshot_url text,
  internal_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS feedback_reports_set_updated_at ON public.feedback_reports;
CREATE TRIGGER feedback_reports_set_updated_at
  BEFORE UPDATE ON public.feedback_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS feedback_reports_workspace_idx
  ON public.feedback_reports (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS feedback_reports_status_idx
  ON public.feedback_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS feedback_reports_user_idx
  ON public.feedback_reports (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  enabled_for_beta boolean NOT NULL DEFAULT false,
  enabled_for_production boolean NOT NULL DEFAULT false,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS feature_flags_set_updated_at ON public.feature_flags;
CREATE TRIGGER feature_flags_set_updated_at
  BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.feedback_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_reports FORCE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS feedback_select_own_or_platform ON public.feedback_reports;
CREATE POLICY feedback_select_own_or_platform
  ON public.feedback_reports
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.auth_is_platform_admin());

DROP POLICY IF EXISTS feedback_insert_member ON public.feedback_reports;
CREATE POLICY feedback_insert_member
  ON public.feedback_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.auth_is_member(workspace_id)
  );

DROP POLICY IF EXISTS feedback_update_platform ON public.feedback_reports;
CREATE POLICY feedback_update_platform
  ON public.feedback_reports
  FOR UPDATE
  TO authenticated
  USING (public.auth_is_platform_admin())
  WITH CHECK (public.auth_is_platform_admin());

DROP POLICY IF EXISTS feature_flags_select_authenticated ON public.feature_flags;
CREATE POLICY feature_flags_select_authenticated
  ON public.feature_flags
  FOR SELECT
  TO authenticated
  USING (true);

GRANT SELECT, INSERT ON public.feedback_reports TO authenticated;
GRANT UPDATE ON public.feedback_reports TO authenticated;
GRANT SELECT ON public.feature_flags TO authenticated;

INSERT INTO public.feature_flags (name, enabled_for_beta, enabled_for_production, description)
VALUES
  ('ops_insights', true, false, 'Operational insights preview for beta workspaces'),
  ('feedback_center', true, true, 'In-app feedback intake for every workspace member')
ON CONFLICT (name) DO NOTHING;

UPDATE public.profiles
SET is_platform_admin = true
WHERE email = 'aegisspectra@gmail.com'
  AND is_platform_admin IS DISTINCT FROM true;

COMMENT ON COLUMN public.workspaces.is_beta IS 'Workspace enrolled in the SITE SECURE beta program.';
COMMENT ON COLUMN public.profiles.is_platform_admin IS 'Platform operator. Not a workspace RBAC role.';
COMMENT ON TABLE public.feedback_reports IS 'Product feedback from any authenticated workspace member.';
