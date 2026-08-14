CREATE TYPE public.assignment_resource_type AS ENUM (
  'site', 'job', 'project', 'service_call', 'customer'
);

CREATE TABLE public.assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  resource_type public.assignment_resource_type NOT NULL,
  resource_id uuid NOT NULL,
  assigned_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id, resource_type, resource_id)
);

CREATE INDEX assignments_lookup_idx
  ON public.assignments (workspace_id, user_id, resource_type, resource_id);
CREATE INDEX assignments_resource_idx
  ON public.assignments (workspace_id, resource_type, resource_id);

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments FORCE ROW LEVEL SECURITY;

CREATE POLICY assignments_select
  ON public.assignments FOR SELECT TO authenticated
  USING (
    public.auth_is_managerial(workspace_id)
    OR user_id = auth.uid()
  );

CREATE POLICY assignments_write_managerial
  ON public.assignments FOR INSERT TO authenticated
  WITH CHECK (public.auth_is_managerial(workspace_id));

CREATE POLICY assignments_update_managerial
  ON public.assignments FOR UPDATE TO authenticated
  USING (public.auth_is_managerial(workspace_id))
  WITH CHECK (public.auth_is_managerial(workspace_id));

CREATE POLICY assignments_delete_managerial
  ON public.assignments FOR DELETE TO authenticated
  USING (public.auth_is_managerial(workspace_id));

CREATE OR REPLACE FUNCTION public.auth_assigned(
  p_workspace_id uuid,
  p_resource_type public.assignment_resource_type,
  p_resource_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.assignments a
    WHERE a.workspace_id = p_workspace_id
      AND a.user_id = auth.uid()
      AND a.resource_type = p_resource_type
      AND a.resource_id = p_resource_id
  );
$$;

REVOKE ALL ON FUNCTION public.auth_assigned(uuid, public.assignment_resource_type, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_assigned(uuid, public.assignment_resource_type, uuid) TO authenticated;
