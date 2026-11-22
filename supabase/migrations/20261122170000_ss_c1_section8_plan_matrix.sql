-- C1 §8: full Free / Pro / Business / Enterprise limits + capabilities matrix.
-- Catalog (packages/authz/catalog.json) is source of truth for API; DB mirrors for RLS/admin.

-- Capabilities registry
INSERT INTO public.capabilities (key, value_type, description) VALUES
  ('quotes.alternatives', 'boolean', 'חלופות ועד בית'),
  ('branding.custom_handover', 'boolean', 'תעודת מסירה במותג המתקין'),
  ('comms.whatsapp', 'boolean', 'שיתוף וואטסאפ'),
  ('quotes.sales_tracking', 'boolean', 'מעקב מכירה / מעקב הצעות'),
  ('field.technicians', 'boolean', 'טכנאים'),
  ('field.dispatch', 'boolean', 'שיבוץ עבודות'),
  ('jobs.checklist', 'boolean', 'צ׳קליסט וחתימה'),
  ('sites.dossier', 'boolean', 'תיק אתר ואחריות'),
  ('service.reminders', 'boolean', 'תזכורות שירות'),
  ('quotes.profitability', 'boolean', 'רווחיות להצעות')
ON CONFLICT (key) DO NOTHING;

-- Wipe + reseed plan_capabilities for commercial plans
DELETE FROM public.plan_capabilities
WHERE plan_key IN ('free', 'pro', 'business', 'enterprise')
  AND capability_key IN (
    'quotes.alternatives', 'branding.custom_handover', 'comms.whatsapp',
    'quotes.sales_tracking', 'field.technicians', 'field.dispatch',
    'jobs.checklist', 'sites.dossier', 'service.reminders', 'quotes.profitability'
  );

INSERT INTO public.plan_capabilities (plan_key, capability_key, enabled, limit_value, config) VALUES
  -- free
  ('free', 'quotes.alternatives', false, NULL, '{}'::jsonb),
  ('free', 'branding.custom_handover', false, NULL, '{}'::jsonb),
  ('free', 'comms.whatsapp', false, NULL, '{}'::jsonb),
  ('free', 'quotes.sales_tracking', false, NULL, '{}'::jsonb),
  ('free', 'field.technicians', false, NULL, '{}'::jsonb),
  ('free', 'field.dispatch', false, NULL, '{}'::jsonb),
  ('free', 'jobs.checklist', false, NULL, '{}'::jsonb),
  ('free', 'sites.dossier', false, NULL, '{}'::jsonb),
  ('free', 'service.reminders', false, NULL, '{}'::jsonb),
  ('free', 'quotes.profitability', false, NULL, '{}'::jsonb),
  -- pro
  ('pro', 'quotes.alternatives', true, NULL, '{}'::jsonb),
  ('pro', 'branding.custom_handover', true, NULL, '{}'::jsonb),
  ('pro', 'comms.whatsapp', true, NULL, '{}'::jsonb),
  ('pro', 'quotes.sales_tracking', true, NULL, '{}'::jsonb),
  ('pro', 'field.technicians', false, NULL, '{}'::jsonb),
  ('pro', 'field.dispatch', false, NULL, '{}'::jsonb),
  ('pro', 'jobs.checklist', false, NULL, '{}'::jsonb),
  ('pro', 'sites.dossier', false, NULL, '{}'::jsonb),
  ('pro', 'service.reminders', false, NULL, '{}'::jsonb),
  ('pro', 'quotes.profitability', false, NULL, '{}'::jsonb),
  -- business
  ('business', 'quotes.alternatives', true, NULL, '{}'::jsonb),
  ('business', 'branding.custom_handover', true, NULL, '{}'::jsonb),
  ('business', 'comms.whatsapp', true, NULL, '{}'::jsonb),
  ('business', 'quotes.sales_tracking', true, NULL, '{}'::jsonb),
  ('business', 'field.technicians', true, NULL, '{}'::jsonb),
  ('business', 'field.dispatch', true, NULL, '{}'::jsonb),
  ('business', 'jobs.checklist', true, NULL, '{}'::jsonb),
  ('business', 'sites.dossier', true, NULL, '{}'::jsonb),
  ('business', 'service.reminders', true, NULL, '{}'::jsonb),
  ('business', 'quotes.profitability', true, NULL, '{}'::jsonb),
  -- enterprise
  ('enterprise', 'quotes.alternatives', true, NULL, '{}'::jsonb),
  ('enterprise', 'branding.custom_handover', true, NULL, '{}'::jsonb),
  ('enterprise', 'comms.whatsapp', true, NULL, '{}'::jsonb),
  ('enterprise', 'quotes.sales_tracking', true, NULL, '{}'::jsonb),
  ('enterprise', 'field.technicians', true, NULL, '{}'::jsonb),
  ('enterprise', 'field.dispatch', true, NULL, '{}'::jsonb),
  ('enterprise', 'jobs.checklist', true, NULL, '{}'::jsonb),
  ('enterprise', 'sites.dossier', true, NULL, '{}'::jsonb),
  ('enterprise', 'service.reminders', true, NULL, '{}'::jsonb),
  ('enterprise', 'quotes.profitability', true, NULL, '{}'::jsonb')
ON CONFLICT (plan_key, capability_key) DO UPDATE
SET enabled = EXCLUDED.enabled;

-- Limits: max_members / storage / quotes (0 = unlimited)
DELETE FROM public.plan_limits
WHERE plan_key IN ('free', 'pro', 'business', 'enterprise')
  AND limit_key IN (
    'max_members', 'max_technicians', 'seats_operator', 'seats_field',
    'storage_gb', 'quota_quotes', 'quota_clients'
  );

INSERT INTO public.plan_limits (plan_key, limit_key, limit_value) VALUES
  ('free', 'max_members', 1),
  ('free', 'max_technicians', 0),
  ('free', 'seats_operator', 1),
  ('free', 'seats_field', 0),
  ('free', 'storage_gb', 1),
  ('free', 'quota_quotes', 10),
  ('free', 'quota_clients', 30),
  ('pro', 'max_members', 2),
  ('pro', 'max_technicians', 0),
  ('pro', 'seats_operator', 2),
  ('pro', 'seats_field', 0),
  ('pro', 'storage_gb', 10),
  ('pro', 'quota_quotes', 0),
  ('pro', 'quota_clients', 150),
  ('business', 'max_members', 5),
  ('business', 'max_technicians', 0),
  ('business', 'seats_operator', 5),
  ('business', 'seats_field', 0),
  ('business', 'storage_gb', 50),
  ('business', 'quota_quotes', 0),
  ('business', 'quota_clients', 0),
  ('enterprise', 'max_members', 0),
  ('enterprise', 'max_technicians', 0),
  ('enterprise', 'seats_operator', 0),
  ('enterprise', 'seats_field', 0),
  ('enterprise', 'storage_gb', 0),
  ('enterprise', 'quota_quotes', 0),
  ('enterprise', 'quota_clients', 0)
ON CONFLICT (plan_key, limit_key) DO UPDATE
SET limit_value = EXCLUDED.limit_value;
