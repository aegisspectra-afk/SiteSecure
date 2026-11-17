-- DEMO-5: installation completion chain (local apply only).
-- Rollback: supabase/rollbacks/rollback_20261117180000_ss_installation_complete.sql
-- Warranty without months uses status=draft (shown as «ממתין להגדרת תקופה»).

BEGIN;

ALTER TABLE public.warranties
  ADD COLUMN IF NOT EXISTS job_id uuid REFERENCES public.jobs (id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS warranties_job_id_uidx
  ON public.warranties (job_id)
  WHERE job_id IS NOT NULL;

ALTER TABLE public.warranties
  ALTER COLUMN ends_on DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.warranties_set_public_token_hash()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  IF NEW.public_token IS NULL OR btrim(NEW.public_token) = '' THEN
    NEW.public_token := encode(
      digest(convert_to(encode(gen_random_bytes(32), 'hex'), 'UTF8'), 'sha256'),
      'hex'
    );
  END IF;
  RETURN NEW;
END;
$$;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS completed_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS completion_idempotency_key text,
  ADD COLUMN IF NOT EXISTS completion_result jsonb;

ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_completion_idempotency_key_len;
ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_completion_idempotency_key_len
  CHECK (
    completion_idempotency_key IS NULL
    OR (char_length(completion_idempotency_key) BETWEEN 8 AND 100)
  );

CREATE UNIQUE INDEX IF NOT EXISTS jobs_completion_idempotency_uidx
  ON public.jobs (workspace_id, completion_idempotency_key)
  WHERE completion_idempotency_key IS NOT NULL;

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS field_ops jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.workspaces
SET field_ops = jsonb_set(COALESCE(field_ops, '{}'::jsonb), '{warranty_months}', '12'::jsonb, true)
WHERE id = 'ceacad59-168a-4305-b823-53983ecebb12'
  AND COALESCE(field_ops->>'warranty_months', '') = '';

CREATE TABLE IF NOT EXISTS public.billing_pending_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.jobs (id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects (id) ON DELETE SET NULL,
  quote_id uuid REFERENCES public.quotes (id) ON DELETE SET NULL,
  amount_gross numeric(14, 2),
  currency text NOT NULL DEFAULT 'ILS',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'invoiced', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT billing_pending_job_or_project_chk
    CHECK (job_id IS NOT NULL OR project_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS billing_pending_items_job_uidx
  ON public.billing_pending_items (job_id)
  WHERE job_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS billing_pending_items_project_uidx
  ON public.billing_pending_items (project_id)
  WHERE project_id IS NOT NULL AND status = 'pending';

CREATE INDEX IF NOT EXISTS billing_pending_items_ws_idx
  ON public.billing_pending_items (workspace_id, status);

ALTER TABLE public.billing_pending_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_pending_items FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS billing_pending_items_select ON public.billing_pending_items;
CREATE POLICY billing_pending_items_select ON public.billing_pending_items
  FOR SELECT TO authenticated
  USING (public.auth_is_managerial(workspace_id));

REVOKE INSERT, UPDATE, DELETE ON TABLE public.billing_pending_items FROM authenticated;
GRANT SELECT ON TABLE public.billing_pending_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.billing_pending_items TO service_role;

CREATE TABLE IF NOT EXISTS public.outbound_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.jobs (id) ON DELETE SET NULL,
  channel text NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'whatsapp', 'sms')),
  status text NOT NULL DEFAULT 'preview' CHECK (status IN ('preview')),
  recipient text,
  subject text,
  body text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS outbound_messages_ws_idx
  ON public.outbound_messages (workspace_id, created_at DESC);

ALTER TABLE public.outbound_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outbound_messages FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS outbound_messages_select ON public.outbound_messages;
CREATE POLICY outbound_messages_select ON public.outbound_messages
  FOR SELECT TO authenticated
  USING (public.auth_is_managerial(workspace_id));

REVOKE INSERT, UPDATE, DELETE ON TABLE public.outbound_messages FROM authenticated;
GRANT SELECT ON TABLE public.outbound_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.outbound_messages TO service_role;

CREATE TABLE IF NOT EXISTS public.handover_public_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs (id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (token_hash)
);

CREATE INDEX IF NOT EXISTS handover_public_access_job_idx
  ON public.handover_public_access (workspace_id, job_id, created_at DESC);

ALTER TABLE public.handover_public_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.handover_public_access FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.handover_public_access FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.handover_public_access TO service_role;

COMMENT ON TABLE public.handover_public_access IS
  'Hashed handover tokens. Service role only; plaintext never stored.';

COMMIT;
