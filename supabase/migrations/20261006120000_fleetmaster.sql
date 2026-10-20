-- FleetMaster: departments + fleet entities + RLS + permissions + feature flag
-- Organization = workspaces.id (workspace_id). No parallel org/auth systems.

-- ── Feature + permissions ────────────────────────────────────────────────────

INSERT INTO public.features (key) VALUES ('fleet')
ON CONFLICT (key) DO NOTHING;

-- Available on all paid+free plans so beta workspaces can adopt FleetMaster.
INSERT INTO public.plan_features (plan_key, feature_key)
SELECT p.plan_key, 'fleet'
FROM (VALUES ('solo'), ('business'), ('enterprise')) AS p(plan_key)
ON CONFLICT DO NOTHING;

INSERT INTO public.permissions (key, group_key)
VALUES
  ('fleet.view', 'fleet'),
  ('fleet.create', 'fleet'),
  ('fleet.edit', 'fleet'),
  ('fleet.delete', 'fleet'),
  ('fleet.mileage', 'fleet'),
  ('fleet.mileage_history', 'fleet'),
  ('fleet.maintenance', 'fleet'),
  ('fleet.documents', 'fleet'),
  ('fleet.equipment', 'fleet'),
  ('fleet.assignments', 'fleet'),
  ('fleet.schedules', 'fleet'),
  ('fleet.reports', 'fleet'),
  ('fleet.import', 'fleet'),
  ('fleet.departments', 'fleet')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.role_permissions (role_key, permission_key)
SELECT role_key, permission_key
FROM (
  VALUES
    ('owner', 'fleet.view'),
    ('owner', 'fleet.create'),
    ('owner', 'fleet.edit'),
    ('owner', 'fleet.delete'),
    ('owner', 'fleet.mileage'),
    ('owner', 'fleet.mileage_history'),
    ('owner', 'fleet.maintenance'),
    ('owner', 'fleet.documents'),
    ('owner', 'fleet.equipment'),
    ('owner', 'fleet.assignments'),
    ('owner', 'fleet.schedules'),
    ('owner', 'fleet.reports'),
    ('owner', 'fleet.import'),
    ('owner', 'fleet.departments'),
    ('administrator', 'fleet.view'),
    ('administrator', 'fleet.create'),
    ('administrator', 'fleet.edit'),
    ('administrator', 'fleet.delete'),
    ('administrator', 'fleet.mileage'),
    ('administrator', 'fleet.mileage_history'),
    ('administrator', 'fleet.maintenance'),
    ('administrator', 'fleet.documents'),
    ('administrator', 'fleet.equipment'),
    ('administrator', 'fleet.assignments'),
    ('administrator', 'fleet.schedules'),
    ('administrator', 'fleet.reports'),
    ('administrator', 'fleet.import'),
    ('administrator', 'fleet.departments'),
    ('manager', 'fleet.view'),
    ('manager', 'fleet.create'),
    ('manager', 'fleet.edit'),
    ('manager', 'fleet.mileage'),
    ('manager', 'fleet.mileage_history'),
    ('manager', 'fleet.maintenance'),
    ('manager', 'fleet.documents'),
    ('manager', 'fleet.equipment'),
    ('manager', 'fleet.assignments'),
    ('manager', 'fleet.schedules'),
    ('manager', 'fleet.reports'),
    ('manager', 'fleet.import'),
    ('manager', 'fleet.departments'),
    ('technician', 'fleet.view'),
    ('technician', 'fleet.mileage'),
    ('technician', 'fleet.mileage_history'),
    ('viewer', 'fleet.view'),
    ('viewer', 'fleet.mileage_history'),
    ('viewer', 'fleet.reports')
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
      AND key IN ('administrator', 'manager', 'technician', 'viewer')
      AND jsonb_typeof(grants) = 'array'
      AND jsonb_array_length(grants) > 0
      AND NOT (grants @> '["*"]'::jsonb)
  LOOP
    IF r.key IN ('administrator', 'manager') THEN
      keys := ARRAY[
        'fleet.view', 'fleet.create', 'fleet.edit', 'fleet.delete',
        'fleet.mileage', 'fleet.mileage_history', 'fleet.maintenance',
        'fleet.documents', 'fleet.equipment', 'fleet.assignments',
        'fleet.schedules', 'fleet.reports', 'fleet.import', 'fleet.departments'
      ];
    ELSIF r.key = 'technician' THEN
      keys := ARRAY['fleet.view', 'fleet.mileage', 'fleet.mileage_history'];
    ELSE
      keys := ARRAY['fleet.view', 'fleet.mileage_history', 'fleet.reports'];
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

ALTER TYPE public.document_entity_type ADD VALUE IF NOT EXISTS 'vehicle';

-- ── Departments ──────────────────────────────────────────────────────────────

CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  key text NOT NULL,
  name_he text NOT NULL,
  name_en text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  modules jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, key)
);

