import { Button } from "@site-secure/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { EmptyRows, ErrorState, ModuleScaffold, useQuery } from "../../../components/modules/ModuleKit";
import { SspHubLinks } from "../../../components/ssp/SspHubLinks";
import { useSspWorkspace } from "../../../components/ssp/useSspWorkspace";
import { he } from "../../../i18n/he";
import { formatOpsTime } from "../../../lib/ssp-ops-time";

export const Route = createFileRoute("/app/ssp/activity")({
  component: SspActivityPage,
});

function SspActivityPage() {
  const { api, workspaceId, canAssign, isOfficer } = useSspWorkspace();
  const qc = useQueryClient();
  const [formId, setFormId] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const assignments = useQuery({
    queryKey: ["ssp-site-assignments", workspaceId, "work"],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listSspSiteAssignments(workspaceId!),
    retry: false,
  });
  const submissions = useQuery({
    queryKey: ["ssp-submissions", workspaceId, "work"],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listSspSubmissions(workspaceId!),
    retry: false,
  });
  const actors = useQuery({
    queryKey: ["ssp-sites", workspaceId, "actors", "work"],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listSspSites(workspaceId!, { kind: "office,ops_center" }),
    retry: false,
  });
  const forms = useQuery({
    queryKey: ["ssp-forms", workspaceId, "work"],
    enabled: Boolean(workspaceId) && canAssign,
    queryFn: () => api.listSspForms(workspaceId!, { status: "published" }),
    retry: false,
  });

  const assign = useMutation({
    mutationFn: () =>
      api.createSspSiteAssignments(workspaceId!, {
        form_id: formId,
        site_ids: selected,
        filler_mode: "site",
      }),
    onSuccess: async () => {
      setSelected([]);
      setMsg(he.sspAssignToActors);
      await qc.invalidateQueries({ queryKey: ["ssp-site-assignments", workspaceId] });
    },
    onError: (e: unknown) => setMsg(e instanceof Error ? e.message : he.apiUnavailable),
  });

  if (!workspaceId) return <ErrorState title={he.sessionError} />;

  const actorName = new Map((actors.data?.items ?? []).map((s) => [s.id, s.name]));
  const pending = (assignments.data?.items ?? []).filter(
    (row) => row.fill_status === "available" || row.fill_status === "overdue",
  );
  const failed = assignments.isError || submissions.isError;
  const loading = assignments.isLoading || submissions.isLoading;

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <div data-testid="ssp-activity">
      <ModuleScaffold title={he.sspNavWork} lead={he.sspWorkLead}>
        <SspHubLinks
          items={[
            { to: "/app/ssp/submissions", label: he.sspNavSubmittedForms },
            { to: "/app/ssp/forms", label: he.sspNavFormTemplates },
          ]}
        />
        <p className="text-xs text-fg-muted">{he.sspActorNotPerson}</p>
        <p className="text-xs text-fg-muted">{he.sspAttendanceUnavailable}</p>
        {loading ? <EmptyRows message={he.loading} /> : null}
        {failed ? (
          <ErrorState
            title={he.apiUnavailable}
            description={he.sspWaitingLocalDb}
            action={
              <Button type="button" variant="secondary" onClick={() => void assignments.refetch()}>
                {he.retry}
              </Button>
            }
          />
        ) : null}

        {canAssign ? (
          <section className="space-y-3 rounded-[var(--radius-card)] border border-border bg-bg-1 p-4">
            <h2 className="text-sm font-semibold text-fg">{he.sspAssignToActors}</h2>
            <label className="flex flex-col gap-1 text-sm">
              <span>{he.sspNavFormTemplates}</span>
              <select
                className="rounded-md border border-border bg-bg px-2 py-1.5 text-sm"
                value={formId}
                onChange={(e) => setFormId(e.target.value)}
                aria-label={he.sspNavFormTemplates}
              >
                <option value="">—</option>
                {(forms.data?.items ?? []).map((form) => (
                  <option key={form.id} value={form.id}>
                    {form.title}
                  </option>
                ))}
              </select>
            </label>
            {!forms.data?.items.length && !forms.isLoading ? (
              <p className="text-xs text-fg-muted">{he.sspPublishBeforeAssign}</p>
            ) : null}
            <p className="text-sm font-medium">{he.sspSelectActors}</p>
            <ul className="max-h-48 overflow-auto rounded-md border border-border">
              {(actors.data?.items ?? []).filter((site) => site.is_active).map((site) => (
                <li key={site.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selected.includes(site.id)}
                    onChange={() => toggle(site.id)}
                    aria-label={site.name}
                  />
                  <span>{site.name}</span>
                </li>
              ))}
            </ul>
            {!actors.data?.items.length && !actors.isLoading ? (
              <p className="text-xs text-fg-muted">{he.sspNoActors}</p>
            ) : null}
            <Button
              type="button"
              onClick={() => assign.mutate()}
              disabled={assign.isPending || !formId || !selected.length}
            >
              {he.sspAssignToActors}
            </Button>
            {msg ? <p className="text-sm text-fg-muted">{msg}</p> : null}
          </section>
        ) : null}

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-fg">{he.sspPendingFill}</h2>
          {!loading && !failed && !pending.length ? (
            <p className="ss-module-empty-text">{he.sspNoPendingFill}</p>
          ) : null}
          <ul className="divide-y divide-border rounded-[var(--radius-card)] border border-border bg-bg-1">
            {pending.map((row) => (
              <li key={row.id}>
                <Link
                  to="/app/ssp/sites/$siteId"
                  params={{ siteId: row.site_pk }}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-bg-subtle"
                >
                  <div>
                    <p className="font-medium text-fg">{row.form_title || row.form_id}</p>
                    <p className="text-xs text-fg-muted">
                      {actorName.get(row.site_pk) || row.site_pk.slice(0, 8)} · {row.fill_status}
                      {row.due_at ? ` · ${row.due_at.slice(0, 10)}` : ""}
                    </p>
                  </div>
                  {isOfficer || row.fill_status === "available" || row.fill_status === "overdue" ? (
                    <span className="text-xs text-fg-muted">{he.sspFillForm}</span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-fg">{he.sspAssignedForms}</h2>
          {!assignments.data?.items.length && !assignments.isLoading ? (
            <p className="ss-module-empty-text">{he.sspNoItems}</p>
          ) : null}
          <ul className="divide-y divide-border rounded-[var(--radius-card)] border border-border bg-bg-1 text-sm">
            {(assignments.data?.items ?? []).map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div>
                  <p className="font-medium text-fg">{row.form_title || row.form_id}</p>
                  <p className="text-xs text-fg-muted">
                    {actorName.get(row.site_pk) || row.site_pk.slice(0, 8)} · {row.status}
                    {row.fill_status ? ` · ${row.fill_status}` : ""}
                  </p>
                </div>
                <span className="text-xs text-fg-muted">{row.due_at ? row.due_at.slice(0, 10) : "—"}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-fg">{he.sspSubmissions}</h2>
          {!submissions.data?.items.length && !submissions.isLoading ? (
            <p className="ss-module-empty-text">{he.sspNoSubmissions}</p>
          ) : null}
          <ul className="divide-y divide-border rounded-[var(--radius-card)] border border-border bg-bg-1">
            {(submissions.data?.items ?? []).map((row) => (
              <li key={row.id}>
                <Link
                  to="/app/ssp/submissions/$submissionId"
                  params={{ submissionId: row.id }}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-bg-subtle"
                >
                  <div>
                    <p className="font-medium text-fg">{row.status}</p>
                    <p className="text-xs text-fg-muted">
                      {he.sspSubmittedBy}: {row.submitted_by || "—"}
                    </p>
                  </div>
                  <p className="text-xs text-fg-muted">{formatOpsTime(row.submitted_at)}</p>
                </Link>
              </li>
            ))}
          </ul>
          <Link to="/app/ssp/submissions" className="ops-section-link text-sm">
            {he.sspNavSubmittedForms}
          </Link>
        </section>
      </ModuleScaffold>
    </div>
  );
}
