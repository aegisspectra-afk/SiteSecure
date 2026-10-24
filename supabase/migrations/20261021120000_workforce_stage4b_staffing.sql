-- Workforce Stage 4B: demand vs slot vs assignment, policy, time-off, qualifications.
-- Additive. Does not duplicate CRM public.sites or SSP ssp_sites.
-- Does not reopen authenticated writes on workforce_employees / workforce_memberships.
-- Does not add approve/publish/optimizer. Do not apply on production without explicit approval.

-- ── Sites: IANA timezone (operational clock, not a labor-law assumption) ─────
ALTER TABLE public.workforce_sites
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Asia/Jerusalem';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workforce_sites_timezone_chk'
  ) THEN
    ALTER TABLE public.workforce_sites
      ADD CONSTRAINT workforce_sites_timezone_chk
      CHECK (timezone ~ '^[A-Za-z_]+/[A-Za-z0-9_+-]+(/[A-Za-z0-9_+-]+)?$');
  END IF;
END $$;

COMMENT ON COLUMN public.workforce_sites.timezone IS
  'IANA timezone for local recurring templates and DST conversion. Assignments stay timestamptz.';

-- ── Recurring coverage demand (not an assignment) ────────────────────────────
CREATE TABLE IF NOT EXISTS public.workforce_coverage_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.workforce_sites (id) ON DELETE RESTRICT,
  position_id uuid NOT NULL REFERENCES public.workforce_positions (id) ON DELETE RESTRICT,
  weekday smallint NOT NULL,
  start_local time NOT NULL,
  end_local time NOT NULL,
  crosses_midnight boolean NOT NULL DEFAULT false,
  required_count integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workforce_coverage_weekday_chk CHECK (weekday BETWEEN 0 AND 6),
  CONSTRAINT workforce_coverage_count_chk CHECK (required_count >= 1),
  UNIQUE (workspace_id, site_id, position_id, weekday, start_local)
);

CREATE INDEX IF NOT EXISTS workforce_coverage_workspace_site_idx
  ON public.workforce_coverage_requirements (workspace_id, site_id, weekday);

COMMENT ON TABLE public.workforce_coverage_requirements IS
  'Recurring staffing demand: how many of a position are needed at a site on a local weekday window. Timezone comes from workforce_sites.';

-- ── Concrete weekly slots (unfilled demand posts) ────────────────────────────
CREATE TABLE IF NOT EXISTS public.workforce_shift_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.workforce_sites (id) ON DELETE RESTRICT,
  region_id uuid REFERENCES public.workforce_regions (id) ON DELETE SET NULL,
  position_id uuid NOT NULL REFERENCES public.workforce_positions (id) ON DELETE RESTRICT,
  coverage_requirement_id uuid REFERENCES public.workforce_coverage_requirements (id) ON DELETE SET NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  required_count integer NOT NULL DEFAULT 1,
  notes text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workforce_slots_range_chk CHECK (ends_at > starts_at),
  CONSTRAINT workforce_slots_count_chk CHECK (required_count >= 1)
);

