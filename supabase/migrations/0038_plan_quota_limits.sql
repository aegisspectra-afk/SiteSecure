-- Plan quote/customer quotas. 0 = unlimited.
-- Runtime limits remain packages/authz/catalog.json; plan_limits stays aligned for SQL audits.

INSERT INTO public.plan_limits (plan_key, limit_key, limit_value) VALUES
  ('solo', 'quota_quotes', 50),
  ('solo', 'quota_clients', 30),
  ('business', 'quota_quotes', 200),
  ('business', 'quota_clients', 150),
  ('enterprise', 'quota_quotes', 0),
  ('enterprise', 'quota_clients', 0)
ON CONFLICT (plan_key, limit_key) DO UPDATE
SET limit_value = EXCLUDED.limit_value;
