-- Production Settings: workspace roles (RBAC), PDF document templates, membership workspace_role_key,
-- and quote numbering prefixes from workspace_settings.

-- ── Workspace roles (per-tenant grant matrix + custom roles) ─────────────────

CREATE TABLE public.workspace_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  key text NOT NULL,
  label_he text NOT NULL,
  description text NOT NULL DEFAULT '',
  is_system boolean NOT NULL DEFAULT false,
  is_locked boolean NOT NULL DEFAULT false,
  base_role_key text NOT NULL REFERENCES public.roles (key),
  grants jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_roles_key_chk CHECK (key ~ '^[a-z][a-z0-9_]{1,63}$'),
  CONSTRAINT workspace_roles_workspace_key_uq UNIQUE (workspace_id, key)
);

CREATE INDEX workspace_roles_workspace_idx ON public.workspace_roles (workspace_id);

CREATE TRIGGER workspace_roles_set_updated_at
  BEFORE UPDATE ON public.workspace_roles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.workspace_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_roles FORCE ROW LEVEL SECURITY;

CREATE POLICY workspace_roles_select_member
  ON public.workspace_roles
  FOR SELECT
  TO authenticated
  USING (public.auth_is_member(workspace_id));

CREATE POLICY workspace_roles_write_privileged
  ON public.workspace_roles
  FOR ALL
  TO authenticated
  USING (public.auth_is_privileged(workspace_id))
  WITH CHECK (public.auth_is_privileged(workspace_id));

-- Effective role key for grant lookup (custom roles). Seat/plan still use role_key (base).
ALTER TABLE public.workspace_memberships
  ADD COLUMN IF NOT EXISTS workspace_role_key text;

COMMENT ON COLUMN public.workspace_memberships.workspace_role_key IS
  'Workspace role key for grant resolution; falls back to role_key when null.';

-- ── PDF document templates (layout/branding — not CPQ quote_templates) ───────

