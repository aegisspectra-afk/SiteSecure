-- DEMO-1: a technician (assigned scope) sees and writes only the jobs assigned to them.
--
-- Before: auth_job_visible() let any job through when its site was visible, and a site is
-- visible to a technician as soon as they have ANY job there. So a technician with one job
-- at a site could read and update every other technician's job at that site (and its
-- checklist, after-action report and job files). projects, project_planned_items and
-- service_calls had the same site shortcut, and documents of type quote/project/warranty
-- were readable by any assigned-scope member; documents_insert did not check the entity.
--
-- After, for assigned scope only (auth_is_assigned_scope: technician, founding_technician):
--   job          -> assigned to me
--   project      -> assigned to me, or the project of a job assigned to me
--   service call -> assigned to me, or the service call of a job assigned to me
--   documents    -> entity visible by the rules above (site/system/equipment/customer keep
--                   the site path; quote never; project/job/warranty by the new rules)
-- Every other role keeps exactly the previous predicate.

BEGIN;

-- A job assigned to the caller references this project / service call.
CREATE OR REPLACE FUNCTION public.auth_via_assigned_job(p_workspace_id uuid, p_kind text, p_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.jobs j
    JOIN public.assignments a
      ON a.workspace_id = j.workspace_id
     AND a.resource_type = 'job'
     AND a.resource_id = j.id
     AND a.user_id = auth.uid()
     AND a.unassigned_at IS NULL
    WHERE j.workspace_id = p_workspace_id
      AND ((p_kind = 'project' AND j.project_id = p_id)
        OR (p_kind = 'service_call' AND j.service_call_id = p_id))
  );
$function$;

CREATE OR REPLACE FUNCTION public.auth_job_visible(p_workspace_id uuid, p_job_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT public.auth_is_member(p_workspace_id)
    AND (
      public.auth_is_managerial(p_workspace_id)
      OR public.auth_role(p_workspace_id) IN ('sales', 'viewer')
      OR public.auth_assigned(p_workspace_id, 'job', p_job_id)
      OR (
        NOT public.auth_is_assigned_scope(p_workspace_id)
        AND EXISTS (
          SELECT 1 FROM public.jobs j
          WHERE j.id = p_job_id
            AND public.auth_site_visible(j.workspace_id, j.site_id)
        )
      )
    );
$function$;

-- Assigned-scope visibility of a project / service call (callers handle other roles).
CREATE OR REPLACE FUNCTION public.auth_assigned_project_visible(p_workspace_id uuid, p_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT public.auth_assigned(p_workspace_id, 'project', p_project_id)
      OR public.auth_via_assigned_job(p_workspace_id, 'project', p_project_id);
$function$;

CREATE OR REPLACE FUNCTION public.auth_assigned_service_call_visible(p_workspace_id uuid, p_call_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT public.auth_assigned(p_workspace_id, 'service_call', p_call_id)
      OR public.auth_via_assigned_job(p_workspace_id, 'service_call', p_call_id);
$function$;

-- Document entity visibility for assigned scope (used by select and insert).
CREATE OR REPLACE FUNCTION public.auth_assigned_document_entity_visible(
  p_workspace_id uuid, p_entity_type public.document_entity_type, p_entity_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT CASE p_entity_type::text
    WHEN 'site' THEN public.auth_site_visible(p_workspace_id, p_entity_id)
    WHEN 'system' THEN EXISTS (
      SELECT 1 FROM public.systems sys
      WHERE sys.id = p_entity_id AND public.auth_site_visible(sys.workspace_id, sys.site_id))
    WHEN 'equipment' THEN EXISTS (
      SELECT 1 FROM public.equipment eq
      WHERE eq.id = p_entity_id AND eq.workspace_id = p_workspace_id
        AND public.auth_site_visible(eq.workspace_id, eq.site_id))
    WHEN 'job' THEN public.auth_job_visible(p_workspace_id, p_entity_id)
    WHEN 'customer' THEN public.auth_customer_visible(p_workspace_id, p_entity_id)
    WHEN 'project' THEN public.auth_assigned_project_visible(p_workspace_id, p_entity_id)
    WHEN 'warranty' THEN EXISTS (
      SELECT 1 FROM public.warranties w
      WHERE w.id = p_entity_id AND w.workspace_id = p_workspace_id
        AND public.auth_site_visible(w.workspace_id, w.site_id))
    WHEN 'workspace' THEN p_entity_id = p_workspace_id
    ELSE false  -- quote, vehicle: never for assigned scope
  END;
$function$;

-- projects
DROP POLICY IF EXISTS projects_select ON public.projects;
CREATE POLICY projects_select ON public.projects FOR SELECT TO authenticated USING (
  public.auth_is_member(workspace_id) AND (
    NOT public.auth_is_assigned_scope(workspace_id)
    OR public.auth_assigned_project_visible(workspace_id, id)
  )
);
DROP POLICY IF EXISTS projects_update ON public.projects;
CREATE POLICY projects_update ON public.projects FOR UPDATE TO authenticated
USING (
  public.auth_is_managerial(workspace_id)
  OR public.auth_assigned(workspace_id, 'project', id)
  OR (public.auth_is_assigned_scope(workspace_id) AND public.auth_via_assigned_job(workspace_id, 'project', id))
  OR (NOT public.auth_is_assigned_scope(workspace_id) AND site_id IS NOT NULL AND public.auth_site_visible(workspace_id, site_id))
)
WITH CHECK (
  public.auth_is_managerial(workspace_id)
  OR public.auth_assigned(workspace_id, 'project', id)
  OR (public.auth_is_assigned_scope(workspace_id) AND public.auth_via_assigned_job(workspace_id, 'project', id))
  OR (NOT public.auth_is_assigned_scope(workspace_id) AND site_id IS NOT NULL AND public.auth_site_visible(workspace_id, site_id))
);

-- project_planned_items (follow the parent project)
DROP POLICY IF EXISTS project_planned_items_select ON public.project_planned_items;
CREATE POLICY project_planned_items_select ON public.project_planned_items FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_planned_items.project_id
      AND p.workspace_id = project_planned_items.workspace_id
      AND public.auth_is_member(p.workspace_id)
      AND (NOT public.auth_is_assigned_scope(p.workspace_id)
           OR public.auth_assigned_project_visible(p.workspace_id, p.id))
  )
);
DROP POLICY IF EXISTS project_planned_items_update ON public.project_planned_items;
CREATE POLICY project_planned_items_update ON public.project_planned_items FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_planned_items.project_id
      AND p.workspace_id = project_planned_items.workspace_id
      AND (public.auth_is_managerial(p.workspace_id)
           OR public.auth_assigned(p.workspace_id, 'project', p.id)
           OR (public.auth_is_assigned_scope(p.workspace_id) AND public.auth_via_assigned_job(p.workspace_id, 'project', p.id))
           OR (NOT public.auth_is_assigned_scope(p.workspace_id) AND p.site_id IS NOT NULL
               AND public.auth_site_visible(p.workspace_id, p.site_id)))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_planned_items.project_id
      AND p.workspace_id = project_planned_items.workspace_id
      AND (public.auth_is_managerial(p.workspace_id)
           OR public.auth_assigned(p.workspace_id, 'project', p.id)
           OR (public.auth_is_assigned_scope(p.workspace_id) AND public.auth_via_assigned_job(p.workspace_id, 'project', p.id))
           OR (NOT public.auth_is_assigned_scope(p.workspace_id) AND p.site_id IS NOT NULL
               AND public.auth_site_visible(p.workspace_id, p.site_id)))
  )
);

