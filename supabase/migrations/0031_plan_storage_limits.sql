-- Plan storage entitlements (workspace quota). 0 = unlimited.
-- Source of truth for runtime limits remains packages/authz/catalog.json;
-- this keeps public.plan_limits aligned for SQL consumers and audits.

INSERT INTO public.plan_limits (plan_key, limit_key, limit_value) VALUES
  ('solo', 'storage_gb', 15),
  ('business', 'storage_gb', 100),
  ('enterprise', 'storage_gb', 0)
ON CONFLICT (plan_key, limit_key) DO UPDATE
SET limit_value = EXCLUDED.limit_value;
