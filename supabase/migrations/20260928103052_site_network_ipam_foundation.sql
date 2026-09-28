-- INF-1B: Site Network / IPAM foundation (additive, equipment untouched).

CREATE TYPE public.ip_assignment_type AS ENUM ('static', 'dhcp', 'reserved');
CREATE TYPE public.ip_address_status AS ENUM ('available', 'assigned', 'reserved');

-- ── VLANs ───────────────────────────────────────────────────────────────────

CREATE TABLE public.site_vlans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.sites (id) ON DELETE CASCADE,
  vlan_number integer NOT NULL CHECK (vlan_number >= 1 AND vlan_number <= 4094),
  name text NOT NULL,
  purpose text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT site_vlans_site_number_uidx UNIQUE (site_id, vlan_number)
);

CREATE INDEX site_vlans_site_idx ON public.site_vlans (workspace_id, site_id);

CREATE TRIGGER site_vlans_set_updated_at
  BEFORE UPDATE ON public.site_vlans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.site_vlans IS
  'INF-1B: site-scoped VLAN catalog (no switch/port config).';

-- ── Networks / Subnets ──────────────────────────────────────────────────────

CREATE TABLE public.site_networks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.sites (id) ON DELETE CASCADE,
  vlan_id uuid REFERENCES public.site_vlans (id) ON DELETE SET NULL,
  name text NOT NULL,
  cidr text NOT NULL,
  gateway text,
  dhcp_enabled boolean NOT NULL DEFAULT false,
  dhcp_start text,
  dhcp_end text,
  dns_primary text,
  dns_secondary text,
  purpose text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX site_networks_site_idx ON public.site_networks (workspace_id, site_id);
CREATE INDEX site_networks_vlan_idx ON public.site_networks (workspace_id, vlan_id)
  WHERE vlan_id IS NOT NULL;

CREATE TRIGGER site_networks_set_updated_at
  BEFORE UPDATE ON public.site_networks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.site_networks IS
  'INF-1B: site-scoped subnet/network documentation (manual IPAM).';

-- ── IP Addresses ────────────────────────────────────────────────────────────

CREATE TABLE public.site_ip_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.sites (id) ON DELETE CASCADE,
  network_id uuid NOT NULL REFERENCES public.site_networks (id) ON DELETE CASCADE,
  vlan_id uuid REFERENCES public.site_vlans (id) ON DELETE SET NULL,
  equipment_id uuid REFERENCES public.equipment (id) ON DELETE SET NULL,
  ip_address text NOT NULL,
  hostname text,
  mac_address text,
  assignment_type public.ip_assignment_type NOT NULL DEFAULT 'static',
  status public.ip_address_status NOT NULL DEFAULT 'available',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT site_ip_addresses_site_ip_uidx UNIQUE (site_id, ip_address)
);

CREATE INDEX site_ip_addresses_site_idx ON public.site_ip_addresses (workspace_id, site_id);
CREATE INDEX site_ip_addresses_equipment_idx ON public.site_ip_addresses (workspace_id, equipment_id)
  WHERE equipment_id IS NOT NULL;
CREATE INDEX site_ip_addresses_status_idx ON public.site_ip_addresses (workspace_id, site_id, status);

CREATE TRIGGER site_ip_addresses_set_updated_at
  BEFORE UPDATE ON public.site_ip_addresses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.site_ip_addresses IS
  'INF-1B: managed IP assignments. Canonical for new IPAM; equipment.ip remains legacy fallback.';
COMMENT ON COLUMN public.site_ip_addresses.ip_address IS
  'Normalized IP text. Uniqueness enforced per site.';

-- ── RLS (mirror equipment: site visibility + managerial/tech write) ─────────

ALTER TABLE public.site_vlans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_vlans FORCE ROW LEVEL SECURITY;
ALTER TABLE public.site_networks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_networks FORCE ROW LEVEL SECURITY;
ALTER TABLE public.site_ip_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_ip_addresses FORCE ROW LEVEL SECURITY;

CREATE POLICY site_vlans_select ON public.site_vlans FOR SELECT TO authenticated
  USING (public.auth_site_visible(workspace_id, site_id));

CREATE POLICY site_vlans_insert ON public.site_vlans FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_site_visible(workspace_id, site_id)
    AND public.auth_role_in(
      workspace_id,
      ARRAY['owner','administrator','manager','technician','founding_technician']
    )
  );

CREATE POLICY site_vlans_update ON public.site_vlans FOR UPDATE TO authenticated
  USING (public.auth_site_visible(workspace_id, site_id))
  WITH CHECK (public.auth_site_visible(workspace_id, site_id));

CREATE POLICY site_vlans_delete ON public.site_vlans FOR DELETE TO authenticated
  USING (public.auth_is_privileged(workspace_id));

CREATE POLICY site_networks_select ON public.site_networks FOR SELECT TO authenticated
  USING (public.auth_site_visible(workspace_id, site_id));

CREATE POLICY site_networks_insert ON public.site_networks FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_site_visible(workspace_id, site_id)
    AND public.auth_role_in(
      workspace_id,
      ARRAY['owner','administrator','manager','technician','founding_technician']
    )
  );

CREATE POLICY site_networks_update ON public.site_networks FOR UPDATE TO authenticated
  USING (public.auth_site_visible(workspace_id, site_id))
  WITH CHECK (public.auth_site_visible(workspace_id, site_id));

CREATE POLICY site_networks_delete ON public.site_networks FOR DELETE TO authenticated
  USING (public.auth_is_privileged(workspace_id));

CREATE POLICY site_ip_addresses_select ON public.site_ip_addresses FOR SELECT TO authenticated
  USING (public.auth_site_visible(workspace_id, site_id));

CREATE POLICY site_ip_addresses_insert ON public.site_ip_addresses FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_site_visible(workspace_id, site_id)
    AND public.auth_role_in(
      workspace_id,
      ARRAY['owner','administrator','manager','technician','founding_technician']
    )
  );

CREATE POLICY site_ip_addresses_update ON public.site_ip_addresses FOR UPDATE TO authenticated
  USING (public.auth_site_visible(workspace_id, site_id))
  WITH CHECK (public.auth_site_visible(workspace_id, site_id));

CREATE POLICY site_ip_addresses_delete ON public.site_ip_addresses FOR DELETE TO authenticated
  USING (public.auth_is_privileged(workspace_id));
