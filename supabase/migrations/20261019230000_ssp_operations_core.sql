-- SSP Operations Core — patrols, checkpoints, scans, events, form distributions.
-- Single product: SSP (not a separate patrol app). Depends on ssp_organization_core.
-- Local migration file only — do not apply to Staging/Production from agent runs.

-- ── Checkpoints (QR / barcode points) ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ssp_checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  company_pk uuid NOT NULL REFERENCES public.ssp_companies (id) ON DELETE CASCADE,
  org_unit_id uuid REFERENCES public.ssp_org_units (id) ON DELETE SET NULL,
  department_id uuid REFERENCES public.ssp_departments (id) ON DELETE SET NULL,
  -- Public immutable scan code (crypto-random); not sequential.
  code text NOT NULL,
  name text NOT NULL,
  location_label text,
  code_format text NOT NULL DEFAULT 'qr' CHECK (code_format IN ('qr', 'barcode', 'both')),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ssp_checkpoints_code_uid UNIQUE (company_pk, code),
  CONSTRAINT ssp_checkpoints_code_format CHECK (code ~ '^cp_[a-f0-9]{24}$'),
  CONSTRAINT ssp_checkpoints_name_len CHECK (char_length(name) BETWEEN 1 AND 200)
);

CREATE INDEX IF NOT EXISTS ssp_checkpoints_ws_idx
  ON public.ssp_checkpoints (workspace_id, company_pk, is_active);

CREATE TRIGGER ssp_checkpoints_set_updated_at
  BEFORE UPDATE ON public.ssp_checkpoints
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.ssp_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ssp_checkpoints FORCE ROW LEVEL SECURITY;

CREATE POLICY ssp_checkpoints_select ON public.ssp_checkpoints
  FOR SELECT TO authenticated
  USING (public.auth_is_member(workspace_id));

CREATE POLICY ssp_checkpoints_write ON public.ssp_checkpoints
  FOR ALL TO authenticated
  USING (public.auth_is_member(workspace_id))
  WITH CHECK (public.auth_is_member(workspace_id));

REVOKE ALL ON TABLE public.ssp_checkpoints FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ssp_checkpoints TO authenticated;
GRANT ALL ON TABLE public.ssp_checkpoints TO service_role;

-- ── Patrol definitions ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ssp_patrols (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  company_pk uuid NOT NULL REFERENCES public.ssp_companies (id) ON DELETE CASCADE,
  org_unit_id uuid REFERENCES public.ssp_org_units (id) ON DELETE SET NULL,
  department_id uuid REFERENCES public.ssp_departments (id) ON DELETE SET NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'archived')),
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ssp_patrols_name_len CHECK (char_length(name) BETWEEN 1 AND 200)
);

CREATE INDEX IF NOT EXISTS ssp_patrols_ws_idx
  ON public.ssp_patrols (workspace_id, company_pk, status);

CREATE TRIGGER ssp_patrols_set_updated_at
  BEFORE UPDATE ON public.ssp_patrols
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.ssp_patrols ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ssp_patrols FORCE ROW LEVEL SECURITY;

CREATE POLICY ssp_patrols_select ON public.ssp_patrols
  FOR SELECT TO authenticated
  USING (public.auth_is_member(workspace_id));

CREATE POLICY ssp_patrols_write ON public.ssp_patrols
  FOR ALL TO authenticated
  USING (public.auth_is_member(workspace_id))
  WITH CHECK (public.auth_is_member(workspace_id));

REVOKE ALL ON TABLE public.ssp_patrols FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ssp_patrols TO authenticated;
GRANT ALL ON TABLE public.ssp_patrols TO service_role;

-- Ordered stops on a patrol route
CREATE TABLE IF NOT EXISTS public.ssp_patrol_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  patrol_id uuid NOT NULL REFERENCES public.ssp_patrols (id) ON DELETE CASCADE,
  checkpoint_id uuid NOT NULL REFERENCES public.ssp_checkpoints (id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  is_required boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ssp_patrol_stops_unique UNIQUE (patrol_id, checkpoint_id)
);

CREATE INDEX IF NOT EXISTS ssp_patrol_stops_patrol_idx
  ON public.ssp_patrol_stops (workspace_id, patrol_id, sort_order);

ALTER TABLE public.ssp_patrol_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ssp_patrol_stops FORCE ROW LEVEL SECURITY;

CREATE POLICY ssp_patrol_stops_select ON public.ssp_patrol_stops
  FOR SELECT TO authenticated
  USING (public.auth_is_member(workspace_id));

CREATE POLICY ssp_patrol_stops_write ON public.ssp_patrol_stops
  FOR ALL TO authenticated
  USING (public.auth_is_member(workspace_id))
  WITH CHECK (public.auth_is_member(workspace_id));