CREATE INDEX IF NOT EXISTS workforce_slots_workspace_range_idx
  ON public.workforce_shift_slots (workspace_id, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS workforce_slots_site_idx
  ON public.workforce_shift_slots (workspace_id, site_id, starts_at);

COMMENT ON TABLE public.workforce_shift_slots IS
  'Concrete staffing posts for a clock window. No employee lives here. Coverage = assignments on workforce_shifts.slot_id.';

-- ── Assignments stay 1:1 employee rows; optional link to a slot ──────────────
ALTER TABLE public.workforce_shifts
  ADD COLUMN IF NOT EXISTS slot_id uuid REFERENCES public.workforce_shift_slots (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS workforce_shifts_slot_idx
  ON public.workforce_shifts (workspace_id, slot_id);

COMMENT ON COLUMN public.workforce_shifts.slot_id IS
  'Optional link from an employee assignment to a demand slot. employee_id remains NOT NULL.';

-- ── Per-workspace schedule policy (opt-in rest; no global labor law) ────────
CREATE TABLE IF NOT EXISTS public.workforce_schedule_policies (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces (id) ON DELETE CASCADE,
  max_shift_hours numeric(5, 2) NOT NULL DEFAULT 36,
  min_rest_hours numeric(5, 2),
  rest_rule_enabled boolean NOT NULL DEFAULT false,
  weekly_hour_cap numeric(6, 2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workforce_policy_max_shift_chk CHECK (max_shift_hours >= 1 AND max_shift_hours <= 48),
  CONSTRAINT workforce_policy_rest_chk CHECK (min_rest_hours IS NULL OR min_rest_hours >= 0),
  CONSTRAINT workforce_policy_week_chk CHECK (weekly_hour_cap IS NULL OR weekly_hour_cap >= 1)
);

COMMENT ON TABLE public.workforce_schedule_policies IS
  'Workspace staffing policy. Rest and weekly caps apply only when enabled/set. Not Israeli labor law by default.';

-- ── Time off ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.workforce_time_off (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.workforce_employees (id) ON DELETE RESTRICT,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  kind text NOT NULL DEFAULT 'vacation',
  status text NOT NULL DEFAULT 'pending',
  notes text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workforce_time_off_range_chk CHECK (ends_at > starts_at),
  CONSTRAINT workforce_time_off_kind_chk CHECK (kind IN ('vacation', 'sick', 'unpaid', 'other')),
  CONSTRAINT workforce_time_off_status_chk CHECK (status IN ('pending', 'approved', 'rejected'))
);

CREATE INDEX IF NOT EXISTS workforce_time_off_employee_idx
  ON public.workforce_time_off (workspace_id, employee_id, starts_at);

-- ── Qualifications ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.workforce_qualifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.workforce_employees (id) ON DELETE CASCADE,
  qualification_key text NOT NULL,
  expires_on date,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workforce_qual_key_chk CHECK (length(trim(qualification_key)) >= 1),
  UNIQUE (workspace_id, employee_id, qualification_key)
);

CREATE INDEX IF NOT EXISTS workforce_qual_employee_idx
  ON public.workforce_qualifications (workspace_id, employee_id, is_active);

CREATE TABLE IF NOT EXISTS public.workforce_position_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  position_id uuid NOT NULL REFERENCES public.workforce_positions (id) ON DELETE CASCADE,
  qualification_key text NOT NULL,
  enforcement text NOT NULL DEFAULT 'required',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workforce_pos_req_key_chk CHECK (length(trim(qualification_key)) >= 1),
  CONSTRAINT workforce_pos_req_enforcement_chk CHECK (enforcement IN ('required', 'preferred')),
  UNIQUE (workspace_id, position_id, qualification_key)
);

-- ── Triggers ────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS workforce_coverage_set_updated_at ON public.workforce_coverage_requirements;
CREATE TRIGGER workforce_coverage_set_updated_at
  BEFORE UPDATE ON public.workforce_coverage_requirements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS workforce_coverage_lock_workspace ON public.workforce_coverage_requirements;
CREATE TRIGGER workforce_coverage_lock_workspace
  BEFORE UPDATE ON public.workforce_coverage_requirements
  FOR EACH ROW EXECUTE FUNCTION public.workforce_lock_workspace_id();

DROP TRIGGER IF EXISTS workforce_slots_set_updated_at ON public.workforce_shift_slots;
CREATE TRIGGER workforce_slots_set_updated_at
  BEFORE UPDATE ON public.workforce_shift_slots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS workforce_slots_lock_workspace ON public.workforce_shift_slots;
CREATE TRIGGER workforce_slots_lock_workspace
  BEFORE UPDATE ON public.workforce_shift_slots
  FOR EACH ROW EXECUTE FUNCTION public.workforce_lock_workspace_id();

DROP TRIGGER IF EXISTS workforce_policy_set_updated_at ON public.workforce_schedule_policies;
CREATE TRIGGER workforce_policy_set_updated_at
  BEFORE UPDATE ON public.workforce_schedule_policies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS workforce_policy_lock_workspace ON public.workforce_schedule_policies;
CREATE TRIGGER workforce_policy_lock_workspace
  BEFORE UPDATE ON public.workforce_schedule_policies
  FOR EACH ROW EXECUTE FUNCTION public.workforce_lock_workspace_id();

DROP TRIGGER IF EXISTS workforce_time_off_set_updated_at ON public.workforce_time_off;
CREATE TRIGGER workforce_time_off_set_updated_at
  BEFORE UPDATE ON public.workforce_time_off
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS workforce_time_off_lock_workspace ON public.workforce_time_off;
CREATE TRIGGER workforce_time_off_lock_workspace
  BEFORE UPDATE ON public.workforce_time_off
  FOR EACH ROW EXECUTE FUNCTION public.workforce_lock_workspace_id();

DROP TRIGGER IF EXISTS workforce_qual_set_updated_at ON public.workforce_qualifications;
CREATE TRIGGER workforce_qual_set_updated_at
  BEFORE UPDATE ON public.workforce_qualifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS workforce_qual_lock_workspace ON public.workforce_qualifications;
CREATE TRIGGER workforce_qual_lock_workspace
  BEFORE UPDATE ON public.workforce_qualifications
  FOR EACH ROW EXECUTE FUNCTION public.workforce_lock_workspace_id();

DROP TRIGGER IF EXISTS workforce_pos_req_set_updated_at ON public.workforce_position_requirements;
CREATE TRIGGER workforce_pos_req_set_updated_at
  BEFORE UPDATE ON public.workforce_position_requirements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS workforce_pos_req_lock_workspace ON public.workforce_position_requirements;
CREATE TRIGGER workforce_pos_req_lock_workspace
  BEFORE UPDATE ON public.workforce_position_requirements
  FOR EACH ROW EXECUTE FUNCTION public.workforce_lock_workspace_id();

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.workforce_coverage_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workforce_coverage_requirements FORCE ROW LEVEL SECURITY;
ALTER TABLE public.workforce_shift_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workforce_shift_slots FORCE ROW LEVEL SECURITY;
ALTER TABLE public.workforce_schedule_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workforce_schedule_policies FORCE ROW LEVEL SECURITY;
ALTER TABLE public.workforce_time_off ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workforce_time_off FORCE ROW LEVEL SECURITY;
ALTER TABLE public.workforce_qualifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workforce_qualifications FORCE ROW LEVEL SECURITY;
ALTER TABLE public.workforce_position_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workforce_position_requirements FORCE ROW LEVEL SECURITY;

-- Coverage + slots: same grants as shifts (schedules.view / schedules.edit)
DROP POLICY IF EXISTS workforce_coverage_select ON public.workforce_coverage_requirements;
CREATE POLICY workforce_coverage_select ON public.workforce_coverage_requirements
  FOR SELECT TO authenticated
  USING (
    public.auth_is_member(workspace_id)
    AND public.auth_feature(workspace_id, 'workforce')
    AND (
      public.auth_has_workspace_grant(workspace_id, 'workforce.schedules.view')
      OR public.auth_has_workspace_grant(workspace_id, 'workforce.schedules.edit')
    )
  );
DROP POLICY IF EXISTS workforce_coverage_insert ON public.workforce_coverage_requirements;
CREATE POLICY workforce_coverage_insert ON public.workforce_coverage_requirements
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_is_member(workspace_id)
    AND public.auth_feature(workspace_id, 'workforce')
    AND public.auth_has_workspace_grant(workspace_id, 'workforce.schedules.edit')
  );
