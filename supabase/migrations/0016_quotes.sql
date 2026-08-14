CREATE TYPE public.quote_status AS ENUM (
  'draft', 'sent', 'viewed', 'approved', 'rejected', 'expired', 'cancelled'
);

CREATE TYPE public.quote_item_type AS ENUM ('catalog', 'free', 'labor', 'note');

CREATE TABLE public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  number text NOT NULL,
  status public.quote_status NOT NULL DEFAULT 'draft',
  customer_id uuid REFERENCES public.customers (id) ON DELETE RESTRICT,
  site_id uuid REFERENCES public.sites (id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.leads (id) ON DELETE SET NULL,
  owner_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  currency text NOT NULL DEFAULT 'ILS',
  vat_percent numeric(5, 2) NOT NULL DEFAULT 18,
  discount_type text,
  discount_value numeric(12, 2) NOT NULL DEFAULT 0,
  subtotal_net numeric(12, 2) NOT NULL DEFAULT 0,
  vat_amount numeric(12, 2) NOT NULL DEFAULT 0,
  total_gross numeric(12, 2) NOT NULL DEFAULT 0,
  cost_total numeric(12, 2) NOT NULL DEFAULT 0,
  margin_amount numeric(12, 2) NOT NULL DEFAULT 0,
  margin_percent numeric(8, 2) NOT NULL DEFAULT 0,
  valid_until date,
  payment_terms text,
  customer_notes text,
  internal_notes text,
  version integer NOT NULL DEFAULT 1,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (workspace_id, number)
);

CREATE INDEX quotes_workspace_status_idx ON public.quotes (workspace_id, status);
CREATE INDEX quotes_workspace_customer_idx ON public.quotes (workspace_id, customer_id);

CREATE TRIGGER quotes_set_updated_at
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.quote_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  quote_id uuid NOT NULL REFERENCES public.quotes (id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products (id) ON DELETE SET NULL,
  item_type public.quote_item_type NOT NULL DEFAULT 'catalog',
  description text NOT NULL DEFAULT '',
  qty numeric(12, 2) NOT NULL DEFAULT 1,
  unit_price numeric(12, 2) NOT NULL DEFAULT 0,
  cost numeric(12, 2) NOT NULL DEFAULT 0,
  discount numeric(12, 2) NOT NULL DEFAULT 0,
  line_net numeric(12, 2) NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE INDEX quote_items_quote_idx ON public.quote_items (workspace_id, quote_id);

CREATE TABLE public.quote_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  quote_id uuid NOT NULL REFERENCES public.quotes (id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.quote_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  quote_id uuid NOT NULL REFERENCES public.quotes (id) ON DELETE CASCADE,
  version integer NOT NULL,
  snapshot jsonb NOT NULL,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (quote_id, version)
);

CREATE OR REPLACE FUNCTION public.quotes_set_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.number IS NULL OR NEW.number = '' THEN
    NEW.number := 'Q-' || lpad(public.next_code(NEW.workspace_id, 'quote')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER quotes_set_number
  BEFORE INSERT ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.quotes_set_number();

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes FORCE ROW LEVEL SECURITY;
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_items FORCE ROW LEVEL SECURITY;
ALTER TABLE public.quote_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.quote_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_versions FORCE ROW LEVEL SECURITY;

CREATE POLICY quotes_select ON public.quotes FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND public.auth_is_member(workspace_id)
    AND (
      public.auth_is_managerial(workspace_id)
      OR owner_user_id = auth.uid()
      OR (
        public.auth_is_assigned_scope(workspace_id)
        AND site_id IS NOT NULL
        AND public.auth_site_visible(workspace_id, site_id)
      )
    )
  );

CREATE POLICY quotes_insert ON public.quotes FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_role_in(workspace_id, ARRAY['owner','administrator','manager','sales'])
  );

CREATE POLICY quotes_update ON public.quotes FOR UPDATE TO authenticated
  USING (
    public.auth_is_managerial(workspace_id)
    OR owner_user_id = auth.uid()
    OR (
      public.auth_role(workspace_id) = 'founding_technician'
      AND site_id IS NOT NULL
      AND public.auth_site_visible(workspace_id, site_id)
    )
  )
  WITH CHECK (
    public.auth_is_managerial(workspace_id)
    OR owner_user_id = auth.uid()
    OR (
      public.auth_role(workspace_id) = 'founding_technician'
      AND site_id IS NOT NULL
      AND public.auth_site_visible(workspace_id, site_id)
    )
  );

CREATE POLICY quotes_delete ON public.quotes FOR DELETE TO authenticated
  USING (public.auth_is_privileged(workspace_id));

CREATE POLICY quote_items_select ON public.quote_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quotes q
      WHERE q.id = quote_items.quote_id
    )
  );

CREATE POLICY quote_items_write ON public.quote_items FOR ALL TO authenticated
  USING (
    public.auth_role_in(
      workspace_id,
      ARRAY['owner','administrator','manager','sales','founding_technician']
    )
    AND EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_items.quote_id)
  )
  WITH CHECK (
    public.auth_role_in(
      workspace_id,
      ARRAY['owner','administrator','manager','sales','founding_technician']
    )
    AND EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_items.quote_id)
  );

CREATE POLICY quote_events_select ON public.quote_events FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_events.quote_id)
  );

CREATE POLICY quote_events_insert ON public.quote_events FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_events.quote_id)
  );

CREATE POLICY quote_versions_select ON public.quote_versions FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_versions.quote_id)
  );

CREATE POLICY quote_versions_insert ON public.quote_versions FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.quotes q WHERE q.id = quote_versions.quote_id)
  );
