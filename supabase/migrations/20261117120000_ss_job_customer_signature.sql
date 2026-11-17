-- DEMO-4.1: customer signature on a job.
--
-- The image lives in the private "signatures" bucket ({workspace}/job/{job}/...) with a
-- documents row (entity_type job, kind signature). The job points at it and keeps who signed
-- and when, and which user collected it.
-- Only the trusted backend (the API with the service role, after its own checks) may set or
-- change these columns: a technician can update their own job through PostgREST (RLS
-- jobs_update), so without the guard they could forge a signature.
--
-- Rollback: supabase/rollbacks/rollback_20261117120000_ss_job_customer_signature.sql

BEGIN;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS customer_signature_document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer_signer_name text,
  ADD COLUMN IF NOT EXISTS customer_signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS customer_signed_by uuid;

ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_customer_signer_name_len;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_customer_signer_name_len
  CHECK (customer_signer_name IS NULL OR char_length(btrim(customer_signer_name)) BETWEEN 1 AND 120);

CREATE OR REPLACE FUNCTION public.jobs_guard_customer_signature()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF NEW.customer_signature_document_id IS NOT DISTINCT FROM OLD.customer_signature_document_id
     AND NEW.customer_signer_name IS NOT DISTINCT FROM OLD.customer_signer_name
     AND NEW.customer_signed_at IS NOT DISTINCT FROM OLD.customer_signed_at
     AND NEW.customer_signed_by IS NOT DISTINCT FROM OLD.customer_signed_by THEN
    RETURN NEW;
  END IF;
  IF public.ss_is_trusted_backend() THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'SIGNATURE_SERVER_ONLY' USING ERRCODE = '42501';
END;
$function$;

DROP TRIGGER IF EXISTS jobs_guard_customer_signature ON public.jobs;
CREATE TRIGGER jobs_guard_customer_signature
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.jobs_guard_customer_signature();

-- Inserts carry no signature (a new job is never signed).
CREATE OR REPLACE FUNCTION public.jobs_guard_customer_signature_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF (NEW.customer_signature_document_id IS NOT NULL OR NEW.customer_signer_name IS NOT NULL
      OR NEW.customer_signed_at IS NOT NULL OR NEW.customer_signed_by IS NOT NULL)
     AND NOT public.ss_is_trusted_backend() THEN
    RAISE EXCEPTION 'SIGNATURE_SERVER_ONLY' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS jobs_guard_customer_signature_insert ON public.jobs;
CREATE TRIGGER jobs_guard_customer_signature_insert
  BEFORE INSERT ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.jobs_guard_customer_signature_insert();

REVOKE EXECUTE ON FUNCTION public.jobs_guard_customer_signature() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.jobs_guard_customer_signature_insert() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.jobs_guard_customer_signature() TO service_role;
GRANT EXECUTE ON FUNCTION public.jobs_guard_customer_signature_insert() TO service_role;

COMMIT;
