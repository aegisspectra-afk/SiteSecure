-- B3: ועד בית alternatives (up to 3 mutually exclusive tiers on one quote).
BEGIN;

CREATE TABLE IF NOT EXISTS public.quote_alternatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  label text NOT NULL,
  sort_order smallint NOT NULL CHECK (sort_order >= 1 AND sort_order <= 3),
  is_recommended boolean NOT NULL DEFAULT false,
  customer_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (quote_id, sort_order)
);

CREATE INDEX IF NOT EXISTS quote_alternatives_workspace_quote_idx
  ON public.quote_alternatives (workspace_id, quote_id);

COMMENT ON TABLE public.quote_alternatives IS
  'B3: up to 3 sales alternatives (בסיסי/מומלץ/מתקדם) per quote; prices live on quote_items';

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS presentation_mode text NOT NULL DEFAULT 'single'
    CHECK (presentation_mode IN ('single', 'alternatives')),
  ADD COLUMN IF NOT EXISTS approved_alternative_id uuid
    REFERENCES public.quote_alternatives(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.quotes.presentation_mode IS
  'B3: single = classic quote; alternatives = up to 3 customer-facing tiers';
COMMENT ON COLUMN public.quotes.approved_alternative_id IS
  'B3: alternative the customer chose on public approve';

ALTER TABLE public.quote_items
  ADD COLUMN IF NOT EXISTS alternative_id uuid
    REFERENCES public.quote_alternatives(id) ON DELETE RESTRICT;

ALTER TABLE public.quote_sections
  ADD COLUMN IF NOT EXISTS alternative_id uuid
    REFERENCES public.quote_alternatives(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS quote_items_alternative_id_idx
  ON public.quote_items (alternative_id)
  WHERE alternative_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS quote_sections_alternative_id_idx
  ON public.quote_sections (alternative_id)
  WHERE alternative_id IS NOT NULL;

-- RLS: members can read; writes only on draft quotes (API uses service for money-adjacent paths).
ALTER TABLE public.quote_alternatives ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.quote_alternatives FROM anon;
REVOKE TRUNCATE ON public.quote_alternatives FROM authenticated;

DROP POLICY IF EXISTS quote_alternatives_select ON public.quote_alternatives;
CREATE POLICY quote_alternatives_select ON public.quote_alternatives
  FOR SELECT TO authenticated
  USING (public.auth_is_member(workspace_id));

DROP POLICY IF EXISTS quote_alternatives_write ON public.quote_alternatives;
CREATE POLICY quote_alternatives_write ON public.quote_alternatives
  FOR ALL TO authenticated
  USING (
    public.auth_role_in(
      workspace_id,
      ARRAY['owner'::text, 'administrator'::text, 'manager'::text, 'sales'::text, 'founding_technician'::text]
    )
    AND EXISTS (
      SELECT 1 FROM public.quotes q
      WHERE q.id = quote_alternatives.quote_id
        AND q.workspace_id = quote_alternatives.workspace_id
        AND q.status = 'draft'::public.quote_status
    )
  )
  WITH CHECK (
    public.auth_role_in(
      workspace_id,
      ARRAY['owner'::text, 'administrator'::text, 'manager'::text, 'sales'::text, 'founding_technician'::text]
    )
    AND EXISTS (
      SELECT 1 FROM public.quotes q
      WHERE q.id = quote_alternatives.quote_id
        AND q.workspace_id = quote_alternatives.workspace_id
        AND q.status = 'draft'::public.quote_status
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_alternatives TO authenticated;
GRANT SELECT (presentation_mode, approved_alternative_id) ON public.quotes TO authenticated;
GRANT SELECT (alternative_id) ON public.quote_items TO authenticated;
GRANT SELECT (alternative_id) ON public.quote_sections TO authenticated;

COMMIT;
