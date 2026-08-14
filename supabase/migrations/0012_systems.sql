CREATE TYPE public.system_type AS ENUM (
  'alarm', 'cctv', 'access', 'network', 'intercom', 'other'
);

CREATE TYPE public.system_status AS ENUM ('planned', 'active', 'inactive', 'decommissioned');

CREATE TYPE public.equipment_category AS ENUM (
  'camera', 'pir', 'nvr', 'dvr', 'panel', 'reader', 'lock', 'switch',
  'cable', 'sim', 'power', 'other'
);

CREATE TYPE public.equipment_status AS ENUM ('planned', 'installed', 'replaced', 'removed');

CREATE TABLE public.systems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.sites (id) ON DELETE CASCADE,
  type public.system_type NOT NULL,
  name text NOT NULL,
  status public.system_status NOT NULL DEFAULT 'planned',
  manufacturer text,
  model text,
  panel_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX systems_site_idx ON public.systems (workspace_id, site_id);

CREATE TRIGGER systems_set_updated_at
  BEFORE UPDATE ON public.systems
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.sites (id) ON DELETE CASCADE,
  system_id uuid REFERENCES public.systems (id) ON DELETE SET NULL,
  zone_id uuid REFERENCES public.site_zones (id) ON DELETE SET NULL,
  category public.equipment_category NOT NULL DEFAULT 'other',
  status public.equipment_status NOT NULL DEFAULT 'planned',
  name text NOT NULL,
  manufacturer text,
  model text,
  serial text,
  mac text,
  ip text,
  location_note text,
  installed_at date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX equipment_site_idx ON public.equipment (workspace_id, site_id);
CREATE INDEX equipment_system_idx ON public.equipment (workspace_id, system_id);

CREATE TRIGGER equipment_set_updated_at
  BEFORE UPDATE ON public.equipment
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.systems ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.systems FORCE ROW LEVEL SECURITY;
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment FORCE ROW LEVEL SECURITY;

CREATE POLICY systems_select ON public.systems FOR SELECT TO authenticated
  USING (public.auth_site_visible(workspace_id, site_id));

CREATE POLICY systems_insert ON public.systems FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_site_visible(workspace_id, site_id)
    AND public.auth_role_in(
      workspace_id,
      ARRAY['owner','administrator','manager','technician','founding_technician']
    )
  );

CREATE POLICY systems_update ON public.systems FOR UPDATE TO authenticated
  USING (public.auth_site_visible(workspace_id, site_id))
  WITH CHECK (public.auth_site_visible(workspace_id, site_id));

CREATE POLICY systems_delete ON public.systems FOR DELETE TO authenticated
  USING (public.auth_is_privileged(workspace_id));

CREATE POLICY equipment_select ON public.equipment FOR SELECT TO authenticated
  USING (public.auth_site_visible(workspace_id, site_id));

CREATE POLICY equipment_insert ON public.equipment FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_site_visible(workspace_id, site_id)
    AND public.auth_role_in(
      workspace_id,
      ARRAY['owner','administrator','manager','technician','founding_technician']
    )
  );

CREATE POLICY equipment_update ON public.equipment FOR UPDATE TO authenticated
  USING (public.auth_site_visible(workspace_id, site_id))
  WITH CHECK (public.auth_site_visible(workspace_id, site_id));

CREATE POLICY equipment_delete ON public.equipment FOR DELETE TO authenticated
  USING (public.auth_is_privileged(workspace_id));
