import { Link, createFileRoute } from "@tanstack/react-router";
import { EmptyRows, ErrorState, ModuleScaffold, useQuery } from "../../../components/modules/ModuleKit";
import { he } from "../../../i18n/he";
import { can } from "../../../lib/can";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/app/workforce/")({
  component: WorkforceDashboardPage,
});

function WorkforceDashboardPage() {
  const { session, api } = useSession();
  const membership = session?.memberships[0];
  const workspaceId = membership?.workspace_id;
  const canViewOps = can(
    membership?.role_key,
    "workforce.view",
    membership?.features ?? [],
    membership?.permissions ?? null,
  );
  const query = useQuery({
    queryKey: ["workforce-summary", workspaceId],
    enabled: Boolean(workspaceId && canViewOps),
    queryFn: () => api.getWorkforceSummary(workspaceId!),
  });

  if (!canViewOps) {
    return (
      <ModuleScaffold title={he.workforcePortalTitle} lead={he.workforcePortalLead}>
        <EmptyRows message={he.workforcePortalLead} />
      </ModuleScaffold>
    );
  }

  return (
    <ModuleScaffold title={he.workforceDashboardTitle} lead={he.workforceDashboardLead}>
      {query.isError ? (
        <ErrorState title={he.workforceLoadError} description={he.workforceLoadErrorHint} />
      ) : query.isLoading || !query.data ? (
        <p className="text-sm text-fg-muted">{he.loading}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Metric label={he.workforceMetricEmployees} value={query.data.employees_active} to="/app/workforce/employees" />
          <Metric label={he.workforceMetricAccounts} value={query.data.employees_with_account} to="/app/workforce/employees" />
          <Metric label={he.workforceMetricSites} value={query.data.sites_active} to="/app/workforce/sites" />
          {query.data.employees_total === 0 && query.data.sites_total === 0 ? (
            <div className="sm:col-span-2 lg:col-span-3">
              <EmptyRows message={he.workforceEmptyFoundation} />
            </div>
          ) : null}
        </div>
      )}
    </ModuleScaffold>
  );
}

function Metric({
  label,
  value,
  to,
}: {
  label: string;
  value: number;
  to?: "/app/workforce/employees" | "/app/workforce/sites";
}) {
  const body = (
    <>
      <p className="text-xs text-fg-muted">{label}</p>
      <p className="text-2xl font-semibold tabular-nums text-fg">{value}</p>
    </>
  );
  if (to) {
    return (
      <Link to={to} className="ops-kpi-card ops-card-interactive px-4 py-3">
        {body}
      </Link>
    );
  }
  return <div className="ops-kpi-card px-4 py-3">{body}</div>;
}
