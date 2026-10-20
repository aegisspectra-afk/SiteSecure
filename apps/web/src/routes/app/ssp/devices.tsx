import { Button } from "@site-secure/ui";
import { Link, createFileRoute } from "@tanstack/react-router";
import { EmptyRows, ErrorState, ModuleScaffold, useQuery } from "../../../components/modules/ModuleKit";
import { useSspWorkspace } from "../../../components/ssp/useSspWorkspace";
import { he } from "../../../i18n/he";

export const Route = createFileRoute("/app/ssp/devices")({
  component: SspDevicesPage,
});

function SspDevicesPage() {
  const { api, workspaceId } = useSspWorkspace();
  const list = useQuery({
    queryKey: ["ssp-sites", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listSspSites(workspaceId!),
    retry: false,
  });

  if (!workspaceId) return <ErrorState title={he.sessionError} />;

  return (
    <div data-testid="ssp-devices">
      <ModuleScaffold title={he.sspNavDevices} lead={he.sspDevicesLead}>
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
        {!list.isLoading && !list.isError && !(list.data?.items.length) ? (
          <p className="ss-module-empty-text">{he.sspNoSites}</p>
        ) : null}
        <ul className="divide-y divide-border rounded-[var(--radius-card)] border border-border bg-bg-1">
          {(list.data?.items ?? []).map((site) => (
            <li key={site.id}>
              <Link
                to="/app/ssp/sites/$siteId"
                params={{ siteId: site.id }}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-bg-subtle"
              >
                <div>
                  <p className="font-medium text-fg">{site.name}</p>
                  <p className="text-xs text-fg-muted">{site.activation_status || "—"}</p>
                </div>
                <p className="text-sm tabular-nums text-fg">
                  {he.sspMetricDevicesActive} {site.active_devices_count ?? 0}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </ModuleScaffold>
    </div>
  );
}
