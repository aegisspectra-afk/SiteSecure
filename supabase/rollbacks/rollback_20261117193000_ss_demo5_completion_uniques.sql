BEGIN;

DROP INDEX IF EXISTS public.outbound_messages_job_email_uidx;
DROP INDEX IF EXISTS public.handover_public_access_active_job_uidx;
DROP INDEX IF EXISTS public.notifications_job_completed_uidx;

COMMIT;
