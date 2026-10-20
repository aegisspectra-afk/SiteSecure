import { Button, ErrorState, PageHeader } from "@site-secure/ui";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { DataModeNote } from "../components/DataModeNote";
import { SspHubLinks } from "../components/SspHubLinks";
import { RequireSspAccess } from "../components/RequirePermission";
import { he } from "../i18n/he";
import { useSession } from "../lib/session";

export function MobilityPage() {
  return (
    <RequireSspAccess anyOf={["ssp.sites.view", "ssp.forms.view"]}>
      <MobilityBody />
    </RequireSspAccess>
  );
}

function MobilityBody() {
  const { api, workspaceId } = useSession();
  const list = useQuery({
    queryKey: ["ssp-sites", workspaceId, "mobility"],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listSspSites(workspaceId!),
    retry: false,
  });

  if (!workspaceId) return <ErrorState title={he.sessionError} />;
  const rows = (list.data?.items ?? []).filter((site) => (site.active_devices_count ?? 0) > 0);

  return (
    <div className="flex flex-col gap-4" data-testid="ssp-mobility">
      <PageHeader title={he.navMobility} description={he.mobilityLead} />
      <SspHubLinks items={[{ to: "/devices", label: he.navDevices }]} />
      <DataModeNote mode={list.data?.data_mode} waitingDb={list.isError} />
      <p className="text-sm text-fg-muted">{he.locationNeeded}</p>
      {list.isLoading ? <p className="text-sm text-fg-muted">{he.loading}</p> : null}
      {list.isError ? (
        <Button type="button" variant="secondary" onClick={() => void list.refetch()}>
          {he.retry}
        </Button>
      ) : null}
      {!rows.length && !list.isLoading && !list.isError ? (
        <p className="text-sm text-fg-muted">{he.navDevices}: {he.noItems}</p>
      ) : null}
      <ul className="divide-y divide-border rounded-lg border border-border text-sm">
        {rows.map((site) => (
          <li key={site.id} className="flex justify-between gap-2 px-4 py-3">
            <Link to="/sites/$siteId" params={{ siteId: site.id }} className="font-medium underline">
              {site.name}
            </Link>
            <span className="text-xs text-fg-muted">
              {he.metricDevicesActive} {site.active_devices_count ?? 0} · {he.lastSeen}:{" "}
              {site.last_device_seen_at ? site.last_device_seen_at.slice(0, 16) : "—"} · {he.noLocation}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
