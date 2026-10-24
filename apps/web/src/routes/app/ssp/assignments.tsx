import { Button, Card, Input, Select } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ErrorState, ModuleScaffold } from "../../../components/modules/ModuleKit";
import { useSspWorkspace } from "../../../components/ssp/useSspWorkspace";
import { he } from "../../../i18n/he";

export const Route = createFileRoute("/app/ssp/assignments")({
  validateSearch: (search: Record<string, unknown>) => ({
    form: typeof search.form === "string" ? search.form : undefined,
  }),
  component: SspAssignmentsPage,
});

function SspAssignmentsPage() {
  const { api, workspaceId, canAssign } = useSspWorkspace();
  const qc = useQueryClient();
  const { form: formFromSearch } = Route.useSearch();
  const [formId, setFormId] = useState(formFromSearch || "");

  useEffect(() => {
    if (formFromSearch) setFormId(formFromSearch);
  }, [formFromSearch]);
  const [selectedOffices, setSelectedOffices] = useState<string[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [fillerMode, setFillerMode] = useState<"site" | "users">("site");
  const [dueAt, setDueAt] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const forms = useQuery({
    queryKey: ["ssp-forms", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listSspForms(workspaceId!),
    retry: false,
  });
  const offices = useQuery({
    queryKey: ["ssp-sites", workspaceId, "actors"],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listSspSites(workspaceId!, { kind: "office,ops_center", is_active: true }),
    retry: false,
  });
  const people = useQuery({
    queryKey: ["ssp-people", workspaceId, "active"],
    enabled: Boolean(workspaceId) && canAssign,
    queryFn: () => api.listSspUsers(workspaceId!, { status: "active" }),
    retry: false,
  });
  const assignments = useQuery({
    queryKey: ["ssp-site-assignments", workspaceId, formId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listSspSiteAssignments(workspaceId!, { form_id: formId || undefined }),
    retry: false,
  });

  const published = useMemo(
    () => (forms.data?.items ?? []).filter((f) => f.status === "published"),
    [forms.data],
  );

  const create = useMutation({
    mutationFn: () =>
      api.createSspSiteAssignments(workspaceId!, {
        form_id: formId,
        site_ids: selectedOffices,
        due_at: dueAt ? new Date(dueAt).toISOString() : undefined,
        filler_mode: fillerMode,
        user_ids: fillerMode === "users" ? selectedUsers : undefined,
      }),
    onSuccess: async () => {
      setMsg(he.sspAssignToActors);
      setSelectedOffices([]);
      setSelectedUsers([]);
      await qc.invalidateQueries({ queryKey: ["ssp-site-assignments", workspaceId] });
    },
    onError: (e: unknown) => setMsg(e instanceof Error ? e.message : he.apiUnavailable),
  });

  function toggle(list: string[], id: string, setter: (next: string[]) => void) {
    setter(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  if (!workspaceId) return <ErrorState title={he.sessionError} />;

  return (
    <div data-testid="ssp-assignments">
      <ModuleScaffold title={he.sspNavAssignments} lead={he.sspAssignmentsLead}>
        {assignments.isError || forms.isError ? (
          <ErrorState
            title={he.apiUnavailable}
            action={
              <Button type="button" variant="secondary" onClick={() => void assignments.refetch()}>
                {he.retry}
              </Button>
            }
          />
        ) : null}
        {canAssign ? (
          <Card className="flex flex-col gap-3">
            <Select id="assign-form" label={he.sspForms} value={formId} onChange={(e) => setFormId(e.target.value)}>
              <option value="">—</option>
              {published.map((form) => (
                <option key={form.id} value={form.id}>
                  {form.title}
                </option>
              ))}
            </Select>
            {!published.length ? <p className="text-sm text-fg-muted">{he.sspPublishBeforeAssign}</p> : null}
            <p className="text-sm font-medium">{he.sspSelectActors}</p>
            <ul className="max-h-48 overflow-auto rounded-md border border-border">
              {(offices.data?.items ?? []).map((site) => (
                <li key={site.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedOffices.includes(site.id)}
                    onChange={() => toggle(selectedOffices, site.id, setSelectedOffices)}
                    aria-label={site.name}
                  />
                  {site.name}
                </li>
              ))}
            </ul>
            <Select
              id="assign-filler"
              label={he.sspFillerMode}
              value={fillerMode}
              onChange={(e) => setFillerMode(e.target.value as typeof fillerMode)}
            >
              <option value="site">{he.sspFillerSiteSnapshot}</option>
              <option value="users">{he.sspFillerUsers}</option>
            </Select>
            {fillerMode === "users" ? (
              <ul className="max-h-48 overflow-auto rounded-md border border-border">
                {(people.data?.items ?? []).map((person) => (
                  <li key={person.user_id} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(person.user_id)}
                      onChange={() => toggle(selectedUsers, person.user_id, setSelectedUsers)}
                      aria-label={person.full_name || person.email || person.user_id}
                    />
                    {person.full_name || person.email || person.user_id.slice(0, 8)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-fg-muted">{he.sspFillerSiteSnapshot}</p>
            )}
            <Input
              id="assign-due"
              label={he.sspDueDate}
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
            />
            <Button
              type="button"
              onClick={() => create.mutate()}
              disabled={
                create.isPending ||
                !formId ||
                !selectedOffices.length ||
                (fillerMode === "users" && !selectedUsers.length)
              }
            >
              {he.sspAssignToActors}
            </Button>
            {msg ? <p className="text-sm text-fg-muted">{msg}</p> : null}
          </Card>
        ) : null}
        <Card className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-fg">{he.sspNavAssignments}</h2>
          {assignments.isLoading ? <p className="text-sm text-fg-muted">{he.loading}</p> : null}
          {!(assignments.data?.items ?? []).length && !assignments.isLoading && !assignments.isError ? (
            <p className="ss-module-empty-text">{he.sspNoAssignments}</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {(assignments.data?.items ?? []).map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    <Link to="/app/ssp/forms/$formId" params={{ formId: a.form_id }} search={{ preview: false }} className="underline">
                      {forms.data?.items.find((f) => f.id === a.form_id)?.title || a.form_id.slice(0, 8)}
                    </Link>
                    {" · "}
                    <Link to="/app/ssp/sites/$siteId" params={{ siteId: a.site_pk }} className="underline">
                      {offices.data?.items.find((s) => s.id === a.site_pk)?.name || a.site_pk.slice(0, 8)}
                    </Link>
                    {" · "}
                    {a.status}
                    {" · "}
                    {a.filler_mode === "users" ? he.sspAssignPersonal : he.sspAssignOfficeWide}
                    {a.fill_status ? ` · ${a.fill_status}` : ""}
                    {a.due_at ? ` · ${a.due_at.slice(0, 10)}` : ""}
                    {a.target_count != null ? ` · ${he.sspTargetsCount} ${a.target_count}` : ""}
                    {a.submission_count != null ? ` · ${he.sspSubmissionsCount} ${a.submission_count}` : ""}
                    {a.target_names?.length ? ` · ${a.target_names.join(", ")}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </ModuleScaffold>
    </div>
  );
}
