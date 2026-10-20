import { Button, ErrorState, Input, PageHeader } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { DataModeNote } from "../components/DataModeNote";
import { RequireSspAccess } from "../components/RequirePermission";
import { he } from "../i18n/he";
import { useOrg } from "../lib/org";
import { useSession } from "../lib/session";

export function DistributionsPage() {
  return (
    <RequireSspAccess permission="ssp.distributions.view">
      <DistributionsBody />
    </RequireSspAccess>
  );
}

function DistributionsBody() {
  const { api, workspaceId } = useSession();
  const { sspCan } = useOrg();
  const qc = useQueryClient();
  const [formId, setFormId] = useState("");
  const [title, setTitle] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["ssp-distributions", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listSspDistributions(workspaceId!),
    retry: false,
  });

  const create = useMutation({
    mutationFn: () =>
      api.createSspDistribution(workspaceId!, {
        form_id: formId.trim(),
        title: title.trim(),
      }),
    onSuccess: async () => {
      setFormId("");
      setTitle("");
      await qc.invalidateQueries({ queryKey: ["ssp-distributions", workspaceId] });
    },
    onError: (e: unknown) => setMsg(e instanceof Error ? e.message : he.apiUnavailable),
  });

  if (!workspaceId) return <ErrorState title={he.sessionError} />;

  return (
    <div className="flex flex-col gap-4" data-testid="ssp-distributions">
      <PageHeader title={he.distributionsTitle} description={he.distributionsLead} />
      <DataModeNote mode={list.data?.data_mode} waitingDb={list.isError} />
      {sspCan("ssp.distributions.manage") ? (
        <div className="flex flex-wrap items-end gap-2">
          <Input
            id="dist-form"
            label="מזהה טופס"
            value={formId}
            onChange={(e) => setFormId(e.target.value)}
          />
          <Input id="dist-title" label={he.name} value={title} onChange={(e) => setTitle(e.target.value)} />
          <Button
            type="button"
            onClick={() => create.mutate()}
            disabled={create.isPending || !formId.trim()}
          >
            {he.create}
          </Button>
        </div>
      ) : null}
      {msg ? <p className="text-sm text-danger">{msg}</p> : null}
      {list.isLoading ? <p className="text-sm text-fg-muted">{he.loading}</p> : null}
      <ul className="divide-y divide-border rounded-lg border border-border">
        {(list.data?.items ?? []).map((d) => (
          <li key={d.id} className="flex justify-between gap-2 px-4 py-3 text-sm">
            <div>
              <div className="font-medium text-fg">{d.title || d.form_id.slice(0, 8)}</div>
              <div className="text-xs text-fg-muted">
                {d.status}
                {d.due_at ? ` · due ${d.due_at}` : ""}
                {d.require_completion ? " · חובה" : ""}
              </div>
            </div>
          </li>
        ))}
      </ul>
      {(list.data?.targets ?? []).length ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold">ההפצות שלי</h2>
          <ul className="divide-y divide-border rounded-lg border border-border text-sm">
            {(list.data?.targets ?? []).map((t, i) => (
              <li key={t.id ?? `${t.distribution_id}-${i}`} className="flex justify-between px-4 py-2">
                <span>{t.title || t.form_id || t.distribution_id}</span>
                <span>{t.effective_status || t.status}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {!list.isLoading && !(list.data?.items.length) && !list.isError ? (
        <p className="text-sm text-fg-muted">{he.noItems}</p>
      ) : null}
    </div>
  );
}
