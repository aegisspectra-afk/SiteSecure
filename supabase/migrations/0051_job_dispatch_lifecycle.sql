-- Dispatch-first: extend job lifecycle without replacing existing enums.
-- scheduled remains the open/pre-route state; "assigned" is assignment-row presence.
-- Adds: arrived status, arrived_at, scheduled_end, priority.

ALTER TYPE public.job_status ADD VALUE IF NOT EXISTS 'arrived';
ALTER TYPE public.job_status ADD VALUE IF NOT EXISTS 'blocked';

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS arrived_at timestamptz,
  ADD COLUMN IF NOT EXISTS scheduled_end timestamptz,
  ADD COLUMN IF NOT EXISTS priority public.service_call_priority NOT NULL DEFAULT 'normal';

CREATE INDEX IF NOT EXISTS jobs_workspace_service_call_idx
  ON public.jobs (workspace_id, service_call_id)
  WHERE service_call_id IS NOT NULL;

COMMENT ON COLUMN public.jobs.arrived_at IS 'Set when technician marks arrived on site';
COMMENT ON COLUMN public.jobs.scheduled_end IS 'Optional end of service window';
COMMENT ON COLUMN public.jobs.priority IS 'Operational priority; often copied from service_call';
