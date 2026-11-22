-- B7: workspace quote terms library, defaults on new quotes, maintenance annual template.

CREATE OR REPLACE FUNCTION public.seed_quote_terms_b7(p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quotes jsonb;
  v_tmpl_id uuid;
  v_prod_id uuid;
  v_terms_library constant jsonb := '[
    {"id":"pay_net30","kind":"payment_terms","name_he":"שוטף + 30","body":"תשלום שוטף + 30 ימים ממועד החשבונית."},
    {"id":"pay_50_50","kind":"payment_terms","name_he":"מקדמה 50%","body":"50% מקדמה עם אישור ההזמנה, 50% עם סיום העבודה במקום."},
    {"id":"pay_annual","kind":"payment_terms","name_he":"תשלום שנתי","body":"תשלום שנתי מראש לתקופת החוזה."},
    {"id":"warr_install_12","kind":"warranty","name_he":"אחריות התקנה 12 חודשים","body":"אחריות התקנה — 12 חודשים מיום ההפעלה. אחריות יצרן לציוד לפי תעודת היצרן."},
    {"id":"warr_cctv_24","kind":"warranty","name_he":"אחריות ציוד 24 חודשים","body":"אחריות יצרן על ציוד — 24 חודשים. אחריות התקנה — 12 חודשים."},
    {"id":"warr_maintenance","kind":"warranty","name_he":"כיסוי תחזוקה","body":"כיסוי ביקורים מונעים ותיקון תקלות שוטפות בהתאם לנספח השירות."},
    {"id":"notes_standard","kind":"notes","name_he":"הערה ללקוח","body":"המחירים אינם כוללים מיסים אלא אם צוין אחרת. ההצעה כפופה לסיור ואישור סופי בשטח."}
  ]'::jsonb;
BEGIN
  IF p_workspace_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = p_workspace_id) THEN
    RETURN;
  END IF;

  SELECT COALESCE(quotes, '{}'::jsonb) INTO v_quotes
  FROM public.workspace_settings
  WHERE workspace_id = p_workspace_id;

  IF v_quotes IS NULL THEN
    v_quotes := '{}'::jsonb;
  END IF;

  IF COALESCE(jsonb_array_length(v_quotes->'terms_templates'), 0) = 0 THEN
    v_quotes := v_quotes || jsonb_build_object('terms_templates', v_terms_library);
  END IF;

  IF COALESCE(NULLIF(trim(v_quotes->>'warranty'), ''), '') = '' THEN
    v_quotes := v_quotes || jsonb_build_object(
      'warranty',
      'אחריות התקנה — 12 חודשים מיום ההפעלה. אחריות יצרן לציוד לפי תעודת היצרן.'
    );
  END IF;

  IF COALESCE(NULLIF(trim(v_quotes->>'general_terms'), ''), '') = '' THEN
    v_quotes := v_quotes || jsonb_build_object(
      'general_terms',
      'ההצעה ניתנת לביטול בכתב עד 7 ימים לפני מועד ביצוע העבודה. שינויים בהיקף לאחר אישור ההזמנה יחויבו בנפרד.'
    );
  END IF;

  IF v_quotes->'customer_notes' IS NULL THEN
    v_quotes := v_quotes || jsonb_build_object('customer_notes', '');
  END IF;

  UPDATE public.workspace_settings
  SET quotes = COALESCE(quotes, '{}'::jsonb) || v_quotes
  WHERE workspace_id = p_workspace_id;

  INSERT INTO public.quote_templates (
    workspace_id,
    key,
    name_he,
    description,
    category,
    is_active,
    default_payment_terms,
    default_warranty,
    default_general_terms
  ) VALUES (
    p_workspace_id,
    'maintenance_annual',
    'חוזה תחזוקה שנתי',
    'תבנית להצעת חוזה תחזוקה שנתי — לשימוש בתזכורות שירות.',
    'service',
    true,
    'תשלום שנתי מראש או ב-4 תשלימים רבעוניים.',
    'כיסוי ביקורים מונעים ותיקון תקלות שוטפות בהתאם לנספח השירות.',
    'החוזה לשנה קלנדרית אחת ומתחדש אוטומטית אלא אם בוטל בכתב 30 יום לפני מועד החידוש.'
  )
  ON CONFLICT (workspace_id, key) DO NOTHING
  RETURNING id INTO v_tmpl_id;

  IF v_tmpl_id IS NULL THEN
    SELECT id INTO v_tmpl_id
    FROM public.quote_templates
    WHERE workspace_id = p_workspace_id AND key = 'maintenance_annual';
  END IF;

  IF v_tmpl_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.products (
    workspace_id,
    category_id,
    sku,
    name,
    unit,
    list_price,
    cost,
    kind,
    is_labor,
    description,
    is_active
  )
  SELECT
    p_workspace_id,
    c.id,
    'SS-SVC-MAINT-ANNUAL',
    'חוזה תחזוקה שנתי',
    'job',
    2400.00,
    900.00,
    'service',
    true,
    'ביקורת תקופתית, בדיקות מערכת ותמיכה שוטפת לשנה.',
    true
  FROM public.product_categories c
  WHERE c.workspace_id = p_workspace_id
    AND c.key IN ('labor_maintenance', 'labor', 'labor_service')
  ORDER BY CASE c.key
    WHEN 'labor_maintenance' THEN 1
    WHEN 'labor_service' THEN 2
  ELSE 3 END
  LIMIT 1
  ON CONFLICT (workspace_id, sku) DO NOTHING;

  SELECT id INTO v_prod_id
  FROM public.products
  WHERE workspace_id = p_workspace_id AND sku = 'SS-SVC-MAINT-ANNUAL';

  IF v_prod_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.quote_template_items i WHERE i.template_id = v_tmpl_id
  ) THEN
    INSERT INTO public.quote_template_items (
      workspace_id, template_id, product_id, description, qty, sort_order, item_type, unit_price
    ) VALUES (
      p_workspace_id,
      v_tmpl_id,
      v_prod_id,
      'חוזה תחזוקה שנתי — ביקורת ותמיכה',
      1,
      10,
      'service',
      2400.00
    );
  ELSIF NOT EXISTS (
    SELECT 1 FROM public.quote_template_items i WHERE i.template_id = v_tmpl_id
  ) THEN
    INSERT INTO public.quote_template_items (
      workspace_id, template_id, description, qty, sort_order, item_type, unit_price
    ) VALUES (
      p_workspace_id,
      v_tmpl_id,
      'חוזה תחזוקה שנתי — ביקורת ותמיכה',
      1,
      10,
      'service',
      2400.00
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_quote_terms_b7(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_quote_terms_b7(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.seed_workspace_defaults(p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  PERFORM public.seed_workspace_defaults_base(p_workspace_id);
  PERFORM public.seed_starter_catalog(p_workspace_id);
  PERFORM public.seed_quote_terms_b7(p_workspace_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.seed_workspace_defaults(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seed_workspace_defaults(uuid) TO service_role;

SELECT public.seed_quote_terms_b7(id) FROM public.workspaces;