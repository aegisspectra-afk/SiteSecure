-- Smart defaults when a workspace is created (IKEA / empty-state later).

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
END;
$$;

CREATE OR REPLACE FUNCTION public.create_workspace(p_name text, p_plan_key text DEFAULT 'solo')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_uid uuid := auth.uid();
  v_plan text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;
  IF p_name IS NULL OR length(trim(p_name)) < 2 THEN
    RAISE EXCEPTION 'INVALID_NAME';
  END IF;

  v_plan := COALESCE(NULLIF(p_plan_key, ''), 'solo');
  IF NOT EXISTS (SELECT 1 FROM public.plans WHERE key = v_plan) THEN
    RAISE EXCEPTION 'INVALID_PLAN';
  END IF;

  INSERT INTO public.workspaces (name)
  VALUES (trim(p_name))
  RETURNING id INTO v_id;

  INSERT INTO public.workspace_settings (workspace_id) VALUES (v_id);
  INSERT INTO public.workspace_counters (workspace_id, kind, last_value)
  VALUES
    (v_id, 'site', 0),
    (v_id, 'quote', 0),
    (v_id, 'job', 0),
    (v_id, 'warranty', 0),
    (v_id, 'ft', 0);

  INSERT INTO public.workspace_memberships (workspace_id, user_id, role_key)
  VALUES (v_id, v_uid, 'owner');

  INSERT INTO public.subscriptions (workspace_id, plan_key, status)
  VALUES (v_id, v_plan, 'active');

  PERFORM public.seed_workspace_defaults(v_id);

  UPDATE public.profiles
  SET last_workspace_id = v_id
  WHERE id = v_uid;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_workspace_defaults(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_workspace_defaults(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_workspace(text, text) TO authenticated;
