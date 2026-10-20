-- SSP Organization Core (C1)
-- Company is distinct from workspace: workspace remains the tenancy/security boundary;
-- company is an SSP product entity 1:1 linked to a workspace (unique workspace_id).
-- Does NOT reuse fleet public.departments (FleetMaster domain).

-- ── Companies ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ssp_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  -- Immutable public identifier (crypto-random); never email / sequential.
  company_id text NOT NULL,
  name text NOT NULL,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ssp_companies_workspace_uid UNIQUE (workspace_id),
  CONSTRAINT ssp_companies_company_id_uid UNIQUE (company_id),
  CONSTRAINT ssp_companies_company_id_format CHECK (company_id ~ '^cmp_[a-f0-9]{32}$'),
  CONSTRAINT ssp_companies_name_len CHECK (char_length(name) BETWEEN 1 AND 200)
);

CREATE INDEX IF NOT EXISTS ssp_companies_workspace_idx ON public.ssp_companies (workspace_id);

CREATE TRIGGER ssp_companies_set_updated_at
  BEFORE UPDATE ON public.ssp_companies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.ssp_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ssp_companies FORCE ROW LEVEL SECURITY;

CREATE POLICY ssp_companies_select ON public.ssp_companies
  FOR SELECT TO authenticated
  USING (public.auth_is_member(workspace_id));

CREATE POLICY ssp_companies_insert ON public.ssp_companies
  FOR INSERT TO authenticated
  WITH CHECK (public.auth_is_member(workspace_id));

CREATE POLICY ssp_companies_update ON public.ssp_companies
  FOR UPDATE TO authenticated
  USING (public.auth_is_member(workspace_id))
  WITH CHECK (public.auth_is_member(workspace_id));

REVOKE ALL ON TABLE public.ssp_companies FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.ssp_companies TO authenticated;
GRANT ALL ON TABLE public.ssp_companies TO service_role;

COMMENT ON TABLE public.ssp_companies IS
  'SSP product company; workspace_id is tenancy FK. company_id is public immutable random id.';

-- ── Org units (configurable hierarchy) ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ssp_org_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  company_pk uuid NOT NULL REFERENCES public.ssp_companies (id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.ssp_org_units (id) ON DELETE CASCADE,
  name text NOT NULL,
  unit_type text NOT NULL DEFAULT 'unit'
    CHECK (unit_type IN ('root', 'region', 'branch', 'unit')),
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ssp_org_units_name_len CHECK (char_length(name) BETWEEN 1 AND 200),
  CONSTRAINT ssp_org_units_company_workspace UNIQUE (id, workspace_id, company_pk)
);

CREATE INDEX IF NOT EXISTS ssp_org_units_company_idx
  ON public.ssp_org_units (workspace_id, company_pk, parent_id, sort_order);

CREATE TRIGGER ssp_org_units_set_updated_at
  BEFORE UPDATE ON public.ssp_org_units
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.ssp_org_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ssp_org_units FORCE ROW LEVEL SECURITY;

CREATE POLICY ssp_org_units_select ON public.ssp_org_units
  FOR SELECT TO authenticated
  USING (public.auth_is_member(workspace_id));

CREATE POLICY ssp_org_units_write ON public.ssp_org_units
  FOR ALL TO authenticated
  USING (public.auth_is_member(workspace_id))
  WITH CHECK (public.auth_is_member(workspace_id));

REVOKE ALL ON TABLE public.ssp_org_units FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ssp_org_units TO authenticated;
GRANT ALL ON TABLE public.ssp_org_units TO service_role;

-- ── Departments (e.g. Patrol) under an org unit ──────────────────────────────

CREATE TABLE IF NOT EXISTS public.ssp_departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  company_pk uuid NOT NULL REFERENCES public.ssp_companies (id) ON DELETE CASCADE,
  org_unit_id uuid NOT NULL REFERENCES public.ssp_org_units (id) ON DELETE CASCADE,
  key text NOT NULL,
  name_he text NOT NULL,
  name_en text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ssp_departments_key_len CHECK (char_length(key) BETWEEN 1 AND 64),
  CONSTRAINT ssp_departments_unit_key_uid UNIQUE (company_pk, org_unit_id, key)
);

