-- Service warranty expiry reminders (60 / 14 days). Dedup ledger per warranty window.

CREATE TABLE IF NOT EXISTS public.warranty_reminder_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  warranty_id uuid NOT NULL REFERENCES public.warranties (id) ON DELETE CASCADE,
  days_before integer NOT NULL CHECK (days_before IN (60, 14)),
  sent_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT warranty_reminder_events_uniq UNIQUE (warranty_id, days_before)
);

CREATE INDEX IF NOT EXISTS warranty_reminder_events_ws_idx
  ON public.warranty_reminder_events (workspace_id, sent_at DESC);

ALTER TABLE public.warranty_reminder_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warranty_reminder_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS warranty_reminder_events_select ON public.warranty_reminder_events;
CREATE POLICY warranty_reminder_events_select
  ON public.warranty_reminder_events FOR SELECT TO authenticated
  USING (public.auth_is_member(workspace_id));

-- Writes only via service role (API runner). No INSERT/UPDATE/DELETE for authenticated.
COMMENT ON TABLE public.warranty_reminder_events IS
  'Dedup ledger for warranty.expiring notifications (60 and 14 days before ends_on).';
