-- Workforce Intelligence foundation.
-- Tenant = workspaces.id. Does not reuse CRM public.sites or SSP ssp_sites.
-- Additive. Does not rewrite applied migrations. Does not enable the product on existing Solo workspaces
-- except by inserting enabled=false overrides (fail closed). Production apply requires explicit approval.

-- ── Feature + permissions ────────────────────────────────────────────────────

INSERT INTO public.features (key) VALUES ('workforce')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.plan_features (plan_key, feature_key)
SELECT p.plan_key, 'workforce'
FROM (VALUES ('solo'), ('business'), ('enterprise')) AS p(plan_key)
ON CONFLICT DO NOTHING;

INSERT INTO public.permissions (key, group_key)
VALUES
  ('workforce.view', 'workforce'),
  ('workforce.employees.view', 'workforce'),
  ('workforce.employees.manage', 'workforce'),
  ('workforce.employees.create_user', 'workforce'),
  ('workforce.employees.disable', 'workforce'),
  ('workforce.sites.view', 'workforce'),
  ('workforce.sites.manage', 'workforce'),
  ('workforce.schedules.view', 'workforce'),
  ('workforce.schedules.edit', 'workforce'),
  ('workforce.schedules.optimize', 'workforce'),
  ('workforce.schedules.approve', 'workforce'),
  ('workforce.schedules.publish', 'workforce'),
  ('workforce.swaps.manage', 'workforce'),
  ('workforce.reports.view', 'workforce'),
  ('workforce.reports.costs', 'workforce'),
  ('workforce.settings.manage', 'workforce'),
  ('workforce.portal.view', 'workforce'),
  ('workforce.audit.view', 'workforce')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.role_permissions (role_key, permission_key)
SELECT role_key, permission_key
FROM (
  VALUES
    ('owner', 'workforce.view'),
    ('owner', 'workforce.employees.view'),
    ('owner', 'workforce.employees.manage'),
    ('owner', 'workforce.employees.create_user'),
    ('owner', 'workforce.employees.disable'),
    ('owner', 'workforce.sites.view'),
    ('owner', 'workforce.sites.manage'),
    ('owner', 'workforce.schedules.view'),
    ('owner', 'workforce.schedules.edit'),
    ('owner', 'workforce.schedules.optimize'),
    ('owner', 'workforce.schedules.approve'),
    ('owner', 'workforce.schedules.publish'),
    ('owner', 'workforce.swaps.manage'),
    ('owner', 'workforce.reports.view'),
    ('owner', 'workforce.reports.costs'),
    ('owner', 'workforce.settings.manage'),
    ('owner', 'workforce.portal.view'),
    ('owner', 'workforce.audit.view'),
    ('administrator', 'workforce.view'),
    ('administrator', 'workforce.employees.view'),
    ('administrator', 'workforce.employees.manage'),
    ('administrator', 'workforce.employees.create_user'),
    ('administrator', 'workforce.employees.disable'),
    ('administrator', 'workforce.sites.view'),
    ('administrator', 'workforce.sites.manage'),
    ('administrator', 'workforce.schedules.view'),
    ('administrator', 'workforce.schedules.edit'),
    ('administrator', 'workforce.schedules.optimize'),
    ('administrator', 'workforce.schedules.approve'),
    ('administrator', 'workforce.schedules.publish'),
    ('administrator', 'workforce.swaps.manage'),
    ('administrator', 'workforce.reports.view'),
    ('administrator', 'workforce.reports.costs'),
    ('administrator', 'workforce.settings.manage'),
    ('administrator', 'workforce.portal.view'),
    ('administrator', 'workforce.audit.view'),
    ('manager', 'workforce.view'),
    ('manager', 'workforce.employees.view'),
    ('manager', 'workforce.employees.manage'),
    ('manager', 'workforce.sites.view'),
    ('manager', 'workforce.sites.manage'),
    ('manager', 'workforce.schedules.view'),
    ('manager', 'workforce.schedules.edit'),
    ('manager', 'workforce.schedules.optimize'),
    ('manager', 'workforce.swaps.manage'),
    ('manager', 'workforce.reports.view'),
    ('manager', 'workforce.portal.view'),
    ('viewer', 'workforce.view'),
    ('viewer', 'workforce.employees.view'),
    ('viewer', 'workforce.schedules.view'),
    ('viewer', 'workforce.portal.view')
) AS seed(role_key, permission_key)
ON CONFLICT DO NOTHING;

DO $$
DECLARE
  r record;
  keys text[];
