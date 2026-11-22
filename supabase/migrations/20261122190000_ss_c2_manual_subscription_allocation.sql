-- C2 — manual subscription allocation (beta): admin override + immutable audit log.

CREATE TABLE IF NOT EXISTS public.subscription_allocation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  note text,
  before jsonb NOT NULL DEFAULT '{}'::jsonb,
  after jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subscription_allocation_log_workspace_idx
  ON public.subscription_allocation_log (workspace_id, created_at DESC);

ALTER TABLE public.subscription_allocation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_allocation_log FORCE ROW LEVEL SECURITY;

CREATE POLICY subscription_allocation_log_select_platform
  ON public.subscription_allocation_log
  FOR SELECT
  TO authenticated
  USING (public.auth_is_platform_admin());

REVOKE ALL ON TABLE public.subscription_allocation_log FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.subscription_allocation_log TO authenticated;
GRANT ALL ON TABLE public.subscription_allocation_log TO service_role;

COMMENT ON TABLE public.subscription_allocation_log IS
  'Immutable audit trail for platform-admin subscription allocation (plan, period end, note).';