DROP POLICY IF EXISTS workforce_coverage_update ON public.workforce_coverage_requirements;
CREATE POLICY workforce_coverage_update ON public.workforce_coverage_requirements
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
DROP POLICY IF EXISTS workforce_coverage_delete ON public.workforce_coverage_requirements;
CREATE POLICY workforce_coverage_delete ON public.workforce_coverage_requirements
  FOR DELETE TO authenticated
  USING (
    public.auth_is_member(workspace_id)
    AND public.auth_feature(workspace_id, 'workforce')
    AND public.auth_has_workspace_grant(workspace_id, 'workforce.schedules.edit')
  );

DROP POLICY IF EXISTS workforce_slots_select ON public.workforce_shift_slots;
CREATE POLICY workforce_slots_select ON public.workforce_shift_slots
  FOR SELECT TO authenticated
  USING (
    public.auth_is_member(workspace_id)
    AND public.auth_feature(workspace_id, 'workforce')
    AND (
      public.auth_has_workspace_grant(workspace_id, 'workforce.schedules.view')
      OR public.auth_has_workspace_grant(workspace_id, 'workforce.schedules.edit')
    )
  );
DROP POLICY IF EXISTS workforce_slots_insert ON public.workforce_shift_slots;
CREATE POLICY workforce_slots_insert ON public.workforce_shift_slots
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_is_member(workspace_id)
    AND public.auth_feature(workspace_id, 'workforce')
    AND public.auth_has_workspace_grant(workspace_id, 'workforce.schedules.edit')
  );
