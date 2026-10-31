-- Stage 3: quote contact must belong to the quote customer; search indexes.
-- Stage 5 cloud: enable pg_trgm (CREATE EXTENSION) on the project BEFORE applying this file.

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES public.customer_contacts (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS quotes_workspace_contact_idx
  ON public.quotes (workspace_id, contact_id);

GRANT SELECT (contact_id) ON TABLE public.quotes TO authenticated;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS customers_display_name_trgm_idx
  ON public.customers USING gin (display_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS tasks_title_trgm_idx
  ON public.tasks USING gin (title gin_trgm_ops);
