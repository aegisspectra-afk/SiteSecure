-- INF-1C: Asset connections for basic Site topology (additive).

CREATE TYPE public.asset_connection_type AS ENUM (
  'ethernet',
  'fiber',
  'poe',
  'wireless',
  'uplink',
  'wan',
  'other'
);

CREATE TABLE public.asset_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.sites (id) ON DELETE CASCADE,
  source_equipment_id uuid NOT NULL REFERENCES public.equipment (id) ON DELETE CASCADE,
  target_equipment_id uuid NOT NULL REFERENCES public.equipment (id) ON DELETE CASCADE,
  connection_type public.asset_connection_type NOT NULL DEFAULT 'ethernet',
  source_port text,
  target_port text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT asset_connections_no_self CHECK (source_equipment_id <> target_equipment_id)
);

-- Directional uniqueness including ports (null ports treated as '').
CREATE UNIQUE INDEX asset_connections_unique_edge_uidx
  ON public.asset_connections (
    site_id,
    source_equipment_id,
    target_equipment_id,
    connection_type,
    COALESCE(source_port, ''),
    COALESCE(target_port, '')
  );

CREATE INDEX asset_connections_site_idx
  ON public.asset_connections (workspace_id, site_id);

CREATE INDEX asset_connections_source_idx
  ON public.asset_connections (workspace_id, source_equipment_id);

CREATE INDEX asset_connections_target_idx
  ON public.asset_connections (workspace_id, target_equipment_id);

CREATE TRIGGER asset_connections_set_updated_at
  BEFORE UPDATE ON public.asset_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.asset_connections IS
  'INF-1C: directional Asset→Asset connections for Site topology (no discovery/monitoring).';

ALTER TABLE public.asset_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_connections FORCE ROW LEVEL SECURITY;

CREATE POLICY asset_connections_select ON public.asset_connections FOR SELECT TO authenticated
  USING (public.auth_site_visible(workspace_id, site_id));

CREATE POLICY asset_connections_insert ON public.asset_connections FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_site_visible(workspace_id, site_id)
    AND public.auth_role_in(
      workspace_id,
      ARRAY['owner','administrator','manager','technician','founding_technician']
    )
  );

CREATE POLICY asset_connections_update ON public.asset_connections FOR UPDATE TO authenticated
  USING (public.auth_site_visible(workspace_id, site_id))
  WITH CHECK (public.auth_site_visible(workspace_id, site_id));

CREATE POLICY asset_connections_delete ON public.asset_connections FOR DELETE TO authenticated
  USING (
    public.auth_site_visible(workspace_id, site_id)
    AND public.auth_role_in(
      workspace_id,
      ARRAY['owner','administrator','manager','technician','founding_technician']
    )
  );
