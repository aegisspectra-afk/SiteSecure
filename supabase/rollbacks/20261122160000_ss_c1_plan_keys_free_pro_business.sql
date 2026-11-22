-- Rollback C1 plan keys: free → solo (best-effort). Does not remove pro if subscriptions use it.
-- Prefer restore from backup if production already migrated.

UPDATE public.subscriptions SET plan_key = 'solo' WHERE plan_key = 'free';

INSERT INTO public.plans (key, label_he, label_en)
SELECT 'solo', 'Free', 'Free'
WHERE NOT EXISTS (SELECT 1 FROM public.plans WHERE key = 'solo');

INSERT INTO public.plan_features (plan_key, feature_key)
SELECT 'solo', pf.feature_key FROM public.plan_features pf
WHERE pf.plan_key = 'free'
  AND NOT EXISTS (SELECT 1 FROM public.plan_features x WHERE x.plan_key = 'solo' AND x.feature_key = pf.feature_key);

INSERT INTO public.plan_limits (plan_key, limit_key, limit_value)
SELECT 'solo', pl.limit_key, pl.limit_value FROM public.plan_limits pl
WHERE pl.plan_key = 'free'
  AND NOT EXISTS (SELECT 1 FROM public.plan_limits x WHERE x.plan_key = 'solo' AND x.limit_key = pl.limit_key);

DELETE FROM public.plan_capabilities WHERE capability_key = 'quotes.alternatives';
DELETE FROM public.capabilities WHERE key = 'quotes.alternatives';
-- Leave pro/business/enterprise rows; operators must re-label manually if needed.
