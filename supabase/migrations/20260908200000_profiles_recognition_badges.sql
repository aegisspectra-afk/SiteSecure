-- Platform recognition badges (Founding Technician etc.) — metadata, not RBAC.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS recognition_badges text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_recognition_badges_chk;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_recognition_badges_chk
  CHECK (
    recognition_badges <@ ARRAY[
      'founding_technician',
      'verified_technician',
      'early_access',
      'partner'
    ]::text[]
  );

CREATE OR REPLACE FUNCTION public.protect_recognition_badges()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.recognition_badges IS DISTINCT FROM OLD.recognition_badges THEN
    IF auth.role() IS DISTINCT FROM 'service_role' AND auth.uid() IS NOT NULL THEN
      RAISE EXCEPTION 'cannot change recognition_badges';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_recognition_badges ON public.profiles;
CREATE TRIGGER profiles_protect_recognition_badges
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_recognition_badges();
