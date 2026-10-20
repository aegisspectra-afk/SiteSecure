import { Button, Input, Textarea } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ErrorState, ModuleScaffold } from "../../../components/modules/ModuleKit";
import { RequireSspAction } from "../../../components/ssp/RequireSspAction";
import { useSspWorkspace } from "../../../components/ssp/useSspWorkspace";
import { he } from "../../../i18n/he";
import { formatOpsTime } from "../../../lib/ssp-ops-time";

export const Route = createFileRoute("/app/ssp/events/$eventId")({
  component: () => (
    <RequireSspAction permission="ssp.events.view">
      <SspEventDetailPage />
    </RequireSspAction>
  ),
});

function SspEventDetailPage() {
  const { eventId } = Route.useParams();
  const { api, workspaceId, sspCan } = useSspWorkspace();
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [assignee, setAssignee] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const detail = useQuery({
    queryKey: ["ssp-event", workspaceId, eventId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.getSspEvent(workspaceId!, eventId),
    retry: false,
  });
  const patch = useMutation({
    mutationFn: (body: Parameters<typeof api.patchSspEvent>[2]) => api.patchSspEvent(workspaceId!, eventId, body),
    onSuccess: async () => {
      setNote("");
      setMsg(null);
      await qc.invalidateQueries({ queryKey: ["ssp-event", workspaceId, eventId] });
    },
    onError: (e: unknown) => setMsg(e instanceof Error ? e.message : he.apiUnavailable),
  });

  if (!workspaceId) return <ErrorState title={he.sessionError} />;
  if (detail.isLoading) return <p className="text-sm text-fg-muted">{he.loading}</p>;
  if (detail.isError || !detail.data) {
    return (
      <ErrorState
        title={he.apiUnavailable}
        action={
          <Button type="button" variant="secondary" onClick={() => void detail.refetch()}>
            {he.retry}
          </Button>
        }
      />
    );
  }

  const { event, actions } = detail.data;

  return (
    <div data-testid="ssp-event-detail">
      <ModuleScaffold title={event.title} lead={`${event.status} · ${event.severity}`}>
        <p className="whitespace-pre-wrap text-sm text-fg-muted">{event.description || "—"}</p>
        {msg ? <p className="text-sm text-danger">{msg}</p> : null}
        {sspCan("ssp.events.edit") ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => patch.mutate({ status: "in_progress" })}>
              בטיפול
            </Button>
            <Button type="button" variant="secondary" onClick={() => patch.mutate({ status: "resolved" })}>
              טופל
            </Button>
            <Button type="button" onClick={() => patch.mutate({ status: "closed" })}>
              סגירה
            </Button>
            <Input id="ssp-ev-assignee" label="מזהה משתמש" value={assignee} onChange={(e) => setAssignee(e.target.value)} />
            <Button
              type="button"
              variant="secondary"
              disabled={!assignee.trim()}
              onClick={() => patch.mutate({ assignee_user_id: assignee.trim() })}
            >
              הקצאה
            </Button>
          </div>
        ) : null}
        <Textarea id="ssp-ev-note" label="הערה" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
        <Button
          type="button"
          variant="secondary"
          disabled={!note.trim() || patch.isPending}
          onClick={() => patch.mutate({ note: note.trim() })}
        >
          הוספת הערה
        </Button>
        <section>
          <h2 className="mb-2 text-sm font-semibold">{he.sspTimelineTitle}</h2>
          <ul className="divide-y divide-border rounded-[var(--radius-card)] border border-border text-sm">
            {actions.map((row) => (
              <li key={row.id} className="px-3 py-2">
                <p className="font-medium">{row.action_type}</p>
                <p className="text-xs text-fg-muted">
                  {row.from_value ? `${row.from_value} → ` : ""}
                  {row.to_value ?? ""}
                  {row.note ? ` · ${row.note}` : ""}
                </p>
                <p className="text-xs text-fg-muted">{formatOpsTime(row.created_at)}</p>
              </li>
            ))}
          </ul>
          {!actions.length ? <p className="text-sm text-fg-muted">{he.sspNoItems}</p> : null}
        </section>
      </ModuleScaffold>
    </div>
  );
}
