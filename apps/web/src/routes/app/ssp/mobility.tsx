import { Button } from "@site-secure/ui";
import { Link, createFileRoute } from "@tanstack/react-router";
import { EmptyRows, ErrorState, ModuleScaffold, useQuery } from "../../../components/modules/ModuleKit";
import { SspHubLinks } from "../../../components/ssp/SspHubLinks";
import { useSspWorkspace } from "../../../components/ssp/useSspWorkspace";
import { he } from "../../../i18n/he";
import { formatOpsTime } from "../../../lib/ssp-ops-time";

export const Route = createFileRoute("/app/ssp/mobility")({
  component: SspMobilityPage,
});

function SspMobilityPage() {
  const { api, workspaceId } = useSspWorkspace();
  const list = useQuery({
    queryKey: ["ssp-sites", workspaceId, "mobility"],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listSspSites(workspaceId!),
    retry: false,
  });

  if (!workspaceId) return <ErrorState title={he.sessionError} />;

  const rows = (list.data?.items ?? []).filter((site) => (site.active_devices_count ?? 0) > 0);

  return (
    <div data-testid="ssp-mobility">
      <ModuleScaffold title={he.sspNavMobility} lead={he.sspMobilityLead}>
        <SspHubLinks items={[{ to: "/app/ssp/devices", label: he.sspNavDevices }]} />
        {list.isLoading ? <EmptyRows message={he.loading} /> : null}
        {list.isError ? (
          <ErrorState
            title={he.apiUnavailable}
            description={he.sspWaitingLocalDb}
            action={
              <Button type="button" variant="secondary" onClick={() => void list.refetch()}>
                {he.retry}
              </Button>
            }
          />
        ) : null}
        <p className="text-sm text-fg-muted">{he.sspLocationNeeded}</p>
        {!list.isLoading && !list.isError && !rows.length ? (
          <p className="ss-module-empty-text">{he.sspNoDevices}</p>
        ) : null}
        <ul className="divide-y divide-border rounded-[var(--radius-card)] border border-border bg-bg-1">
          {rows.map((site) => (
            <li key={site.id}>
              <Link
                to="/app/ssp/sites/$siteId"
                params={{ siteId: site.id }}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-bg-subtle"
              >
                <div>
                  <p className="font-medium text-fg">{site.name}</p>
                  <p className="text-xs text-fg-muted">
                    {site.kind === "physical_site" || site.kind === "other" ? he.sspNavCustomerSites : he.sspNavUsers} ·{" "}
                    {site.activation_status || "—"}
                  </p>
                </div>
                <div className="text-end">
                  <p className="text-sm tabular-nums">
                    {he.sspMetricDevicesActive} {site.active_devices_count ?? 0}
                  </p>
                  <p className="text-xs text-fg-muted">
                    {he.sspLastSeen}: {site.last_device_seen_at ? formatOpsTime(site.last_device_seen_at) : "—"}
                  </p>
                  <p className="text-xs text-fg-muted">{he.sspNoLocation}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </ModuleScaffold>
    </div>
  );
}
