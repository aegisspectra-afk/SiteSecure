-- Default catalog products + real quote-template lines for every workspace.
-- Applying a template must insert billable lines; names alone are not enough.

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

  INSERT INTO public.products (
    workspace_id, category_id, sku, name, unit, list_price, cost, kind, is_labor, description, is_active
  )
  SELECT
    p_workspace_id,
    c.id,
    v.sku,
    v.name,
    v.unit,
    v.list_price,
    v.cost,
    v.kind,
    v.is_labor,
    v.description,
    true
  FROM (
    VALUES
      ('CAM-DOME', 'cctv', 'מצלמת כיפה 4MP', 'unit', 890.00, 450.00, 'product', false, 'מצלמת אבטחה להתקנה פנימית או חיצונית'),
      ('NVR-8', 'nvr', 'מקליט NVR 8 ערוצים', 'unit', 1450.00, 780.00, 'product', false, 'מערכת הקלטה ל-8 מצלמות'),
      ('ALARM-KIT', 'alarm', 'ערכת אזעקה', 'unit', 2100.00, 980.00, 'product', false, 'מערכת אזעקה בסיסית כולל לוח ובקרים'),
      ('ACCESS-KIT', 'access', 'ערכת בקרת כניסה', 'unit', 1680.00, 820.00, 'product', false, 'קורא, בקר ומנעול חשמלי'),
      ('LABOR-INSTALL', 'labor', 'התקנה והפעלה', 'job', 1200.00, 400.00, 'service', true, 'עבודת התקנה, חיווט והפעלה')
  ) AS v(sku, cat_key, name, unit, list_price, cost, kind, is_labor, description)
  JOIN public.product_categories c
    ON c.workspace_id = p_workspace_id AND c.key = v.cat_key
  ON CONFLICT (workspace_id, sku) DO NOTHING;

  INSERT INTO public.quote_template_items (
    workspace_id, template_id, product_id, description, qty, sort_order
  )
  SELECT p_workspace_id, t.id, p.id, p.name, x.qty, x.sort_order
  FROM (
    VALUES
      ('apartment', 'CAM-DOME', 2, 10),
      ('apartment', 'LABOR-INSTALL', 1, 20),
      ('private_house', 'CAM-DOME', 4, 10),
      ('private_house', 'NVR-8', 1, 20),
      ('private_house', 'LABOR-INSTALL', 1, 30),
      ('villa', 'CAM-DOME', 6, 10),
      ('villa', 'NVR-8', 1, 20),
      ('villa', 'ALARM-KIT', 1, 30),
      ('villa', 'LABOR-INSTALL', 1, 40),
      ('office', 'CAM-DOME', 4, 10),
      ('office', 'ACCESS-KIT', 1, 20),
      ('office', 'LABOR-INSTALL', 1, 30),
      ('store', 'CAM-DOME', 2, 10),
      ('store', 'ALARM-KIT', 1, 20),
      ('store', 'LABOR-INSTALL', 1, 30),
      ('warehouse', 'CAM-DOME', 4, 10),
      ('warehouse', 'NVR-8', 1, 20),
      ('warehouse', 'LABOR-INSTALL', 1, 30)
  ) AS x(tkey, sku, qty, sort_order)
  JOIN public.quote_templates t
    ON t.workspace_id = p_workspace_id AND t.key = x.tkey
  JOIN public.products p
    ON p.workspace_id = p_workspace_id AND p.sku = x.sku
  WHERE NOT EXISTS (
    SELECT 1 FROM public.quote_template_items i WHERE i.template_id = t.id
  );

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
END;
$$;

REVOKE ALL ON FUNCTION public.seed_workspace_defaults(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_workspace_defaults(uuid) TO service_role;

SELECT public.seed_workspace_defaults(id) FROM public.workspaces;