REVOKE ALL ON TABLE public.ssp_patrol_stops FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ssp_patrol_stops TO authenticated;
GRANT ALL ON TABLE public.ssp_patrol_stops TO service_role;

-- Scheduled / live patrol runs
CREATE TABLE IF NOT EXISTS public.ssp_patrol_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  company_pk uuid NOT NULL REFERENCES public.ssp_companies (id) ON DELETE CASCADE,
  patrol_id uuid NOT NULL REFERENCES public.ssp_patrols (id) ON DELETE CASCADE,
  department_id uuid REFERENCES public.ssp_departments (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'active', 'completed', 'late', 'cancelled')),
  planned_start_at timestamptz,
  planned_end_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ssp_patrol_runs_ws_idx
  ON public.ssp_patrol_runs (workspace_id, company_pk, status, planned_start_at);

CREATE TRIGGER ssp_patrol_runs_set_updated_at
  BEFORE UPDATE ON public.ssp_patrol_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.ssp_patrol_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ssp_patrol_runs FORCE ROW LEVEL SECURITY;

CREATE POLICY ssp_patrol_runs_select ON public.ssp_patrol_runs
  FOR SELECT TO authenticated
  USING (public.auth_is_member(workspace_id));

CREATE POLICY ssp_patrol_runs_write ON public.ssp_patrol_runs
  FOR ALL TO authenticated
  USING (public.auth_is_member(workspace_id))
  WITH CHECK (public.auth_is_member(workspace_id));

REVOKE ALL ON TABLE public.ssp_patrol_runs FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ssp_patrol_runs TO authenticated;
GRANT ALL ON TABLE public.ssp_patrol_runs TO service_role;

CREATE TABLE IF NOT EXISTS public.ssp_patrol_run_assignees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES public.ssp_patrol_runs (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ssp_patrol_run_assignees_uid UNIQUE (run_id, user_id)
);

CREATE INDEX IF NOT EXISTS ssp_patrol_run_assignees_user_idx
  ON public.ssp_patrol_run_assignees (workspace_id, user_id);

ALTER TABLE public.ssp_patrol_run_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ssp_patrol_run_assignees FORCE ROW LEVEL SECURITY;

CREATE POLICY ssp_patrol_run_assignees_select ON public.ssp_patrol_run_assignees
  FOR SELECT TO authenticated
  USING (public.auth_is_member(workspace_id));

CREATE POLICY ssp_patrol_run_assignees_write ON public.ssp_patrol_run_assignees
  FOR ALL TO authenticated
  USING (public.auth_is_member(workspace_id))
  WITH CHECK (public.auth_is_member(workspace_id));

REVOKE ALL ON TABLE public.ssp_patrol_run_assignees FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ssp_patrol_run_assignees TO authenticated;
GRANT ALL ON TABLE public.ssp_patrol_run_assignees TO service_role;

-- Checkpoint scans
CREATE TABLE IF NOT EXISTS public.ssp_checkpoint_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  company_pk uuid NOT NULL REFERENCES public.ssp_companies (id) ON DELETE CASCADE,
  checkpoint_id uuid NOT NULL REFERENCES public.ssp_checkpoints (id) ON DELETE CASCADE,
  run_id uuid REFERENCES public.ssp_patrol_runs (id) ON DELETE SET NULL,
  scanned_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  result text NOT NULL DEFAULT 'ok'
    CHECK (result IN ('ok', 'duplicate', 'out_of_route', 'unauthorized', 'error')),
  scanned_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ssp_checkpoint_scans_ws_idx
  ON public.ssp_checkpoint_scans (workspace_id, company_pk, scanned_at DESC);
CREATE INDEX IF NOT EXISTS ssp_checkpoint_scans_cp_idx
  ON public.ssp_checkpoint_scans (checkpoint_id, scanned_at DESC);

ALTER TABLE public.ssp_checkpoint_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ssp_checkpoint_scans FORCE ROW LEVEL SECURITY;

CREATE POLICY ssp_checkpoint_scans_select ON public.ssp_checkpoint_scans
  FOR SELECT TO authenticated
  USING (public.auth_is_member(workspace_id));

CREATE POLICY ssp_checkpoint_scans_insert ON public.ssp_checkpoint_scans
  FOR INSERT TO authenticated
  WITH CHECK (public.auth_is_member(workspace_id));

REVOKE ALL ON TABLE public.ssp_checkpoint_scans FROM PUBLIC, anon;
GRANT SELECT, INSERT ON TABLE public.ssp_checkpoint_scans TO authenticated;
GRANT ALL ON TABLE public.ssp_checkpoint_scans TO service_role;

