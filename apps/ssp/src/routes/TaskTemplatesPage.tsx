import { Button, ErrorState, Input, PageHeader } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataModeNote } from "../components/DataModeNote";
import { SspHubLinks } from "../components/SspHubLinks";
import { RequireSspAccess } from "../components/RequirePermission";
import { he } from "../i18n/he";
import { useOrg } from "../lib/org";
import { useSession } from "../lib/session";

export function TaskTemplatesPage() {
  return (
    <RequireSspAccess permission="ssp.patrols.view">
      <TaskTemplatesBody />
    </RequireSspAccess>
  );
}

function TaskTemplatesBody() {
  const { api, workspaceId } = useSession();
  const { sspCan } = useOrg();
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
    <div className="flex flex-col gap-4" data-testid="ssp-task-templates">
      <PageHeader title={he.navTaskTemplates} description={he.taskTemplatesLead} />
      <SspHubLinks items={[{ to: "/templates", label: he.navTemplatesHub }]} />
      <DataModeNote mode={list.data?.data_mode} waitingDb={list.isError || runs.isError} />
      {sspCan("ssp.patrols.edit") ? (
        <div className="flex flex-wrap items-end gap-2">
          <Input id="ssp-task-name" label={he.name} value={name} onChange={(e) => setName(e.target.value)} />
          <Button type="button" onClick={() => create.mutate()} disabled={create.isPending}>
            {he.create}
          </Button>
        </div>
      ) : null}
      {msg ? <p className="text-sm text-danger">{msg}</p> : null}
      <h2 className="text-sm font-semibold">{he.taskTemplate}</h2>
      <ul className="divide-y divide-border rounded-lg border border-border text-sm">
        {(list.data?.items ?? []).map((row) => (
          <li key={row.id} className="flex items-center justify-between gap-2 px-4 py-3">
            <span>{row.name}</span>
            {sspCan("ssp.patrols.edit") ? (
              <Button type="button" variant="secondary" onClick={() => createRun.mutate(row.id)} disabled={createRun.isPending}>
                {he.createTaskRun}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      <h2 className="text-sm font-semibold">{he.taskRun}</h2>
      <ul className="divide-y divide-border rounded-lg border border-border text-sm">
        {(runs.data?.items ?? []).map((row) => (
          <li key={row.id} className="flex justify-between gap-2 px-4 py-3">
            <span className="font-mono text-xs">{row.id.slice(0, 8)}…</span>
            <span>{row.status}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
