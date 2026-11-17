-- DEMO-5: uniqueness for parallel completion (notifications + one active handover).
-- Rollback: supabase/rollbacks/rollback_20261117193000_ss_demo5_completion_uniques.sql

BEGIN;

-- One job.completed notification per recipient per job.
CREATE UNIQUE INDEX IF NOT EXISTS notifications_job_completed_uidx
  ON public.notifications (workspace_id, recipient_user_id, type, entity_id)
  WHERE type = 'job.completed' AND entity_id IS NOT NULL;

-- At most one active (non-revoked) handover link per job.
CREATE UNIQUE INDEX IF NOT EXISTS handover_public_access_active_job_uidx
  ON public.handover_public_access (job_id)
  WHERE revoked_at IS NULL;

-- One preview outbound message per job (email channel).
CREATE UNIQUE INDEX IF NOT EXISTS outbound_messages_job_email_uidx
  ON public.outbound_messages (job_id)
  WHERE job_id IS NOT NULL AND channel = 'email';

COMMIT;
