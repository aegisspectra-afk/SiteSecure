-- Rollback for 20261116120000_ss_technician_assigned_job_scope (local only). Restores the previous definitions.
BEGIN;
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
      OR EXISTS (
        SELECT 1 FROM public.jobs j
        WHERE j.id = p_job_id
          AND public.auth_site_visible(j.workspace_id, j.site_id)
      )
    );
$function$
;
DROP POLICY IF EXISTS documents_insert ON public.documents;
CREATE POLICY documents_insert ON public.documents FOR INSERT TO authenticated WITH CHECK ((auth_is_member(workspace_id) AND auth_role_in(workspace_id, ARRAY['owner'::text, 'administrator'::text, 'manager'::text, 'sales'::text, 'technician'::text, 'founding_technician'::text])));
DROP POLICY IF EXISTS documents_select ON public.documents;
CREATE POLICY documents_select ON public.documents FOR SELECT TO authenticated USING ((auth_is_member(workspace_id) AND ((NOT auth_is_assigned_scope(workspace_id)) OR ((entity_type = 'site'::document_entity_type) AND auth_site_visible(workspace_id, entity_id)) OR ((entity_type = 'system'::document_entity_type) AND (EXISTS ( SELECT 1
   FROM systems sys
  WHERE ((sys.id = documents.entity_id) AND auth_site_visible(sys.workspace_id, sys.site_id))))) OR ((entity_type = 'equipment'::document_entity_type) AND (EXISTS ( SELECT 1
   FROM equipment eq
  WHERE ((eq.id = documents.entity_id) AND (eq.workspace_id = documents.workspace_id) AND auth_site_visible(eq.workspace_id, eq.site_id))))) OR ((entity_type = 'job'::document_entity_type) AND auth_job_visible(workspace_id, entity_id)) OR ((entity_type = 'customer'::document_entity_type) AND auth_customer_visible(workspace_id, entity_id)) OR ((entity_type = 'quote'::document_entity_type) AND (EXISTS ( SELECT 1
   FROM quotes q
  WHERE ((q.id = documents.entity_id) AND (q.workspace_id = documents.workspace_id))))) OR ((entity_type = 'project'::document_entity_type) AND (EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = documents.entity_id) AND (p.workspace_id = documents.workspace_id))))) OR ((entity_type = 'warranty'::document_entity_type) AND (EXISTS ( SELECT 1
   FROM warranties w
  WHERE ((w.id = documents.entity_id) AND (w.workspace_id = documents.workspace_id))))) OR ((entity_type = 'workspace'::document_entity_type) AND (entity_id = workspace_id)))));
DROP POLICY IF EXISTS project_planned_items_select ON public.project_planned_items;
CREATE POLICY project_planned_items_select ON public.project_planned_items FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = project_planned_items.project_id) AND (p.workspace_id = project_planned_items.workspace_id) AND auth_is_member(p.workspace_id) AND ((NOT auth_is_assigned_scope(p.workspace_id)) OR auth_assigned(p.workspace_id, 'project'::assignment_resource_type, p.id) OR ((p.site_id IS NOT NULL) AND auth_site_visible(p.workspace_id, p.site_id)))))));
DROP POLICY IF EXISTS project_planned_items_update ON public.project_planned_items;
CREATE POLICY project_planned_items_update ON public.project_planned_items FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = project_planned_items.project_id) AND (p.workspace_id = project_planned_items.workspace_id) AND (auth_is_managerial(p.workspace_id) OR auth_assigned(p.workspace_id, 'project'::assignment_resource_type, p.id) OR ((p.site_id IS NOT NULL) AND auth_site_visible(p.workspace_id, p.site_id))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM projects p
  WHERE ((p.id = project_planned_items.project_id) AND (p.workspace_id = project_planned_items.workspace_id) AND (auth_is_managerial(p.workspace_id) OR auth_assigned(p.workspace_id, 'project'::assignment_resource_type, p.id) OR ((p.site_id IS NOT NULL) AND auth_site_visible(p.workspace_id, p.site_id)))))));
DROP POLICY IF EXISTS projects_select ON public.projects;
CREATE POLICY projects_select ON public.projects FOR SELECT TO authenticated USING ((auth_is_member(workspace_id) AND ((NOT auth_is_assigned_scope(workspace_id)) OR auth_assigned(workspace_id, 'project'::assignment_resource_type, id) OR ((site_id IS NOT NULL) AND auth_site_visible(workspace_id, site_id)))));
DROP POLICY IF EXISTS projects_update ON public.projects;
CREATE POLICY projects_update ON public.projects FOR UPDATE TO authenticated USING ((auth_is_managerial(workspace_id) OR auth_assigned(workspace_id, 'project'::assignment_resource_type, id) OR ((site_id IS NOT NULL) AND auth_site_visible(workspace_id, site_id)))) WITH CHECK ((auth_is_managerial(workspace_id) OR auth_assigned(workspace_id, 'project'::assignment_resource_type, id) OR ((site_id IS NOT NULL) AND auth_site_visible(workspace_id, site_id))));
DROP POLICY IF EXISTS service_calls_select ON public.service_calls;
CREATE POLICY service_calls_select ON public.service_calls FOR SELECT TO authenticated USING ((auth_is_member(workspace_id) AND ((NOT auth_is_assigned_scope(workspace_id)) OR auth_assigned(workspace_id, 'service_call'::assignment_resource_type, id) OR auth_site_visible(workspace_id, site_id))));
DROP POLICY IF EXISTS service_calls_update ON public.service_calls;
CREATE POLICY service_calls_update ON public.service_calls FOR UPDATE TO authenticated USING ((auth_is_managerial(workspace_id) OR auth_assigned(workspace_id, 'service_call'::assignment_resource_type, id) OR auth_site_visible(workspace_id, site_id))) WITH CHECK ((auth_is_managerial(workspace_id) OR auth_assigned(workspace_id, 'service_call'::assignment_resource_type, id) OR auth_site_visible(workspace_id, site_id)));
DROP FUNCTION IF EXISTS public.auth_assigned_document_entity_visible(uuid, public.document_entity_type, uuid);
DROP FUNCTION IF EXISTS public.auth_assigned_service_call_visible(uuid, uuid);
DROP FUNCTION IF EXISTS public.auth_assigned_project_visible(uuid, uuid);
DROP FUNCTION IF EXISTS public.auth_via_assigned_job(uuid, text, uuid);
COMMIT;
