-- INF-1D part B: service_calls.equipment_id + documents RLS for equipment.
-- Requires 20260928110328_asset_lifecycle_inf1d_enum.sql committed first.

ALTER TABLE public.service_calls
  ADD COLUMN IF NOT EXISTS equipment_id uuid REFERENCES public.equipment (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS service_calls_equipment_idx
  ON public.service_calls (workspace_id, equipment_id)
  WHERE equipment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS service_calls_site_idx
  ON public.service_calls (workspace_id, site_id);

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
        entity_type = 'equipment'
        AND EXISTS (
          SELECT 1 FROM public.equipment eq
          WHERE eq.id = documents.entity_id
            AND eq.workspace_id = documents.workspace_id
            AND public.auth_site_visible(eq.workspace_id, eq.site_id)
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
      OR (
        entity_type = 'workspace'
        AND documents.entity_id = documents.workspace_id
      )
    )
  );

COMMENT ON COLUMN public.service_calls.equipment_id IS
  'INF-1D: optional Asset link for service history (nullable).';
