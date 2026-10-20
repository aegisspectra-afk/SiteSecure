-- Workforce Intelligence Stage 2: restricted workforce_member role + provision columns.
-- Additive. Does not rewrite applied migrations. Does not enable the product on G1/production.

INSERT INTO public.roles (key, label_he, label_en, default_scope)
VALUES ('workforce_member', 'עובד Workforce', 'Workforce member', 'assigned')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.role_permissions (role_key, permission_key)
SELECT role_key, permission_key
FROM (
  VALUES
    ('workforce_member', 'workforce.portal.view'),
    ('workforce_member', 'settings.view')
) AS seed(role_key, permission_key)
ON CONFLICT DO NOTHING;

ALTER TABLE public.workforce_employees
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.workforce_employees.must_change_password IS
  'Forces a password change after manager-provisioned Auth. The password itself is never stored here.';

CREATE UNIQUE INDEX IF NOT EXISTS workforce_employees_email_uidx
  ON public.workforce_employees (workspace_id, lower(email))
  WHERE email IS NOT NULL AND length(trim(email)) > 0;

-- Seed the system role for existing and new workspaces.
CREATE OR REPLACE FUNCTION public.seed_workspace_roles(p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.workspace_roles (workspace_id, key, label_he, description, is_system, is_locked, base_role_key, grants)
  VALUES
    (p_workspace_id, 'owner', 'בעלים', 'בעלים — גישה מלאה. לא ניתן לצמצם.', true, true, 'owner', '["*"]'::jsonb),
    (p_workspace_id, 'administrator', 'מנהל מערכת', 'ניהול סביבה, משתמשים והגדרות.', true, false, 'administrator', '[]'::jsonb),
    (p_workspace_id, 'manager', 'תפעול', 'תפעול שטח, פרויקטים ותיקי אתר.', true, false, 'manager', '[]'::jsonb),
    (p_workspace_id, 'sales', 'מכירות', 'מכירות, לידים והצעות מחיר.', true, false, 'sales', '[]'::jsonb),
    (
      p_workspace_id,
      'technician',
      'טכנאי',
      'עבודות שטח ושירות.',
      true,
      false,
      'technician',
      $tech$[
        "dashboard.view",
        "calendar.view",
        "calendar.edit",
        "settings.view",
        "crm.view",
        "projects.view",
        "jobs.view",
        "jobs.start",
        "jobs.complete",
        "service.view",
        "service.create",
        "service.edit",
        "service.close",
        "sites.view",
        "sites.edit",
        "systems.view",
        "systems.edit",
        "documents.view",
        "documents.upload",
        "warranties.view",
        "warranties.issue",
        "knowledge.view"
      ]$tech$::jsonb
    ),
    (p_workspace_id, 'viewer', 'צפייה בלבד', 'צפייה בלבד בכל המודולים הפתוחים.', true, false, 'viewer', '[]'::jsonb),
    (
      p_workspace_id,
      'workforce_member',
      'עובד Workforce',
      'גישת פורטל כוח אדם בלבד. ללא CRM או מוצרים אחרים.',
      true,
      true,
      'workforce_member',
      $wf$["settings.view", "workforce.portal.view"]$wf$::jsonb
    )
  ON CONFLICT (workspace_id, key) DO NOTHING;
END;
$$;

INSERT INTO public.workspace_roles (
  workspace_id, key, label_he, description, is_system, is_locked, base_role_key, grants
)
SELECT
  w.id,
  'workforce_member',
  'עובד Workforce',
  'גישת פורטל כוח אדם בלבד. ללא CRM או מוצרים אחרים.',
  true,
  true,
  'workforce_member',
  '["settings.view", "workforce.portal.view"]'::jsonb
FROM public.workspaces w
ON CONFLICT (workspace_id, key) DO NOTHING;

-- Block manager-provisioned workforce users from creating a Site Secure workspace.
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
  v_feature text;
  v_meta jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  v_meta := COALESCE(auth.jwt() -> 'app_metadata', '{}'::jsonb);
  IF COALESCE(v_meta ->> 'workforce_only', '') IN ('true', 't', '1')
     OR COALESCE(v_meta ->> 'provisioned_via', '') = 'workforce' THEN
    RAISE EXCEPTION 'WORKFORCE_USER_CANNOT_CREATE_WORKSPACE';
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

  IF v_plan = 'solo' THEN
    FOREACH v_feature IN ARRAY ARRAY['fleet', 'ssp', 'workforce']::text[]
    LOOP
      IF EXISTS (
        SELECT 1
        FROM public.plan_features pf
        WHERE pf.plan_key = v_plan
          AND pf.feature_key = v_feature
      ) THEN
        IF NOT EXISTS (
          SELECT 1 FROM public.features f WHERE f.key = v_feature
        ) THEN
          RAISE EXCEPTION 'PRODUCT_DEFAULTS_UNAVAILABLE';
        END IF;

        INSERT INTO public.workspace_feature_overrides (workspace_id, feature_key, enabled)
        VALUES (v_id, v_feature, false);
      END IF;
    END LOOP;
  END IF;

  PERFORM public.seed_workspace_defaults(v_id);

  UPDATE public.profiles
  SET last_workspace_id = v_id
  WHERE id = v_uid;

  RETURN v_id;
END;
$$;
