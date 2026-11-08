-- Rollback 20261031122000_storage_rls_documents_signed_only.sql
-- LOCAL ONLY. Restores member access to all five buckets (0023_storage.sql).

DROP POLICY IF EXISTS storage_objects_select_member ON storage.objects;
DROP POLICY IF EXISTS storage_objects_insert_member ON storage.objects;
DROP POLICY IF EXISTS storage_objects_update_member ON storage.objects;
DROP POLICY IF EXISTS storage_objects_delete_member ON storage.objects;

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

DELETE FROM supabase_migrations.schema_migrations
WHERE version = '20261031122000';
