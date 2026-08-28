-- Backfill documents.byte_size from Supabase Storage metadata where files exist.
-- Orphan upload intents (no storage object) keep byte_size NULL and do not count toward quota.

UPDATE public.documents d
SET byte_size = (o.metadata->>'size')::integer
FROM storage.objects o
WHERE d.byte_size IS NULL
  AND o.bucket_id = d.storage_bucket
  AND o.name = d.storage_path
  AND o.metadata->>'size' IS NOT NULL;
