import { useState } from "react";
import { RequirePermission } from "../components/RequirePermission";
import { ErrorState, ModuleScaffold, SimpleEntityTable, useQuery } from "../components/Kit";
import { he } from "../i18n/he";
import { queryErrorDescription } from "../lib/query-error";
import { useSession } from "../lib/session";
import { addDays, formatWeekLabel, startOfWeekSunday, toIso } from "../lib/week";

function statusLabel(status: string): string {
  if (status === "pending") return he.statusPending;
  if (status === "approved") return he.statusApproved;
  if (status === "rejected") return he.statusRejected;
  return status;
}

export function TimeOffPage() {
  return (
    <RequirePermission permission="workforce.schedules.view">
      <TimeOffBody />
    </RequirePermission>
  );
}

function TimeOffBody() {
  const { session, api } = useSession();
  const workspaceId = session?.memberships[0]?.workspace_id;
  const [weekStart, setWeekStart] = useState(() => startOfWeekSunday(new Date()));
  const weekEnd = addDays(weekStart, 7);
  const query = useQuery({
    queryKey: ["workforce-time-off", workspaceId, weekStart.toISOString()],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listWorkforceTimeOff(workspaceId!, { startsFrom: toIso(weekStart), startsTo: toIso(weekEnd) }),
  });

  return (
    <ModuleScaffold title={he.timeOffTitle} lead={he.timeOffLead}>
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
      ) : query.isLoading ? (
        <p className="text-sm text-fg-muted">{he.loading}</p>
      ) : (
        <SimpleEntityTable
          empty={he.timeOffEmpty}
          statusLabel={statusLabel}
          rows={(query.data?.items ?? []).map((row) => ({
            id: row.id,
            title: row.employee_name || he.navTimeOff,
            meta: row.kind,
            status: row.status,
          }))}
        />
      )}
    </ModuleScaffold>
  );
}
