import { Button, ErrorState, Input, PageHeader, Textarea } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useState } from "react";
import { DataModeNote } from "../components/DataModeNote";
import { RequireSspAccess } from "../components/RequirePermission";
import { he } from "../i18n/he";
import { useOrg } from "../lib/org";
import { useSession } from "../lib/session";

export function EventDetailPage() {
  return (
    <RequireSspAccess permission="ssp.events.view">
      <Body />
    </RequireSspAccess>
  );
}

function Body() {
  const { eventId } = useParams({ from: "/authenticated/events/$eventId" });
  const { api, workspaceId } = useSession();
  const { sspCan } = useOrg();
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
    mutationFn: (body: Parameters<typeof api.patchSspEvent>[2]) =>
      api.patchSspEvent(workspaceId!, eventId, body),
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
    <div className="flex flex-col gap-4" data-testid="ssp-event-detail">
      <PageHeader title={event.title} description={`${event.status} · ${event.severity}`} />
      <DataModeNote mode={detail.data.data_mode} />
      <p className="text-sm text-fg-muted whitespace-pre-wrap">{event.description || "—"}</p>
      {msg ? <p className="text-sm text-danger">{msg}</p> : null}

      {sspCan("ssp.events.edit") ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => patch.mutate({ status: "in_progress" })}>
            {he.eventInProgress}
          </Button>
          <Button type="button" variant="secondary" onClick={() => patch.mutate({ status: "resolved" })}>
            {he.eventResolved}
          </Button>
          <Button type="button" onClick={() => patch.mutate({ status: "closed" })}>
            {he.eventClose}
          </Button>
          <div className="flex flex-wrap items-end gap-2">
            <Input
              id="ev-assignee"
              label={he.eventAssignee}
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
            />
            <Button
              type="button"
              variant="secondary"
              disabled={!assignee.trim()}
              onClick={() => patch.mutate({ assignee_user_id: assignee.trim() })}
            >
              {he.eventAssign}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <Textarea id="ev-note" label={he.eventNote} value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
        <Button
          type="button"
          variant="secondary"
          disabled={!note.trim() || patch.isPending}
          onClick={() => patch.mutate({ note: note.trim() })}
        >
          {he.eventAddNote}
        </Button>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold">{he.eventHistory}</h2>
        <ul className="divide-y divide-border rounded-lg border border-border text-sm">
          {actions.map((a) => (
            <li key={a.id} className="px-3 py-2">
              <div className="font-medium">{a.action_type}</div>
              <div className="text-xs text-fg-muted">
                {a.from_value ? `${a.from_value} → ` : ""}
                {a.to_value ?? ""}
                {a.note ? ` · ${a.note}` : ""}
              </div>
              <div className="text-xs text-fg-muted">{a.created_at}</div>
            </li>
          ))}
        </ul>
        {!actions.length ? <p className="text-sm text-fg-muted">{he.noItems}</p> : null}
      </section>
    </div>
  );
}
