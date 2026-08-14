CREATE TYPE public.document_entity_type AS ENUM (
  'customer', 'site', 'system', 'job', 'quote', 'project', 'warranty'
);

CREATE TYPE public.document_kind AS ENUM ('document', 'photo', 'signature', 'pdf_export');

CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  entity_type public.document_entity_type NOT NULL,
  entity_id uuid NOT NULL,
  kind public.document_kind NOT NULL DEFAULT 'document',
  storage_bucket text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  byte_size integer,
  checksum text,
  original_filename text,
  captured_at timestamptz,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, storage_bucket, storage_path)
);

CREATE INDEX documents_entity_idx ON public.documents (workspace_id, entity_type, entity_id);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents FORCE ROW LEVEL SECURITY;

-- Visibility: member for now; tightened after jobs exist via entity checks in API.
-- RLS: workspace membership required. Assigned-scope users only see docs for visible sites
-- when entity_type is site/system; other entities tightened in 0017.

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
    )
  );

CREATE POLICY documents_insert ON public.documents FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_is_member(workspace_id)
    AND public.auth_role_in(
      workspace_id,
      ARRAY['owner','administrator','manager','sales','technician','founding_technician']
    )
  );

CREATE POLICY documents_delete ON public.documents FOR DELETE TO authenticated
  USING (
    public.auth_is_privileged(workspace_id)
    OR created_by = auth.uid()
  );