CREATE INDEX IF NOT EXISTS ssp_departments_company_idx
  ON public.ssp_departments (workspace_id, company_pk, org_unit_id);

CREATE TRIGGER ssp_departments_set_updated_at
  BEFORE UPDATE ON public.ssp_departments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.ssp_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ssp_departments FORCE ROW LEVEL SECURITY;

CREATE POLICY ssp_departments_select ON public.ssp_departments
  FOR SELECT TO authenticated
  USING (public.auth_is_member(workspace_id));

CREATE POLICY ssp_departments_write ON public.ssp_departments
  FOR ALL TO authenticated
  USING (public.auth_is_member(workspace_id))
  WITH CHECK (public.auth_is_member(workspace_id));

REVOKE ALL ON TABLE public.ssp_departments FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ssp_departments TO authenticated;
GRANT ALL ON TABLE public.ssp_departments TO service_role;

-- ── Product memberships (patrol_manager / patrol_officer / org_admin) ────────

CREATE TABLE IF NOT EXISTS public.ssp_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  company_pk uuid NOT NULL REFERENCES public.ssp_companies (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  org_unit_id uuid REFERENCES public.ssp_org_units (id) ON DELETE SET NULL,
  department_id uuid REFERENCES public.ssp_departments (id) ON DELETE SET NULL,
  product_role text NOT NULL
    CHECK (product_role IN ('org_admin', 'patrol_manager', 'patrol_officer')),
  manager_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- One active product membership per user per company.
  CONSTRAINT ssp_memberships_user_company_uid UNIQUE (company_pk, user_id)
);

CREATE INDEX IF NOT EXISTS ssp_memberships_user_idx
  ON public.ssp_memberships (workspace_id, user_id, status);
CREATE INDEX IF NOT EXISTS ssp_memberships_dept_idx
  ON public.ssp_memberships (workspace_id, department_id, product_role);

CREATE TRIGGER ssp_memberships_set_updated_at
  BEFORE UPDATE ON public.ssp_memberships
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.ssp_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ssp_memberships FORCE ROW LEVEL SECURITY;

CREATE POLICY ssp_memberships_select ON public.ssp_memberships
  FOR SELECT TO authenticated
  USING (
    public.auth_is_member(workspace_id)
    AND (
      user_id = auth.uid()
      OR public.auth_is_managerial(workspace_id)
      OR EXISTS (
        SELECT 1
        FROM public.ssp_memberships me
        WHERE me.user_id = auth.uid()
          AND me.workspace_id = ssp_memberships.workspace_id
          AND me.company_pk = ssp_memberships.company_pk
          AND me.status = 'active'
          AND me.product_role IN ('org_admin', 'patrol_manager')
      )
    )
  );

CREATE POLICY ssp_memberships_write ON public.ssp_memberships
  FOR ALL TO authenticated
  USING (public.auth_is_member(workspace_id))
  WITH CHECK (public.auth_is_member(workspace_id));

REVOKE ALL ON TABLE public.ssp_memberships FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ssp_memberships TO authenticated;
GRANT ALL ON TABLE public.ssp_memberships TO service_role;

COMMENT ON TABLE public.ssp_memberships IS
  'SSP product roles (org_admin / patrol_manager / patrol_officer). Does not replace workspace_memberships.role_key.';

-- ── Scope columns on forms (nullable = legacy workspace-wide) ────────────────

ALTER TABLE public.ssp_forms
  ADD COLUMN IF NOT EXISTS company_pk uuid REFERENCES public.ssp_companies (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS org_unit_id uuid REFERENCES public.ssp_org_units (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.ssp_departments (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ssp_forms_department_idx
  ON public.ssp_forms (workspace_id, department_id)
  WHERE department_id IS NOT NULL;

-- Officer submission attribution (authenticated fill)
ALTER TABLE public.ssp_form_submissions
  ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ssp_submissions_submitted_by_idx
  ON public.ssp_form_submissions (workspace_id, submitted_by)
  WHERE submitted_by IS NOT NULL;