DROP POLICY IF EXISTS workforce_slots_update ON public.workforce_shift_slots;
CREATE POLICY workforce_slots_update ON public.workforce_shift_slots
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
DROP POLICY IF EXISTS workforce_slots_delete ON public.workforce_shift_slots;
CREATE POLICY workforce_slots_delete ON public.workforce_shift_slots
  FOR DELETE TO authenticated
  USING (
    public.auth_is_member(workspace_id)
    AND public.auth_feature(workspace_id, 'workforce')
    AND public.auth_has_workspace_grant(workspace_id, 'workforce.schedules.edit')
  );

DROP POLICY IF EXISTS workforce_policy_select ON public.workforce_schedule_policies;
CREATE POLICY workforce_policy_select ON public.workforce_schedule_policies
  FOR SELECT TO authenticated
  USING (
    public.auth_is_member(workspace_id)
    AND public.auth_feature(workspace_id, 'workforce')
    AND (
      public.auth_has_workspace_grant(workspace_id, 'workforce.schedules.view')
      OR public.auth_has_workspace_grant(workspace_id, 'workforce.schedules.edit')
    )
  );
DROP POLICY IF EXISTS workforce_policy_insert ON public.workforce_schedule_policies;
CREATE POLICY workforce_policy_insert ON public.workforce_schedule_policies
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_is_member(workspace_id)
    AND public.auth_feature(workspace_id, 'workforce')
    AND public.auth_has_workspace_grant(workspace_id, 'workforce.schedules.edit')
  );
DROP POLICY IF EXISTS workforce_policy_update ON public.workforce_schedule_policies;
CREATE POLICY workforce_policy_update ON public.workforce_schedule_policies
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
DROP POLICY IF EXISTS workforce_policy_delete ON public.workforce_schedule_policies;
CREATE POLICY workforce_policy_delete ON public.workforce_schedule_policies
  FOR DELETE TO authenticated
  USING (
    public.auth_is_member(workspace_id)
    AND public.auth_feature(workspace_id, 'workforce')
    AND public.auth_has_workspace_grant(workspace_id, 'workforce.schedules.edit')
  );

DROP POLICY IF EXISTS workforce_time_off_select ON public.workforce_time_off;
CREATE POLICY workforce_time_off_select ON public.workforce_time_off
  FOR SELECT TO authenticated
  USING (
    public.auth_is_member(workspace_id)
    AND public.auth_feature(workspace_id, 'workforce')
    AND (
      public.auth_has_workspace_grant(workspace_id, 'workforce.schedules.view')
      OR public.auth_has_workspace_grant(workspace_id, 'workforce.schedules.edit')
      OR public.auth_has_workspace_grant(workspace_id, 'workforce.employees.view')
      OR (
        public.auth_has_workspace_grant(workspace_id, 'workforce.portal.view')
        AND employee_id IN (
          SELECT id FROM public.workforce_employees
          WHERE workspace_id = workforce_time_off.workspace_id AND user_id = auth.uid()
        )
      )
    )
  );
DROP POLICY IF EXISTS workforce_time_off_insert ON public.workforce_time_off;
CREATE POLICY workforce_time_off_insert ON public.workforce_time_off
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_is_member(workspace_id)
    AND public.auth_feature(workspace_id, 'workforce')
    AND public.auth_has_workspace_grant(workspace_id, 'workforce.schedules.edit')
  );
DROP POLICY IF EXISTS workforce_time_off_update ON public.workforce_time_off;
CREATE POLICY workforce_time_off_update ON public.workforce_time_off
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
DROP POLICY IF EXISTS workforce_time_off_delete ON public.workforce_time_off;
CREATE POLICY workforce_time_off_delete ON public.workforce_time_off
  FOR DELETE TO authenticated
  USING (
    public.auth_is_member(workspace_id)
    AND public.auth_feature(workspace_id, 'workforce')
    AND public.auth_has_workspace_grant(workspace_id, 'workforce.schedules.edit')
  );

DROP POLICY IF EXISTS workforce_qual_select ON public.workforce_qualifications;
CREATE POLICY workforce_qual_select ON public.workforce_qualifications
  FOR SELECT TO authenticated
  USING (
    public.auth_is_member(workspace_id)
    AND public.auth_feature(workspace_id, 'workforce')
    AND (
      public.auth_has_workspace_grant(workspace_id, 'workforce.employees.view')
      OR public.auth_has_workspace_grant(workspace_id, 'workforce.schedules.view')
      OR public.auth_has_workspace_grant(workspace_id, 'workforce.schedules.edit')
      OR (
        public.auth_has_workspace_grant(workspace_id, 'workforce.portal.view')
        AND employee_id IN (
          SELECT id FROM public.workforce_employees
          WHERE workspace_id = workforce_qualifications.workspace_id AND user_id = auth.uid()
        )
      )
    )
  );