BEGIN
  FOR r IN
    SELECT id, key, grants
    FROM public.workspace_roles
    WHERE is_system
      AND key IN ('administrator', 'manager', 'viewer')
      AND jsonb_typeof(grants) = 'array'
      AND jsonb_array_length(grants) > 0
      AND NOT (grants @> '["*"]'::jsonb)
  LOOP
    IF r.key = 'administrator' THEN
      keys := ARRAY[
        'workforce.view', 'workforce.employees.view', 'workforce.employees.manage',
        'workforce.employees.create_user', 'workforce.employees.disable',
        'workforce.sites.view', 'workforce.sites.manage',
        'workforce.schedules.view', 'workforce.schedules.edit',
        'workforce.schedules.optimize', 'workforce.schedules.approve', 'workforce.schedules.publish',
        'workforce.swaps.manage', 'workforce.reports.view', 'workforce.reports.costs',
        'workforce.settings.manage', 'workforce.portal.view', 'workforce.audit.view'
      ];
    ELSIF r.key = 'manager' THEN
      keys := ARRAY[
        'workforce.view', 'workforce.employees.view', 'workforce.employees.manage',
        'workforce.sites.view', 'workforce.sites.manage',
        'workforce.schedules.view', 'workforce.schedules.edit',
        'workforce.schedules.optimize', 'workforce.swaps.manage',
        'workforce.reports.view', 'workforce.portal.view'
      ];
    ELSE
      keys := ARRAY[
        'workforce.view', 'workforce.employees.view',
        'workforce.schedules.view', 'workforce.portal.view'
      ];
    END IF;

    UPDATE public.workspace_roles
    SET grants = (
      SELECT jsonb_agg(to_jsonb(item) ORDER BY item)
      FROM (
        SELECT DISTINCT item
        FROM (
          SELECT jsonb_array_elements_text(r.grants) AS item
          UNION
          SELECT unnest(keys)
        ) s
      ) q
    )
    WHERE id = r.id;
  END LOOP;
END $$;

-- ── Domain tables ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.workforce_regions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, name),
  CONSTRAINT workforce_regions_name_chk CHECK (length(trim(name)) >= 1)
);

CREATE INDEX IF NOT EXISTS workforce_regions_workspace_idx
  ON public.workforce_regions (workspace_id, name);

CREATE TABLE IF NOT EXISTS public.workforce_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  region_id uuid REFERENCES public.workforce_regions (id) ON DELETE SET NULL,
  name text NOT NULL,
  code text,
  kind text NOT NULL DEFAULT 'physical_site',
  address jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, name),
  CONSTRAINT workforce_sites_kind_chk
    CHECK (kind IN ('physical_site', 'office', 'ops_center', 'other')),
  CONSTRAINT workforce_sites_name_chk CHECK (length(trim(name)) >= 1)
);

CREATE INDEX IF NOT EXISTS workforce_sites_workspace_idx
  ON public.workforce_sites (workspace_id, is_active);
CREATE INDEX IF NOT EXISTS workforce_sites_region_idx
  ON public.workforce_sites (workspace_id, region_id);

COMMENT ON TABLE public.workforce_sites IS
  'Workforce Intelligence posting locations. Distinct from CRM public.sites and SSP ssp_sites.';

CREATE TABLE IF NOT EXISTS public.workforce_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, name),
  CONSTRAINT workforce_positions_name_chk CHECK (length(trim(name)) >= 1)
);

CREATE INDEX IF NOT EXISTS workforce_positions_workspace_idx
  ON public.workforce_positions (workspace_id, name);

