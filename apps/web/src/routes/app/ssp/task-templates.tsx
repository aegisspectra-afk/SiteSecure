import { Button, Input } from "@site-secure/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { EmptyRows, ErrorState, ModuleScaffold, useQuery } from "../../../components/modules/ModuleKit";
import { RequireSspAction } from "../../../components/ssp/RequireSspAction";
import { SspHubLinks } from "../../../components/ssp/SspHubLinks";
import { useSspWorkspace } from "../../../components/ssp/useSspWorkspace";
import { he } from "../../../i18n/he";

export const Route = createFileRoute("/app/ssp/task-templates")({
  component: () => (
    <RequireSspAction permission="ssp.patrols.view">
      <SspTaskTemplatesPage />
    </RequireSspAction>
  ),
});

function SspTaskTemplatesPage() {
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
    mutationFn: () => api.createSspPatrol(workspaceId!, { name: name.trim() || "משימה" }),
    onSuccess: async () => {
      setName("");
      await qc.invalidateQueries({ queryKey: ["ssp-patrols", workspaceId] });
    },
    onError: (e: unknown) => setMsg(e instanceof Error ? e.message : he.apiUnavailable),
  });
  const createRun = useMutation({
    mutationFn: (patrolId: string) => api.createSspPatrolRun(workspaceId!, { patrol_id: patrolId }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["ssp-patrol-runs", workspaceId] });
    },
    onError: (e: unknown) => setMsg(e instanceof Error ? e.message : he.apiUnavailable),
  });

  if (!workspaceId) return <ErrorState title={he.sessionError} />;

  return (
    <div data-testid="ssp-task-templates">
      <ModuleScaffold title={he.sspNavTaskTemplates} lead={he.sspTaskTemplatesLead}>
        <SspHubLinks items={[{ to: "/app/ssp/templates", label: he.sspNavTemplatesHub }]} />
        {sspCan("ssp.patrols.edit") ? (
          <div className="flex flex-wrap items-end gap-2">
            <Input id="ssp-task-name" label={he.name} value={name} onChange={(e) => setName(e.target.value)} />
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
          <h2 className="text-sm font-semibold text-fg">{he.sspTaskTemplate}</h2>
          {!list.data?.items.length && !list.isLoading ? <p className="ss-module-empty-text">{he.sspNoItems}</p> : null}
          <ul className="divide-y divide-border rounded-[var(--radius-card)] border border-border bg-bg-1 text-sm">
            {(list.data?.items ?? []).map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <span className="font-medium">{row.name}</span>
                <span className="flex items-center gap-2">
                  <span className="text-fg-muted">{row.status}</span>
                  {sspCan("ssp.patrols.edit") ? (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => createRun.mutate(row.id)}
                      disabled={createRun.isPending}
                    >
                      {he.sspCreateTaskRun}
                    </Button>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-fg">{he.sspTaskRun}</h2>
          {!runs.data?.items.length && !runs.isLoading ? <p className="ss-module-empty-text">{he.sspNoItems}</p> : null}
          <ul className="divide-y divide-border rounded-[var(--radius-card)] border border-border bg-bg-1 text-sm">
            {(runs.data?.items ?? []).map((row) => (
              <li key={row.id} className="flex justify-between gap-2 px-4 py-3">
                <span className="font-mono text-xs">{row.id.slice(0, 8)}…</span>
                <span className="text-xs text-fg-muted">
                  {row.status}
                  {row.started_at ? ` · ${row.started_at.slice(0, 16)}` : ""}
                  {row.completed_at ? ` · ${row.completed_at.slice(0, 16)}` : ""}
                </span>
              </li>
            ))}
          </ul>
          <Link to="/app/ssp/patrols" className="ops-section-link text-sm">
            {he.sspNavPatrolExceptions}
          </Link>
        </section>
      </ModuleScaffold>
    </div>
  );
}
