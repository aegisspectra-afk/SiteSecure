-- BETA 0.1.6: technician commercial list isolation
-- Remove quotes/catalog commercial grants from technician.
-- Field workflow grants unchanged (jobs/sites/documents/photos/etc.).

-- 1) Canonical role_permissions seed alignment
DELETE FROM public.role_permissions
WHERE role_key = 'technician'
  AND permission_key IN (
    'quotes.view',
    'quotes.create',
    'quotes.edit',
    'quotes.delete',
    'quotes.send',
    'quotes.approve',
    'quotes.export',
    'quotes.view_cost',
    'quotes.override_price',
    'catalog.view',
    'catalog.edit'
  );

-- 2) Force system technician workspace roles onto catalog field grants (no commercial).
-- Non-empty grants are authoritative in API resolve_role_grants; empty arrays fall back to
-- whatever catalog.json the API image ships — so we write the correct list explicitly.
UPDATE public.workspace_roles
SET
  grants = $grants$[
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
  ]$grants$::jsonb,
  updated_at = now()
WHERE is_system = true
  AND base_role_key = 'technician'
  AND key = 'technician';

-- 3) Strip commercial keys from any custom/overridden technician-based roles.
UPDATE public.workspace_roles wr
SET
  grants = coalesce((
    SELECT jsonb_agg(to_jsonb(x) ORDER BY x)
    FROM jsonb_array_elements_text(coalesce(wr.grants, '[]'::jsonb)) AS t(x)
    WHERE x NOT IN (
      'quotes.view',
      'quotes.create',
      'quotes.edit',
      'quotes.delete',
      'quotes.send',
      'quotes.approve',
      'quotes.export',
      'quotes.view_cost',
      'quotes.override_price',
      'catalog.view',
      'catalog.edit'
    )
  ), '[]'::jsonb),
  updated_at = now()
WHERE base_role_key = 'technician'
  AND key <> 'technician'
  AND grants IS NOT NULL
  AND jsonb_typeof(grants) = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(grants) AS t(x)
    WHERE x IN (
      'quotes.view',
      'quotes.create',
      'quotes.edit',
      'quotes.delete',
      'quotes.send',
      'quotes.approve',
      'quotes.export',
      'quotes.view_cost',
      'quotes.override_price',
      'catalog.view',
      'catalog.edit'
    )
  );

-- 4) Seed new workspaces with non-empty technician field grants so a stale API
-- catalog cannot rehydrate quotes.view / catalog.view into empty grant arrays.
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
    (p_workspace_id, 'viewer', 'צפייה בלבד', 'צפייה בלבד בכל המודולים הפתוחים.', true, false, 'viewer', '[]'::jsonb)
  ON CONFLICT (workspace_id, key) DO NOTHING;
END;
$$;
