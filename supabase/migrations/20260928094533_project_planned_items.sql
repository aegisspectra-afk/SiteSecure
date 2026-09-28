-- Q8-B: Project planned scope (execution BOM) from pinned quote snapshot.
-- Not Installed Assets. No backfill for legacy projects.

CREATE TABLE public.project_planned_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  source_quote_id uuid REFERENCES public.quotes (id) ON DELETE SET NULL,
  source_quote_version integer NOT NULL,
  source_quote_item_id uuid NULL,
  section_id uuid NULL,
  section_name text NULL,
  item_type text NOT NULL DEFAULT 'catalog',
  scope_kind text NOT NULL DEFAULT 'equipment',
  product_id uuid REFERENCES public.products (id) ON DELETE SET NULL,
  sku text NULL,
  name text NULL,
  description text NOT NULL DEFAULT '',
  qty numeric(12, 3) NOT NULL DEFAULT 1,
  unit text NULL,
  manufacturer text NULL,
  model text NULL,
  is_optional boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_planned_items_qty_chk CHECK (qty >= 0),
  CONSTRAINT project_planned_items_version_chk CHECK (source_quote_version >= 1),
  CONSTRAINT project_planned_items_scope_kind_chk
    CHECK (scope_kind IN ('equipment', 'labor', 'other')),
  CONSTRAINT project_planned_items_item_type_chk
    CHECK (char_length(btrim(item_type)) > 0)
);

COMMENT ON TABLE public.project_planned_items IS
  'Pinned quote scope materialised at Project creation. Does not follow later quote revisions.';

CREATE UNIQUE INDEX project_planned_items_project_source_item_uidx
  ON public.project_planned_items (project_id, source_quote_item_id)
  WHERE source_quote_item_id IS NOT NULL;

CREATE INDEX project_planned_items_project_sort_idx
  ON public.project_planned_items (workspace_id, project_id, sort_order);

ALTER TABLE public.project_planned_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_planned_items FORCE ROW LEVEL SECURITY;

-- Visibility follows parent project (same membership / assignment / site rules).
CREATE POLICY project_planned_items_select ON public.project_planned_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = project_planned_items.project_id
        AND p.workspace_id = project_planned_items.workspace_id
        AND public.auth_is_member(p.workspace_id)
        AND (
          NOT public.auth_is_assigned_scope(p.workspace_id)
          OR public.auth_assigned(p.workspace_id, 'project', p.id)
          OR (p.site_id IS NOT NULL AND public.auth_site_visible(p.workspace_id, p.site_id))
        )
    )
  );

CREATE POLICY project_planned_items_insert ON public.project_planned_items
  FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_role_in(
      workspace_id,
      ARRAY['owner','administrator','manager','technician','founding_technician']
    )
    AND EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = project_planned_items.project_id
        AND p.workspace_id = project_planned_items.workspace_id
    )
  );

CREATE POLICY project_planned_items_update ON public.project_planned_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = project_planned_items.project_id
        AND p.workspace_id = project_planned_items.workspace_id
        AND (
          public.auth_is_managerial(p.workspace_id)
          OR public.auth_assigned(p.workspace_id, 'project', p.id)
          OR (p.site_id IS NOT NULL AND public.auth_site_visible(p.workspace_id, p.site_id))
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = project_planned_items.project_id
        AND p.workspace_id = project_planned_items.workspace_id
        AND (
          public.auth_is_managerial(p.workspace_id)
          OR public.auth_assigned(p.workspace_id, 'project', p.id)
          OR (p.site_id IS NOT NULL AND public.auth_site_visible(p.workspace_id, p.site_id))
        )
    )
  );

CREATE POLICY project_planned_items_delete ON public.project_planned_items
  FOR DELETE TO authenticated
  USING (public.auth_is_privileged(workspace_id));
