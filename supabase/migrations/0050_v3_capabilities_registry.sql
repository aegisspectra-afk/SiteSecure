-- V3 P1-T02: Canonical capability registry + plan defaults.
-- Additive only. Does NOT change auth_feature, my_workspace_entitlements, or authorize().
-- Workspace overrides and runtime resolver are P1-T03/T04 — not this migration.
--
-- Numeric semantics (locked):
--   enabled=false → unavailable (ignore limit_value)
--   enabled=true AND limit_value=0 → unlimited
--   enabled=true AND limit_value>0 → capped
--   missing plan_capabilities row → not entitled (fail closed at resolver)
--
-- TBD quotas: product numbers not approved. Where a quota is TBD but the capability
-- must stay available without reducing current Free/Solo behavior, seed
-- enabled=true, limit_value=0 with config.quota_status='tbd' (compat unlimited,
-- not a commercial commitment).
--
-- Note: use jsonb_build_object() instead of '{}'::jsonb literals for tooling safety.

CREATE TABLE IF NOT EXISTS public.capabilities (
  key text PRIMARY KEY,
  value_type text NOT NULL,
  description text NOT NULL DEFAULT '',
  CONSTRAINT capabilities_value_type_chk
    CHECK (value_type IN ('boolean', 'integer', 'json'))
);

CREATE TABLE IF NOT EXISTS public.plan_capabilities (
  plan_key text NOT NULL REFERENCES public.plans (key) ON DELETE CASCADE,
  capability_key text NOT NULL REFERENCES public.capabilities (key) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  limit_value integer NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (plan_key, capability_key),
  CONSTRAINT plan_capabilities_limit_nonneg_chk
    CHECK (limit_value IS NULL OR limit_value >= 0)
);

CREATE INDEX IF NOT EXISTS plan_capabilities_capability_idx
  ON public.plan_capabilities (capability_key);

COMMENT ON TABLE public.capabilities IS
  'V3 global capability registry. Keys are stable product contracts. value_type: boolean|integer|json.';
COMMENT ON TABLE public.plan_capabilities IS
  'V3 plan defaults for capabilities. plan_key uses solo|business|enterprise. Missing row = not entitled.';
COMMENT ON COLUMN public.plan_capabilities.limit_value IS
  'NULL = N/A (boolean/json). For integer: 0 with enabled=true means unlimited; ignored when enabled=false.';
COMMENT ON COLUMN public.plan_capabilities.config IS
  'Optional structured defaults. quota_status=tbd marks non-final commercial placeholders.';

CREATE OR REPLACE FUNCTION public.plan_capabilities_validate_row()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_type text;
BEGIN
  SELECT c.value_type INTO v_type
  FROM public.capabilities c
  WHERE c.key = NEW.capability_key;

  IF v_type IS NULL THEN
    RAISE EXCEPTION 'UNKNOWN_CAPABILITY:%', NEW.capability_key
      USING ERRCODE = 'P0001';
  END IF;

  IF v_type = 'boolean' THEN
    IF NEW.limit_value IS NOT NULL THEN
      RAISE EXCEPTION 'BOOLEAN_CAPABILITY_LIMIT_FORBIDDEN:%', NEW.capability_key
        USING ERRCODE = 'P0001';
    END IF;
  ELSIF v_type = 'integer' THEN
    IF NEW.limit_value IS NULL THEN
      RAISE EXCEPTION 'INTEGER_CAPABILITY_LIMIT_REQUIRED:%', NEW.capability_key
        USING ERRCODE = 'P0001';
    END IF;
  ELSIF v_type = 'json' THEN
    IF NEW.limit_value IS NOT NULL THEN
      RAISE EXCEPTION 'JSON_CAPABILITY_LIMIT_FORBIDDEN:%', NEW.capability_key
        USING ERRCODE = 'P0001';
    END IF;
  ELSE
    RAISE EXCEPTION 'UNSUPPORTED_CAPABILITY_VALUE_TYPE:%', v_type
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS plan_capabilities_validate ON public.plan_capabilities;
CREATE TRIGGER plan_capabilities_validate
  BEFORE INSERT OR UPDATE ON public.plan_capabilities
  FOR EACH ROW EXECUTE FUNCTION public.plan_capabilities_validate_row();

