-- Durable System Design R1 — persistence foundation (no Apply/REPLACE).
-- Quote soft-delete does not CASCADE; RLS + API hide Designs when parent Quote is soft-deleted.

CREATE TABLE public.system_designs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  quote_id uuid NOT NULL REFERENCES public.quotes (id) ON DELETE CASCADE,
  site_id uuid REFERENCES public.sites (id) ON DELETE SET NULL,
  engine_type text NOT NULL,
  engine_version integer NOT NULL DEFAULT 1,
  lifecycle_status text NOT NULL DEFAULT 'draft',
  requirements jsonb NOT NULL DEFAULT '{}'::jsonb,
  engineering_result jsonb,
  recommendation_meta jsonb,
  calculated_at timestamptz,
  last_applied_at timestamptz,
  current_apply_id uuid,
  apply_fingerprint text,
  revision integer NOT NULL DEFAULT 1,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT system_designs_engine_type_chk
    CHECK (engine_type IN ('cctv')),
  CONSTRAINT system_designs_lifecycle_status_chk
    CHECK (lifecycle_status IN ('draft', 'calculated', 'applied')),
  CONSTRAINT system_designs_revision_chk
    CHECK (revision >= 1),
  CONSTRAINT system_designs_engine_version_chk
    CHECK (engine_version >= 1)
);

CREATE INDEX system_designs_workspace_quote_idx
  ON public.system_designs (workspace_id, quote_id)
  WHERE deleted_at IS NULL;

CREATE INDEX system_designs_workspace_quote_engine_idx
  ON public.system_designs (workspace_id, quote_id, engine_type)
  WHERE deleted_at IS NULL;

CREATE TRIGGER system_designs_set_updated_at
  BEFORE UPDATE ON public.system_designs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.system_design_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  design_id uuid NOT NULL REFERENCES public.system_designs (id) ON DELETE CASCADE,
  role_key text NOT NULL,
  label text NOT NULL DEFAULT '',
  quantity numeric(12, 3) NOT NULL DEFAULT 1,
  optional boolean NOT NULL DEFAULT false,
  blocking boolean NOT NULL DEFAULT false,
  removed boolean NOT NULL DEFAULT false,
  resolution_status text,
  technical_requirements jsonb NOT NULL DEFAULT '{}'::jsonb,
  candidates jsonb NOT NULL DEFAULT '[]'::jsonb,
  engine_preferred_product_id uuid REFERENCES public.products (id) ON DELETE SET NULL,
  user_selected_product_id uuid REFERENCES public.products (id) ON DELETE SET NULL,
  selection_origin text NOT NULL DEFAULT 'UNSELECTED',
  reason_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  needs_review boolean NOT NULL DEFAULT false,
  quote_item_id uuid REFERENCES public.quote_items (id) ON DELETE SET NULL,
  applied_product_id uuid,
  applied_qty numeric(12, 3),
  applied_output_fingerprint text,
  last_apply_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT system_design_components_selection_origin_chk
    CHECK (selection_origin IN ('ENGINE_PREFERRED', 'USER_OVERRIDE', 'UNSELECTED')),
  CONSTRAINT system_design_components_quantity_chk
    CHECK (quantity >= 0),
  CONSTRAINT system_design_components_role_key_chk
    CHECK (char_length(btrim(role_key)) > 0),
  CONSTRAINT system_design_components_design_role_uq
    UNIQUE (design_id, role_key)
);

CREATE UNIQUE INDEX system_design_components_quote_item_uq
  ON public.system_design_components (quote_item_id)
  WHERE quote_item_id IS NOT NULL;

CREATE INDEX system_design_components_design_idx
  ON public.system_design_components (workspace_id, design_id);

CREATE TRIGGER system_design_components_set_updated_at
  BEFORE UPDATE ON public.system_design_components
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Parent Quote must be live (deleted_at IS NULL) for Design visibility.
-- Mirrors quotes_select visibility (managerial / owner / assigned site scope).
ALTER TABLE public.system_designs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_designs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.system_design_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_design_components FORCE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.system_design_quote_visible(p_workspace_id uuid, p_quote_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.quotes q
    WHERE q.id = p_quote_id
      AND q.workspace_id = p_workspace_id
      AND q.deleted_at IS NULL
      AND public.auth_is_member(p_workspace_id)
      AND (
        public.auth_is_managerial(p_workspace_id)
        OR q.owner_user_id = auth.uid()
        OR (
          public.auth_is_assigned_scope(p_workspace_id)
          AND q.site_id IS NOT NULL
          AND public.auth_site_visible(p_workspace_id, q.site_id)
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.system_design_quote_visible(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.system_design_quote_visible(uuid, uuid) TO authenticated;

CREATE POLICY system_designs_select ON public.system_designs FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND public.system_design_quote_visible(workspace_id, quote_id)
  );

CREATE POLICY system_designs_insert ON public.system_designs FOR INSERT TO authenticated
  WITH CHECK (
    deleted_at IS NULL
    AND public.auth_is_member(workspace_id)
    AND public.system_design_quote_visible(workspace_id, quote_id)
  );

CREATE POLICY system_designs_update ON public.system_designs FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND public.system_design_quote_visible(workspace_id, quote_id)
  )
  WITH CHECK (
    public.auth_is_member(workspace_id)
    AND public.system_design_quote_visible(workspace_id, quote_id)
  );

CREATE POLICY system_designs_delete ON public.system_designs FOR DELETE TO authenticated
  USING (
    public.system_design_quote_visible(workspace_id, quote_id)
  );

CREATE POLICY system_design_components_select ON public.system_design_components FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.system_designs d
      WHERE d.id = system_design_components.design_id
        AND d.workspace_id = system_design_components.workspace_id
        AND d.deleted_at IS NULL
        AND public.system_design_quote_visible(d.workspace_id, d.quote_id)
    )
  );

CREATE POLICY system_design_components_write ON public.system_design_components FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.system_designs d
      WHERE d.id = system_design_components.design_id
        AND d.workspace_id = system_design_components.workspace_id
        AND d.deleted_at IS NULL
        AND public.system_design_quote_visible(d.workspace_id, d.quote_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.system_designs d
      WHERE d.id = system_design_components.design_id
        AND d.workspace_id = system_design_components.workspace_id
        AND d.deleted_at IS NULL
        AND public.system_design_quote_visible(d.workspace_id, d.quote_id)
    )
  );
