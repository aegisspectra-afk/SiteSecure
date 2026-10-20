import { Button, Input } from "@site-secure/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { EmptyRows, ErrorState, ModuleScaffold, useQuery } from "../../../components/modules/ModuleKit";
import { RequireSspAction } from "../../../components/ssp/RequireSspAction";
import { SspHubLinks } from "../../../components/ssp/SspHubLinks";
import { useSspWorkspace } from "../../../components/ssp/useSspWorkspace";
import { he } from "../../../i18n/he";

export const Route = createFileRoute("/app/ssp/patrols")({
  component: () => (
    <RequireSspAction permission="ssp.patrols.view">
      <SspPatrolsPage />
    </RequireSspAction>
  ),
});

function SspPatrolsPage() {
  const { api, workspaceId, sspCan } = useSspWorkspace();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["ssp-patrols", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listSspPatrols(workspaceId!),
    retry: false,
  });
  const runs = useQuery({
    queryKey: ["ssp-patrol-runs", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listSspPatrolRuns(workspaceId!),
    retry: false,
  });
  const create = useMutation({
    mutationFn: () => api.createSspPatrol(workspaceId!, { name: name.trim() || "סיור" }),
    onSuccess: async () => {
      setName("");
      await qc.invalidateQueries({ queryKey: ["ssp-patrols", workspaceId] });
    },
    onError: (e: unknown) => setMsg(e instanceof Error ? e.message : he.apiUnavailable),
  });

  if (!workspaceId) return <ErrorState title={he.sessionError} />;

  const late = (runs.data?.items ?? []).filter((row) => row.status === "late");

  return (
    <div data-testid="ssp-patrols">
      <ModuleScaffold title={he.sspPatrolsTitle} lead={he.sspPatrolsLead}>
        <SspHubLinks
          items={[
            { to: "/app/ssp/checkpoints", label: he.sspNavCheckpoints },
            { to: "/app/ssp/task-templates", label: he.sspNavTaskTemplates },
          ]}
        />
        {sspCan("ssp.patrols.edit") ? (
          <div className="flex flex-wrap items-end gap-2">
            <Input id="ssp-patrol-name" label={he.name} value={name} onChange={(e) => setName(e.target.value)} />
            <Button type="button" onClick={() => create.mutate()} disabled={create.isPending}>
              {he.sspCreate}
            </Button>
          </div>
        ) : null}
        {msg ? <p className="text-sm text-danger">{msg}</p> : null}
        {list.isLoading || runs.isLoading ? <EmptyRows message={he.loading} /> : null}
        {list.isError || runs.isError ? (
          <ErrorState title={he.apiUnavailable} description={he.sspWaitingLocalDb} />
        ) : null}
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-fg">{he.sspMetricLateRuns}</h2>
          {!late.length ? <p className="ss-module-empty-text">{he.sspNoExceptions}</p> : null}
          <ul className="divide-y divide-border rounded-[var(--radius-card)] border border-border bg-bg-1 text-sm">
            {late.map((row) => (
              <li key={row.id} className="flex justify-between gap-2 px-4 py-3">
                <span className="font-mono text-xs">{row.id.slice(0, 8)}…</span>
                <span>{row.status}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-fg">{he.sspPatrolsTitle}</h2>
          {!list.data?.items.length && !list.isLoading ? <p className="ss-module-empty-text">{he.sspNoItems}</p> : null}
          <ul className="divide-y divide-border rounded-[var(--radius-card)] border border-border bg-bg-1 text-sm">
            {(list.data?.items ?? []).map((row) => (
              <li key={row.id} className="flex justify-between gap-2 px-4 py-3">
                <span className="font-medium">{row.name}</span>
                <span className="text-fg-muted">{row.status}</span>
              </li>
            ))}
          </ul>
        </section>
      </ModuleScaffold>
    </div>
  );
}