-- Events / exceptions
CREATE TABLE IF NOT EXISTS public.ssp_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  company_pk uuid NOT NULL REFERENCES public.ssp_companies (id) ON DELETE CASCADE,
  org_unit_id uuid REFERENCES public.ssp_org_units (id) ON DELETE SET NULL,
  department_id uuid REFERENCES public.ssp_departments (id) ON DELETE SET NULL,
  run_id uuid REFERENCES public.ssp_patrol_runs (id) ON DELETE SET NULL,
  checkpoint_id uuid REFERENCES public.ssp_checkpoints (id) ON DELETE SET NULL,
  reported_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  assignee_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'general'
    CHECK (category IN ('general', 'security', 'safety', 'maintenance', 'other')),
  severity text NOT NULL DEFAULT 'medium'
    CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  occurred_at timestamptz,
  location_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ssp_events_title_len CHECK (char_length(title) BETWEEN 1 AND 200)
);

CREATE INDEX IF NOT EXISTS ssp_events_ws_idx
  ON public.ssp_events (workspace_id, company_pk, status, severity);

CREATE TRIGGER ssp_events_set_updated_at
  BEFORE UPDATE ON public.ssp_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.ssp_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ssp_events FORCE ROW LEVEL SECURITY;

CREATE POLICY ssp_events_select ON public.ssp_events
  FOR SELECT TO authenticated
  USING (public.auth_is_member(workspace_id));

CREATE POLICY ssp_events_write ON public.ssp_events
  FOR ALL TO authenticated
  USING (public.auth_is_member(workspace_id))
  WITH CHECK (public.auth_is_member(workspace_id));

REVOKE ALL ON TABLE public.ssp_events FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ssp_events TO authenticated;
GRANT ALL ON TABLE public.ssp_events TO service_role;

-- Form distributions (authenticated recipients — complements public assignments)
CREATE TABLE IF NOT EXISTS public.ssp_form_distributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  company_pk uuid NOT NULL REFERENCES public.ssp_companies (id) ON DELETE CASCADE,
  form_id uuid NOT NULL REFERENCES public.ssp_forms (id) ON DELETE CASCADE,
  department_id uuid REFERENCES public.ssp_departments (id) ON DELETE SET NULL,
  org_unit_id uuid REFERENCES public.ssp_org_units (id) ON DELETE SET NULL,
  run_id uuid REFERENCES public.ssp_patrol_runs (id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT '',
  due_at timestamptz,
  require_completion boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'closed', 'cancelled')),
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ssp_form_distributions_ws_idx
  ON public.ssp_form_distributions (workspace_id, company_pk, status);

CREATE TRIGGER ssp_form_distributions_set_updated_at
  BEFORE UPDATE ON public.ssp_form_distributions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.ssp_form_distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ssp_form_distributions FORCE ROW LEVEL SECURITY;

CREATE POLICY ssp_form_distributions_select ON public.ssp_form_distributions
  FOR SELECT TO authenticated
  USING (public.auth_is_member(workspace_id));

CREATE POLICY ssp_form_distributions_write ON public.ssp_form_distributions
  FOR ALL TO authenticated
  USING (public.auth_is_member(workspace_id))
  WITH CHECK (public.auth_is_member(workspace_id));

REVOKE ALL ON TABLE public.ssp_form_distributions FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ssp_form_distributions TO authenticated;
GRANT ALL ON TABLE public.ssp_form_distributions TO service_role;

CREATE TABLE IF NOT EXISTS public.ssp_form_distribution_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  distribution_id uuid NOT NULL REFERENCES public.ssp_form_distributions (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'submitted', 'waived')),
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ssp_form_distribution_targets_uid UNIQUE (distribution_id, user_id)
);

CREATE INDEX IF NOT EXISTS ssp_form_distribution_targets_user_idx
  ON public.ssp_form_distribution_targets (workspace_id, user_id, status);

ALTER TABLE public.ssp_form_distribution_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ssp_form_distribution_targets FORCE ROW LEVEL SECURITY;

CREATE POLICY ssp_form_distribution_targets_select ON public.ssp_form_distribution_targets
  FOR SELECT TO authenticated
  USING (
    public.auth_is_member(workspace_id)
    AND (
      user_id = auth.uid()
      OR public.auth_is_managerial(workspace_id)
      OR EXISTS (
        SELECT 1 FROM public.ssp_memberships me
        WHERE me.user_id = auth.uid()
          AND me.workspace_id = ssp_form_distribution_targets.workspace_id
          AND me.status = 'active'
          AND me.product_role IN ('org_admin', 'patrol_manager')
      )
    )
  );

CREATE POLICY ssp_form_distribution_targets_write ON public.ssp_form_distribution_targets
  FOR ALL TO authenticated
  USING (public.auth_is_member(workspace_id))
  WITH CHECK (public.auth_is_member(workspace_id));

REVOKE ALL ON TABLE public.ssp_form_distribution_targets FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ssp_form_distribution_targets TO authenticated;
GRANT ALL ON TABLE public.ssp_form_distribution_targets TO service_role;
