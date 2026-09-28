-- E2 — Durable Equipment Intent on System Design components (additive).
-- Design-side equipment definition without catalog product_id.
-- Does NOT deploy Apply/Quote/pricing changes.

ALTER TABLE public.system_design_components
  ADD COLUMN IF NOT EXISTS equipment_intent jsonb;

COMMENT ON COLUMN public.system_design_components.equipment_intent IS
  'E2 durable equipment intent (manufacturer/model/attributes). Not a Product, SKU, Quote line, or price.';
