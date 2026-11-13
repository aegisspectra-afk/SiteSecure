-- Local rollback for 20261031112121_quote_contact_search_indexes.sql
-- Does not drop pg_trgm (shared).

DROP INDEX IF EXISTS public.tasks_title_trgm_idx;
DROP INDEX IF EXISTS public.customers_display_name_trgm_idx;
DROP INDEX IF EXISTS public.quotes_workspace_contact_idx;

ALTER TABLE public.quotes DROP COLUMN IF EXISTS contact_id;
