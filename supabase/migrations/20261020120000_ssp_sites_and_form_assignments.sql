-- SSP operational sites + published-form assignments (local only; do not apply to Cloud/Staging/Production).
-- Reuses ssp_forms / ssp_form_versions / ssp_form_submissions. Does not reuse CRM public.sites.

-- ── Forms: optional category (builder metadata) ───────────────────────────────

ALTER TABLE public.ssp_forms
  ADD COLUMN IF NOT EXISTS category text;

ALTER TABLE public.ssp_forms
  DROP CONSTRAINT IF EXISTS ssp_forms_category_len;

ALTER TABLE public.ssp_forms
  ADD CONSTRAINT ssp_forms_category_len
  CHECK (category IS NULL OR char_length(category) BETWEEN 1 AND 80);

-- ── Operational sites (product entity; not a user account) ────────────────────

CREATE TABLE IF NOT EXISTS public.ssp_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  company_pk uuid NOT NULL REFERENCES public.ssp_companies (id) ON DELETE CASCADE,
  site_id text NOT NULL,
  name text NOT NULL,
  phone text,
  description text NOT NULL DEFAULT '',
  org_unit_id uuid REFERENCES public.ssp_org_units (id) ON DELETE SET NULL,
  department_id uuid REFERENCES public.ssp_departments (id) ON DELETE SET NULL,
  manager_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ssp_sites_site_id_format CHECK (site_id ~ '^sit_[a-f0-9]{32}$'),
  CONSTRAINT ssp_sites_site_id_uid UNIQUE (site_id),
  CONSTRAINT ssp_sites_workspace_id_uid UNIQUE (id, workspace_id),
  CONSTRAINT ssp_sites_name_len CHECK (char_length(name) BETWEEN 1 AND 200),
  CONSTRAINT ssp_sites_phone_len CHECK (phone IS NULL OR char_length(phone) BETWEEN 1 AND 32),
  CONSTRAINT ssp_sites_description_len CHECK (char_length(description) <= 2000)
);

CREATE INDEX IF NOT EXISTS ssp_sites_workspace_idx
  ON public.ssp_sites (workspace_id, company_pk, is_active, name);

CREATE INDEX IF NOT EXISTS ssp_sites_department_idx
  ON public.ssp_sites (workspace_id, department_id)
  WHERE department_id IS NOT NULL;

CREATE TRIGGER ssp_sites_set_updated_at
  BEFORE UPDATE ON public.ssp_sites
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.ssp_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ssp_sites FORCE ROW LEVEL SECURITY;

CREATE POLICY ssp_sites_select ON public.ssp_sites
  FOR SELECT TO authenticated
  USING (public.auth_is_member(workspace_id));

CREATE POLICY ssp_sites_write ON public.ssp_sites
  FOR ALL TO authenticated
  USING (public.auth_is_member(workspace_id))
  WITH CHECK (public.auth_is_member(workspace_id));

REVOKE ALL ON TABLE public.ssp_sites FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ssp_sites TO authenticated;
GRANT ALL ON TABLE public.ssp_sites TO service_role;

COMMENT ON TABLE public.ssp_sites IS
  'SSP operational site. site_id is a stable public identifier. Not a login account; members are linked separately.';

-- ── Site members (authorized users for a site; no auto-created accounts) ──────

CREATE TABLE IF NOT EXISTS public.ssp_site_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  site_pk uuid NOT NULL REFERENCES public.ssp_sites (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ssp_site_members_uid UNIQUE (site_pk, user_id),
  CONSTRAINT ssp_site_members_site_workspace UNIQUE (site_pk, workspace_id)
);

CREATE INDEX IF NOT EXISTS ssp_site_members_user_idx
  ON public.ssp_site_members (workspace_id, user_id);

CREATE INDEX IF NOT EXISTS ssp_site_members_site_idx
  ON public.ssp_site_members (site_pk);

ALTER TABLE public.ssp_site_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ssp_site_members FORCE ROW LEVEL SECURITY;

CREATE POLICY ssp_site_members_select ON public.ssp_site_members
  FOR SELECT TO authenticated
  USING (public.auth_is_member(workspace_id));

CREATE POLICY ssp_site_members_write ON public.ssp_site_members
  FOR ALL TO authenticated
  USING (public.auth_is_member(workspace_id))
  WITH CHECK (public.auth_is_member(workspace_id));

REVOKE ALL ON TABLE public.ssp_site_members FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ssp_site_members TO authenticated;
GRANT ALL ON TABLE public.ssp_site_members TO service_role;

COMMENT ON TABLE public.ssp_site_members IS
  'Links existing workspace users to an operational site. Does not create profiles or credentials.';

-- ── Form → site assignments with frozen published-version snapshot ─────────────

