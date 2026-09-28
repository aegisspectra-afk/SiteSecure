-- Q4.1: Optional commercial quote lines.
-- Semantics (pricing.py remains authority):
--   is_optional = false → included in base/required quote totals (section + quote discounts + VAT).
--   is_optional = true  → visible on quote/preview/PDF, labeled optional, excluded from base totals;
--                         contributes to optional_subtotal / optional_total_gross / total_with_options_gross.

ALTER TABLE public.quote_items
  ADD COLUMN IF NOT EXISTS is_optional boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.quote_items.is_optional IS
  'Q4 optional commercial line: visible and priced, excluded from required/base quote totals.';