CREATE TABLE IF NOT EXISTS public.workforce_employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  membership_id uuid REFERENCES public.workspace_memberships (id) ON DELETE SET NULL,
  employee_number text,
  first_name text NOT NULL,
  last_name text NOT NULL,
  phone text,
  email text,
  username text,
  employment_status text NOT NULL DEFAULT 'active',
  position_id uuid REFERENCES public.workforce_positions (id) ON DELETE SET NULL,
  region_id uuid REFERENCES public.workforce_regions (id) ON DELETE SET NULL,
  site_id uuid REFERENCES public.workforce_sites (id) ON DELETE SET NULL,
  hire_date date,
  notes text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workforce_employees_status_chk
    CHECK (employment_status IN ('active', 'inactive', 'terminated')),
  CONSTRAINT workforce_employees_name_chk
    CHECK (length(trim(first_name)) >= 1 AND length(trim(last_name)) >= 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS workforce_employees_user_uidx
  ON public.workforce_employees (workspace_id, user_id)
  WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS workforce_employees_membership_uidx
  ON public.workforce_employees (workspace_id, membership_id)
  WHERE membership_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS workforce_employees_username_uidx
  ON public.workforce_employees (workspace_id, lower(username))
  WHERE username IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS workforce_employees_number_uidx
  ON public.workforce_employees (workspace_id, employee_number)
  WHERE employee_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS workforce_employees_workspace_status_idx
  ON public.workforce_employees (workspace_id, employment_status);
CREATE INDEX IF NOT EXISTS workforce_employees_site_idx
  ON public.workforce_employees (workspace_id, site_id);

COMMENT ON TABLE public.workforce_employees IS
  'Workforce Intelligence HR records. Login identity is optional user_id → profiles. Passwords are never stored here.';
COMMENT ON COLUMN public.workforce_employees.username IS
  'Operational identifier unique per workspace. Not a Supabase Auth username.';

CREATE TABLE IF NOT EXISTS public.workforce_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  employee_id uuid REFERENCES public.workforce_employees (id) ON DELETE SET NULL,
  product_role text NOT NULL,
  region_id uuid REFERENCES public.workforce_regions (id) ON DELETE SET NULL,
  site_id uuid REFERENCES public.workforce_sites (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id),
  CONSTRAINT workforce_memberships_role_chk
    CHECK (product_role IN (
      'org_admin', 'national_manager', 'regional_manager', 'site_manager',
      'scheduler', 'employee', 'payroll', 'auditor'
    )),
  CONSTRAINT workforce_memberships_status_chk
    CHECK (status IN ('active', 'disabled'))
);

CREATE INDEX IF NOT EXISTS workforce_memberships_user_idx
  ON public.workforce_memberships (workspace_id, user_id);
CREATE INDEX IF NOT EXISTS workforce_memberships_role_idx
  ON public.workforce_memberships (workspace_id, product_role);

COMMENT ON TABLE public.workforce_memberships IS
  'Workforce product roles and optional region/site scope. Does not replace workspace_memberships.role_key.';

DROP TRIGGER IF EXISTS workforce_regions_set_updated_at ON public.workforce_regions;
CREATE TRIGGER workforce_regions_set_updated_at
  BEFORE UPDATE ON public.workforce_regions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS workforce_sites_set_updated_at ON public.workforce_sites;
CREATE TRIGGER workforce_sites_set_updated_at
  BEFORE UPDATE ON public.workforce_sites
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS workforce_positions_set_updated_at ON public.workforce_positions;
CREATE TRIGGER workforce_positions_set_updated_at
  BEFORE UPDATE ON public.workforce_positions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS workforce_employees_set_updated_at ON public.workforce_employees;
CREATE TRIGGER workforce_employees_set_updated_at
  BEFORE UPDATE ON public.workforce_employees
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS workforce_memberships_set_updated_at ON public.workforce_memberships;
CREATE TRIGGER workforce_memberships_set_updated_at
  BEFORE UPDATE ON public.workforce_memberships
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.workforce_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workforce_regions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.workforce_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workforce_sites FORCE ROW LEVEL SECURITY;
ALTER TABLE public.workforce_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workforce_positions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.workforce_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workforce_employees FORCE ROW LEVEL SECURITY;
ALTER TABLE public.workforce_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workforce_memberships FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workforce_regions_select ON public.workforce_regions;
CREATE POLICY workforce_regions_select ON public.workforce_regions
  FOR SELECT TO authenticated
  USING (public.auth_is_member(workspace_id));

DROP POLICY IF EXISTS workforce_regions_write ON public.workforce_regions;
CREATE POLICY workforce_regions_write ON public.workforce_regions
  FOR ALL TO authenticated
  USING (public.auth_is_managerial(workspace_id))
  WITH CHECK (public.auth_is_managerial(workspace_id));

DROP POLICY IF EXISTS workforce_sites_select ON public.workforce_sites;
CREATE POLICY workforce_sites_select ON public.workforce_sites
  FOR SELECT TO authenticated
  USING (public.auth_is_member(workspace_id));

DROP POLICY IF EXISTS workforce_sites_write ON public.workforce_sites;
CREATE POLICY workforce_sites_write ON public.workforce_sites
  FOR ALL TO authenticated
  USING (public.auth_is_managerial(workspace_id))
  WITH CHECK (public.auth_is_managerial(workspace_id));

DROP POLICY IF EXISTS workforce_positions_select ON public.workforce_positions;
CREATE POLICY workforce_positions_select ON public.workforce_positions
  FOR SELECT TO authenticated
  USING (public.auth_is_member(workspace_id));

