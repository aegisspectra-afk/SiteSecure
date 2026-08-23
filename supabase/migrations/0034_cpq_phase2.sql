-- CPQ Phase 2: sections, packages, line discount types, margin override, template metadata.
-- Backwards-compatible; existing quotes/items remain valid.

-- Line discount: amount (default, legacy) | percent
ALTER TABLE public.quote_items
  ADD COLUMN IF NOT EXISTS discount_type text NOT NULL DEFAULT 'amount';

ALTER TABLE public.quote_items
  DROP CONSTRAINT IF EXISTS quote_items_discount_type_chk;

ALTER TABLE public.quote_items
  ADD CONSTRAINT quote_items_discount_type_chk
  CHECK (discount_type IN ('amount', 'percent', 'fixed'));

-- Section membership + package provenance (editable after insert)
ALTER TABLE public.quote_items
  ADD COLUMN IF NOT EXISTS section_id uuid;

ALTER TABLE public.quote_items
  ADD COLUMN IF NOT EXISTS package_instance_id uuid;

ALTER TABLE public.quote_items
  ADD COLUMN IF NOT EXISTS package_id uuid;

ALTER TABLE public.quote_items
  ADD COLUMN IF NOT EXISTS package_name text;

-- Sections
CREATE TABLE IF NOT EXISTS public.quote_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  quote_id uuid NOT NULL REFERENCES public.quotes (id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  discount_type text NOT NULL DEFAULT 'amount',
  discount_value numeric(12, 2) NOT NULL DEFAULT 0,
  collapsed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quote_sections_discount_type_chk
    CHECK (discount_type IN ('amount', 'percent', 'fixed'))
);

CREATE INDEX IF NOT EXISTS quote_sections_quote_idx
  ON public.quote_sections (workspace_id, quote_id, sort_order);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'quote_sections_set_updated_at'
  ) THEN
    CREATE TRIGGER quote_sections_set_updated_at
      BEFORE UPDATE ON public.quote_sections
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

ALTER TABLE public.quote_items
  DROP CONSTRAINT IF EXISTS quote_items_section_id_fkey;

ALTER TABLE public.quote_items
  ADD CONSTRAINT quote_items_section_id_fkey
  FOREIGN KEY (section_id) REFERENCES public.quote_sections (id) ON DELETE SET NULL;

-- Reusable packages (workspace catalog of BOM templates)
CREATE TABLE IF NOT EXISTS public.quote_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'general',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quote_packages_workspace_idx
  ON public.quote_packages (workspace_id, is_active);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'quote_packages_set_updated_at'
  ) THEN
    CREATE TRIGGER quote_packages_set_updated_at
      BEFORE UPDATE ON public.quote_packages
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.quote_package_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  package_id uuid NOT NULL REFERENCES public.quote_packages (id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products (id) ON DELETE SET NULL,
  description text NOT NULL DEFAULT '',
  qty numeric(12, 2) NOT NULL DEFAULT 1,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS quote_package_items_pkg_idx
  ON public.quote_package_items (workspace_id, package_id, sort_order);

ALTER TABLE public.quote_items
  DROP CONSTRAINT IF EXISTS quote_items_package_id_fkey;

ALTER TABLE public.quote_items
  ADD CONSTRAINT quote_items_package_id_fkey
  FOREIGN KEY (package_id) REFERENCES public.quote_packages (id) ON DELETE SET NULL;

-- Quote margin override + revision reason
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS margin_override_reason text;

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS margin_override_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL;

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS margin_override_at timestamptz;

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS revise_reason text;

-- Template metadata for save-as (structure only; no customer PII)
ALTER TABLE public.quote_templates
  ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';

ALTER TABLE public.quote_templates
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'general';

ALTER TABLE public.quote_templates
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

ALTER TABLE public.quote_templates
  ADD COLUMN IF NOT EXISTS default_payment_terms text;

ALTER TABLE public.quote_templates
  ADD COLUMN IF NOT EXISTS default_warranty text;

ALTER TABLE public.quote_templates
  ADD COLUMN IF NOT EXISTS default_general_terms text;

ALTER TABLE public.quote_templates
  ADD COLUMN IF NOT EXISTS default_notes text;

ALTER TABLE public.quote_templates
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL;

ALTER TABLE public.quote_templates
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL;

ALTER TABLE public.quote_templates
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.quote_templates
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.quote_template_items
  ADD COLUMN IF NOT EXISTS section_name text;

ALTER TABLE public.quote_template_items
  ADD COLUMN IF NOT EXISTS unit_price numeric(12, 2);

ALTER TABLE public.quote_template_items
  ADD COLUMN IF NOT EXISTS discount numeric(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.quote_template_items
  ADD COLUMN IF NOT EXISTS discount_type text NOT NULL DEFAULT 'amount';

ALTER TABLE public.quote_template_items
  ADD COLUMN IF NOT EXISTS item_type text NOT NULL DEFAULT 'catalog';

-- RLS
ALTER TABLE public.quote_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_sections FORCE ROW LEVEL SECURITY;
ALTER TABLE public.quote_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_packages FORCE ROW LEVEL SECURITY;
ALTER TABLE public.quote_package_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_package_items FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS quote_sections_select ON public.quote_sections;
CREATE POLICY quote_sections_select ON public.quote_sections FOR SELECT TO authenticated
  USING (public.auth_is_member(workspace_id));

DROP POLICY IF EXISTS quote_sections_write ON public.quote_sections;
CREATE POLICY quote_sections_write ON public.quote_sections FOR ALL TO authenticated
  USING (public.auth_is_member(workspace_id))
  WITH CHECK (public.auth_is_member(workspace_id));

DROP POLICY IF EXISTS quote_packages_select ON public.quote_packages;
CREATE POLICY quote_packages_select ON public.quote_packages FOR SELECT TO authenticated
  USING (public.auth_is_member(workspace_id));

DROP POLICY IF EXISTS quote_packages_write ON public.quote_packages;
CREATE POLICY quote_packages_write ON public.quote_packages FOR ALL TO authenticated
  USING (public.auth_is_managerial(workspace_id))
  WITH CHECK (public.auth_is_managerial(workspace_id));

DROP POLICY IF EXISTS quote_package_items_select ON public.quote_package_items;
CREATE POLICY quote_package_items_select ON public.quote_package_items FOR SELECT TO authenticated
  USING (public.auth_is_member(workspace_id));

DROP POLICY IF EXISTS quote_package_items_write ON public.quote_package_items;
CREATE POLICY quote_package_items_write ON public.quote_package_items FOR ALL TO authenticated
  USING (public.auth_is_managerial(workspace_id))
  WITH CHECK (public.auth_is_managerial(workspace_id));
