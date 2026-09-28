-- WAR-1: Link warranties to installed equipment (optional).
-- customer_id / site_id remain for backward compatibility and list filters;
-- when equipment is set, it must belong to the same site (enforced in API).

ALTER TABLE public.warranties
  ADD COLUMN IF NOT EXISTS installed_equipment_id uuid
    REFERENCES public.equipment (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS warranties_equipment_idx
  ON public.warranties (workspace_id, installed_equipment_id)
  WHERE installed_equipment_id IS NOT NULL;
