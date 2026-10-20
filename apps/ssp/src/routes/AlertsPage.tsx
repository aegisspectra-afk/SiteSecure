import { Button, ErrorState, PageHeader } from "@site-secure/ui";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { DataModeNote } from "../components/DataModeNote";
import { SspHubLinks } from "../components/SspHubLinks";
import { RequireSspAccess } from "../components/RequirePermission";
import { he } from "../i18n/he";
import { useSession } from "../lib/session";

export function AlertsPage() {
  return (
    <RequireSspAccess anyOf={["ssp.dashboard.view", "ssp.events.view", "ssp.forms.view"]}>
      <AlertsBody />
    </RequireSspAccess>
  );
}

function toSspHref(href: string) {
  return href.startsWith("/app/ssp") ? href.slice("/app/ssp".length) || "/" : href;
}

function AlertsBody() {
  const { api, workspaceId } = useSession();
  const list = useQuery({
    queryKey: ["ssp-alerts", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listSspAlerts(workspaceId!),
    retry: false,
  });

  if (!workspaceId) return <ErrorState title={he.sessionError} />;

  return (
    <div className="flex flex-col gap-4" data-testid="ssp-alerts">
      <PageHeader title={he.navOpsCenter} description={he.alertsLead} />
      <SspHubLinks
        items={[
          { to: "/events", label: he.navEventsHub },
          { to: "/patrols", label: he.navPatrolsMain },
          { to: "/activity", label: he.navWork },
        ]}
      />
      <DataModeNote mode={list.data?.data_mode} waitingDb={list.isError} />
      {list.isLoading ? <p className="text-sm text-fg-muted">{he.loading}</p> : null}
      {list.isError ? (
        <Button type="button" variant="secondary" onClick={() => void list.refetch()}>
          {he.retry}
        </Button>
      ) : null}
      {!list.isLoading && !list.isError && !list.data?.items.length ? (
        <p className="text-sm text-fg-muted">{he.alertsEmpty}</p>
      ) : null}
      <ul className="divide-y divide-border rounded-lg border border-border text-sm">
        {(list.data?.items ?? []).map((row) => (
          <li key={row.id} className="flex justify-between gap-2 px-4 py-3">
            <Link to={toSspHref(row.href) as never} className="font-medium underline">
              {row.title || row.source}
            </Link>
            <span className="text-xs text-fg-muted">
              {row.source} · {row.status || "—"} {row.at ? `· ${row.at.slice(0, 16)}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
