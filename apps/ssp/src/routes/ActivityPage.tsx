import { Button, ErrorState, PageHeader } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { DataModeNote } from "../components/DataModeNote";
import { SspHubLinks } from "../components/SspHubLinks";
import { RequireSspAccess } from "../components/RequirePermission";
import { he } from "../i18n/he";
import { useOrg } from "../lib/org";
import { useSession } from "../lib/session";

export function ActivityPage() {
  return (
    <RequireSspAccess anyOf={["ssp.dashboard.view", "ssp.forms.view", "ssp.submissions.view"]}>
      <ActivityBody />
    </RequireSspAccess>
  );
}

function ActivityBody() {
  const { api, workspaceId } = useSession();
  const { sspCan } = useOrg();
  const qc = useQueryClient();
  const canAssign = sspCan("ssp.assignments.manage");
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
      setMsg(he.assignToActors);
      await qc.invalidateQueries({ queryKey: ["ssp-site-assignments", workspaceId] });
    },
    onError: (e: unknown) => setMsg(e instanceof Error ? e.message : he.apiUnavailable),
  });

  if (!workspaceId) return <ErrorState title={he.sessionError} />;

  const names = new Map((actors.data?.items ?? []).map((s) => [s.id, s.name]));
  const pending = (assignments.data?.items ?? []).filter(
    (row) => row.fill_status === "available" || row.fill_status === "overdue",
  );

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <div className="flex flex-col gap-4" data-testid="ssp-activity">
      <PageHeader title={he.navWork} description={he.workLead} />
      <SspHubLinks
        items={[
          { to: "/submissions", label: he.navSubmissions },
          { to: "/forms", label: he.navFormTemplates },
        ]}
      />
      <p className="text-xs text-fg-muted">{he.actorNotPerson}</p>
      <p className="text-xs text-fg-muted">{he.attendanceUnavailable}</p>
      <DataModeNote mode={assignments.data?.data_mode} waitingDb={assignments.isError || submissions.isError} />
      {canAssign ? (
        <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <h2 className="text-sm font-semibold">{he.assignToActors}</h2>
          <label className="flex flex-col gap-1 text-sm">
            <span>{he.navFormTemplates}</span>
            <select
              className="rounded-md border border-border bg-bg px-2 py-1.5 text-sm"
              value={formId}
              onChange={(e) => setFormId(e.target.value)}
              aria-label={he.navFormTemplates}
            >
              <option value="">—</option>
              {(forms.data?.items ?? []).map((form) => (
                <option key={form.id} value={form.id}>
                  {form.title}
                </option>
              ))}
            </select>
          </label>
          <p className="text-sm font-medium">{he.selectActors}</p>
          <ul className="max-h-48 overflow-auto rounded-md border border-border">
            {(actors.data?.items ?? [])
              .filter((site) => site.is_active)
              .map((site) => (
                <li key={site.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <input type="checkbox" checked={selected.includes(site.id)} onChange={() => toggle(site.id)} aria-label={site.name} />
                  <span>{site.name}</span>
                </li>
              ))}
          </ul>
          <Button type="button" onClick={() => assign.mutate()} disabled={assign.isPending || !formId || !selected.length}>
            {he.assignToActors}
          </Button>
          {msg ? <p className="text-sm text-fg-muted">{msg}</p> : null}
        </section>
      ) : null}

      <h2 className="text-sm font-semibold">{he.pendingFill}</h2>
      {!pending.length ? <p className="text-sm text-fg-muted">{he.noPendingFill}</p> : null}
      <ul className="divide-y divide-border rounded-lg border border-border text-sm">
        {pending.map((row) => (
          <li key={row.id} className="flex justify-between gap-2 px-4 py-3">
            <Link to="/sites/$siteId" params={{ siteId: row.site_pk }} className="underline">
              {row.form_title || row.form_id}
            </Link>
            <span className="text-xs text-fg-muted">
              {names.get(row.site_pk) || row.site_pk.slice(0, 8)} · {row.fill_status}
            </span>
          </li>
        ))}
      </ul>

      <h2 className="text-sm font-semibold">{he.sspSubmissions}</h2>
      {submissions.isError ? (
        <Button type="button" variant="secondary" onClick={() => void submissions.refetch()}>
          {he.retry}
        </Button>
      ) : null}
      {!submissions.data?.items.length && !submissions.isLoading ? (
        <p className="text-sm text-fg-muted">{he.sspNoSubmissions}</p>
      ) : null}
      <ul className="divide-y divide-border rounded-lg border border-border text-sm">
        {(submissions.data?.items ?? []).map((row) => (
          <li key={row.id} className="flex justify-between gap-2 px-4 py-3">
            <Link to="/submissions/$submissionId" params={{ submissionId: row.id }} className="underline">
              {row.status}
            </Link>
            <span className="text-xs text-fg-muted">
              {he.submittedBy}: {row.submitted_by || "—"} · {row.submitted_at.slice(0, 16)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
