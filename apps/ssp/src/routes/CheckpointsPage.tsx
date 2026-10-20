import { Button, ErrorState, Input, PageHeader } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { DataModeNote } from "../components/DataModeNote";
import { RequireSspAccess } from "../components/RequirePermission";
import { he } from "../i18n/he";
import { useOrg } from "../lib/org";
import { useSession } from "../lib/session";

export function CheckpointsPage() {
  return (
    <RequireSspAccess permission="ssp.checkpoints.view">
      <CheckpointsBody />
    </RequireSspAccess>
  );
}

function CheckpointsBody() {
  const { api, workspaceId } = useSession();
  const { sspCan } = useOrg();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [scanCode, setScanCode] = useState("");
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

  const scan = useMutation({
    mutationFn: () => api.createSspScan(workspaceId!, { code: scanCode.trim() }),
    onSuccess: (row) => {
      setMsg(`${he.scanAction}: ${row.result}`);
      setScanCode("");
    },
    onError: (e: unknown) => setMsg(e instanceof Error ? e.message : he.apiUnavailable),
  });

  if (!workspaceId) return <ErrorState title={he.sessionError} />;

  return (
    <div className="flex flex-col gap-6" data-testid="ssp-checkpoints">
      <PageHeader
        title={he.checkpointsTitle}
        description={he.checkpointsLead}
        action={
          <Link to="/checkpoints/print" className="rounded-md bg-bg-subtle px-3 py-2 text-sm font-medium text-fg">
            {he.printAll}
          </Link>
        }
      />
      <DataModeNote mode={list.data?.data_mode} waitingDb={list.isError} />

      {sspCan("ssp.checkpoints.edit") ? (
        <div className="flex flex-wrap items-end gap-2">
          <Input id="cp-name" label={he.name} value={name} onChange={(e) => setName(e.target.value)} />
          <Input
            id="cp-loc"
            label={he.location}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
          <Button type="button" onClick={() => create.mutate()} disabled={create.isPending}>
            {he.newCheckpoint}
          </Button>
        </div>
      ) : null}

      {sspCan("ssp.scans.create") ? (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-3">
          <Input
            id="cp-scan"
            label={he.scanCode}
            value={scanCode}
            onChange={(e) => setScanCode(e.target.value)}
          />
          <Button
            type="button"
            onClick={() => {
              if (scan.isPending || !scanCode.trim()) return;
              scan.mutate();
            }}
            disabled={scan.isPending || !scanCode.trim()}
          >
            {he.scanAction}
          </Button>
        </div>
      ) : null}

      {msg ? <p className="text-sm text-fg-muted">{msg}</p> : null}
      {list.isLoading ? <p className="text-sm text-fg-muted">{he.loading}</p> : null}
      <ul className="divide-y divide-border rounded-lg border border-border">
        {(list.data?.items ?? []).map((c) => (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
            <div>
              <div className="font-medium text-fg">{c.name}</div>
              <div className="text-xs text-fg-muted">{c.location_label || "—"}</div>
            </div>
            <div className="flex items-center gap-2">
              <code className="text-xs text-fg-muted" data-testid="ssp-checkpoint-code">
                {c.code}
              </code>
              <Link
                to="/checkpoints/$checkpointId/print"
                params={{ checkpointId: c.id }}
                className="text-xs font-medium text-fg underline"
              >
                {he.printLink}
              </Link>
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