-- service_calls
DROP POLICY IF EXISTS service_calls_select ON public.service_calls;
CREATE POLICY service_calls_select ON public.service_calls FOR SELECT TO authenticated USING (
  public.auth_is_member(workspace_id) AND (
    NOT public.auth_is_assigned_scope(workspace_id)
    OR public.auth_assigned_service_call_visible(workspace_id, id)
  )
);
DROP POLICY IF EXISTS service_calls_update ON public.service_calls;
CREATE POLICY service_calls_update ON public.service_calls FOR UPDATE TO authenticated
USING (
  public.auth_is_managerial(workspace_id)
  OR public.auth_assigned(workspace_id, 'service_call', id)
  OR (public.auth_is_assigned_scope(workspace_id) AND public.auth_via_assigned_job(workspace_id, 'service_call', id))
  OR (NOT public.auth_is_assigned_scope(workspace_id) AND public.auth_site_visible(workspace_id, site_id))
)
WITH CHECK (
  public.auth_is_managerial(workspace_id)
  OR public.auth_assigned(workspace_id, 'service_call', id)
  OR (public.auth_is_assigned_scope(workspace_id) AND public.auth_via_assigned_job(workspace_id, 'service_call', id))
  OR (NOT public.auth_is_assigned_scope(workspace_id) AND public.auth_site_visible(workspace_id, site_id))
);

-- documents
DROP POLICY IF EXISTS documents_select ON public.documents;
CREATE POLICY documents_select ON public.documents FOR SELECT TO authenticated USING (
  public.auth_is_member(workspace_id) AND (
    NOT public.auth_is_assigned_scope(workspace_id)
    OR public.auth_assigned_document_entity_visible(workspace_id, entity_type, entity_id)
  )
);
DROP POLICY IF EXISTS documents_insert ON public.documents;
CREATE POLICY documents_insert ON public.documents FOR INSERT TO authenticated WITH CHECK (
  public.auth_is_member(workspace_id)
  AND public.auth_role_in(workspace_id, ARRAY['owner', 'administrator', 'manager', 'sales', 'technician', 'founding_technician'])
  AND (
    NOT public.auth_is_assigned_scope(workspace_id)
    OR public.auth_assigned_document_entity_visible(workspace_id, entity_type, entity_id)
  )
);

-- Helpers are for policies, not a client API.
REVOKE EXECUTE ON FUNCTION public.auth_via_assigned_job(uuid, text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.auth_assigned_project_visible(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.auth_assigned_service_call_visible(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.auth_assigned_document_entity_visible(uuid, public.document_entity_type, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.auth_via_assigned_job(uuid, text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.auth_assigned_project_visible(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.auth_assigned_service_call_visible(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.auth_assigned_document_entity_visible(uuid, public.document_entity_type, uuid) TO authenticated, service_role;

COMMIT;