DROP POLICY IF EXISTS workforce_positions_write ON public.workforce_positions;
CREATE POLICY workforce_positions_write ON public.workforce_positions
  FOR ALL TO authenticated
  USING (public.auth_is_managerial(workspace_id))
  WITH CHECK (public.auth_is_managerial(workspace_id));

DROP POLICY IF EXISTS workforce_employees_select ON public.workforce_employees;
CREATE POLICY workforce_employees_select ON public.workforce_employees
  FOR SELECT TO authenticated
  USING (
    public.auth_is_member(workspace_id)
    AND (
      public.auth_is_managerial(workspace_id)
      OR user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS workforce_employees_write ON public.workforce_employees;
CREATE POLICY workforce_employees_write ON public.workforce_employees
  FOR ALL TO authenticated
  USING (public.auth_is_managerial(workspace_id))
  WITH CHECK (public.auth_is_managerial(workspace_id));

DROP POLICY IF EXISTS workforce_memberships_select ON public.workforce_memberships;
CREATE POLICY workforce_memberships_select ON public.workforce_memberships
  FOR SELECT TO authenticated
  USING (
    public.auth_is_member(workspace_id)
    AND (
      public.auth_is_managerial(workspace_id)
      OR user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS workforce_memberships_write ON public.workforce_memberships;
CREATE POLICY workforce_memberships_write ON public.workforce_memberships
  FOR ALL TO authenticated
  USING (public.auth_is_managerial(workspace_id))
  WITH CHECK (public.auth_is_managerial(workspace_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workforce_regions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workforce_sites TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workforce_positions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workforce_employees TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workforce_memberships TO authenticated;

-- ── Solo default-off for new workspaces ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_workspace(p_name text, p_plan_key text DEFAULT 'solo')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_uid uuid := auth.uid();
  v_plan text;
  v_feature text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;
  IF p_name IS NULL OR length(trim(p_name)) < 2 THEN
    RAISE EXCEPTION 'INVALID_NAME';
  END IF;

  v_plan := COALESCE(NULLIF(p_plan_key, ''), 'solo');
  IF NOT EXISTS (SELECT 1 FROM public.plans WHERE key = v_plan) THEN
    RAISE EXCEPTION 'INVALID_PLAN';
  END IF;

  INSERT INTO public.workspaces (name)
  VALUES (trim(p_name))
  RETURNING id INTO v_id;

  INSERT INTO public.workspace_settings (workspace_id) VALUES (v_id);
  INSERT INTO public.workspace_counters (workspace_id, kind, last_value)
  VALUES
    (v_id, 'site', 0),
    (v_id, 'quote', 0),
    (v_id, 'job', 0),
    (v_id, 'warranty', 0),
    (v_id, 'ft', 0);

  INSERT INTO public.workspace_memberships (workspace_id, user_id, role_key)
  VALUES (v_id, v_uid, 'owner');

  INSERT INTO public.subscriptions (workspace_id, plan_key, status)
  VALUES (v_id, v_plan, 'active');

  -- Solo only: disable plan-eligible optional products in the same transaction.
  IF v_plan = 'solo' THEN
    FOREACH v_feature IN ARRAY ARRAY['fleet', 'ssp', 'workforce']::text[]
    LOOP
      IF EXISTS (
        SELECT 1
        FROM public.plan_features pf
        WHERE pf.plan_key = v_plan
          AND pf.feature_key = v_feature
      ) THEN
        IF NOT EXISTS (
          SELECT 1 FROM public.features f WHERE f.key = v_feature
        ) THEN
          RAISE EXCEPTION 'PRODUCT_DEFAULTS_UNAVAILABLE';
        END IF;

        INSERT INTO public.workspace_feature_overrides (workspace_id, feature_key, enabled)
        VALUES (v_id, v_feature, false);
      END IF;
    END LOOP;
  END IF;

  PERFORM public.seed_workspace_defaults(v_id);

  UPDATE public.profiles
  SET last_workspace_id = v_id
  WHERE id = v_uid;

  RETURN v_id;
END;
$$;

-- Existing Solo workspaces: fail closed until Platform Admin enables the product.
INSERT INTO public.workspace_feature_overrides (workspace_id, feature_key, enabled)
SELECT s.workspace_id, 'workforce', false
FROM public.subscriptions s
WHERE s.plan_key = 'solo'
ON CONFLICT (workspace_id, feature_key) DO NOTHING;
