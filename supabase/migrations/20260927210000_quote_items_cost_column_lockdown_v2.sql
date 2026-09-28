-- Q4-S v2: Table-level SELECT still granted cost after v1 column REVOKE.
-- Revoke table SELECT from authenticated/anon; re-grant non-sensitive columns only.

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