DROP POLICY IF EXISTS workforce_qual_insert ON public.workforce_qualifications;
CREATE POLICY workforce_qual_insert ON public.workforce_qualifications
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_is_member(workspace_id)
    AND public.auth_feature(workspace_id, 'workforce')
    AND public.auth_has_workspace_grant(workspace_id, 'workforce.employees.manage')
  );
DROP POLICY IF EXISTS workforce_qual_update ON public.workforce_qualifications;
CREATE POLICY workforce_qual_update ON public.workforce_qualifications
  FOR UPDATE TO authenticated
  USING (
    public.auth_is_member(workspace_id)
    AND public.auth_feature(workspace_id, 'workforce')
    AND public.auth_has_workspace_grant(workspace_id, 'workforce.employees.manage')
  )
  WITH CHECK (
    public.auth_is_member(workspace_id)
    AND public.auth_feature(workspace_id, 'workforce')
    AND public.auth_has_workspace_grant(workspace_id, 'workforce.employees.manage')
  );
DROP POLICY IF EXISTS workforce_qual_delete ON public.workforce_qualifications;
CREATE POLICY workforce_qual_delete ON public.workforce_qualifications
  FOR DELETE TO authenticated
  USING (
    public.auth_is_member(workspace_id)
    AND public.auth_feature(workspace_id, 'workforce')
    AND public.auth_has_workspace_grant(workspace_id, 'workforce.employees.manage')
  );

DROP POLICY IF EXISTS workforce_pos_req_select ON public.workforce_position_requirements;
CREATE POLICY workforce_pos_req_select ON public.workforce_position_requirements
  FOR SELECT TO authenticated
  USING (
    public.auth_is_member(workspace_id)
    AND public.auth_feature(workspace_id, 'workforce')
    AND (
      public.auth_has_workspace_grant(workspace_id, 'workforce.sites.view')
      OR public.auth_has_workspace_grant(workspace_id, 'workforce.employees.view')
      OR public.auth_has_workspace_grant(workspace_id, 'workforce.schedules.view')
      OR public.auth_has_workspace_grant(workspace_id, 'workforce.schedules.edit')
    )
  );
DROP POLICY IF EXISTS workforce_pos_req_insert ON public.workforce_position_requirements;
CREATE POLICY workforce_pos_req_insert ON public.workforce_position_requirements
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_is_member(workspace_id)
    AND public.auth_feature(workspace_id, 'workforce')
    AND public.auth_has_workspace_grant(workspace_id, 'workforce.sites.manage')
  );
DROP POLICY IF EXISTS workforce_pos_req_update ON public.workforce_position_requirements;
CREATE POLICY workforce_pos_req_update ON public.workforce_position_requirements
  FOR UPDATE TO authenticated
  USING (
    public.auth_is_member(workspace_id)
    AND public.auth_feature(workspace_id, 'workforce')
    AND public.auth_has_workspace_grant(workspace_id, 'workforce.sites.manage')
  )
  WITH CHECK (
    public.auth_is_member(workspace_id)
    AND public.auth_feature(workspace_id, 'workforce')
    AND public.auth_has_workspace_grant(workspace_id, 'workforce.sites.manage')
  );
DROP POLICY IF EXISTS workforce_pos_req_delete ON public.workforce_position_requirements;
CREATE POLICY workforce_pos_req_delete ON public.workforce_position_requirements
  FOR DELETE TO authenticated
  USING (
    public.auth_is_member(workspace_id)
    AND public.auth_feature(workspace_id, 'workforce')
    AND public.auth_has_workspace_grant(workspace_id, 'workforce.sites.manage')
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.workforce_coverage_requirements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.workforce_shift_slots TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.workforce_schedule_policies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.workforce_time_off TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.workforce_qualifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.workforce_position_requirements TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.workforce_coverage_requirements TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.workforce_shift_slots TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.workforce_schedule_policies TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.workforce_time_off TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.workforce_qualifications TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.workforce_position_requirements TO service_role;

-- Keep Stage-2 lock.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.workforce_employees FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.workforce_memberships FROM authenticated;
GRANT SELECT ON TABLE public.workforce_employees TO authenticated;
GRANT SELECT ON TABLE public.workforce_memberships TO authenticated;
