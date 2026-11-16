-- Rollback for 20261116140000_ss_jobs_idempotency_key (local only).
-- Run the API without the Idempotency-Key handling first, or job creation with a key fails.
BEGIN;
DROP INDEX IF EXISTS public.jobs_workspace_idempotency_key_uidx;
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_idempotency_key_length;
ALTER TABLE public.jobs DROP COLUMN IF EXISTS idempotency_key;
COMMIT;
