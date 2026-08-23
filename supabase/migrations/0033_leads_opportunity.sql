-- Lead / Opportunity workflow extensions (visit via tasks.type = 'visit')

CREATE TYPE public.lead_priority AS ENUM ('low', 'normal', 'high', 'urgent');

ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'visit_scheduling';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'visit_scheduled';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'quote_preparing';
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'cancelled';

ALTER TYPE public.lead_source ADD VALUE IF NOT EXISTS 'whatsapp';
ALTER TYPE public.lead_source ADD VALUE IF NOT EXISTS 'facebook';
ALTER TYPE public.lead_source ADD VALUE IF NOT EXISTS 'instagram';
ALTER TYPE public.lead_source ADD VALUE IF NOT EXISTS 'existing_customer';

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS priority public.lead_priority NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS service_type text,
  ADD COLUMN IF NOT EXISTS next_action text,
  ADD COLUMN IF NOT EXISTS next_action_at timestamptz,
  ADD COLUMN IF NOT EXISTS estimated_value_cents integer,
  ADD COLUMN IF NOT EXISTS requirements jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS address_text text,
  ADD COLUMN IF NOT EXISTS property_notes text;

CREATE INDEX IF NOT EXISTS leads_workspace_priority_idx ON public.leads (workspace_id, priority);
CREATE INDEX IF NOT EXISTS leads_customer_idx ON public.leads (workspace_id, customer_id);
CREATE INDEX IF NOT EXISTS leads_next_action_idx ON public.leads (workspace_id, next_action_at);

-- Visit metadata on tasks (type = 'visit')
CREATE TYPE public.visit_time_window AS ENUM ('morning', 'afternoon', 'evening');

CREATE TYPE public.visit_status AS ENUM (
  'pending_schedule',
  'scheduled',
  'completed',
  'cancelled',
  'no_show'
);

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS time_window public.visit_time_window,
  ADD COLUMN IF NOT EXISTS visit_status public.visit_status;

CREATE INDEX IF NOT EXISTS tasks_lead_visit_idx ON public.tasks (workspace_id, lead_id)
  WHERE type = 'visit';
