-- Rollback DEMO-5 installation completion schema (local only).
-- Note: warranty_status 'pending_period' enum value cannot be removed safely.

BEGIN;

DROP TABLE IF EXISTS public.handover_public_access CASCADE;
DROP TABLE IF EXISTS public.outbound_messages CASCADE;
DROP TABLE IF EXISTS public.billing_pending_items CASCADE;

DROP INDEX IF EXISTS jobs_completion_idempotency_uidx;
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_completion_idempotency_key_len;
ALTER TABLE public.jobs
  DROP COLUMN IF EXISTS completed_by,
  DROP COLUMN IF EXISTS completion_idempotency_key,
  DROP COLUMN IF EXISTS completion_result;

DROP INDEX IF EXISTS warranties_job_id_uidx;
ALTER TABLE public.warranties DROP COLUMN IF EXISTS job_id;

-- Restore trigger to always overwrite (pre-DEMO-5 behavior).
CREATE OR REPLACE FUNCTION public.warranties_set_public_token_hash()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  NEW.public_token := encode(
    digest(convert_to(encode(gen_random_bytes(32), 'hex'), 'UTF8'), 'sha256'),
    'hex'
  );
  RETURN NEW;
END;
$$;

-- ends_on / field_ops left in place (nullable ends_on and field_ops are non-destructive).

COMMIT;
