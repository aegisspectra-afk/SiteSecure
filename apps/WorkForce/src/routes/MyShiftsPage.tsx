import { useState } from "react";
import { RequirePermission } from "../components/RequirePermission";
import { EmptyRows, ErrorState, ModuleScaffold, Status, useQuery } from "../components/Kit";
import { he } from "../i18n/he";
import { assignmentStatusLabel, groupMyShiftsByDate, shiftMeta } from "../lib/my-shifts";
import { queryErrorDescription } from "../lib/query-error";
import { useSession } from "../lib/session";
import { addDays, formatWeekLabel, startOfWeekSunday, toIso } from "../lib/week";

export function MyShiftsPage() {
  return (
    <RequirePermission permission="workforce.portal.view">
      <MyShiftsBody />
    </RequirePermission>
  );
}

function MyShiftsBody() {
  const { session, api } = useSession();
  const workspaceId = session?.memberships[0]?.workspace_id;
  const [weekStart, setWeekStart] = useState(() => startOfWeekSunday(new Date()));
  const weekEnd = addDays(weekStart, 7);
  const query = useQuery({
    queryKey: ["workforce-me-shifts", workspaceId, weekStart.toISOString()],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listMyWorkforceShifts(workspaceId!, { startsFrom: toIso(weekStart), startsTo: toIso(weekEnd) }),
  });
  const groups = groupMyShiftsByDate(query.data?.items ?? []);

  return (
    <ModuleScaffold title={he.portalTitle} lead={he.portalLead}>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="wf-ops-chip" onClick={() => setWeekStart((current) => addDays(current, -7))}>
          {he.weekPrev}
        </button>
        <p className="text-sm font-medium text-fg">{formatWeekLabel(weekStart)}</p>
        <button type="button" className="wf-ops-chip" onClick={() => setWeekStart((current) => addDays(current, 7))}>
          {he.weekNext}
        </button>
      </div>
      {query.isError ? (
        <ErrorState title={he.loadError} description={queryErrorDescription(query.error)} />
      ) : query.isLoading || query.isFetching ? (
        <p className="text-sm text-fg-muted">{he.loading}</p>
      ) : groups.length === 0 ? (
        <EmptyRows message={he.portalEmpty} />
      ) : (
        <div className="wf-my-shifts">
          {groups.map((group) => (
            <section key={group.date} className="wf-my-shift-day" aria-label={group.label}>
              <h2>{group.label}</h2>
              <ul>
                {group.items.map((row) => (
                  <li key={row.id} className="wf-my-shift-card">
                    <div>
                      <p className="wf-my-shift-time">
                        {row.starts_local}–{row.ends_local}
                        {row.overnight ? <span className="wf-my-shift-flag">{he.overnightShift}</span> : null}
                      </p>
                      <p className="wf-my-shift-meta">{shiftMeta(row) || he.fieldSite}</p>
                    </div>
                    <Status label={assignmentStatusLabel(row.status)} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </ModuleScaffold>
  );
}
