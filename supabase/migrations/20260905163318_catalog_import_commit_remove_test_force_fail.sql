-- Task 15C: remove production test-only force-fail sentinel from catalog_import_commit.
-- Rollback coverage uses UNIQUE(workspace_id, sku) mid-batch failures instead.

CREATE OR REPLACE FUNCTION public.catalog_import_commit(
  p_workspace_id uuid,
  p_rows jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r jsonb;
  v_action text;
  v_sku text;
  v_existing_id uuid;
  v_category_id uuid;
  v_id uuid;
  v_imported int := 0;
  v_updated int := 0;
  v_skipped int := 0;
  v_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  IF NOT public.auth_is_managerial(p_workspace_id) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;

  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'INVALID_ROWS';
  END IF;

  -- Pre-validate all rows (no writes yet)
  FOR r IN SELECT value FROM jsonb_array_elements(p_rows)
  LOOP
    v_action := COALESCE(r->>'action', 'create');
    v_sku := NULLIF(btrim(COALESCE(r->>'sku', '')), '');

    IF v_action NOT IN ('create', 'update', 'skip') THEN
      RAISE EXCEPTION 'INVALID_ACTION';
    ELSIF v_action = 'skip' THEN
      NULL;
    ELSIF v_sku IS NULL OR NULLIF(btrim(COALESCE(r->>'name', '')), '') IS NULL THEN
      RAISE EXCEPTION 'MISSING_REQUIRED_FIELDS';
    END IF;

    IF r ? 'category_id' AND NULLIF(r->>'category_id', '') IS NOT NULL THEN
      v_category_id := (r->>'category_id')::uuid;
      IF NOT EXISTS (
        SELECT 1 FROM public.product_categories c
        WHERE c.id = v_category_id AND c.workspace_id = p_workspace_id
      ) THEN
        RAISE EXCEPTION 'INVALID_CATEGORY';
      END IF;
    END IF;

    IF v_action = 'update' THEN
      v_existing_id := NULLIF(r->>'existing_id', '')::uuid;
      IF v_existing_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.products p
        WHERE p.id = v_existing_id
          AND p.workspace_id = p_workspace_id
          AND p.sku = v_sku
      ) THEN
        RAISE EXCEPTION 'INVALID_UPDATE_TARGET';
      END IF;
    END IF;
  END LOOP;

  -- Apply writes (single transaction = this function)
  FOR r IN SELECT value FROM jsonb_array_elements(p_rows)
  LOOP
    v_action := COALESCE(r->>'action', 'create');

    IF v_action = 'skip' THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    v_sku := btrim(r->>'sku');
    v_category_id := NULLIF(r->>'category_id', '')::uuid;

    IF v_action = 'update' THEN
      v_existing_id := (r->>'existing_id')::uuid;
      UPDATE public.products p
      SET
        name = btrim(r->>'name'),
        description = COALESCE(r->>'description', ''),
        unit = COALESCE(NULLIF(btrim(r->>'unit'), ''), 'unit'),
        list_price = COALESCE((r->>'list_price')::numeric, 0),
        cost = COALESCE((r->>'cost')::numeric, 0),
        manufacturer = NULLIF(btrim(COALESCE(r->>'manufacturer', '')), ''),
        model = NULLIF(btrim(COALESCE(r->>'model', '')), ''),
        category_id = v_category_id,
        attributes = COALESCE(r->'attributes', '{}'::jsonb),
        is_active = COALESCE((r->>'is_active')::boolean, true),
        kind = COALESCE(NULLIF(r->>'kind', ''), 'product'),
        is_labor = COALESCE((r->>'kind') = 'service', false),
        vat_eligible = COALESCE((r->>'vat_eligible')::boolean, true)
      WHERE p.id = v_existing_id
        AND p.workspace_id = p_workspace_id
      RETURNING p.id INTO v_id;

      IF v_id IS NULL THEN
        RAISE EXCEPTION 'UPDATE_FAILED';
      END IF;
      v_updated := v_updated + 1;
      v_ids := array_append(v_ids, v_id);
    ELSE
      INSERT INTO public.products (
        workspace_id, sku, name, description, unit, kind, list_price, cost,
        vat_eligible, is_labor, is_active, manufacturer, model, category_id, attributes
      ) VALUES (
        p_workspace_id,
        v_sku,
        btrim(r->>'name'),
        COALESCE(r->>'description', ''),
        COALESCE(NULLIF(btrim(r->>'unit'), ''), 'unit'),
        COALESCE(NULLIF(r->>'kind', ''), 'product'),
        COALESCE((r->>'list_price')::numeric, 0),
        COALESCE((r->>'cost')::numeric, 0),
        COALESCE((r->>'vat_eligible')::boolean, true),
        COALESCE((r->>'kind') = 'service', false),
        COALESCE((r->>'is_active')::boolean, true),
        NULLIF(btrim(COALESCE(r->>'manufacturer', '')), ''),
        NULLIF(btrim(COALESCE(r->>'model', '')), ''),
        v_category_id,
        COALESCE(r->'attributes', '{}'::jsonb)
      )
      RETURNING id INTO v_id;

      v_imported := v_imported + 1;
      v_ids := array_append(v_ids, v_id);
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'imported', v_imported,
    'updated', v_updated,
    'skipped', v_skipped,
    'product_ids', to_jsonb(v_ids)
  );
END;
$$;

COMMENT ON FUNCTION public.catalog_import_commit(uuid, jsonb) IS
  'Atomic catalog product create/update for workspace import. Managerial members only. No test hooks.';
