CREATE TYPE public.service_call_status AS ENUM ('open', 'in_progress', 'waiting', 'closed');
CREATE TYPE public.service_call_priority AS ENUM ('low', 'normal', 'high', 'critical');
CREATE TYPE public.service_contract_plan AS ENUM ('basic', 'plus', 'pro');
CREATE TYPE public.service_contract_status AS ENUM ('active', 'paused', 'ended');

CREATE TABLE public.service_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  status public.service_call_status NOT NULL DEFAULT 'open',
  priority public.service_call_priority NOT NULL DEFAULT 'normal',
  customer_id uuid NOT NULL REFERENCES public.customers (id) ON DELETE RESTRICT,
  site_id uuid NOT NULL REFERENCES public.sites (id) ON DELETE RESTRICT,
  system_id uuid REFERENCES public.systems (id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX service_calls_workspace_status_idx ON public.service_calls (workspace_id, status);

CREATE TRIGGER service_calls_set_updated_at
  BEFORE UPDATE ON public.service_calls
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_service_call_id_fkey
  FOREIGN KEY (service_call_id) REFERENCES public.service_calls (id) ON DELETE SET NULL;

CREATE TABLE public.service_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers (id) ON DELETE RESTRICT,
  site_id uuid REFERENCES public.sites (id) ON DELETE SET NULL,
  plan public.service_contract_plan NOT NULL DEFAULT 'basic',
  status public.service_contract_status NOT NULL DEFAULT 'active',
  starts_on date,
  ends_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER service_contracts_set_updated_at
  BEFORE UPDATE ON public.service_contracts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

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
        WHERE j.workspace_id = p_workspace_id AND j.site_id = p_site_id
      )
      OR EXISTS (
        SELECT 1 FROM public.projects p
        JOIN public.assignments a
          ON a.workspace_id = p.workspace_id
         AND a.resource_type = 'project'
         AND a.resource_id = p.id
         AND a.user_id = auth.uid()
        WHERE p.workspace_id = p_workspace_id AND p.site_id = p_site_id
      )
      OR EXISTS (
        SELECT 1 FROM public.service_calls sc
        JOIN public.assignments a
          ON a.workspace_id = sc.workspace_id
         AND a.resource_type = 'service_call'
         AND a.resource_id = sc.id
         AND a.user_id = auth.uid()
        WHERE sc.workspace_id = p_workspace_id AND sc.site_id = p_site_id
      )
    );
$$;

ALTER TABLE public.service_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_calls FORCE ROW LEVEL SECURITY;
ALTER TABLE public.service_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_contracts FORCE ROW LEVEL SECURITY;

CREATE POLICY service_calls_select ON public.service_calls FOR SELECT TO authenticated
  USING (
    public.auth_is_member(workspace_id)
    AND (
      NOT public.auth_is_assigned_scope(workspace_id)
      OR public.auth_assigned(workspace_id, 'service_call', id)
      OR public.auth_site_visible(workspace_id, site_id)
    )
  );

CREATE POLICY service_calls_insert ON public.service_calls FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_role_in(
      workspace_id,
      ARRAY['owner','administrator','manager','technician','founding_technician']
    )
  );

CREATE POLICY service_calls_update ON public.service_calls FOR UPDATE TO authenticated
  USING (
    public.auth_is_managerial(workspace_id)
    OR public.auth_assigned(workspace_id, 'service_call', id)
    OR public.auth_site_visible(workspace_id, site_id)
  )
  WITH CHECK (
    public.auth_is_managerial(workspace_id)
    OR public.auth_assigned(workspace_id, 'service_call', id)
    OR public.auth_site_visible(workspace_id, site_id)
  );

CREATE POLICY service_calls_delete ON public.service_calls FOR DELETE TO authenticated
  USING (public.auth_is_privileged(workspace_id));

CREATE POLICY service_contracts_select ON public.service_contracts FOR SELECT TO authenticated
  USING (public.auth_is_managerial(workspace_id) OR public.auth_role(workspace_id) IN ('sales', 'viewer'));

CREATE POLICY service_contracts_write ON public.service_contracts FOR ALL TO authenticated
  USING (public.auth_is_managerial(workspace_id))
  WITH CHECK (public.auth_is_managerial(workspace_id));
