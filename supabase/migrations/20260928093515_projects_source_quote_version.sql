-- Q8-A: pin approved quote revision on projects created from quotes.
-- Nullable for existing rows; no guessed backfill.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS source_quote_version integer NULL;

COMMENT ON COLUMN public.projects.source_quote_version IS
  'Quote.version frozen when the project was created from an approved quote. Does not follow later revisions.';

ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_source_quote_version_positive;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_source_quote_version_positive
  CHECK (source_quote_version IS NULL OR source_quote_version >= 1);