CREATE TABLE public.pdf_document_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  name text NOT NULL,
  doc_type text NOT NULL CHECK (doc_type IN ('quote', 'service', 'project')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft')),
  is_default boolean NOT NULL DEFAULT false,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX pdf_document_templates_workspace_idx
  ON public.pdf_document_templates (workspace_id, doc_type);

CREATE UNIQUE INDEX pdf_document_templates_one_default_quote
  ON public.pdf_document_templates (workspace_id)
  WHERE is_default = true AND doc_type = 'quote';

CREATE TRIGGER pdf_document_templates_set_updated_at
  BEFORE UPDATE ON public.pdf_document_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.pdf_document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pdf_document_templates FORCE ROW LEVEL SECURITY;

CREATE POLICY pdf_document_templates_select_member
  ON public.pdf_document_templates
  FOR SELECT
  TO authenticated
  USING (public.auth_is_member(workspace_id));

CREATE POLICY pdf_document_templates_write_privileged
  ON public.pdf_document_templates
  FOR ALL
  TO authenticated
  USING (
    public.auth_role_in(workspace_id, ARRAY['owner', 'administrator'])
    OR public.auth_role(workspace_id) IS NOT NULL
  )
  WITH CHECK (
    public.auth_role_in(workspace_id, ARRAY['owner', 'administrator'])
    OR public.auth_is_member(workspace_id)
  );

-- Tighten write to managerial roles that can edit workspace (owner/admin). API still authorizes.
DROP POLICY pdf_document_templates_write_privileged ON public.pdf_document_templates;
CREATE POLICY pdf_document_templates_write_privileged
  ON public.pdf_document_templates
  FOR ALL
  TO authenticated
  USING (public.auth_is_privileged(workspace_id))
  WITH CHECK (public.auth_is_privileged(workspace_id));

-- ── Quote number prefix from workspace_settings.localization ─────────────────

CREATE OR REPLACE FUNCTION public.quotes_set_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prefix text := 'Q-';
  loc jsonb;
BEGIN
  IF NEW.number IS NULL OR NEW.number = '' THEN
    SELECT ws.localization INTO loc
    FROM public.workspace_settings ws
    WHERE ws.workspace_id = NEW.workspace_id;
    IF loc IS NOT NULL AND COALESCE(loc->>'quote_prefix', '') <> '' THEN
      prefix := loc->>'quote_prefix';
    END IF;
    NEW.number := prefix || lpad(public.next_code(NEW.workspace_id, 'quote')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

-- Seed helpers used by API (SECURITY DEFINER so service path can seed under user JWT too)

CREATE OR REPLACE FUNCTION public.seed_workspace_roles(p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Catalog defaults mirrored for system roles (grants filled by API from catalog on first access if empty).
  INSERT INTO public.workspace_roles (workspace_id, key, label_he, description, is_system, is_locked, base_role_key, grants)
  VALUES
    (p_workspace_id, 'owner', 'בעלים', 'בעלים — גישה מלאה. לא ניתן לצמצם.', true, true, 'owner', '["*"]'::jsonb),
    (p_workspace_id, 'administrator', 'מנהל מערכת', 'ניהול סביבה, משתמשים והגדרות.', true, false, 'administrator', '[]'::jsonb),
    (p_workspace_id, 'manager', 'תפעול', 'תפעול שטח, פרויקטים ותיקי אתר.', true, false, 'manager', '[]'::jsonb),
    (p_workspace_id, 'sales', 'מכירות', 'מכירות, לידים והצעות מחיר.', true, false, 'sales', '[]'::jsonb),
    (p_workspace_id, 'technician', 'טכנאי', 'עבודות שטח ושירות.', true, false, 'technician', '[]'::jsonb),
    (p_workspace_id, 'viewer', 'צפייה בלבד', 'צפייה בלבד בכל המודולים הפתוחים.', true, false, 'viewer', '[]'::jsonb)
  ON CONFLICT (workspace_id, key) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.seed_workspace_pdf_templates(p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.pdf_document_templates WHERE workspace_id = p_workspace_id) THEN
    RETURN;
  END IF;
  INSERT INTO public.pdf_document_templates (workspace_id, name, doc_type, status, is_default, config)
  VALUES (
    p_workspace_id,
    'הצעת מחיר — סטנדרט',
    'quote',
    'active',
    true,
    jsonb_build_object(
      'primaryColor', '#0b6bcb',
      'secondaryColor', '#0f172a',
      'showLogo', true,
      'showCompanyAddress', true,
      'showPaymentTerms', true,
      'showTechnicalNotes', true,
      'showCustomerSignature', true,
      'showQuoteValidity', true,
      'headerCompany', true,
      'headerContact', true,
      'headerLogo', true,
      'bodyCustomerSite', true,
      'bodyLineItems', true,
      'bodyTotals', true,
      'footerPayment', true,
      'footerNotes', true,
      'footerSignature', true,
      'footerPageNumber', true,
      'notes', 'ההצעה כוללת אספקה, התקנה והדרכה בסיסית.',
      'paymentTerms', 'שוטף + 30 · מקדמה 40% עם אישור ההצעה'
    )
  );
END;
$$;

-- Hook into existing workspace defaults seeder
CREATE OR REPLACE FUNCTION public.seed_workspace_defaults(p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.product_categories (workspace_id, key, name_he, sort_order) VALUES
    (p_workspace_id, 'cctv', 'מצלמות', 10),
    (p_workspace_id, 'nvr', 'הקלטה / NVR', 20),
    (p_workspace_id, 'alarm', 'אזעקה', 30),
    (p_workspace_id, 'access', 'בקרת כניסה', 40),
    (p_workspace_id, 'network', 'רשת', 50),
    (p_workspace_id, 'cables', 'כבלים והתקנה', 60),
    (p_workspace_id, 'labor', 'עבודה', 70)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.quote_templates (workspace_id, key, name_he) VALUES
    (p_workspace_id, 'apartment', 'דירה'),
    (p_workspace_id, 'private_house', 'בית פרטי'),
    (p_workspace_id, 'villa', 'וילה'),
    (p_workspace_id, 'office', 'משרד'),
    (p_workspace_id, 'store', 'חנות'),
    (p_workspace_id, 'warehouse', 'מחסן')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.checklist_templates (workspace_id, key, name_he)
  VALUES (p_workspace_id, 'job_complete', 'סגירת עבודה')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.checklist_template_items (workspace_id, template_id, label_he, required, sort_order)
  SELECT p_workspace_id, t.id, x.label, x.required, x.sort_order
  FROM public.checklist_templates t
  CROSS JOIN (
    VALUES
      ('הגעה לאתר', true, 10),
      ('עבודה בוצעה', true, 20),
      ('צילומים הועלו', false, 30),
      ('חתימת לקוח', true, 40)
  ) AS x(label, required, sort_order)
  WHERE t.workspace_id = p_workspace_id AND t.key = 'job_complete'
    AND NOT EXISTS (
      SELECT 1 FROM public.checklist_template_items i WHERE i.template_id = t.id
    );

  PERFORM public.seed_workspace_roles(p_workspace_id);
  PERFORM public.seed_workspace_pdf_templates(p_workspace_id);
END;
$$;

-- Backfill existing workspaces
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM public.workspaces LOOP
    PERFORM public.seed_workspace_roles(r.id);
    PERFORM public.seed_workspace_pdf_templates(r.id);
  END LOOP;
END $$;
