-- Rollback for 20261117120000_ss_job_customer_signature (local only).
-- Drops the guard and the columns. Signature images and their documents rows stay.
BEGIN;
DROP TRIGGER IF EXISTS jobs_guard_customer_signature ON public.jobs;
DROP TRIGGER IF EXISTS jobs_guard_customer_signature_insert ON public.jobs;
DROP FUNCTION IF EXISTS public.jobs_guard_customer_signature();
DROP FUNCTION IF EXISTS public.jobs_guard_customer_signature_insert();
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_customer_signer_name_len;
ALTER TABLE public.jobs
  DROP COLUMN IF EXISTS customer_signature_document_id,
  DROP COLUMN IF EXISTS customer_signer_name,
  DROP COLUMN IF EXISTS customer_signed_at,
  DROP COLUMN IF EXISTS customer_signed_by;
COMMIT;