CREATE INDEX departments_workspace_idx ON public.departments (workspace_id, sort_order);

CREATE TABLE public.department_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  UNIQUE (department_id, user_id)
);

CREATE INDEX department_memberships_user_idx
  ON public.department_memberships (workspace_id, user_id);
CREATE INDEX department_memberships_dept_idx
  ON public.department_memberships (workspace_id, department_id);

-- Managerial roles see all departments; others only assigned departments.
CREATE OR REPLACE FUNCTION public.auth_can_access_department(
  p_workspace_id uuid,
  p_department_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.auth_is_member(p_workspace_id)
    AND (
      public.auth_is_managerial(p_workspace_id)
      OR EXISTS (
        SELECT 1
        FROM public.department_memberships dm
        WHERE dm.workspace_id = p_workspace_id
          AND dm.department_id = p_department_id
          AND dm.user_id = auth.uid()
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.auth_fleet_department_ids(p_workspace_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.id
  FROM public.departments d
  WHERE d.workspace_id = p_workspace_id
    AND d.is_active
    AND public.auth_can_access_department(p_workspace_id, d.id);
$$;

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.department_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_memberships FORCE ROW LEVEL SECURITY;

CREATE POLICY departments_select ON public.departments FOR SELECT TO authenticated
  USING (public.auth_can_access_department(workspace_id, id));

CREATE POLICY departments_insert ON public.departments FOR INSERT TO authenticated
  WITH CHECK (public.auth_is_managerial(workspace_id));

CREATE POLICY departments_update ON public.departments FOR UPDATE TO authenticated
  USING (public.auth_is_managerial(workspace_id))
  WITH CHECK (public.auth_is_managerial(workspace_id));

CREATE POLICY departments_delete ON public.departments FOR DELETE TO authenticated
  USING (public.auth_is_privileged(workspace_id));

CREATE POLICY department_memberships_select ON public.department_memberships FOR SELECT TO authenticated
  USING (
    public.auth_is_managerial(workspace_id)
    OR user_id = auth.uid()
  );

CREATE POLICY department_memberships_write ON public.department_memberships FOR ALL TO authenticated
  USING (public.auth_is_managerial(workspace_id))
  WITH CHECK (public.auth_is_managerial(workspace_id));

-- ── Vehicles ─────────────────────────────────────────────────────────────────

CREATE TYPE public.fleet_vehicle_status AS ENUM (
  'active',
  'maintenance',
  'temporarily_inactive',
  'inactive',
  'sold'
);

CREATE TABLE public.fleet_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments (id) ON DELETE RESTRICT,
  license_plate text NOT NULL,
  vehicle_type text NOT NULL DEFAULT 'car',
  manufacturer text,
  model text,
  year integer,
  current_mileage integer NOT NULL DEFAULT 0 CHECK (current_mileage >= 0),
  service_interval_km integer CHECK (service_interval_km IS NULL OR service_interval_km > 0),
  next_service_mileage integer CHECK (next_service_mileage IS NULL OR next_service_mileage >= 0),
  last_service_mileage integer CHECK (last_service_mileage IS NULL OR last_service_mileage >= 0),
  last_service_at date,
  status public.fleet_vehicle_status NOT NULL DEFAULT 'active',
  assigned_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  notes text,
  test_expiry_date date,
  insurance_provider text,
  insurance_policy_number text,
  insurance_expiry_date date,
  maintenance_soon_km integer NOT NULL DEFAULT 1000 CHECK (maintenance_soon_km >= 0),
  archived_at timestamptz,
  archived_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, license_plate)
);

CREATE INDEX fleet_vehicles_workspace_dept_idx
  ON public.fleet_vehicles (workspace_id, department_id)
  WHERE archived_at IS NULL;
CREATE INDEX fleet_vehicles_status_idx
  ON public.fleet_vehicles (workspace_id, status)
  WHERE archived_at IS NULL;
CREATE INDEX fleet_vehicles_assigned_idx
  ON public.fleet_vehicles (workspace_id, assigned_user_id)
  WHERE archived_at IS NULL;
CREATE INDEX fleet_vehicles_plate_idx
  ON public.fleet_vehicles (workspace_id, license_plate);

CREATE TABLE public.fleet_mileage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments (id) ON DELETE RESTRICT,
  vehicle_id uuid NOT NULL REFERENCES public.fleet_vehicles (id) ON DELETE CASCADE,
  previous_mileage integer NOT NULL CHECK (previous_mileage >= 0),
  mileage integer NOT NULL CHECK (mileage >= 0),
  distance_since_previous integer NOT NULL CHECK (distance_since_previous >= 0),
  recorded_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'manual',
  notes text,
  CHECK (mileage >= previous_mileage),
  CHECK (distance_since_previous = mileage - previous_mileage)
);

CREATE INDEX fleet_mileage_logs_vehicle_idx
  ON public.fleet_mileage_logs (vehicle_id, recorded_at DESC);
CREATE INDEX fleet_mileage_logs_workspace_idx
  ON public.fleet_mileage_logs (workspace_id, department_id, recorded_at DESC);

CREATE TABLE public.fleet_maintenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments (id) ON DELETE RESTRICT,
  vehicle_id uuid NOT NULL REFERENCES public.fleet_vehicles (id) ON DELETE CASCADE,
  maintenance_type text NOT NULL DEFAULT 'service',
  mileage integer CHECK (mileage IS NULL OR mileage >= 0),
  performed_on date NOT NULL DEFAULT CURRENT_DATE,
  next_mileage integer CHECK (next_mileage IS NULL OR next_mileage >= 0),
  provider text,
  cost_cents integer CHECK (cost_cents IS NULL OR cost_cents >= 0),
  description text,
  notes text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX fleet_maintenance_vehicle_idx
  ON public.fleet_maintenance (vehicle_id, performed_on DESC);

CREATE TABLE public.fleet_vehicle_equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments (id) ON DELETE RESTRICT,
  vehicle_id uuid NOT NULL REFERENCES public.fleet_vehicles (id) ON DELETE CASCADE,
  equipment_type text NOT NULL,
  name text NOT NULL,
  serial_number text,
  status text NOT NULL DEFAULT 'active',
  installation_date date,
  notes text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX fleet_vehicle_equipment_vehicle_idx
  ON public.fleet_vehicle_equipment (vehicle_id);

CREATE TABLE public.fleet_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments (id) ON DELETE RESTRICT,
  vehicle_id uuid NOT NULL REFERENCES public.fleet_vehicles (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  notes text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at >= starts_at)
);

