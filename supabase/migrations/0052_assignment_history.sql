-- Dispatch: keep assignment history on reassign. Active assignment = unassigned_at IS NULL.
-- Do not delete assignment rows; close them. Completion leaves the row active.

ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS unassigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS unassigned_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL;

DO $$
DECLARE
  cname text;
BEGIN
  FOR cname IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'assignments'
      AND con.contype = 'u'
  LOOP
    EXECUTE format('ALTER TABLE public.assignments DROP CONSTRAINT IF EXISTS %I', cname);
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS assignments_active_unique
  ON public.assignments (workspace_id, user_id, resource_type, resource_id)
  WHERE unassigned_at IS NULL;

CREATE INDEX IF NOT EXISTS assignments_active_resource_idx
  ON public.assignments (workspace_id, resource_type, resource_id)
  WHERE unassigned_at IS NULL;

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
      AND a.unassigned_at IS NULL
  );
$$;

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
         AND a.unassigned_at IS NULL
        WHERE j.workspace_id = p_workspace_id AND j.site_id = p_site_id
      )
      OR EXISTS (
        SELECT 1 FROM public.projects p
        JOIN public.assignments a
          ON a.workspace_id = p.workspace_id
         AND a.resource_type = 'project'
         AND a.resource_id = p.id
         AND a.user_id = auth.uid()
         AND a.unassigned_at IS NULL
        WHERE p.workspace_id = p_workspace_id AND p.site_id = p_site_id
      )
      OR EXISTS (
        SELECT 1 FROM public.service_calls sc
        JOIN public.assignments a
          ON a.workspace_id = sc.workspace_id
         AND a.resource_type = 'service_call'
         AND a.resource_id = sc.id
         AND a.user_id = auth.uid()
         AND a.unassigned_at IS NULL
        WHERE sc.workspace_id = p_workspace_id AND sc.site_id = p_site_id
      )
    );
$$;

COMMENT ON COLUMN public.assignments.unassigned_at IS 'Set on reassign; NULL means currently assigned';
