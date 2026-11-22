-- D2: installation jobs awaiting technician dispatch after quote approval.
--
-- Rollback: supabase/rollbacks/20261122210000_ss_d2_job_awaiting_dispatch.sql

BEGIN;

ALTER TYPE public.job_status ADD VALUE IF NOT EXISTS 'awaiting_dispatch';

COMMIT;