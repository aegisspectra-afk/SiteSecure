-- Portal employees may SELECT only their own assignments.
-- Does not grant workforce.schedules.view, org week board, or shift writes.
-- Local apply only. Do not apply to cloud / production / G1.

DROP POLICY IF EXISTS workforce_shifts_select ON public.workforce_shifts;

CREATE POLICY workforce_shifts_select ON public.workforce_shifts
  FOR SELECT TO authenticated
  USING (
    public.auth_is_member(workspace_id)
    AND public.auth_feature(workspace_id, 'workforce')
    AND (
      public.auth_has_workspace_grant(workspace_id, 'workforce.schedules.view')
      OR public.auth_has_workspace_grant(workspace_id, 'workforce.schedules.edit')
      OR (
        public.auth_has_workspace_grant(workspace_id, 'workforce.portal.view')
        AND employee_id IN (
          SELECT e.id
          FROM public.workforce_employees e
          WHERE e.workspace_id = workforce_shifts.workspace_id
            AND e.user_id = (SELECT auth.uid())
        )
      )
    )
  );

ALTER TABLE public.workforce_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workforce_shifts FORCE ROW LEVEL SECURITY;

COMMENT ON POLICY workforce_shifts_select ON public.workforce_shifts IS
  'Schedulers see workspace assignments. Portal members see only rows bound to their employee.user_id.';
