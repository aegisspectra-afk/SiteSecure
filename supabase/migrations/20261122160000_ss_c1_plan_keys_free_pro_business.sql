-- C1: Plan keys match display names — free / pro / business / enterprise.
-- solo → free; existing business key stays business (testers keep entitlements);
-- insert new pro (mid tier); relabel business from "Pro" → "Business".
-- Also seed quotes.alternatives capability (Pro+).

-- 1) Insert free as clone of solo (if missing)
INSERT INTO public.plans (key, label_he, label_en)
SELECT 'free', 'Free', 'Free'
WHERE NOT EXISTS (SELECT 1 FROM public.plans WHERE key = 'free');

INSERT INTO public.plan_features (plan_key, feature_key)
SELECT 'free', pf.feature_key
FROM public.plan_features pf
WHERE pf.plan_key = 'solo'
  AND NOT EXISTS (
    SELECT 1 FROM public.plan_features x
    WHERE x.plan_key = 'free' AND x.feature_key = pf.feature_key
  );

INSERT INTO public.plan_limits (plan_key, limit_key, limit_value)
SELECT 'free', pl.limit_key, pl.limit_value
FROM public.plan_limits pl
WHERE pl.plan_key = 'solo'
  AND NOT EXISTS (
    SELECT 1 FROM public.plan_limits x
    WHERE x.plan_key = 'free' AND x.limit_key = pl.limit_key
  );

INSERT INTO public.plan_capabilities (plan_key, capability_key, enabled, limit_value, config)
SELECT 'free', pc.capability_key, pc.enabled, pc.limit_value, pc.config
FROM public.plan_capabilities pc
WHERE pc.plan_key = 'solo'
  AND NOT EXISTS (
    SELECT 1 FROM public.plan_capabilities x
    WHERE x.plan_key = 'free' AND x.capability_key = pc.capability_key
  );

-- 2) Point all solo FKs to free, then drop solo
UPDATE public.subscriptions SET plan_key = 'free' WHERE plan_key = 'solo';
DELETE FROM public.plan_capabilities WHERE plan_key = 'solo';
DELETE FROM public.plan_features WHERE plan_key = 'solo';
DELETE FROM public.plan_limits WHERE plan_key = 'solo';
DELETE FROM public.plans WHERE key = 'solo';

-- 3) Insert pro (between free and business) if missing — copy business features as baseline Pro
INSERT INTO public.plans (key, label_he, label_en)
SELECT 'pro', 'Pro', 'Pro'
WHERE NOT EXISTS (SELECT 1 FROM public.plans WHERE key = 'pro');

INSERT INTO public.plan_features (plan_key, feature_key)
SELECT 'pro', pf.feature_key
FROM public.plan_features pf
WHERE pf.plan_key = 'business'
  AND NOT EXISTS (
    SELECT 1 FROM public.plan_features x
    WHERE x.plan_key = 'pro' AND x.feature_key = pf.feature_key
  );

INSERT INTO public.plan_limits (plan_key, limit_key, limit_value)
SELECT 'pro', pl.limit_key, pl.limit_value
FROM public.plan_limits pl
WHERE pl.plan_key = 'business'
  AND NOT EXISTS (
    SELECT 1 FROM public.plan_limits x
    WHERE x.plan_key = 'pro' AND x.limit_key = pl.limit_key
  );

INSERT INTO public.plan_capabilities (plan_key, capability_key, enabled, limit_value, config)
SELECT 'pro', pc.capability_key, pc.enabled, pc.limit_value, pc.config
FROM public.plan_capabilities pc
WHERE pc.plan_key = 'business'
  AND NOT EXISTS (
    SELECT 1 FROM public.plan_capabilities x
    WHERE x.plan_key = 'pro' AND x.capability_key = pc.capability_key
  );

-- 4) Labels: keys == display names
UPDATE public.plans SET label_he = 'Free', label_en = 'Free' WHERE key = 'free';
UPDATE public.plans SET label_he = 'Pro', label_en = 'Pro' WHERE key = 'pro';
UPDATE public.plans SET label_he = 'Business', label_en = 'Business' WHERE key = 'business';
UPDATE public.plans SET label_he = 'Enterprise', label_en = 'Enterprise' WHERE key = 'enterprise';

