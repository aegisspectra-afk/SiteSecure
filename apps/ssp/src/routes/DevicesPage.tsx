import { Button, ErrorState, PageHeader } from "@site-secure/ui";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { DataModeNote } from "../components/DataModeNote";
import { RequireSspAccess } from "../components/RequirePermission";
import { he } from "../i18n/he";
import { useSession } from "../lib/session";

export function DevicesPage() {
  return (
    <RequireSspAccess anyOf={["ssp.sites.view", "ssp.forms.view"]}>
      <DevicesBody />
    </RequireSspAccess>
  );
}

function DevicesBody() {
  const { api, workspaceId } = useSession();
  const list = useQuery({
    queryKey: ["ssp-sites", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listSspSites(workspaceId!),
    retry: false,
  });

  if (!workspaceId) return <ErrorState title={he.sessionError} />;

  return (
    <div className="flex flex-col gap-4" data-testid="ssp-devices">
      <PageHeader title={he.navDevices} description={he.devicesLead} />
      <DataModeNote mode={list.data?.data_mode} waitingDb={list.isError} />
      {list.isLoading ? <p className="text-sm text-fg-muted">{he.loading}</p> : null}
      {list.isError ? (
        <Button type="button" variant="secondary" onClick={() => void list.refetch()}>
          {he.retry}
        </Button>
      ) : null}
      {!list.isLoading && !(list.data?.items.length) && !list.isError ? (
        <p className="text-sm text-fg-muted">{he.noSites}</p>
      ) : null}
      <ul className="divide-y divide-border rounded-lg border border-border text-sm">
        {(list.data?.items ?? []).map((site) => (
          <li key={site.id} className="flex justify-between gap-2 px-4 py-3">
            <Link to="/sites/$siteId" params={{ siteId: site.id }} className="font-medium underline">
              {site.name}
            </Link>
            <span>
              {he.metricDevicesActive} {site.active_devices_count ?? 0}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
