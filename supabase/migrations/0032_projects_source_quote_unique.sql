-- Idempotent link: at most one project per source quote.
CREATE UNIQUE INDEX IF NOT EXISTS projects_source_quote_id_uidx
  ON public.projects (source_quote_id)
  WHERE source_quote_id IS NOT NULL;