CREATE TABLE IF NOT EXISTS public.ssp_form_site_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  company_pk uuid NOT NULL REFERENCES public.ssp_companies (id) ON DELETE CASCADE,
  form_id uuid NOT NULL,
  form_version_id uuid NOT NULL REFERENCES public.ssp_form_versions (id),
  site_pk uuid NOT NULL REFERENCES public.ssp_sites (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  cadence text NOT NULL DEFAULT 'once'
    CHECK (cadence IN ('once')),
  filler_mode text NOT NULL DEFAULT 'site'
    CHECK (filler_mode IN ('site', 'users', 'group')),
  starts_at timestamptz,
  due_at timestamptz,
  department_id uuid REFERENCES public.ssp_departments (id) ON DELETE SET NULL,
  definition_snapshot jsonb NOT NULL,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  paused_at timestamptz,
  completed_at timestamptz,
  CONSTRAINT ssp_form_site_assignments_form_workspace_fk
    FOREIGN KEY (form_id, workspace_id)
    REFERENCES public.ssp_forms (id, workspace_id),
  CONSTRAINT ssp_form_site_assignments_due_after_start
    CHECK (due_at IS NULL OR starts_at IS NULL OR due_at >= starts_at)
);

CREATE INDEX IF NOT EXISTS ssp_form_site_assignments_site_idx
  ON public.ssp_form_site_assignments (workspace_id, site_pk, status);

CREATE INDEX IF NOT EXISTS ssp_form_site_assignments_form_idx
  ON public.ssp_form_site_assignments (workspace_id, form_id, status);

CREATE TRIGGER ssp_form_site_assignments_set_updated_at
  BEFORE UPDATE ON public.ssp_form_site_assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.ssp_form_site_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ssp_form_site_assignments FORCE ROW LEVEL SECURITY;

CREATE POLICY ssp_form_site_assignments_select ON public.ssp_form_site_assignments
  FOR SELECT TO authenticated
  USING (public.auth_is_member(workspace_id));

CREATE POLICY ssp_form_site_assignments_write ON public.ssp_form_site_assignments
  FOR ALL TO authenticated
  USING (public.auth_is_member(workspace_id))
  WITH CHECK (public.auth_is_member(workspace_id));

REVOKE ALL ON TABLE public.ssp_form_site_assignments FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ssp_form_site_assignments TO authenticated;
GRANT ALL ON TABLE public.ssp_form_site_assignments TO service_role;

COMMENT ON TABLE public.ssp_form_site_assignments IS
  'Assigns a published SSP form version to an operational site. definition_snapshot is frozen; later publishes do not mutate existing rows.';

-- Explicit fillers when filler_mode = users
CREATE TABLE IF NOT EXISTS public.ssp_form_site_assignment_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  site_assignment_id uuid NOT NULL REFERENCES public.ssp_form_site_assignments (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ssp_form_site_assignment_targets_uid UNIQUE (site_assignment_id, user_id)
);

CREATE INDEX IF NOT EXISTS ssp_form_site_assignment_targets_user_idx
  ON public.ssp_form_site_assignment_targets (workspace_id, user_id);

ALTER TABLE public.ssp_form_site_assignment_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ssp_form_site_assignment_targets FORCE ROW LEVEL SECURITY;

CREATE POLICY ssp_form_site_assignment_targets_select ON public.ssp_form_site_assignment_targets
  FOR SELECT TO authenticated
  USING (public.auth_is_member(workspace_id));

CREATE POLICY ssp_form_site_assignment_targets_write ON public.ssp_form_site_assignment_targets
  FOR ALL TO authenticated
  USING (public.auth_is_member(workspace_id))
  WITH CHECK (public.auth_is_member(workspace_id));

REVOKE ALL ON TABLE public.ssp_form_site_assignment_targets FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ssp_form_site_assignment_targets TO authenticated;
GRANT ALL ON TABLE public.ssp_form_site_assignment_targets TO service_role;

-- ── Submissions may originate from a site assignment (tablet assignment_id optional)

ALTER TABLE public.ssp_form_submissions
  ALTER COLUMN assignment_id DROP NOT NULL;

ALTER TABLE public.ssp_form_submissions
  ADD COLUMN IF NOT EXISTS site_assignment_id uuid
    REFERENCES public.ssp_form_site_assignments (id) ON DELETE SET NULL;

ALTER TABLE public.ssp_form_submissions
  DROP CONSTRAINT IF EXISTS ssp_form_submissions_source_chk;

ALTER TABLE public.ssp_form_submissions
  ADD CONSTRAINT ssp_form_submissions_source_chk
  CHECK (assignment_id IS NOT NULL OR site_assignment_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS ssp_submissions_site_assignment_idx
  ON public.ssp_form_submissions (site_assignment_id)
  WHERE site_assignment_id IS NOT NULL;

-- One submit per user per site assignment (once cadence). Site-wide once is also enforced in API.
CREATE UNIQUE INDEX IF NOT EXISTS ssp_submissions_site_assign_user_uid
  ON public.ssp_form_submissions (site_assignment_id, submitted_by)
  WHERE site_assignment_id IS NOT NULL AND submitted_by IS NOT NULL;
