import { Button, Input, Textarea } from "@site-secure/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { EmptyRows, ErrorState, ModuleScaffold, useQuery } from "../../../components/modules/ModuleKit";
import { RequireSspAction } from "../../../components/ssp/RequireSspAction";
import { SspHubLinks } from "../../../components/ssp/SspHubLinks";
import { useSspWorkspace } from "../../../components/ssp/useSspWorkspace";
import { he } from "../../../i18n/he";
import { formatOpsTime } from "../../../lib/ssp-ops-time";

export const Route = createFileRoute("/app/ssp/events/")({
  component: () => (
    <RequireSspAction permission="ssp.events.view">
      <SspEventsPage />
    </RequireSspAction>
  ),
});

function SspEventsPage() {
  const { api, workspaceId, sspCan } = useSspWorkspace();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["ssp-events", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listSspEvents(workspaceId!),
    retry: false,
  });
  const create = useMutation({
    mutationFn: () =>
      api.createSspEvent(workspaceId!, {
        title: title.trim() || "אירוע",
        description: description.trim(),
      }),
    onSuccess: async () => {
      setTitle("");
      setDescription("");
      await qc.invalidateQueries({ queryKey: ["ssp-events", workspaceId] });
    },
    onError: (e: unknown) => setMsg(e instanceof Error ? e.message : he.apiUnavailable),
  });

  if (!workspaceId) return <ErrorState title={he.sessionError} />;

  return (
    <div data-testid="ssp-events">
      <ModuleScaffold title={he.sspEventsTitle} lead={he.sspEventsLead}>
        <SspHubLinks
          items={[
            { to: "/app/ssp/alerts", label: he.sspNavOpsCenter },
            { to: "/app/ssp/patrols", label: he.sspNavPatrolExceptions },
          ]}
        />
        <p className="text-xs text-fg-muted">{he.sspDistressUnavailable}</p>
        {sspCan("ssp.events.create") ? (
          <div className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-border p-3">
            <Input id="ssp-ev-title" label={he.name} value={title} onChange={(e) => setTitle(e.target.value)} />
            <Textarea
              id="ssp-ev-desc"
              label="תיאור"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
            <Button type="button" onClick={() => create.mutate()} disabled={create.isPending}>
              {he.sspNewEvent}
            </Button>
          </div>
        ) : null}
        {msg ? <p className="text-sm text-danger">{msg}</p> : null}
        {list.isLoading ? <EmptyRows message={he.loading} /> : null}
        {list.isError ? (
          <ErrorState title={he.apiUnavailable} description={he.sspWaitingLocalDb} />
        ) : null}
        {!list.isLoading && !list.isError && !(list.data?.items.length) ? (
          <p className="ss-module-empty-text">{he.sspNoItems}</p>
        ) : null}
        <ul className="divide-y divide-border rounded-[var(--radius-card)] border border-border bg-bg-1">
          {(list.data?.items ?? []).map((row) => (
            <li key={row.id} className="px-4 py-3 text-sm">
              <Link to="/app/ssp/events/$eventId" params={{ eventId: row.id }} className="font-medium text-fg hover:underline">
                {row.title}
              </Link>
              <p className="text-xs text-fg-muted">
                {row.status} · {row.severity} · {formatOpsTime(row.created_at)}
              </p>
            </li>
          ))}
        </ul>
      </ModuleScaffold>
    </div>
  );
}
