-- Beta Task 01: Founding Technician is Badge-only, not a permission Role.

WITH moved AS (
  UPDATE public.workspace_memberships m
  SET role_key = 'technician',
      workspace_role_key = CASE
        WHEN m.workspace_role_key = 'founding_technician' THEN 'technician'
        ELSE COALESCE(m.workspace_role_key, 'technician')
      END,
      program_type = COALESCE(NULLIF(m.program_type, ''), 'founding_technician')
  WHERE m.role_key = 'founding_technician'
  RETURNING m.user_id
)
UPDATE public.profiles p
SET recognition_badges = (
  SELECT ARRAY(
    SELECT DISTINCT x
    FROM unnest(COALESCE(p.recognition_badges, '{}'::text[]) || ARRAY['founding_technician']::text[]) AS x
  )
)
WHERE p.id IN (SELECT user_id FROM moved);

UPDATE public.invitations
SET role_key = 'technician'
WHERE role_key = 'founding_technician'
  AND accepted_at IS NULL;

CREATE OR REPLACE FUNCTION public.block_founding_technician_role()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.role_key = 'founding_technician' THEN
    NEW.role_key := 'technician';
    NEW.program_type := COALESCE(NULLIF(NEW.program_type, ''), 'founding_technician');
    IF NEW.workspace_role_key IS NULL OR NEW.workspace_role_key = 'founding_technician' THEN
      NEW.workspace_role_key := 'technician';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS workspace_memberships_block_ft_role ON public.workspace_memberships;
CREATE TRIGGER workspace_memberships_block_ft_role
  BEFORE INSERT OR UPDATE OF role_key ON public.workspace_memberships
  FOR EACH ROW EXECUTE FUNCTION public.block_founding_technician_role();
