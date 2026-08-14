-- Documents: assigned-scope visibility for jobs/customers/quotes, and UPDATE for complete().

DROP POLICY IF EXISTS documents_select ON public.documents;

CREATE POLICY documents_select ON public.documents FOR SELECT TO authenticated
  USING (
    public.auth_is_member(workspace_id)
    AND (
      NOT public.auth_is_assigned_scope(workspace_id)
      OR (
        entity_type = 'site'
        AND public.auth_site_visible(workspace_id, entity_id)
      )
      OR (
        entity_type = 'system'
        AND EXISTS (
          SELECT 1 FROM public.systems sys
          WHERE sys.id = documents.entity_id
            AND public.auth_site_visible(sys.workspace_id, sys.site_id)
        )
      )
      OR (
        entity_type = 'job'
        AND public.auth_job_visible(workspace_id, entity_id)
      )
      OR (
        entity_type = 'customer'
        AND public.auth_customer_visible(workspace_id, entity_id)
      )
      OR (
        entity_type = 'quote'
        AND EXISTS (
          SELECT 1 FROM public.quotes q
          WHERE q.id = documents.entity_id
            AND q.workspace_id = documents.workspace_id
        )
      )
      OR (
        entity_type = 'project'
        AND EXISTS (
          SELECT 1 FROM public.projects p
          WHERE p.id = documents.entity_id
            AND p.workspace_id = documents.workspace_id
        )
      )
      OR (
        entity_type = 'warranty'
        AND EXISTS (
          SELECT 1 FROM public.warranties w
          WHERE w.id = documents.entity_id
            AND w.workspace_id = documents.workspace_id
        )
      )
    )
  );

DROP POLICY IF EXISTS documents_update ON public.documents;

CREATE POLICY documents_update ON public.documents FOR UPDATE TO authenticated
  USING (
    public.auth_is_member(workspace_id)
    AND (
      created_by = auth.uid()
      OR public.auth_is_managerial(workspace_id)
    )
  )
  WITH CHECK (public.auth_is_member(workspace_id));
