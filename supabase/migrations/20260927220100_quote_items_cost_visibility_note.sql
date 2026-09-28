-- Q4.3 documentation note: quote_items.cost is readable via PostgREST for any
-- authenticated member who can SELECT the parent quote (policy quote_items_select).
-- Product path protection: FastAPI _strip_cost / quotes.view_cost.
-- Column-level revoke was intentionally NOT applied here because the API UserClient
-- loads cost for authorized recalculation under the same JWT. Closing the PostgREST
-- hole requires service-role reads for commercial columns — tracked as remaining gap.

COMMENT ON COLUMN public.quote_items.cost IS
  'Internal cost. Stripped from FastAPI responses without quotes.view_cost. Direct PostgREST SELECT still exposes this column under quote_items_select.';
