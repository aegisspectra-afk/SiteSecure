ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS business_type text;

ALTER TABLE public.workspaces
  DROP CONSTRAINT IF EXISTS workspaces_business_type_chk;

ALTER TABLE public.workspaces
  ADD CONSTRAINT workspaces_business_type_chk
  CHECK (
    business_type IS NULL OR business_type IN (
      'security_company',
      'security_installer',
      'low_voltage',
      'integrator',
      'electrician',
      'other'
    )
  );

COMMENT ON COLUMN public.workspaces.business_type IS 'Onboarding business category for analytics and personalization.';
