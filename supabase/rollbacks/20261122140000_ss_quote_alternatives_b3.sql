-- Rollback B3 quote alternatives (local / staging only — never auto-run in prod).
BEGIN;

ALTER TABLE public.quote_items DROP COLUMN IF EXISTS alternative_id;
ALTER TABLE public.quote_sections DROP COLUMN IF EXISTS alternative_id;

ALTER TABLE public.quotes DROP COLUMN IF EXISTS approved_alternative_id;
ALTER TABLE public.quotes DROP COLUMN IF EXISTS presentation_mode;

DROP POLICY IF EXISTS quote_alternatives_write ON public.quote_alternatives;
DROP POLICY IF EXISTS quote_alternatives_select ON public.quote_alternatives;
DROP TABLE IF EXISTS public.quote_alternatives;

COMMIT;