COMMENT ON TABLE public.plans IS
  'Commercial plans. Keys match display names: free, pro, business, enterprise.';

-- 5) quotes.alternatives capability (boolean) — free off; pro/business/enterprise on
INSERT INTO public.capabilities (key, value_type, description)
VALUES ('quotes.alternatives', 'boolean', 'חלופות ועד בית / Quote alternatives')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.plan_capabilities (plan_key, capability_key, enabled, limit_value, config)
VALUES
  ('free', 'quotes.alternatives', false, NULL, '{}'::jsonb),
  ('pro', 'quotes.alternatives', true, NULL, '{}'::jsonb),
  ('business', 'quotes.alternatives', true, NULL, '{}'::jsonb),
  ('enterprise', 'quotes.alternatives', true, NULL, '{}'::jsonb)
ON CONFLICT (plan_key, capability_key) DO UPDATE
SET enabled = EXCLUDED.enabled;

-- 6) create_workspace: default + self-serve lock on free (was solo)
CREATE OR REPLACE FUNCTION public.create_workspace(p_name text, p_plan_key text DEFAULT 'free'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_id uuid;
  v_uid uuid := auth.uid();
  v_plan text;
  v_feature text;
  v_meta jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  v_meta := COALESCE(auth.jwt() -> 'app_metadata', '{}'::jsonb);
  IF COALESCE(v_meta ->> 'workforce_only', '') IN ('true', 't', '1')
     OR COALESCE(v_meta ->> 'provisioned_via', '') = 'workforce' THEN
    RAISE EXCEPTION 'WORKFORCE_USER_CANNOT_CREATE_WORKSPACE';
  END IF;

  IF p_name IS NULL OR length(trim(p_name)) < 2 THEN
    RAISE EXCEPTION 'INVALID_NAME';
  END IF;

  v_plan := COALESCE(NULLIF(p_plan_key, ''), 'free');
  -- Self-service workspaces start on Free. Other plans are platform-provisioned.
  IF v_plan <> 'free' THEN
    RAISE EXCEPTION 'INVALID_PLAN';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.plans WHERE key = v_plan) THEN
    RAISE EXCEPTION 'INVALID_PLAN';
  END IF;

  INSERT INTO public.workspaces (name)
  VALUES (trim(p_name))
  RETURNING id INTO v_id;

  INSERT INTO public.workspace_settings (workspace_id) VALUES (v_id);
  INSERT INTO public.workspace_counters (workspace_id, kind, last_value)
  VALUES
    (v_id, 'site', 0),
    (v_id, 'quote', 0),
    (v_id, 'job', 0),
    (v_id, 'warranty', 0),
    (v_id, 'ft', 0);

  INSERT INTO public.workspace_memberships (workspace_id, user_id, role_key)
  VALUES (v_id, v_uid, 'owner');

  INSERT INTO public.subscriptions (workspace_id, plan_key, status)
  VALUES (v_id, v_plan, 'active');

  IF v_plan = 'free' THEN
    FOREACH v_feature IN ARRAY ARRAY['fleet', 'ssp', 'workforce']::text[]
    LOOP
      IF EXISTS (
        SELECT 1
        FROM public.plan_features pf
        WHERE pf.plan_key = v_plan
          AND pf.feature_key = v_feature
      ) THEN
        IF NOT EXISTS (
          SELECT 1 FROM public.features f WHERE f.key = v_feature
        ) THEN
          RAISE EXCEPTION 'PRODUCT_DEFAULTS_UNAVAILABLE';
        END IF;

        INSERT INTO public.workspace_feature_overrides (workspace_id, feature_key, enabled)
        VALUES (v_id, v_feature, false);
      END IF;
    END LOOP;
  END IF;

  PERFORM public.seed_workspace_defaults(v_id);

  UPDATE public.profiles
  SET last_workspace_id = v_id
  WHERE id = v_uid;

  RETURN v_id;
END;
$function$;