ALTER TABLE public.capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capabilities FORCE ROW LEVEL SECURITY;
ALTER TABLE public.plan_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_capabilities FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS capabilities_select_authenticated ON public.capabilities;
CREATE POLICY capabilities_select_authenticated
  ON public.capabilities FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS plan_capabilities_select_authenticated ON public.plan_capabilities;
CREATE POLICY plan_capabilities_select_authenticated
  ON public.plan_capabilities FOR SELECT TO authenticated
  USING (true);

COMMENT ON POLICY capabilities_select_authenticated ON public.capabilities IS
  'Global catalog, not tenant data. Mutations via migrations/service role only.';
COMMENT ON POLICY plan_capabilities_select_authenticated ON public.plan_capabilities IS
  'Global catalog, not tenant data. Mutations via migrations/service role only.';

INSERT INTO public.capabilities (key, value_type, description) VALUES
  ('field_service.enabled', 'boolean', 'Field Service / Work Orders module gate'),
  ('field_service.monthly_work_orders', 'integer', 'Monthly work order (jobs) quota'),
  ('field_service.advanced_scheduling', 'boolean', 'Advanced dispatch / scheduling'),
  ('inspections.enabled', 'boolean', 'Inspections & Compliance module gate'),
  ('inspections.monthly_runs', 'integer', 'Monthly inspection run quota'),
  ('inspections.custom_templates', 'boolean', 'Custom inspection templates'),
  ('inspections.corrective_actions', 'boolean', 'Corrective actions from findings'),
  ('inspections.patrol_checkpoints', 'boolean', 'Patrol / checkpoint compliance'),
  ('workforce.enabled', 'boolean', 'Workforce module gate'),
  ('workforce.max_people', 'integer', 'Max operational workforce people'),
  ('workforce.scheduling', 'boolean', 'Shifts / scheduling'),
  ('workforce.certifications', 'boolean', 'Certifications tracking'),
  ('site_ai.enabled', 'boolean', 'SITE AI module gate'),
  ('site_ai.monthly_usage', 'integer', 'Monthly SITE AI usage quota'),
  ('site_ai.actions', 'boolean', 'SITE AI propose/confirm actions'),
  ('site_ai.cross_module_analysis', 'boolean', 'Cross-module SITE AI analysis')
ON CONFLICT (key) DO UPDATE
SET
  value_type = EXCLUDED.value_type,
  description = EXCLUDED.description;

