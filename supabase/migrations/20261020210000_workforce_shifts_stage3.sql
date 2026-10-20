-- Workforce Stage 3: manual weekly shifts.
-- Minimal new table. Does not duplicate CRM public.sites or SSP ssp_sites.
-- Does not reopen authenticated writes on workforce_employees / workforce_memberships.
-- Additive. Do not apply on production without explicit approval.

CREATE TABLE IF NOT EXISTS public.workforce_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.workforce_employees (id) ON DELETE RESTRICT,
  site_id uuid NOT NULL REFERENCES public.workforce_sites (id) ON DELETE RESTRICT,
  region_id uuid REFERENCES public.workforce_regions (id) ON DELETE SET NULL,
  position_id uuid REFERENCES public.workforce_positions (id) ON DELETE SET NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  notes text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workforce_shifts_range_chk CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS workforce_shifts_workspace_range_idx
  ON public.workforce_shifts (workspace_id, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS workforce_shifts_employee_idx
  ON public.workforce_shifts (workspace_id, employee_id, starts_at);
CREATE INDEX IF NOT EXISTS workforce_shifts_site_idx
  ON public.workforce_shifts (workspace_id, site_id, starts_at);

COMMENT ON TABLE public.workforce_shifts IS
  'Manual Workforce Intelligence shifts. No publish/optimizer/AI. Tenant = workspaces.id.';

DROP TRIGGER IF EXISTS workforce_shifts_set_updated_at ON public.workforce_shifts;
CREATE TRIGGER workforce_shifts_set_updated_at
  BEFORE UPDATE ON public.workforce_shifts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS workforce_shifts_lock_workspace ON public.workforce_shifts;
CREATE TRIGGER workforce_shifts_lock_workspace
  BEFORE UPDATE ON public.workforce_shifts
  FOR EACH ROW EXECUTE FUNCTION public.workforce_lock_workspace_id();

ALTER TABLE public.workforce_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workforce_shifts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workforce_shifts_select ON public.workforce_shifts;
CREATE POLICY workforce_shifts_select ON public.workforce_shifts
  FOR SELECT TO authenticated
  USING (
    public.auth_is_member(workspace_id)
    AND public.auth_feature(workspace_id, 'workforce')
    AND (
      public.auth_has_workspace_grant(workspace_id, 'workforce.schedules.view')
      OR public.auth_has_workspace_grant(workspace_id, 'workforce.schedules.edit')
    )
  );

DROP POLICY IF EXISTS workforce_shifts_insert ON public.workforce_shifts;
CREATE POLICY workforce_shifts_insert ON public.workforce_shifts
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_is_member(workspace_id)
    AND public.auth_feature(workspace_id, 'workforce')
    AND public.auth_has_workspace_grant(workspace_id, 'workforce.schedules.edit')
  );

DROP POLICY IF EXISTS workforce_shifts_update ON public.workforce_shifts;
CREATE POLICY workforce_shifts_update ON public.workforce_shifts
  FOR UPDATE TO authenticated
  USING (
    public.auth_is_member(workspace_id)
    AND public.auth_feature(workspace_id, 'workforce')
    AND public.auth_has_workspace_grant(workspace_id, 'workforce.schedules.edit')
  )
  WITH CHECK (
    public.auth_is_member(workspace_id)
    AND public.auth_feature(workspace_id, 'workforce')
    AND public.auth_has_workspace_grant(workspace_id, 'workforce.schedules.edit')
  );

DROP POLICY IF EXISTS workforce_shifts_delete ON public.workforce_shifts;
CREATE POLICY workforce_shifts_delete ON public.workforce_shifts
  FOR DELETE TO authenticated
  USING (
    public.auth_is_member(workspace_id)
    AND public.auth_feature(workspace_id, 'workforce')
    AND public.auth_has_workspace_grant(workspace_id, 'workforce.schedules.edit')
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.workforce_shifts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.workforce_shifts TO service_role;

-- Keep Stage-2 lock: authenticated must not write employee/membership rows directly.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.workforce_employees FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.workforce_memberships FROM authenticated;
GRANT SELECT ON TABLE public.workforce_employees TO authenticated;
GRANT SELECT ON TABLE public.workforce_memberships TO authenticated;
