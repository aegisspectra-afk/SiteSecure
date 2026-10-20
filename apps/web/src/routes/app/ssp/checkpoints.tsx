import { Button, Input } from "@site-secure/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { EmptyRows, ErrorState, ModuleScaffold, useQuery } from "../../../components/modules/ModuleKit";
import { RequireSspAction } from "../../../components/ssp/RequireSspAction";
import { useSspWorkspace } from "../../../components/ssp/useSspWorkspace";
import { he } from "../../../i18n/he";

export const Route = createFileRoute("/app/ssp/checkpoints")({
  component: () => (
    <RequireSspAction permission="ssp.checkpoints.view">
      <SspCheckpointsPage />
    </RequireSspAction>
  ),
});

function SspCheckpointsPage() {
  const { api, workspaceId, sspCan } = useSspWorkspace();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["ssp-checkpoints", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listSspCheckpoints(workspaceId!),
    retry: false,
  });
  const create = useMutation({
    mutationFn: () =>
      api.createSspCheckpoint(workspaceId!, {
        name: name.trim() || "נקודה",
        location_label: location.trim() || undefined,
      }),
    onSuccess: async () => {
      setName("");
      setLocation("");
      await qc.invalidateQueries({ queryKey: ["ssp-checkpoints", workspaceId] });
    },
    onError: (e: unknown) => setMsg(e instanceof Error ? e.message : he.apiUnavailable),
  });

  if (!workspaceId) return <ErrorState title={he.sessionError} />;

  return (
    <div data-testid="ssp-checkpoints">
      <ModuleScaffold title={he.sspCheckpointsTitle} lead={he.sspCheckpointsLead}>
        {sspCan("ssp.checkpoints.edit") ? (
          <div className="flex flex-wrap items-end gap-2">
            <Input id="ssp-cp-name" label={he.name} value={name} onChange={(e) => setName(e.target.value)} />
            <Input id="ssp-cp-loc" label="מיקום" value={location} onChange={(e) => setLocation(e.target.value)} />
            <Button type="button" onClick={() => create.mutate()} disabled={create.isPending}>
              {he.sspCreate}
            </Button>
          </div>
        ) : null}
        {msg ? <p className="text-sm text-danger">{msg}</p> : null}
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
          <p className="ss-module-empty-text">{he.sspNoItems}</p>
        ) : null}
        <ul className="divide-y divide-border rounded-[var(--radius-card)] border border-border bg-bg-1">
          {(list.data?.items ?? []).map((row) => (
            <li key={row.id} className="px-4 py-3 text-sm">
              <p className="font-medium text-fg">{row.name}</p>
              <p className="text-xs text-fg-muted">{row.location_label || "—"}</p>
            </li>
          ))}
        </ul>
      </ModuleScaffold>
    </div>
  );
}
