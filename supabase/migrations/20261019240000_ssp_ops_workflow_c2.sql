-- SSP C2 — event action history + distribution target/status refinements.
-- Local file only. Depends on 20261019230000_ssp_operations_core.sql.

-- Immutable event action log (no user UPDATE/DELETE)
CREATE TABLE IF NOT EXISTS public.ssp_event_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  company_pk uuid NOT NULL REFERENCES public.ssp_companies (id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.ssp_events (id) ON DELETE CASCADE,
  actor_user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  action_type text NOT NULL
    CHECK (action_type IN (
      'created', 'assigned', 'status_changed', 'severity_changed',
      'note_added', 'linked', 'closed'
    )),
  from_value text,
  to_value text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ssp_event_actions_event_idx
  ON public.ssp_event_actions (workspace_id, event_id, created_at DESC);

ALTER TABLE public.ssp_event_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ssp_event_actions FORCE ROW LEVEL SECURITY;

CREATE POLICY ssp_event_actions_select ON public.ssp_event_actions
  FOR SELECT TO authenticated
  USING (public.auth_is_member(workspace_id));

CREATE POLICY ssp_event_actions_insert ON public.ssp_event_actions
  FOR INSERT TO authenticated
  WITH CHECK (public.auth_is_member(workspace_id) AND actor_user_id = auth.uid());

REVOKE ALL ON TABLE public.ssp_event_actions FROM PUBLIC, anon;
GRANT SELECT, INSERT ON TABLE public.ssp_event_actions TO authenticated;
GRANT ALL ON TABLE public.ssp_event_actions TO service_role;

-- Snapshot published form version at distribution time (historical submissions stay on their version)
ALTER TABLE public.ssp_form_distributions
  ADD COLUMN IF NOT EXISTS form_version_id uuid REFERENCES public.ssp_form_versions (id) ON DELETE SET NULL;

-- Expand target statuses: pending | started | submitted | waived
ALTER TABLE public.ssp_form_distribution_targets
  DROP CONSTRAINT IF EXISTS ssp_form_distribution_targets_status_check;

ALTER TABLE public.ssp_form_distribution_targets
  ADD CONSTRAINT ssp_form_distribution_targets_status_check
  CHECK (status IN ('pending', 'started', 'submitted', 'waived'));

ALTER TABLE public.ssp_form_distribution_targets
  ADD COLUMN IF NOT EXISTS started_at timestamptz;
