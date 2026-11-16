-- SITE SECURE Q2.7: starter CCTV catalog.
--
-- New workspaces get it automatically (create_workspace / admin_provision_workspace call
-- seed_workspace_defaults). Existing workspaces load it from the catalog page
-- ("טען קטלוג התחלתי"), through the API with the service role.
--
-- Idempotent: products are matched by (workspace_id, sku); existing ones are skipped,
-- never overwritten. Prices are sample prices, marked in the description
-- ("מחיר לדוגמה – עדכן") and in metadata.sample_price; the API clears the marker when
-- the price is changed.
--
-- seed_workspace_defaults is renamed to seed_workspace_defaults_base (body untouched)
-- and a wrapper with the original name runs it and then the starter catalog.
--
-- Rollback: supabase/rollbacks/rollback_20261115120000_ss_starter_catalog.sql

CREATE OR REPLACE FUNCTION public.seed_starter_catalog(p_workspace_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_marker constant text := 'מחיר לדוגמה – עדכן';
  v_item record;
  v_category uuid;
  v_inserted integer := 0;
  v_skipped integer := 0;
  v_missing_category integer := 0;
  v_rows integer;
BEGIN
  IF p_workspace_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = p_workspace_id) THEN
    RAISE EXCEPTION 'WORKSPACE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  FOR v_item IN
    SELECT * FROM (VALUES
      ('SS-CAM-2MP-DOME',   'cameras_ip',    'מצלמת IP כיפה 2MP',      'יחידה', 290::numeric,
       '{"resolution_mp": 2, "form_factor": "dome", "environment": "indoor_outdoor", "poe": true, "max_power_w": 6, "codec": "h265"}'::jsonb),
      ('SS-CAM-2MP-BULLET', 'cameras_ip',    'מצלמת IP קנה 2MP',       'יחידה', 290,
       '{"resolution_mp": 2, "form_factor": "bullet", "environment": "outdoor", "poe": true, "max_power_w": 6, "codec": "h265"}'),
      ('SS-CAM-4MP-DOME',   'cameras_ip',    'מצלמת IP כיפה 4MP',      'יחידה', 390,
       '{"resolution_mp": 4, "form_factor": "dome", "environment": "indoor_outdoor", "poe": true, "max_power_w": 6, "codec": "h265"}'),
      ('SS-CAM-4MP-BULLET', 'cameras_ip',    'מצלמת IP קנה 4MP',       'יחידה', 390,
       '{"resolution_mp": 4, "form_factor": "bullet", "environment": "outdoor", "poe": true, "max_power_w": 6, "codec": "h265"}'),
      ('SS-CAM-8MP-DOME',   'cameras_ip',    'מצלמת IP כיפה 8MP',      'יחידה', 690,
       '{"resolution_mp": 8, "form_factor": "dome", "environment": "indoor_outdoor", "poe": true, "max_power_w": 8, "codec": "h265"}'),
      ('SS-CAM-8MP-BULLET', 'cameras_ip',    'מצלמת IP קנה 8MP',       'יחידה', 690,
       '{"resolution_mp": 8, "form_factor": "bullet", "environment": "outdoor", "poe": true, "max_power_w": 8, "codec": "h265"}'),
      ('SS-NVR-4CH-POE',    'nvr',           'מקליט NVR 4 ערוצים PoE',  'יחידה', 690,
       '{"channels": 4, "poe_ports": 4, "poe_budget_w": 50, "drive_bays": 1, "max_hdd_tb": 10}'),
      ('SS-NVR-8CH-POE',    'nvr',           'מקליט NVR 8 ערוצים PoE',  'יחידה', 990,
       '{"channels": 8, "poe_ports": 8, "poe_budget_w": 80, "drive_bays": 1, "max_hdd_tb": 10}'),
      ('SS-NVR-16CH-POE',   'nvr',           'מקליט NVR 16 ערוצים PoE', 'יחידה', 1690,
       '{"channels": 16, "poe_ports": 16, "poe_budget_w": 160, "drive_bays": 2, "max_hdd_tb": 10}'),
      ('SS-HDD-2TB',        'hdd_recorders', 'דיסק קשיח למערכות הקלטה 2TB', 'יחידה', 330,
       '{"capacity_tb": 2, "surveillance_grade": true}'),
      ('SS-HDD-4TB',        'hdd_recorders', 'דיסק קשיח למערכות הקלטה 4TB', 'יחידה', 490,
       '{"capacity_tb": 4, "surveillance_grade": true}'),
      ('SS-HDD-6TB',        'hdd_recorders', 'דיסק קשיח למערכות הקלטה 6TB', 'יחידה', 690,
       '{"capacity_tb": 6, "surveillance_grade": true}'),
      ('SS-SW-4P-POE',      'switch',        'מתג PoE 4 יציאות',        'יחידה', 290,
       '{"ports": 6, "poe_ports": 4, "poe_budget_w": 60}'),
      ('SS-SW-8P-POE',      'switch',        'מתג PoE 8 יציאות',        'יחידה', 490,
       '{"ports": 10, "poe_ports": 8, "poe_budget_w": 120}'),
      ('SS-CAT6-M',         'cat6',          'כבל רשת CAT6 (למטר)',     'מטר',  4,
       '{}')
    ) AS t(sku, category_key, name, unit, list_price, attributes)
  LOOP
    SELECT c.id INTO v_category
    FROM public.product_categories c
    WHERE c.workspace_id = p_workspace_id AND c.key = v_item.category_key AND c.archived_at IS NULL
    ORDER BY c.sort_order, c.id
    LIMIT 1;
    IF v_category IS NULL THEN
      v_missing_category := v_missing_category + 1;
    END IF;

    INSERT INTO public.products (
      workspace_id, category_id, sku, name, description, unit, kind, list_price,
      vat_eligible, is_labor, is_active, attributes, metadata
    )
    VALUES (
      p_workspace_id, v_category, v_item.sku, v_item.name, v_marker, v_item.unit, 'product', v_item.list_price,
      true, false, true, v_item.attributes,
      jsonb_build_object('sample_price', true, 'starter_catalog', 'v1')
    )
    ON CONFLICT (workspace_id, sku) DO NOTHING;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 1 THEN
      v_inserted := v_inserted + 1;
    ELSE
      v_skipped := v_skipped + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('inserted', v_inserted, 'skipped', v_skipped, 'missing_category', v_missing_category);
END;
$function$;

ALTER FUNCTION public.seed_workspace_defaults(uuid) RENAME TO seed_workspace_defaults_base;

CREATE FUNCTION public.seed_workspace_defaults(p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  PERFORM public.seed_workspace_defaults_base(p_workspace_id);
  PERFORM public.seed_starter_catalog(p_workspace_id);
END;
$function$;

-- Service role only, like the rest of the seed functions (migration 20261113120000).
REVOKE ALL ON FUNCTION public.seed_starter_catalog(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.seed_workspace_defaults(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.seed_workspace_defaults_base(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seed_starter_catalog(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.seed_workspace_defaults(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.seed_workspace_defaults_base(uuid) TO service_role;
