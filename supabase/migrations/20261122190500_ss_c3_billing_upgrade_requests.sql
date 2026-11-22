-- C3 — beta upgrade intent (no checkout): workspace owner form → platform admin queue.

CREATE TABLE IF NOT EXISTS public.billing_upgrade_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  current_plan_key text NOT NULL,
  target_plan_key text,
  message text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'contacted', 'closed')),
  internal_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER billing_upgrade_requests_set_updated_at
  BEFORE UPDATE ON public.billing_upgrade_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS billing_upgrade_requests_workspace_idx
  ON public.billing_upgrade_requests (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS billing_upgrade_requests_status_idx
  ON public.billing_upgrade_requests (status, created_at DESC);

ALTER TABLE public.billing_upgrade_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_upgrade_requests FORCE ROW LEVEL SECURITY;

CREATE POLICY billing_upgrade_requests_select
  ON public.billing_upgrade_requests
  FOR SELECT
  TO authenticated
  USING (public.auth_is_platform_admin() OR user_id = auth.uid());

CREATE POLICY billing_upgrade_requests_insert
  ON public.billing_upgrade_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.auth_is_member(workspace_id)
  );

CREATE POLICY billing_upgrade_requests_update_platform
  ON public.billing_upgrade_requests
  FOR UPDATE
  TO authenticated
  USING (public.auth_is_platform_admin())
  WITH CHECK (public.auth_is_platform_admin());

REVOKE ALL ON TABLE public.billing_upgrade_requests FROM PUBLIC, anon;
GRANT SELECT, INSERT ON TABLE public.billing_upgrade_requests TO authenticated;
GRANT UPDATE ON TABLE public.billing_upgrade_requests TO authenticated;
GRANT ALL ON TABLE public.billing_upgrade_requests TO service_role;

COMMENT ON TABLE public.billing_upgrade_requests IS
  'Beta upgrade leads — honest intake until PayPlus checkout ships (C4 plan only).';