CREATE TABLE public.product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  key text NOT NULL,
  name_he text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  UNIQUE (workspace_id, key)
);

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.product_categories (id) ON DELETE SET NULL,
  sku text NOT NULL,
  name text NOT NULL,
  unit text NOT NULL DEFAULT 'unit',
  list_price numeric(12, 2) NOT NULL DEFAULT 0,
  cost numeric(12, 2) NOT NULL DEFAULT 0,
  vat_eligible boolean NOT NULL DEFAULT true,
  is_labor boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, sku)
);

CREATE INDEX products_workspace_active_idx ON public.products (workspace_id, is_active);

CREATE TRIGGER products_set_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.quote_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  key text NOT NULL,
  name_he text NOT NULL,
  UNIQUE (workspace_id, key)
);

CREATE TABLE public.quote_template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES public.quote_templates (id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products (id) ON DELETE SET NULL,
  description text NOT NULL,
  qty numeric(12, 2) NOT NULL DEFAULT 1,
  sort_order integer NOT NULL DEFAULT 0
);

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories FORCE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products FORCE ROW LEVEL SECURITY;
ALTER TABLE public.quote_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_templates FORCE ROW LEVEL SECURITY;
ALTER TABLE public.quote_template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_template_items FORCE ROW LEVEL SECURITY;

-- Catalog is workspace-wide (price list). Costs are stripped in the API without quotes.view_cost.
CREATE POLICY product_categories_select ON public.product_categories FOR SELECT TO authenticated
  USING (public.auth_is_member(workspace_id));

CREATE POLICY product_categories_write ON public.product_categories FOR ALL TO authenticated
  USING (public.auth_is_managerial(workspace_id))
  WITH CHECK (public.auth_is_managerial(workspace_id));

CREATE POLICY products_select ON public.products FOR SELECT TO authenticated
  USING (public.auth_is_member(workspace_id));

CREATE POLICY products_write ON public.products FOR ALL TO authenticated
  USING (public.auth_is_managerial(workspace_id))
  WITH CHECK (public.auth_is_managerial(workspace_id));

CREATE POLICY quote_templates_select ON public.quote_templates FOR SELECT TO authenticated
  USING (public.auth_is_member(workspace_id));

CREATE POLICY quote_templates_write ON public.quote_templates FOR ALL TO authenticated
  USING (public.auth_is_managerial(workspace_id))
  WITH CHECK (public.auth_is_managerial(workspace_id));

CREATE POLICY quote_template_items_select ON public.quote_template_items FOR SELECT TO authenticated
  USING (public.auth_is_member(workspace_id));

CREATE POLICY quote_template_items_write ON public.quote_template_items FOR ALL TO authenticated
  USING (public.auth_is_managerial(workspace_id))
  WITH CHECK (public.auth_is_managerial(workspace_id));
