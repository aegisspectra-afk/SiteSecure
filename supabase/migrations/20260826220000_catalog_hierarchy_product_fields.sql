-- Catalog hierarchy (parent_id) + product manufacturer/model/attributes.
-- Replaces flat 7-category seed with a 2-level professional CCTV taxonomy.

ALTER TABLE public.product_categories
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.product_categories (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS product_categories_workspace_parent_idx
  ON public.product_categories (workspace_id, parent_id);

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS manufacturer text,
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS attributes jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.seed_workspace_defaults(p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  -- Roots (sort_order 100+)
  INSERT INTO public.product_categories (workspace_id, key, name_he, sort_order, parent_id) VALUES
    (p_workspace_id, 'video', 'וידאו ואבטחה', 100, NULL),
    (p_workspace_id, 'network', 'תקשורת ורשת', 200, NULL),
    (p_workspace_id, 'cabling', 'כבלים ותשתיות', 300, NULL),
    (p_workspace_id, 'alarm', 'אזעקות', 400, NULL),
    (p_workspace_id, 'access', 'בקרת כניסה', 500, NULL),
    (p_workspace_id, 'power', 'חשמל וספקי כוח', 600, NULL),
    (p_workspace_id, 'intercom', 'אינטרקום', 700, NULL),
    (p_workspace_id, 'fire', 'גילוי אש', 800, NULL),
    (p_workspace_id, 'labor', 'התקנה ועבודה', 900, NULL),
    (p_workspace_id, 'packages', 'חבילות', 1000, NULL)
  ON CONFLICT (workspace_id, key) DO UPDATE
    SET name_he = EXCLUDED.name_he,
        sort_order = EXCLUDED.sort_order,
        archived_at = NULL;

  -- Children keyed as (child_key, parent_key, name_he, sort_order)
  FOR r IN
    SELECT * FROM (VALUES
      -- video
      ('cameras_ip', 'video', 'מצלמות IP', 10),
      ('cameras_analog', 'video', 'מצלמות אנלוגיות', 20),
      ('cameras_ptz', 'video', 'מצלמות PTZ', 30),
      ('cameras_thermal', 'video', 'מצלמות תרמיות', 40),
      ('cameras_special', 'video', 'מצלמות מיוחדות', 50),
      ('nvr', 'video', 'NVR', 60),
      ('dvr_xvr', 'video', 'DVR / XVR', 70),
      ('hdd_recorders', 'video', 'דיסקים קשיחים למערכות הקלטה', 80),
      ('camera_accessories', 'video', 'אביזרי מצלמות', 90),
      ('camera_housings', 'video', 'מארזים / קופסאות', 100),
      ('camera_lenses', 'video', 'עדשות', 110),
      ('camera_mounts', 'video', 'תושבות', 120),
      -- network
      ('switch', 'network', 'Switch', 10),
      ('poe', 'network', 'PoE', 20),
      ('poe_plus', 'network', 'PoE+', 30),
      ('poe_plusplus', 'network', 'PoE++', 40),
      ('switch_managed', 'network', 'Managed Switch', 50),
      ('switch_unmanaged', 'network', 'Unmanaged Switch', 60),
      ('switch_industrial', 'network', 'Industrial Switch', 70),
      ('sfp', 'network', 'SFP', 80),
      ('media_converter', 'network', 'Media Converter', 90),
      ('router', 'network', 'Router', 100),
      ('access_point', 'network', 'Access Point', 110),
      ('firewall', 'network', 'Firewall', 120),
      ('rack', 'network', 'Rack', 130),
      ('patch_panel', 'network', 'Patch Panel', 140),
      ('keystone', 'network', 'Keystone', 150),
      ('rj45', 'network', 'RJ45', 160),
      ('network_cabinets', 'network', 'ארונות תקשורת', 170),
      ('network_accessories', 'network', 'אביזרי תקשורת', 180),
      -- cabling
      ('cat5e', 'cabling', 'CAT5e', 10),
      ('cat6', 'cabling', 'CAT6', 20),
      ('cat6a', 'cabling', 'CAT6A', 30),
      ('cat7', 'cabling', 'CAT7', 40),
      ('fiber', 'cabling', 'סיבים אופטיים', 50),
      ('coax', 'cabling', 'כבל קואקסיאלי', 60),
      ('alarm_cable', 'cabling', 'כבל אזעקה', 70),
      ('intercom_cable', 'cabling', 'כבל אינטרקום', 80),
      ('access_cable', 'cabling', 'כבל בקרת כניסה', 90),
      ('power_cable', 'cabling', 'כבל חשמל', 100),
      ('outdoor_network_cable', 'cabling', 'כבל רשת חוץ', 110),
      ('trunking', 'cabling', 'תעלות', 120),
      ('conduit', 'cabling', 'צנרת', 130),
      ('connectors', 'cabling', 'מחברים', 140),
      ('rj45_connectors', 'cabling', 'מחברי RJ45', 150),
      ('junction_boxes', 'cabling', 'קופסאות', 160),
      ('sleeves', 'cabling', 'שרוולים', 170),
      ('install_accessories', 'cabling', 'אביזרי התקנה', 180),
      -- alarm
      ('alarm_panels', 'alarm', 'פאנלים', 10),
      ('pir_detectors', 'alarm', 'גלאי תנועה', 20),
      ('magnetic_contacts', 'alarm', 'גלאי מגנט', 30),
      ('smoke_detectors_alarm', 'alarm', 'גלאי עשן', 40),
      ('flood_detectors', 'alarm', 'גלאי הצפה', 50),
      ('sirens', 'alarm', 'סירנות', 60),
      ('buzzers', 'alarm', 'צופרים', 70),
      ('keypads', 'alarm', 'מקלדות', 80),
      ('remotes', 'alarm', 'שלטים', 90),
      ('alarm_modules', 'alarm', 'מודולים', 100),
      ('alarm_psu', 'alarm', 'ספקי כוח', 110),
      ('alarm_batteries', 'alarm', 'סוללות', 120),
      ('cellular_comms', 'alarm', 'תקשורת סלולרית', 130),
      ('alarm_accessories', 'alarm', 'אביזרי אזעקה', 140),
      -- access
      ('access_controllers', 'access', 'בקרי כניסה', 10),
      ('rfid_readers', 'access', 'קוראי RFID', 20),
      ('card_readers', 'access', 'קוראי כרטיסים', 30),
      ('fingerprint_readers', 'access', 'קוראי טביעת אצבע', 40),
      ('face_readers', 'access', 'קוראי פנים', 50),
      ('electric_locks', 'access', 'מנעולים חשמליים', 60),
      ('magnetic_locks', 'access', 'מנעולים מגנטיים', 70),
      ('smart_locks', 'access', 'מנעולים חכמים', 80),
      ('exit_buttons', 'access', 'לחצני יציאה', 90),
      ('emergency_buttons_access', 'access', 'לחצני חירום', 100),
      ('access_intercom', 'access', 'אינטרקום', 110),
      ('access_psu', 'access', 'ספקי כוח', 120),
      ('access_cards', 'access', 'כרטיסים', 130),
      ('rfid_tags', 'access', 'תגי RFID', 140),
      ('access_accessories', 'access', 'אביזרים', 150),
      -- power
      ('psu', 'power', 'ספקי כוח', 10),
      ('poe_injectors', 'power', 'ספקי PoE', 20),
      ('ups', 'power', 'UPS', 30),
      ('batteries', 'power', 'סוללות', 40),
      ('splitters', 'power', 'מפצלים', 50),
      ('sockets', 'power', 'שקעים', 60),
      ('inverters', 'power', 'ממירים', 70),
      ('voltage_stabilizers', 'power', 'מייצבי מתח', 80),
      ('power_accessories', 'power', 'אביזרי חשמל', 90),
      -- intercom
      ('intercom_ip', 'intercom', 'אינטרקום IP', 10),
      ('intercom_analog', 'intercom', 'אינטרקום אנלוגי', 20),
      ('intercom_panels', 'intercom', 'פאנלים', 30),
      ('intercom_monitors', 'intercom', 'מסכים', 40),
      ('apartment_units', 'intercom', 'יחידות דירה', 50),
      ('intercom_locks', 'intercom', 'מנעולים', 60),
      ('intercom_psu', 'intercom', 'ספקים', 70),
      ('intercom_accessories', 'intercom', 'אביזרים', 80),
      -- fire
      ('fire_panels', 'fire', 'פאנלים', 10),
      ('smoke_detectors_fire', 'fire', 'גלאי עשן', 20),
      ('heat_detectors', 'fire', 'גלאי חום', 30),
      ('fire_sirens', 'fire', 'צופרים', 40),
      ('emergency_buttons_fire', 'fire', 'לחצני חירום', 50),
      ('fire_modules', 'fire', 'מודולים', 60),
      ('fire_psu', 'fire', 'ספקי כוח', 70),
      ('fire_accessories', 'fire', 'אביזרים', 80),
      -- labor
      ('labor_install_cameras', 'labor', 'התקנת מצלמות', 10),
      ('labor_install_nvr', 'labor', 'התקנת NVR', 20),
      ('labor_install_alarm', 'labor', 'התקנת אזעקה', 30),
      ('labor_install_access', 'labor', 'התקנת בקרת כניסה', 40),
      ('labor_install_intercom', 'labor', 'התקנת אינטרקום', 50),
      ('labor_cable_pull', 'labor', 'השחלת כבל', 60),
      ('labor_wiring', 'labor', 'חיווט', 70),
      ('labor_system_setup', 'labor', 'הגדרות מערכת', 80),
      ('labor_remote_view', 'labor', 'הגדרת צפייה מרחוק', 90),
      ('labor_programming', 'labor', 'תכנות', 100),
      ('labor_tech_visit', 'labor', 'ביקור טכנאי', 110),
      ('labor_troubleshoot', 'labor', 'איתור תקלה', 120),
      ('labor_maintenance', 'labor', 'תחזוקה', 130),
      ('labor_hourly', 'labor', 'עבודה לפי שעה', 140),
      ('labor_height', 'labor', 'עבודה בגובה', 150),
      ('labor_special', 'labor', 'התקנה מיוחדת', 160),
      -- packages
      ('pkg_4cam', 'packages', 'חבילת 4 מצלמות', 10),
      ('pkg_8cam', 'packages', 'חבילת 8 מצלמות', 20),
      ('pkg_16cam', 'packages', 'חבילת 16 מצלמות', 30),
      ('pkg_alarm', 'packages', 'חבילת אזעקה', 40),
      ('pkg_access', 'packages', 'חבילת בקרת כניסה', 50),
      ('pkg_intercom', 'packages', 'חבילת אינטרקום', 60)
    ) AS t(child_key, parent_key, name_he, sort_order)
  LOOP
    INSERT INTO public.product_categories (workspace_id, key, name_he, sort_order, parent_id)
    SELECT p_workspace_id, r.child_key, r.name_he, r.sort_order, p.id
    FROM public.product_categories p
    WHERE p.workspace_id = p_workspace_id AND p.key = r.parent_key
    ON CONFLICT (workspace_id, key) DO UPDATE
      SET name_he = EXCLUDED.name_he,
          sort_order = EXCLUDED.sort_order,
          parent_id = EXCLUDED.parent_id,
          archived_at = NULL;
  END LOOP;

  -- Remap products from legacy flat categories to new leaves
  UPDATE public.products prod
  SET category_id = neu.id
  FROM public.product_categories oldc
  JOIN public.product_categories neu
    ON neu.workspace_id = oldc.workspace_id
   AND neu.key = CASE oldc.key
     WHEN 'cctv' THEN 'cameras_ip'
     WHEN 'nvr' THEN 'nvr'
     WHEN 'alarm' THEN 'alarm_panels'
     WHEN 'access' THEN 'access_controllers'
     WHEN 'network' THEN 'switch'
     WHEN 'cables' THEN 'cat6'
     WHEN 'labor' THEN 'labor_install_cameras'
     ELSE NULL
   END
  WHERE oldc.workspace_id = p_workspace_id
    AND oldc.key IN ('cctv', 'nvr', 'alarm', 'access', 'network', 'cables', 'labor')
    AND prod.category_id = oldc.id
    AND prod.workspace_id = p_workspace_id;

  -- Archive legacy flat categories that are not part of the new taxonomy keys
  UPDATE public.product_categories
  SET archived_at = COALESCE(archived_at, now())
  WHERE workspace_id = p_workspace_id
    AND key IN ('cctv', 'cables')
    AND parent_id IS NULL;

  INSERT INTO public.quote_templates (workspace_id, key, name_he) VALUES
    (p_workspace_id, 'apartment', 'דירה'),
    (p_workspace_id, 'private_house', 'בית פרטי'),
    (p_workspace_id, 'villa', 'וילה'),
    (p_workspace_id, 'office', 'משרד'),
    (p_workspace_id, 'store', 'חנות'),
    (p_workspace_id, 'warehouse', 'מחסן')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.products (
    workspace_id, category_id, sku, name, unit, list_price, cost, kind, is_labor, description, is_active, manufacturer, model
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
    true,
    v.manufacturer,
    v.model
  FROM (
    VALUES
      ('CAM-DOME', 'cameras_ip', 'מצלמת כיפה 4MP', 'unit', 890.00, 450.00, 'product', false, 'מצלמת אבטחה להתקנה פנימית או חיצונית', 'Generic', 'DOME-4MP'),
      ('NVR-8', 'nvr', 'מקליט NVR 8 ערוצים', 'unit', 1450.00, 780.00, 'product', false, 'מערכת הקלטה ל-8 מצלמות', 'Generic', 'NVR-8'),
      ('ALARM-KIT', 'alarm_panels', 'ערכת אזעקה', 'unit', 2100.00, 980.00, 'product', false, 'מערכת אזעקה בסיסית כולל לוח ובקרים', NULL, NULL),
      ('ACCESS-KIT', 'access_controllers', 'ערכת בקרת כניסה', 'unit', 1680.00, 820.00, 'product', false, 'קורא, בקר ומנעול חשמלי', NULL, NULL),
      ('LABOR-INSTALL', 'labor_install_cameras', 'התקנה והפעלה', 'job', 1200.00, 400.00, 'service', true, 'עבודת התקנה, חיווט והפעלה', NULL, NULL)
  ) AS v(sku, cat_key, name, unit, list_price, cost, kind, is_labor, description, manufacturer, model)
  JOIN public.product_categories c
    ON c.workspace_id = p_workspace_id AND c.key = v.cat_key
  ON CONFLICT (workspace_id, sku) DO UPDATE
    SET category_id = EXCLUDED.category_id,
        manufacturer = COALESCE(public.products.manufacturer, EXCLUDED.manufacturer),
        model = COALESCE(public.products.model, EXCLUDED.model);

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

-- Apply to all existing workspaces
SELECT public.seed_workspace_defaults(id) FROM public.workspaces;