INSERT INTO public.plan_capabilities (plan_key, capability_key, enabled, limit_value, config) VALUES
  ('solo', 'field_service.enabled', true, NULL, jsonb_build_object()),
  ('solo', 'field_service.monthly_work_orders', true, 0, jsonb_build_object('quota_status', 'tbd', 'note', 'compat unlimited; no job quota today')),
  ('solo', 'field_service.advanced_scheduling', false, NULL, jsonb_build_object()),
  ('solo', 'inspections.enabled', false, NULL, jsonb_build_object()),
  ('solo', 'inspections.monthly_runs', false, 0, jsonb_build_object()),
  ('solo', 'inspections.custom_templates', false, NULL, jsonb_build_object()),
  ('solo', 'inspections.corrective_actions', false, NULL, jsonb_build_object()),
  ('solo', 'inspections.patrol_checkpoints', false, NULL, jsonb_build_object()),
  ('solo', 'workforce.enabled', false, NULL, jsonb_build_object()),
  ('solo', 'workforce.max_people', false, 0, jsonb_build_object()),
  ('solo', 'workforce.scheduling', false, NULL, jsonb_build_object()),
  ('solo', 'workforce.certifications', false, NULL, jsonb_build_object()),
  ('solo', 'site_ai.enabled', false, NULL, jsonb_build_object()),
  ('solo', 'site_ai.monthly_usage', false, 0, jsonb_build_object()),
  ('solo', 'site_ai.actions', false, NULL, jsonb_build_object()),
  ('solo', 'site_ai.cross_module_analysis', false, NULL, jsonb_build_object()),
  ('business', 'field_service.enabled', true, NULL, jsonb_build_object()),
  ('business', 'field_service.monthly_work_orders', true, 0, jsonb_build_object('quota_status', 'tbd', 'note', 'compat unlimited until product-approved Pro quota')),
  ('business', 'field_service.advanced_scheduling', true, NULL, jsonb_build_object()),
  ('business', 'inspections.enabled', true, NULL, jsonb_build_object()),
  ('business', 'inspections.monthly_runs', true, 0, jsonb_build_object('quota_status', 'tbd')),
  ('business', 'inspections.custom_templates', true, NULL, jsonb_build_object()),
  ('business', 'inspections.corrective_actions', true, NULL, jsonb_build_object()),
  ('business', 'inspections.patrol_checkpoints', true, NULL, jsonb_build_object()),
  ('business', 'workforce.enabled', true, NULL, jsonb_build_object()),
  ('business', 'workforce.max_people', true, 0, jsonb_build_object('quota_status', 'tbd')),
  ('business', 'workforce.scheduling', true, NULL, jsonb_build_object()),
  ('business', 'workforce.certifications', true, NULL, jsonb_build_object()),
  ('business', 'site_ai.enabled', false, NULL, jsonb_build_object()),
  ('business', 'site_ai.monthly_usage', false, 0, jsonb_build_object()),
  ('business', 'site_ai.actions', false, NULL, jsonb_build_object()),
  ('business', 'site_ai.cross_module_analysis', false, NULL, jsonb_build_object()),
  ('enterprise', 'field_service.enabled', true, NULL, jsonb_build_object()),
  ('enterprise', 'field_service.monthly_work_orders', true, 0, jsonb_build_object('quota_status', 'tbd', 'note', 'default unlimited; Enterprise custom via overrides later')),
  ('enterprise', 'field_service.advanced_scheduling', true, NULL, jsonb_build_object()),
  ('enterprise', 'inspections.enabled', true, NULL, jsonb_build_object()),
  ('enterprise', 'inspections.monthly_runs', true, 0, jsonb_build_object('quota_status', 'tbd', 'note', 'default unlimited; custom via overrides later')),
  ('enterprise', 'inspections.custom_templates', true, NULL, jsonb_build_object()),
  ('enterprise', 'inspections.corrective_actions', true, NULL, jsonb_build_object()),
  ('enterprise', 'inspections.patrol_checkpoints', true, NULL, jsonb_build_object()),
  ('enterprise', 'workforce.enabled', true, NULL, jsonb_build_object()),
  ('enterprise', 'workforce.max_people', true, 0, jsonb_build_object('quota_status', 'tbd', 'note', 'default unlimited; custom via overrides later')),
  ('enterprise', 'workforce.scheduling', true, NULL, jsonb_build_object()),
  ('enterprise', 'workforce.certifications', true, NULL, jsonb_build_object()),
  ('enterprise', 'site_ai.enabled', true, NULL, jsonb_build_object()),
  ('enterprise', 'site_ai.monthly_usage', true, 0, jsonb_build_object('quota_status', 'tbd', 'note', 'default unlimited; custom via overrides later')),
  ('enterprise', 'site_ai.actions', true, NULL, jsonb_build_object()),
  ('enterprise', 'site_ai.cross_module_analysis', true, NULL, jsonb_build_object())
ON CONFLICT (plan_key, capability_key) DO UPDATE
SET
  enabled = EXCLUDED.enabled,
  limit_value = EXCLUDED.limit_value,
  config = EXCLUDED.config;
