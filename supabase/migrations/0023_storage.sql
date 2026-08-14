-- Private buckets. Path convention: {workspace_id}/...
-- Public product pages use tokenized API routes, not public objects.

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('photos', 'photos', false),
  ('documents', 'documents', false),
  ('signatures', 'signatures', false),
  ('branding', 'branding', false),
  ('exports', 'exports', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY storage_objects_select_member
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id IN ('photos', 'documents', 'signatures', 'branding', 'exports')
    AND public.auth_is_member((storage.foldername(name))[1]::uuid)
  );

CREATE POLICY storage_objects_insert_member
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('photos', 'documents', 'signatures', 'branding', 'exports')
    AND public.auth_is_member((storage.foldername(name))[1]::uuid)
  );

CREATE POLICY storage_objects_update_member
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id IN ('photos', 'documents', 'signatures', 'branding', 'exports')
    AND public.auth_is_member((storage.foldername(name))[1]::uuid)
  )
  WITH CHECK (
    bucket_id IN ('photos', 'documents', 'signatures', 'branding', 'exports')
    AND public.auth_is_member((storage.foldername(name))[1]::uuid)
  );

CREATE POLICY storage_objects_delete_member
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id IN ('photos', 'documents', 'signatures', 'branding', 'exports')
    AND (
      public.auth_is_privileged((storage.foldername(name))[1]::uuid)
      OR owner = auth.uid()
    )
  );
