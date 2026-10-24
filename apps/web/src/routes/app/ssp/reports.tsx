import { Button, LoadingBlock } from "@site-secure/ui";
import { createFileRoute } from "@tanstack/react-router";
import { ErrorState, ModuleScaffold } from "../../../components/modules/ModuleKit";
import { useSspWorkspace } from "../../../components/ssp/useSspWorkspace";
import { he } from "../../../i18n/he";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/app/ssp/reports")({
  component: SspReportsPage,
});

function SspReportsPage() {
  const { api, workspaceId } = useSspWorkspace();
  const dash = useQuery({
    queryKey: ["ssp-dashboard", workspaceId, "reports"],
    enabled: Boolean(workspaceId),
    queryFn: () => api.getSspDashboard(workspaceId!),
    retry: false,
  });

  if (!workspaceId) return <ErrorState title={he.sessionError} />;
  if (dash.isLoading) return <LoadingBlock label={he.loading} />;
  if (dash.isError || !dash.data) {
    return (
      <ErrorState
        title={he.apiUnavailable}
        action={
          <Button type="button" variant="secondary" onClick={() => void dash.refetch()}>
            {he.retry}
          </Button>
        }
      />
    );
  }

  const d = dash.data;
  if (d.data_mode === "empty" && !d.company) {
    return (
      <ModuleScaffold title={he.sspNavReports} lead={he.sspReportsLead}>
        <p className="ss-module-empty-text">{he.sspNoItems}</p>
      </ModuleScaffold>
    );
  }

  const metrics = [
    { label: he.sspMetricUsersActive, value: d.users_active ?? d.officers },
    { label: he.sspMetricOfficesActive, value: d.offices_active ?? d.sites_active },
    { label: he.sspStatusPublished, value: d.forms_published },
    { label: he.sspNavAssignments, value: d.site_assignments_active },
    { label: he.sspFillSubmitted, value: d.submissions_submitted },
    { label: he.sspFillPending, value: d.submissions_pending },
    { label: he.sspFillOverdue, value: d.submissions_overdue },
  ];

  return (
    <div data-testid="ssp-reports">
      <ModuleScaffold title={he.sspNavReports} lead={he.sspReportsLead}>
        <p className="text-xs text-fg-muted">{he.sspReportsDeferred}</p>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((item) => (
            <div key={item.label} className="ops-card p-4">
              <dt className="text-xs text-fg-muted">{item.label}</dt>
              <dd className="mt-1 text-2xl font-semibold text-fg">
                {item.value == null ? "—" : item.value}
              </dd>
            </div>
          ))}
        </dl>
      </ModuleScaffold>
    </div>
  );
}
