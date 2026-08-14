CREATE TYPE public.site_installation_status AS ENUM (
  'planned', 'in_progress', 'completed', 'inactive'
);

CREATE TYPE public.timeline_event_type AS ENUM (
  'created', 'updated', 'job', 'service', 'quote', 'warranty', 'document', 'note', 'system'
);

CREATE TABLE public.sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers (id) ON DELETE RESTRICT,
  code text NOT NULL,
  name text NOT NULL,
  address jsonb NOT NULL DEFAULT '{}'::jsonb,
  installation_status public.site_installation_status NOT NULL DEFAULT 'planned',
  access_notes text,
  public_token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (workspace_id, code)
);

CREATE INDEX sites_workspace_customer_idx ON public.sites (workspace_id, customer_id);
CREATE INDEX sites_workspace_created_idx ON public.sites (workspace_id, created_at DESC);

CREATE TRIGGER sites_set_updated_at
  BEFORE UPDATE ON public.sites
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.site_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.sites (id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.site_timeline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES public.sites (id) ON DELETE CASCADE,
  event_type public.timeline_event_type NOT NULL,
  title text NOT NULL,
  body text,
  actor_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  source_type text,
  source_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX site_timeline_site_idx ON public.site_timeline_events (workspace_id, site_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.auth_site_visible(p_workspace_id uuid, p_site_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.auth_is_member(p_workspace_id)
    AND (
      NOT public.auth_is_assigned_scope(p_workspace_id)
      OR public.auth_assigned(p_workspace_id, 'site', p_site_id)
    );
$$;

REVOKE ALL ON FUNCTION public.auth_site_visible(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_site_visible(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.sites_ft_auto_assign()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND public.auth_is_assigned_scope(NEW.workspace_id) THEN
    INSERT INTO public.assignments (
      workspace_id, user_id, resource_type, resource_id, assigned_by
    )
    VALUES (NEW.workspace_id, auth.uid(), 'site', NEW.id, auth.uid())
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sites_ft_auto_assign
  AFTER INSERT ON public.sites
  FOR EACH ROW EXECUTE FUNCTION public.sites_ft_auto_assign();

CREATE OR REPLACE FUNCTION public.sites_set_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := 'AS-S-' || lpad(public.next_code(NEW.workspace_id, 'site')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sites_set_code
  BEFORE INSERT ON public.sites
  FOR EACH ROW EXECUTE FUNCTION public.sites_set_code();

-- Assigned technicians also see the customer of a visible site
CREATE OR REPLACE FUNCTION public.auth_customer_visible(p_workspace_id uuid, p_customer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.auth_is_member(p_workspace_id)
    AND (
      NOT public.auth_is_assigned_scope(p_workspace_id)
      OR public.auth_assigned(p_workspace_id, 'customer', p_customer_id)
      OR EXISTS (
        SELECT 1 FROM public.sites s
        WHERE s.workspace_id = p_workspace_id
          AND s.customer_id = p_customer_id
          AND s.deleted_at IS NULL
          AND public.auth_assigned(p_workspace_id, 'site', s.id)
      )
    );
$$;

ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sites FORCE ROW LEVEL SECURITY;
ALTER TABLE public.site_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_zones FORCE ROW LEVEL SECURITY;
ALTER TABLE public.site_timeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_timeline_events FORCE ROW LEVEL SECURITY;

CREATE POLICY sites_select ON public.sites FOR SELECT TO authenticated
  USING (public.auth_site_visible(workspace_id, id) AND deleted_at IS NULL);

CREATE POLICY sites_insert ON public.sites FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_is_member(workspace_id)
    AND public.auth_role_in(
      workspace_id,
      ARRAY['owner','administrator','manager','technician','founding_technician']
    )
    AND public.auth_customer_visible(workspace_id, customer_id)
  );

CREATE POLICY sites_update ON public.sites FOR UPDATE TO authenticated
  USING (public.auth_site_visible(workspace_id, id))
  WITH CHECK (public.auth_site_visible(workspace_id, id));

CREATE POLICY sites_delete ON public.sites FOR DELETE TO authenticated
  USING (public.auth_is_privileged(workspace_id));

CREATE POLICY site_zones_select ON public.site_zones FOR SELECT TO authenticated
  USING (public.auth_site_visible(workspace_id, site_id));

CREATE POLICY site_zones_insert ON public.site_zones FOR INSERT TO authenticated
  WITH CHECK (public.auth_site_visible(workspace_id, site_id));

CREATE POLICY site_zones_update ON public.site_zones FOR UPDATE TO authenticated
  USING (public.auth_site_visible(workspace_id, site_id))
  WITH CHECK (public.auth_site_visible(workspace_id, site_id));

CREATE POLICY site_zones_delete ON public.site_zones FOR DELETE TO authenticated
  USING (public.auth_is_privileged(workspace_id));

CREATE POLICY site_timeline_select ON public.site_timeline_events FOR SELECT TO authenticated
  USING (public.auth_site_visible(workspace_id, site_id));

CREATE POLICY site_timeline_insert ON public.site_timeline_events FOR INSERT TO authenticated
  WITH CHECK (public.auth_site_visible(workspace_id, site_id));
