-- Rollback 20261031193159_drop_unused_customer_notes_activities.sql
-- LOCAL ONLY. Recreates unused CRM tables from 0010_customers.sql.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'activity_type') THEN
    CREATE TYPE public.activity_type AS ENUM ('note', 'call', 'meeting', 'quote', 'job', 'other');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.customer_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers (id) ON DELETE CASCADE,
  body text NOT NULL,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customer_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers (id) ON DELETE CASCADE,
  type public.activity_type NOT NULL,
  title text NOT NULL,
  body text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_notes FORCE ROW LEVEL SECURITY;
ALTER TABLE public.customer_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_activities FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_notes_select ON public.customer_notes;
DROP POLICY IF EXISTS customer_notes_insert ON public.customer_notes;
DROP POLICY IF EXISTS customer_activities_select ON public.customer_activities;
DROP POLICY IF EXISTS customer_activities_insert ON public.customer_activities;

CREATE POLICY customer_notes_select ON public.customer_notes FOR SELECT TO authenticated
  USING (public.auth_customer_visible(workspace_id, customer_id));

CREATE POLICY customer_notes_insert ON public.customer_notes FOR INSERT TO authenticated
  WITH CHECK (public.auth_customer_visible(workspace_id, customer_id));

CREATE POLICY customer_activities_select ON public.customer_activities FOR SELECT TO authenticated
  USING (public.auth_customer_visible(workspace_id, customer_id));

CREATE POLICY customer_activities_insert ON public.customer_activities FOR INSERT TO authenticated
  WITH CHECK (public.auth_customer_visible(workspace_id, customer_id));
