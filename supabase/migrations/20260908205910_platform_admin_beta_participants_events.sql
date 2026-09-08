-- Platform Admin events + person-level Beta participants (metadata, not RBAC).
-- V1 Platform Admin authority remains profiles.is_platform_admin
--   (true ≡ platform_super_admin). Workspace roles never grant this.
-- Beta participant status MUST NOT mutate workspace_memberships.role_key.
-- Recognition badges remain profiles.recognition_badges (founding_technician).

COMMENT ON COLUMN public.profiles.is_platform_admin IS
  'SITE SECURE Platform Admin (V1 role: platform_super_admin). '
  'Independent of workspace RBAC and recognition badges. '
  'Mutations require service_role (trigger protect_platform_admin_flag). '
  'Bootstrap: apps/api/scripts/bootstrap_platform_admin.py — not email-seeded at runtime.';

-- ---------------------------------------------------------------------------
-- Platform Admin audit (cross-tenant; not customer content)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_admin_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  action text NOT NULL,
  target_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  target_workspace_id uuid REFERENCES public.workspaces (id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS platform_admin_events_created_at_idx
  ON public.platform_admin_events (created_at DESC);
CREATE INDEX IF NOT EXISTS platform_admin_events_actor_idx
  ON public.platform_admin_events (actor_user_id);
CREATE INDEX IF NOT EXISTS platform_admin_events_target_user_idx
  ON public.platform_admin_events (target_user_id)
  WHERE target_user_id IS NOT NULL;

ALTER TABLE public.platform_admin_events ENABLE ROW LEVEL SECURITY;

-- No authenticated policies: only service_role / API service client.
REVOKE ALL ON public.platform_admin_events FROM PUBLIC;
REVOKE ALL ON public.platform_admin_events FROM anon, authenticated;
GRANT SELECT, INSERT ON public.platform_admin_events TO service_role;

COMMENT ON TABLE public.platform_admin_events IS
  'Platform Admin write audit (beta/badge/org flags). Not a customer-data explorer.';

-- ---------------------------------------------------------------------------
-- Beta participants (person-level; independent of workspace role)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.beta_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  cohort text NOT NULL DEFAULT 'Founding Technicians — 2026',
  status text NOT NULL
    CHECK (status IN ('invited', 'registered', 'activated', 'active', 'paused', 'exited')),
  invited_at timestamptz,
  registered_at timestamptz,
  activated_at timestamptz,
  joined_at timestamptz,
  paused_at timestamptz,
  exited_at timestamptz,
  internal_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT beta_participants_user_workspace_uq UNIQUE (user_id, workspace_id)
);

CREATE INDEX IF NOT EXISTS beta_participants_status_idx
  ON public.beta_participants (status);
CREATE INDEX IF NOT EXISTS beta_participants_cohort_idx
  ON public.beta_participants (cohort);
CREATE INDEX IF NOT EXISTS beta_participants_workspace_idx
  ON public.beta_participants (workspace_id);

ALTER TABLE public.beta_participants ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.beta_participants FROM PUBLIC;
REVOKE ALL ON public.beta_participants FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.beta_participants TO service_role;

-- Authenticated users may read ONLY their own participation row (display / session).
CREATE POLICY beta_participants_select_own
  ON public.beta_participants
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT ON public.beta_participants TO authenticated;

COMMENT ON TABLE public.beta_participants IS
  'SITE SECURE Beta program participation. Metadata only — never grants workspace RBAC or Platform Admin.';

CREATE OR REPLACE FUNCTION public.beta_participants_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS beta_participants_set_updated_at ON public.beta_participants;
CREATE TRIGGER beta_participants_set_updated_at
  BEFORE UPDATE ON public.beta_participants
  FOR EACH ROW EXECUTE FUNCTION public.beta_participants_touch_updated_at();

-- Guard: status/cohort/note changes must not be writable by JWT users via PostgREST.
-- (service_role bypasses RLS; no INSERT/UPDATE/DELETE policies for authenticated.)
