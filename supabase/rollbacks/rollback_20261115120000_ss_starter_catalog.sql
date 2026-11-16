-- Rollback for 20261115120000_ss_starter_catalog.
-- Restores seed_workspace_defaults to its pre-migration function and drops the starter
-- catalog seeder. Products already inserted are workspace data and are NOT deleted; to
-- remove untouched starter items run, per workspace, after review:
--   DELETE FROM public.products
--   WHERE metadata->>'starter_catalog' = 'v1' AND metadata->>'sample_price' = 'true';
BEGIN;
DROP FUNCTION IF EXISTS public.seed_workspace_defaults(uuid);
ALTER FUNCTION public.seed_workspace_defaults_base(uuid) RENAME TO seed_workspace_defaults;
DROP FUNCTION IF EXISTS public.seed_starter_catalog(uuid);
COMMIT;
