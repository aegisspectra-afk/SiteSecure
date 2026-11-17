-- Rollback DEMO-6 is_demo flag.

BEGIN;

ALTER TABLE public.workspaces
  DROP COLUMN IF EXISTS is_demo;

COMMIT;
