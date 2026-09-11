-- V3 P1-T01: Public plan labels Free / Pro / Enterprise.
-- Persisted plan keys remain solo / business / enterprise (no subscription rewrite).

UPDATE public.plans
SET
  label_he = CASE key
    WHEN 'solo' THEN 'Free'
    WHEN 'business' THEN 'Pro'
    WHEN 'enterprise' THEN 'Enterprise'
    ELSE label_he
  END,
  label_en = CASE key
    WHEN 'solo' THEN 'Free'
    WHEN 'business' THEN 'Pro'
    WHEN 'enterprise' THEN 'Enterprise'
    ELSE label_en
  END
WHERE key IN ('solo', 'business', 'enterprise');

COMMENT ON TABLE public.plans IS
  'Commercial plans. Keys: solo=Free, business=Pro, enterprise=Enterprise. Authorize via entitlements/capabilities, not plan name strings.';
