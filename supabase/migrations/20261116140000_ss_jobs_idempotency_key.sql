-- DEMO-3.3: a second click on "create job" must not create a second job.
--
-- The client sends an Idempotency-Key per create attempt; the API stores it on the job.
-- The unique index makes concurrent duplicates impossible: the second insert fails and the
-- API returns the job that the first one created. Keys are per workspace; NULL (no key) is
-- allowed for any number of jobs, so existing callers are unchanged.
--
-- Rollback: supabase/rollbacks/rollback_20261116140000_ss_jobs_idempotency_key.sql

BEGIN;

ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS idempotency_key text;

ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_idempotency_key_length;
ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_idempotency_key_length CHECK (idempotency_key IS NULL OR char_length(idempotency_key) BETWEEN 8 AND 100);

CREATE UNIQUE INDEX IF NOT EXISTS jobs_workspace_idempotency_key_uidx
  ON public.jobs (workspace_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

COMMIT;
