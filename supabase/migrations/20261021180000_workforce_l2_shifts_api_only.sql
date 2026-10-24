-- L2: assignment writes are FastAPI-only so legal/policy validation cannot be
-- bypassed through PostgREST. Authenticated keeps SELECT under existing RLS.
-- service_role keeps write grants for the API after authorize() + validate.
-- Does not weaken employee/membership API-only locks. Local apply only.

REVOKE INSERT, UPDATE, DELETE ON TABLE public.workforce_shifts FROM authenticated;
GRANT SELECT ON TABLE public.workforce_shifts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.workforce_shifts TO service_role;

DROP POLICY IF EXISTS workforce_shifts_insert ON public.workforce_shifts;
DROP POLICY IF EXISTS workforce_shifts_update ON public.workforce_shifts;
DROP POLICY IF EXISTS workforce_shifts_delete ON public.workforce_shifts;

-- Keep SELECT RLS. Defense in depth if INSERT is ever re-granted.
CREATE POLICY workforce_shifts_insert ON public.workforce_shifts
  FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY workforce_shifts_update ON public.workforce_shifts
  FOR UPDATE TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY workforce_shifts_delete ON public.workforce_shifts
  FOR DELETE TO authenticated
  USING (false);

ALTER TABLE public.workforce_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workforce_shifts FORCE ROW LEVEL SECURITY;

COMMENT ON TABLE public.workforce_shifts IS
  'Assigned work. Writes are FastAPI + service_role only. L2 validation cannot be bypassed via PostgREST.';

REVOKE INSERT, UPDATE, DELETE ON TABLE public.workforce_employees FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.workforce_memberships FROM authenticated;
