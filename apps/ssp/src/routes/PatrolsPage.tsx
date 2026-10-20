import { Button, ErrorState, Input, PageHeader } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { DataModeNote } from "../components/DataModeNote";
import { SspHubLinks } from "../components/SspHubLinks";
import { RequireSspAccess } from "../components/RequirePermission";
import { he } from "../i18n/he";
import { useOrg } from "../lib/org";
import { useSession } from "../lib/session";

export function PatrolsPage() {
  return (
    <RequireSspAccess permission="ssp.patrols.view">
      <PatrolsBody />
    </RequireSspAccess>
  );
}

function PatrolsBody() {
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
    mutationFn: () => api.createSspPatrol(workspaceId!, { name: name.trim() || "סיור" }),
    onSuccess: async () => {
      setName("");
      await qc.invalidateQueries({ queryKey: ["ssp-patrols", workspaceId] });
    },
    onError: (e: unknown) => setMsg(e instanceof Error ? e.message : he.apiUnavailable),
  });

  if (!workspaceId) return <ErrorState title={he.sessionError} />;

  return (
    <div className="flex flex-col gap-6" data-testid="ssp-patrols">
      <PageHeader title={he.patrolsTitle} description={he.patrolsLead} />
      <SspHubLinks
        items={[
          { to: "/checkpoints", label: he.navCheckpoints },
          { to: "/task-templates", label: he.navTaskTemplates },
          { to: "/scan", label: he.navScan },
        ]}
      />
      <DataModeNote mode={list.data?.data_mode} waitingDb={list.isError} />
      {sspCan("ssp.patrols.edit") ? (
        <div className="flex flex-wrap items-end gap-2">
          <Input id="ssp-patrol-name" label={he.name} value={name} onChange={(e) => setName(e.target.value)} />
          <Button type="button" onClick={() => create.mutate()} disabled={create.isPending}>
            {he.newPatrol}
          </Button>
        </div>
      ) : null}
      {msg ? <p className="text-sm text-danger">{msg}</p> : null}
      {list.isLoading ? <p className="text-sm text-fg-muted">{he.loading}</p> : null}
      <ul className="divide-y divide-border rounded-lg border border-border">
        {(list.data?.items ?? []).map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-2 px-4 py-3 text-sm">
            <div>
              <div className="font-medium text-fg">{p.name}</div>
              <div className="text-xs text-fg-muted">{p.status}</div>
            </div>
          </li>
        ))}
      </ul>
      {!list.isLoading && !(list.data?.items.length) && !list.isError ? (
        <p className="text-sm text-fg-muted">{he.noItems}</p>
      ) : null}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-fg">ריצות סיור</h2>
        <ul className="divide-y divide-border rounded-lg border border-border text-sm">
          {(runs.data?.items ?? []).map((r) => (
            <li key={r.id} className="flex justify-between gap-2 px-4 py-2">
              <Link
                to="/patrols/runs/$runId"
                params={{ runId: r.id }}
                className="font-mono text-xs text-fg underline"
              >
                {r.id.slice(0, 8)}… · {he.openRun}
              </Link>
              <span>{r.status}</span>
            </li>
          ))}
        </ul>
        {!runs.isLoading && !(runs.data?.items.length) && !runs.isError ? (
          <p className="mt-2 text-sm text-fg-muted">{he.noItems}</p>
        ) : null}
      </section>
    </div>
  );
}