CREATE INDEX fleet_assignments_vehicle_idx
  ON public.fleet_assignments (vehicle_id, starts_at DESC);
CREATE INDEX fleet_assignments_user_idx
  ON public.fleet_assignments (workspace_id, user_id, starts_at DESC);

CREATE TABLE public.fleet_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments (id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES public.fleet_vehicles (id) ON DELETE SET NULL,
  schedule_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  shift_label text,
  location text,
  notes text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time <> start_time)
);

CREATE INDEX fleet_schedules_dept_date_idx
  ON public.fleet_schedules (workspace_id, department_id, schedule_date);
CREATE INDEX fleet_schedules_user_idx
  ON public.fleet_schedules (workspace_id, user_id, schedule_date);

-- ── RLS for fleet tables ─────────────────────────────────────────────────────

ALTER TABLE public.fleet_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_vehicles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_mileage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_mileage_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_maintenance FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_vehicle_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_vehicle_equipment FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_assignments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fleet_schedules FORCE ROW LEVEL SECURITY;

CREATE POLICY fleet_vehicles_select ON public.fleet_vehicles FOR SELECT TO authenticated
  USING (public.auth_can_access_department(workspace_id, department_id));

CREATE POLICY fleet_vehicles_insert ON public.fleet_vehicles FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_can_access_department(workspace_id, department_id)
    AND public.auth_role_in(
      workspace_id,
      ARRAY['owner', 'administrator', 'manager']
    )
  );

