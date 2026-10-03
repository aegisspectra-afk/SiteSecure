-- Add catch-all "אביזרים נלווים" target category (root + leaf).
-- Wraps existing seed so new workspaces get it; backfills existing workspaces.

ALTER FUNCTION public.seed_workspace_defaults(uuid)
  RENAME TO seed_workspace_defaults_pre_accessories;

CREATE OR REPLACE FUNCTION public.seed_workspace_defaults(p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_workspace_defaults_pre_accessories(p_workspace_id);

  INSERT INTO public.product_categories (workspace_id, key, name_he, sort_order, parent_id)
  VALUES (p_workspace_id, 'accessories', 'אביזרים', 850, NULL)
  ON CONFLICT (workspace_id, key) DO UPDATE
    SET name_he = EXCLUDED.name_he,
        sort_order = EXCLUDED.sort_order,
        archived_at = NULL;

  INSERT INTO public.product_categories (workspace_id, key, name_he, sort_order, parent_id)
  SELECT p_workspace_id, 'general_accessories', 'אביזרים נלווים', 10, p.id
  FROM public.product_categories p
  WHERE p.workspace_id = p_workspace_id
    AND p.key = 'accessories'
  ON CONFLICT (workspace_id, key) DO UPDATE
    SET name_he = EXCLUDED.name_he,
        sort_order = EXCLUDED.sort_order,
        parent_id = EXCLUDED.parent_id,
        archived_at = NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_workspace_defaults(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_workspace_defaults(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.seed_workspace_defaults_pre_accessories(uuid) FROM PUBLIC;

-- Backfill every workspace so import target appears without manual reseed.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM public.workspaces
  LOOP
    PERFORM public.seed_workspace_defaults(r.id);
  END LOOP;
END;
$$;
