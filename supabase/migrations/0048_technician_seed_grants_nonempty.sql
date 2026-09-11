-- Follow-up: seed_workspace_roles must insert non-empty technician field grants.
-- Prevents stale API catalog rehydration of quotes.view / catalog.view on new workspaces.

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

-- Re-assert system technician grants (repairs any workspace polluted by stale API rehydrate).
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
