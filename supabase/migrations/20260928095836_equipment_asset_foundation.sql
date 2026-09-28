-- INF-1: Asset foundation on equipment (no rename, no Network/IPAM).

ALTER TABLE public.equipment
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS project_planned_item_id uuid REFERENCES public.project_planned_items (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS asset_code text NULL;

COMMENT ON COLUMN public.equipment.product_id IS
  'Optional catalog product for this installed Asset.';
COMMENT ON COLUMN public.equipment.project_id IS
  'Optional project provenance when Asset was created from project scope.';
COMMENT ON COLUMN public.equipment.project_planned_item_id IS
  'Optional planned-scope line this Asset was expanded from.';
COMMENT ON COLUMN public.equipment.asset_code IS
  'Site-local human Asset code (e.g. CAM-001). Null on legacy rows.';

CREATE UNIQUE INDEX IF NOT EXISTS equipment_site_asset_code_uidx
  ON public.equipment (site_id, asset_code)
  WHERE asset_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS equipment_project_idx
  ON public.equipment (workspace_id, project_id)
  WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS equipment_planned_item_idx
  ON public.equipment (workspace_id, project_planned_item_id)
  WHERE project_planned_item_id IS NOT NULL;
