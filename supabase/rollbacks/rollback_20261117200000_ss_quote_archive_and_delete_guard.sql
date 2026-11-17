BEGIN;

DROP TRIGGER IF EXISTS quotes_enforce_delete_policy ON public.quotes;
DROP FUNCTION IF EXISTS public.quotes_enforce_delete_policy();

DROP INDEX IF EXISTS public.quotes_workspace_archived_at_idx;

ALTER TABLE public.quotes
  DROP COLUMN IF EXISTS archived_by,
  DROP COLUMN IF EXISTS archived_at;

COMMIT;
