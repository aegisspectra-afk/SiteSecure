import { Button, ErrorState, Input, PageHeader, Textarea } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { DataModeNote } from "../components/DataModeNote";
import { SspHubLinks } from "../components/SspHubLinks";
import { RequireSspAccess } from "../components/RequirePermission";
import { he } from "../i18n/he";
import { useOrg } from "../lib/org";
import { useSession } from "../lib/session";

export function EventsPage() {
  return (
    <RequireSspAccess permission="ssp.events.view">
      <EventsBody />
    </RequireSspAccess>
  );
}

function EventsBody() {
  const { api, workspaceId } = useSession();
  const { sspCan } = useOrg();
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
    <div className="flex flex-col gap-4" data-testid="ssp-events">
      <PageHeader title={he.eventsTitle} description={he.eventsLead} />
      <SspHubLinks
        items={[
          { to: "/alerts", label: he.navOpsCenter },
          { to: "/patrols", label: he.navPatrols },
        ]}
      />
      <p className="text-xs text-fg-muted">{he.distressUnavailable}</p>
      <DataModeNote mode={list.data?.data_mode} waitingDb={list.isError} />
      {sspCan("ssp.events.create") ? (
        <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
          <Input id="ev-title" label={he.name} value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea
            id="ev-desc"
            label="תיאור"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
          <Button type="button" onClick={() => create.mutate()} disabled={create.isPending}>
            {he.newEvent}
          </Button>
        </div>
      ) : null}
      {msg ? <p className="text-sm text-danger">{msg}</p> : null}
      {list.isLoading ? <p className="text-sm text-fg-muted">{he.loading}</p> : null}
      <ul className="divide-y divide-border rounded-lg border border-border">
        {(list.data?.items ?? []).map((e) => (
          <li key={e.id} className="px-4 py-3 text-sm">
            <Link to="/events/$eventId" params={{ eventId: e.id }} className="font-medium text-fg underline">
              {e.title}
            </Link>
            <div className="text-xs text-fg-muted">
              {e.status} · {e.severity} · {e.category}
            </div>
          </li>
        ))}
      </ul>
      {!list.isLoading && !(list.data?.items.length) && !list.isError ? (
        <p className="text-sm text-fg-muted">{he.noItems}</p>
      ) : null}
    </div>
  );
}