CREATE POLICY fleet_vehicles_update ON public.fleet_vehicles FOR UPDATE TO authenticated
  USING (
    public.auth_can_access_department(workspace_id, department_id)
    AND (
      public.auth_role_in(workspace_id, ARRAY['owner', 'administrator', 'manager'])
      OR assigned_user_id = auth.uid()
    )
  )
  WITH CHECK (public.auth_can_access_department(workspace_id, department_id));

CREATE POLICY fleet_vehicles_delete ON public.fleet_vehicles FOR DELETE TO authenticated
  USING (public.auth_is_privileged(workspace_id));

CREATE POLICY fleet_mileage_logs_select ON public.fleet_mileage_logs FOR SELECT TO authenticated
  USING (public.auth_can_access_department(workspace_id, department_id));

CREATE POLICY fleet_mileage_logs_insert ON public.fleet_mileage_logs FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_can_access_department(workspace_id, department_id)
    AND (
      public.auth_role_in(
        workspace_id,
        ARRAY['owner', 'administrator', 'manager', 'technician', 'founding_technician']
      )
      OR EXISTS (
        SELECT 1 FROM public.fleet_vehicles v
        WHERE v.id = vehicle_id
          AND v.assigned_user_id = auth.uid()
      )
    )
  );

CREATE POLICY fleet_maintenance_select ON public.fleet_maintenance FOR SELECT TO authenticated
  USING (public.auth_can_access_department(workspace_id, department_id));

CREATE POLICY fleet_maintenance_write ON public.fleet_maintenance FOR ALL TO authenticated
  USING (
    public.auth_can_access_department(workspace_id, department_id)
    AND public.auth_role_in(workspace_id, ARRAY['owner', 'administrator', 'manager'])
  )
  WITH CHECK (
    public.auth_can_access_department(workspace_id, department_id)
    AND public.auth_role_in(workspace_id, ARRAY['owner', 'administrator', 'manager'])
  );

CREATE POLICY fleet_equipment_select ON public.fleet_vehicle_equipment FOR SELECT TO authenticated
  USING (public.auth_can_access_department(workspace_id, department_id));

CREATE POLICY fleet_equipment_write ON public.fleet_vehicle_equipment FOR ALL TO authenticated
  USING (
    public.auth_can_access_department(workspace_id, department_id)
    AND public.auth_role_in(workspace_id, ARRAY['owner', 'administrator', 'manager'])
  )
  WITH CHECK (
    public.auth_can_access_department(workspace_id, department_id)
    AND public.auth_role_in(workspace_id, ARRAY['owner', 'administrator', 'manager'])
  );

CREATE POLICY fleet_assignments_select ON public.fleet_assignments FOR SELECT TO authenticated
  USING (
    public.auth_can_access_department(workspace_id, department_id)
    OR user_id = auth.uid()
  );

CREATE POLICY fleet_assignments_write ON public.fleet_assignments FOR ALL TO authenticated
  USING (
    public.auth_can_access_department(workspace_id, department_id)
    AND public.auth_role_in(workspace_id, ARRAY['owner', 'administrator', 'manager'])
  )
  WITH CHECK (
    public.auth_can_access_department(workspace_id, department_id)
    AND public.auth_role_in(workspace_id, ARRAY['owner', 'administrator', 'manager'])
  );

CREATE POLICY fleet_schedules_select ON public.fleet_schedules FOR SELECT TO authenticated
  USING (
    public.auth_can_access_department(workspace_id, department_id)
    OR user_id = auth.uid()
  );

CREATE POLICY fleet_schedules_write ON public.fleet_schedules FOR ALL TO authenticated
  USING (
    public.auth_can_access_department(workspace_id, department_id)
    AND public.auth_role_in(workspace_id, ARRAY['owner', 'administrator', 'manager'])
  )
  WITH CHECK (
    public.auth_can_access_department(workspace_id, department_id)
    AND public.auth_role_in(workspace_id, ARRAY['owner', 'administrator', 'manager'])
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.department_memberships TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fleet_vehicles TO authenticated;
GRANT SELECT, INSERT ON public.fleet_mileage_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fleet_maintenance TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fleet_vehicle_equipment TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fleet_assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fleet_schedules TO authenticated;
