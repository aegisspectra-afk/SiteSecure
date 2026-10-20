import { Button } from "@site-secure/ui";
import { Link, createFileRoute } from "@tanstack/react-router";
import { EmptyRows, ErrorState, ModuleScaffold, useQuery } from "../../../components/modules/ModuleKit";
import { SspHubLinks } from "../../../components/ssp/SspHubLinks";
import { useSspWorkspace } from "../../../components/ssp/useSspWorkspace";
import { he } from "../../../i18n/he";
import { formatOpsTime } from "../../../lib/ssp-ops-time";

export const Route = createFileRoute("/app/ssp/alerts")({
  component: SspAlertsPage,
});

function sourceLabel(source: string) {
  if (source === "event") return he.sspAlertSourceEvent;
  if (source === "patrol") return he.sspAlertSourcePatrol;
  if (source === "join") return he.sspAlertSourceJoin;
  if (source === "form") return he.sspAlertSourceForm;
  return source;
}

function SspAlertsPage() {
  const { api, workspaceId } = useSspWorkspace();
  const list = useQuery({
    queryKey: ["ssp-alerts", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listSspAlerts(workspaceId!),
    retry: false,
  });

  if (!workspaceId) return <ErrorState title={he.sessionError} />;

  return (
    <div data-testid="ssp-alerts">
      <ModuleScaffold title={he.sspNavOpsCenter} lead={he.sspOpsCenterLead}>
        <SspHubLinks
          items={[
            { to: "/app/ssp/events", label: he.sspNavEventsHub },
            { to: "/app/ssp/patrols", label: he.sspNavPatrolsMain },
            { to: "/app/ssp/activity", label: he.sspNavWork },
          ]}
        />
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
        {!list.isLoading && !list.isError && !list.data?.items.length ? (
          <p className="ss-module-empty-text">{he.sspAlertsEmpty}</p>
        ) : null}
        <ul className="divide-y divide-border rounded-[var(--radius-card)] border border-border bg-bg-1">
          {(list.data?.items ?? []).map((row) => (
            <li key={row.id}>
              <Link
                to={row.href as never}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-bg-subtle"
              >
                <div className="min-w-0">
                  <p className="font-medium text-fg">{row.title || sourceLabel(row.source)}</p>
                  <p className="text-xs text-fg-muted">
                    {sourceLabel(row.source)} · {row.status || "—"}
                    {row.severity ? ` · ${row.severity}` : ""}
                  </p>
                </div>
                <p className="text-xs text-fg-muted">{row.at ? formatOpsTime(row.at) : "—"}</p>
              </Link>
            </li>
          ))}
        </ul>
      </ModuleScaffold>
    </div>
  );
}
