-- Q4-S: Column-level lockdown for commercial cost fields.
-- RLS is row-level only and does NOT hide columns.
-- Table-level GRANT SELECT (0024_grants) implicitly covers every column;
-- REVOKE SELECT (cost) alone is insufficient while table SELECT remains.
-- Pattern: REVOKE table SELECT from authenticated/anon, then GRANT SELECT on
-- non-sensitive columns only. service_role keeps full table SELECT.
-- FastAPI loads cost via service_role after authorize(), then strips for
-- roles without quotes.view_cost.

-- 1) quote_items — lock cost SELECT
REVOKE SELECT ON TABLE public.quote_items FROM PUBLIC;
REVOKE SELECT ON TABLE public.quote_items FROM anon;
REVOKE SELECT ON TABLE public.quote_items FROM authenticated;
GRANT SELECT (
  id, workspace_id, quote_id, product_id, item_type, description, qty, unit_price,
  discount, line_net, sort_order, sku, name, unit, catalog_snapshot, discount_type,
  section_id, package_instance_id, package_id, package_name, is_optional
) ON TABLE public.quote_items TO authenticated;
GRANT SELECT ON TABLE public.quote_items TO service_role;
GRANT INSERT (cost), UPDATE (cost) ON TABLE public.quote_items TO authenticated, service_role;

-- 2) quotes — lock commercial aggregate SELECT
REVOKE SELECT ON TABLE public.quotes FROM PUBLIC;
REVOKE SELECT ON TABLE public.quotes FROM anon;
REVOKE SELECT ON TABLE public.quotes FROM authenticated;
GRANT SELECT (
  id, workspace_id, number, status, customer_id, site_id, lead_id, owner_user_id,
  currency, vat_percent, discount_type, discount_value, subtotal_net, vat_amount,
  total_gross, valid_until, payment_terms, customer_notes, internal_notes, version,
  created_by, created_at, updated_at, deleted_at, title, project_name, project_address,
  summary, key_points, warranty, general_terms, template_id, sent_at, viewed_at,
  approved_at, rejected_at, approved_name, rejection_reason, margin_override_reason,
  margin_override_by, margin_override_at, revise_reason
) ON TABLE public.quotes TO authenticated;
GRANT SELECT ON TABLE public.quotes TO service_role;
GRANT INSERT (cost_total, margin_amount, margin_percent),
      UPDATE (cost_total, margin_amount, margin_percent)
  ON TABLE public.quotes TO authenticated, service_role;

-- 3) products — lock cost SELECT
REVOKE SELECT ON TABLE public.products FROM PUBLIC;
REVOKE SELECT ON TABLE public.products FROM anon;
REVOKE SELECT ON TABLE public.products FROM authenticated;
GRANT SELECT (
  id, workspace_id, category_id, sku, name, unit, list_price, vat_eligible, is_labor,
  is_active, metadata, created_at, updated_at, kind, description, manufacturer, model,
  attributes
) ON TABLE public.products TO authenticated;
GRANT SELECT ON TABLE public.products TO service_role;
GRANT INSERT (cost), UPDATE (cost) ON TABLE public.products TO authenticated, service_role;

-- 4) Scrub nested cost from catalog_snapshot (jsonb SELECT would otherwise leak)
CREATE OR REPLACE FUNCTION public.quote_items_scrub_catalog_cost()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.catalog_snapshot IS NOT NULL AND jsonb_typeof(NEW.catalog_snapshot) = 'object' THEN
    NEW.catalog_snapshot := NEW.catalog_snapshot - 'cost';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS quote_items_scrub_catalog_cost ON public.quote_items;
CREATE TRIGGER quote_items_scrub_catalog_cost
  BEFORE INSERT OR UPDATE OF catalog_snapshot ON public.quote_items
  FOR EACH ROW
  EXECUTE FUNCTION public.quote_items_scrub_catalog_cost();

REVOKE ALL ON FUNCTION public.quote_items_scrub_catalog_cost() FROM PUBLIC;

UPDATE public.quote_items
SET catalog_snapshot = catalog_snapshot - 'cost'
WHERE catalog_snapshot IS NOT NULL
  AND jsonb_typeof(catalog_snapshot) = 'object'
  AND catalog_snapshot ? 'cost';

COMMENT ON COLUMN public.quote_items.cost IS
  'Internal cost. SELECT revoked from authenticated/anon (Q4-S). FastAPI service_role reads after quotes.view_cost authorize; responses stripped without permission.';

COMMENT ON COLUMN public.quotes.cost_total IS
  'Server aggregate cost. SELECT revoked from authenticated/anon (Q4-S); service_role + FastAPI strip path.';

COMMENT ON COLUMN public.products.cost IS
  'Catalog cost. SELECT revoked from authenticated/anon (Q4-S); service_role + FastAPI strip path.';
