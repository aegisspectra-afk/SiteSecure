-- R3: Atomic owned Apply / Replace for system designs.
-- SECURITY DEFINER: tenancy + ownership checks inside; pricing stays in Python.

CREATE OR REPLACE FUNCTION public.system_design_apply_owned(
  p_workspace_id uuid,
  p_quote_id uuid,
  p_design_id uuid,
  p_expected_revision integer,
  p_actor_id uuid,
  p_apply_id uuid,
  p_section_id uuid,
  p_lines jsonb,
  p_confirmed boolean DEFAULT false,
  p_expected_divergence_hash text DEFAULT NULL,
  p_expected_proposed_hash text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_design public.system_designs%ROWTYPE;
  v_quote public.quotes%ROWTYPE;
  v_comp RECORD;
  v_item RECORD;
  v_line jsonb;
  v_owned_ids uuid[] := ARRAY[]::uuid[];
  v_live_fp text;
  v_applied_fp text;
  v_diverged boolean := false;
  v_div_parts text[] := ARRAY[]::text[];
  v_prop_parts text[] := ARRAY[]::text[];
  v_live_hash text;
  v_prop_hash text;
  v_new_id uuid;
  v_inserted int := 0;
  v_deleted int := 0;
  v_component_id uuid;
  v_product_id uuid;
  v_qty numeric;
  v_sort int;
  v_max_sort int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  IF NOT public.auth_is_member(p_workspace_id) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;

  IF p_actor_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;

  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' THEN
    RAISE EXCEPTION 'INVALID_LINES';
  END IF;

  IF p_apply_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_APPLY_ID';
  END IF;

  -- Lock Design
  SELECT * INTO v_design
  FROM public.system_designs
  WHERE id = p_design_id
    AND workspace_id = p_workspace_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DESIGN_NOT_FOUND';
  END IF;

  IF v_design.quote_id IS DISTINCT FROM p_quote_id THEN
    RAISE EXCEPTION 'DESIGN_QUOTE_MISMATCH';
  END IF;

  IF v_design.revision IS DISTINCT FROM p_expected_revision THEN
    RAISE EXCEPTION 'REVISION_CONFLICT';
  END IF;

  -- Lock Quote
  SELECT * INTO v_quote
  FROM public.quotes
  WHERE id = p_quote_id
    AND workspace_id = p_workspace_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'QUOTE_NOT_FOUND';
  END IF;

  IF v_quote.status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'QUOTE_NOT_DRAFT';
  END IF;

  IF p_section_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.quote_sections s
      WHERE s.id = p_section_id
        AND s.workspace_id = p_workspace_id
        AND s.quote_id = p_quote_id
    ) THEN
      RAISE EXCEPTION 'INVALID_SECTION';
    END IF;
  END IF;

  -- Collect owned item ids + divergence vs applied fingerprints
  FOR v_comp IN
    SELECT c.*
    FROM public.system_design_components c
    WHERE c.design_id = p_design_id
      AND c.workspace_id = p_workspace_id
  LOOP
    IF v_comp.quote_item_id IS NOT NULL THEN
      v_owned_ids := array_append(v_owned_ids, v_comp.quote_item_id);
      SELECT qi.* INTO v_item
      FROM public.quote_items qi
      WHERE qi.id = v_comp.quote_item_id
        AND qi.workspace_id = p_workspace_id
        AND qi.quote_id = p_quote_id;

      IF NOT FOUND THEN
        v_diverged := true;
        v_div_parts := array_append(
          v_div_parts,
          v_comp.id::text || ':MISSING:' || COALESCE(v_comp.applied_output_fingerprint, '')
        );
      ELSE
        -- Canonical engineering fp: "{product_id}|{qty}" with qty trimmed of trailing zeros
        v_live_fp := COALESCE(v_item.product_id::text, '') || '|' ||
          COALESCE(
            NULLIF(rtrim(rtrim(to_char(round(COALESCE(v_item.qty, 0), 6), 'FM999999999990.999999'), '0'), '.'), ''),
            '0'
          );
        v_applied_fp := COALESCE(v_comp.applied_output_fingerprint, '');
        IF v_applied_fp = '' THEN
          v_applied_fp := COALESCE(v_comp.applied_product_id::text, '') || '|' ||
            COALESCE(
              NULLIF(rtrim(rtrim(to_char(round(COALESCE(v_comp.applied_qty, 0), 6), 'FM999999999990.999999'), '0'), '.'), ''),
              '0'
            );
        END IF;
        IF v_live_fp IS DISTINCT FROM v_applied_fp
           OR COALESCE(v_item.item_type::text, 'catalog') <> 'catalog' THEN
          v_diverged := true;
          v_div_parts := array_append(
            v_div_parts,
            v_comp.id::text || ':CHANGED:' || v_applied_fp || '=>' || v_live_fp
          );
        END IF;
      END IF;
    END IF;
  END LOOP;

  -- Proposed hash from p_lines (engineering identity only)
  FOR v_line IN SELECT value FROM jsonb_array_elements(p_lines)
  LOOP
    v_prop_parts := array_append(
      v_prop_parts,
      COALESCE(v_line->>'component_id', '') || ':' ||
      COALESCE(v_line->>'product_id', '') || '|' ||
      COALESCE(
        NULLIF(rtrim(rtrim(to_char(round(COALESCE((v_line->>'qty')::numeric, 0), 6), 'FM999999999990.999999'), '0'), '.'), ''),
        '0'
      )
    );
  END LOOP;

  SELECT string_agg(x, '|' ORDER BY x) INTO v_live_hash
  FROM unnest(v_div_parts) AS x;
  v_live_hash := COALESCE(v_live_hash, '');

  SELECT string_agg(x, '|' ORDER BY x) INTO v_prop_hash
  FROM unnest(v_prop_parts) AS x;
  v_prop_hash := COALESCE(v_prop_hash, '');

  IF v_diverged THEN
    IF NOT COALESCE(p_confirmed, false) THEN
      RAISE EXCEPTION 'DIVERGED';
    END IF;
    IF p_expected_divergence_hash IS NULL
       OR p_expected_divergence_hash IS DISTINCT FROM v_live_hash THEN
      RAISE EXCEPTION 'CONFIRMATION_STALE';
    END IF;
  END IF;

  IF p_expected_proposed_hash IS NOT NULL
     AND p_expected_proposed_hash IS DISTINCT FROM v_prop_hash THEN
    RAISE EXCEPTION 'CONFIRMATION_STALE';
  END IF;

  -- Validate lines: component belongs to design; product in workspace; no foreign item ids
  FOR v_line IN SELECT value FROM jsonb_array_elements(p_lines)
  LOOP
    v_component_id := NULLIF(v_line->>'component_id', '')::uuid;
    v_product_id := NULLIF(v_line->>'product_id', '')::uuid;
    IF v_component_id IS NULL OR v_product_id IS NULL THEN
      RAISE EXCEPTION 'INVALID_LINES';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.system_design_components c
      WHERE c.id = v_component_id
        AND c.design_id = p_design_id
        AND c.workspace_id = p_workspace_id
    ) THEN
      RAISE EXCEPTION 'INVALID_COMPONENT';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = v_product_id
        AND p.workspace_id = p_workspace_id
        AND p.is_active IS TRUE
    ) THEN
      RAISE EXCEPTION 'INVALID_PRODUCT';
    END IF;
    -- Reject client-owned arbitrary delete targets
    IF v_line ? 'delete_item_id' THEN
      RAISE EXCEPTION 'INVALID_LINES';
    END IF;
  END LOOP;

  -- Delete ONLY currently owned items for this design (re-query ids)
  SELECT COALESCE(array_agg(c.quote_item_id), ARRAY[]::uuid[])
  INTO v_owned_ids
  FROM public.system_design_components c
  WHERE c.design_id = p_design_id
    AND c.workspace_id = p_workspace_id
    AND c.quote_item_id IS NOT NULL;

  IF array_length(v_owned_ids, 1) IS NOT NULL THEN
    DELETE FROM public.quote_items qi
    WHERE qi.workspace_id = p_workspace_id
      AND qi.quote_id = p_quote_id
      AND qi.id = ANY (v_owned_ids);
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
  END IF;

  -- Clear prior linkage
  UPDATE public.system_design_components
  SET quote_item_id = NULL,
      applied_product_id = NULL,
      applied_qty = NULL,
      applied_output_fingerprint = NULL,
      last_apply_id = NULL
  WHERE design_id = p_design_id
    AND workspace_id = p_workspace_id;

  SELECT COALESCE(MAX(qi.sort_order), 0) INTO v_max_sort
  FROM public.quote_items qi
  WHERE qi.quote_id = p_quote_id AND qi.workspace_id = p_workspace_id;

  v_sort := v_max_sort;

  FOR v_line IN SELECT value FROM jsonb_array_elements(p_lines)
  LOOP
    v_sort := v_sort + 10;
    v_component_id := (v_line->>'component_id')::uuid;
    v_product_id := (v_line->>'product_id')::uuid;
    v_qty := COALESCE((v_line->>'qty')::numeric, 1);

    INSERT INTO public.quote_items (
      workspace_id,
      quote_id,
      product_id,
      item_type,
      description,
      qty,
      unit_price,
      cost,
      discount,
      discount_type,
      line_net,
      sort_order,
      sku,
      name,
      unit,
      catalog_snapshot,
      section_id
    ) VALUES (
      p_workspace_id,
      p_quote_id,
      v_product_id,
      'catalog',
      COALESCE(v_line->>'description', ''),
      v_qty,
      COALESCE((v_line->>'unit_price')::numeric, 0),
      COALESCE((v_line->>'cost')::numeric, 0),
      COALESCE((v_line->>'discount')::numeric, 0),
      COALESCE(NULLIF(v_line->>'discount_type', ''), 'amount'),
      COALESCE((v_line->>'line_net')::numeric, 0),
      COALESCE((v_line->>'sort_order')::integer, v_sort),
      NULLIF(v_line->>'sku', ''),
      NULLIF(v_line->>'name', ''),
      NULLIF(v_line->>'unit', ''),
      COALESCE(v_line->'catalog_snapshot', '{}'::jsonb),
      COALESCE(NULLIF(v_line->>'section_id', '')::uuid, p_section_id)
    )
    RETURNING id INTO v_new_id;

    UPDATE public.system_design_components
    SET quote_item_id = v_new_id,
        applied_product_id = v_product_id,
        applied_qty = v_qty,
        applied_output_fingerprint =
          v_product_id::text || '|' ||
          COALESCE(
            NULLIF(rtrim(rtrim(to_char(round(v_qty, 6), 'FM999999999990.999999'), '0'), '.'), ''),
            '0'
          ),
        last_apply_id = p_apply_id
    WHERE id = v_component_id
      AND design_id = p_design_id
      AND workspace_id = p_workspace_id;

    v_inserted := v_inserted + 1;
  END LOOP;

  UPDATE public.system_designs
  SET current_apply_id = p_apply_id,
      apply_fingerprint = v_prop_hash,
      last_applied_at = now(),
      lifecycle_status = 'applied',
      revision = revision + 1
  WHERE id = p_design_id
    AND workspace_id = p_workspace_id
    AND revision = p_expected_revision;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'REVISION_CONFLICT';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'apply_id', p_apply_id,
    'design_id', p_design_id,
    'revision', p_expected_revision + 1,
    'inserted', v_inserted,
    'deleted', v_deleted,
    'proposed_hash', v_prop_hash,
    'divergence_hash', v_live_hash
  );
END;
$$;

REVOKE ALL ON FUNCTION public.system_design_apply_owned(
  uuid, uuid, uuid, integer, uuid, uuid, uuid, jsonb, boolean, text, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.system_design_apply_owned(
  uuid, uuid, uuid, integer, uuid, uuid, uuid, jsonb, boolean, text, text
) TO authenticated;
