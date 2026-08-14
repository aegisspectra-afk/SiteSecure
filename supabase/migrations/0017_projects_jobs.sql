CREATE TYPE public.project_status AS ENUM (
  'draft', 'planned', 'in_progress', 'on_hold', 'completed', 'cancelled'
);

CREATE TYPE public.job_kind AS ENUM (
  'installation', 'service', 'maintenance', 'survey', 'other'
);

CREATE TYPE public.job_status AS ENUM (
  'scheduled', 'en_route', 'in_progress', 'completed', 'cancelled'
);

CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  name text NOT NULL,
  status public.project_status NOT NULL DEFAULT 'draft',
  customer_id uuid NOT NULL REFERENCES public.customers (id) ON DELETE RESTRICT,
  site_id uuid REFERENCES public.sites (id) ON DELETE SET NULL,
  source_quote_id uuid REFERENCES public.quotes (id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX projects_workspace_status_idx ON public.projects (workspace_id, status);

CREATE TRIGGER projects_set_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  number text NOT NULL,
  title text NOT NULL,
  kind public.job_kind NOT NULL DEFAULT 'service',
  status public.job_status NOT NULL DEFAULT 'scheduled',
  project_id uuid REFERENCES public.projects (id) ON DELETE SET NULL,
  service_call_id uuid,
  customer_id uuid NOT NULL REFERENCES public.customers (id) ON DELETE RESTRICT,
  site_id uuid NOT NULL REFERENCES public.sites (id) ON DELETE RESTRICT,
  scheduled_for timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  completion_notes text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, number)
);

CREATE INDEX jobs_workspace_status_idx ON public.jobs (workspace_id, status);
CREATE INDEX jobs_workspace_scheduled_idx ON public.jobs (workspace_id, scheduled_for);
CREATE INDEX jobs_workspace_site_idx ON public.jobs (workspace_id, site_id);

CREATE TRIGGER jobs_set_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.jobs_set_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.number IS NULL OR NEW.number = '' THEN
    NEW.number := 'J-' || lpad(public.next_code(NEW.workspace_id, 'job')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER jobs_set_number
  BEFORE INSERT ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.jobs_set_number();

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
      OR EXISTS (
        SELECT 1 FROM public.jobs j
        JOIN public.assignments a
          ON a.workspace_id = j.workspace_id
         AND a.resource_type = 'job'
         AND a.resource_id = j.id
         AND a.user_id = auth.uid()
        WHERE j.workspace_id = p_workspace_id
          AND j.site_id = p_site_id
      )
      OR EXISTS (
        SELECT 1 FROM public.projects p
        JOIN public.assignments a
          ON a.workspace_id = p.workspace_id
         AND a.resource_type = 'project'
         AND a.resource_id = p.id
         AND a.user_id = auth.uid()
        WHERE p.workspace_id = p_workspace_id
          AND p.site_id = p_site_id
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.auth_job_visible(p_workspace_id uuid, p_job_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.auth_is_member(p_workspace_id)
    AND (
      public.auth_is_managerial(p_workspace_id)
      OR public.auth_role(p_workspace_id) IN ('sales', 'viewer')
      OR public.auth_assigned(p_workspace_id, 'job', p_job_id)
      OR EXISTS (
        SELECT 1 FROM public.jobs j
        WHERE j.id = p_job_id
          AND public.auth_site_visible(j.workspace_id, j.site_id)
      )
    );
$$;

REVOKE ALL ON FUNCTION public.auth_job_visible(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_job_visible(uuid, uuid) TO authenticated;

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects FORCE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs FORCE ROW LEVEL SECURITY;

CREATE POLICY projects_select ON public.projects FOR SELECT TO authenticated
  USING (
    public.auth_is_member(workspace_id)
    AND (
      NOT public.auth_is_assigned_scope(workspace_id)
      OR public.auth_assigned(workspace_id, 'project', id)
      OR (site_id IS NOT NULL AND public.auth_site_visible(workspace_id, site_id))
    )
  );

CREATE POLICY projects_insert ON public.projects FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_role_in(
      workspace_id,
      ARRAY['owner','administrator','manager','technician','founding_technician']
    )
  );

CREATE POLICY projects_update ON public.projects FOR UPDATE TO authenticated
  USING (
    public.auth_is_managerial(workspace_id)
    OR public.auth_assigned(workspace_id, 'project', id)
    OR (site_id IS NOT NULL AND public.auth_site_visible(workspace_id, site_id))
  )
  WITH CHECK (
    public.auth_is_managerial(workspace_id)
    OR public.auth_assigned(workspace_id, 'project', id)
    OR (site_id IS NOT NULL AND public.auth_site_visible(workspace_id, site_id))
  );

CREATE POLICY projects_delete ON public.projects FOR DELETE TO authenticated
  USING (public.auth_is_privileged(workspace_id));

CREATE POLICY jobs_select ON public.jobs FOR SELECT TO authenticated
  USING (public.auth_job_visible(workspace_id, id));

CREATE POLICY jobs_insert ON public.jobs FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_role_in(
      workspace_id,
      ARRAY['owner','administrator','manager','technician','founding_technician']
    )
    AND public.auth_site_visible(workspace_id, site_id)
  );

CREATE POLICY jobs_update ON public.jobs FOR UPDATE TO authenticated
  USING (public.auth_job_visible(workspace_id, id))
  WITH CHECK (public.auth_job_visible(workspace_id, id));

CREATE POLICY jobs_delete ON public.jobs FOR DELETE TO authenticated
  USING (public.auth_is_privileged(workspace_id));
