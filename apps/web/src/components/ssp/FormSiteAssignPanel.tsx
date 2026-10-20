import { Button, Card, Input } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { he } from "../../i18n/he";
import { useSspWorkspace } from "./useSspWorkspace";

export function FormSiteAssignPanel({ formId, published }: { formId: string; published: boolean }) {
  const { api, workspaceId } = useSspWorkspace();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);
  const [startsAt, setStartsAt] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [fillerMode, setFillerMode] = useState<"site" | "users" | "group">("site");
  const [userIds, setUserIds] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const sites = useQuery({
    queryKey: ["ssp-sites", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listSspSites(workspaceId!, { is_active: true, kind: "office,ops_center" }),
    retry: false,
  });
  const departments = useQuery({
    queryKey: ["ssp-org-departments", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listSspDepartments(workspaceId!),
    retry: false,
  });
  const assignments = useQuery({
    queryKey: ["ssp-site-assignments", workspaceId, formId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listSspSiteAssignments(workspaceId!, { form_id: formId }),
    retry: false,
  });

  const create = useMutation({
    mutationFn: () =>
      api.createSspSiteAssignments(workspaceId!, {
        form_id: formId,
        site_ids: selected,
        starts_at: startsAt ? new Date(startsAt).toISOString() : undefined,
        due_at: dueAt ? new Date(dueAt).toISOString() : undefined,
        filler_mode: fillerMode,
        user_ids: fillerMode === "users" ? userIds.split(/[\s,]+/).filter(Boolean) : undefined,
        department_id: fillerMode === "group" ? departmentId || undefined : undefined,
      }),
    onSuccess: async () => {
      setSelected([]);
      setMsg(he.sspAssignToSites);
      await qc.invalidateQueries({ queryKey: ["ssp-site-assignments", workspaceId, formId] });
    },
    onError: (e: unknown) => setMsg(e instanceof Error ? e.message : he.apiUnavailable),
  });
  const act = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "pause" | "resume" | "complete" }) => {
      if (action === "pause") return api.pauseSspSiteAssignment(workspaceId!, id);
      if (action === "resume") return api.resumeSspSiteAssignment(workspaceId!, id);
      return api.completeSspSiteAssignment(workspaceId!, id);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["ssp-site-assignments", workspaceId, formId] });
    },
  });

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <Card className="flex flex-col gap-3" data-testid="ssp-form-site-assign">
      <h2 className="text-base font-semibold text-fg">{he.sspAssignToActors}</h2>
      <p className="text-xs text-fg-muted">{he.sspCadenceHint}</p>
      {!published ? (
        <p className="text-xs text-fg-muted">{he.sspPublishBeforeAssign}</p>
      ) : (
        <>
          <p className="text-sm font-medium">{he.sspSelectActors}</p>
          {!sites.data?.items.length ? (
            <p className="text-sm text-fg-muted">{he.sspNoActors}</p>
          ) : (
            <ul className="max-h-48 overflow-auto rounded-md border border-border">
              {sites.data.items.map((s) => (
                <li key={s.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selected.includes(s.id)}
                    onChange={() => toggle(s.id)}
                    aria-label={s.name}
                  />
                  <span>
                    {s.name}{" "}
                    <span className="text-xs text-fg-muted">
                      {s.kind === "ops_center"
                        ? he.sspSiteKindOps
                        : s.kind === "physical_site"
                          ? he.sspSiteKindPhysical
                          : s.kind === "other"
                            ? he.sspSiteKindOther
                            : he.sspSiteKindOffice}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              id="assign-start"
              label={he.sspStartDate}
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
            <Input
              id="assign-due"
              label={he.sspDueDate}
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
            />
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span>{he.sspFillerMode}</span>
            <select
              className="rounded-md border border-border bg-bg px-2 py-1.5 text-sm"
              value={fillerMode}
              onChange={(e) => setFillerMode(e.target.value as "site" | "users" | "group")}
              aria-label={he.sspFillerMode}
            >
              <option value="site">{he.sspFillerSite}</option>
              <option value="users">{he.sspFillerUsers}</option>
              <option value="group">{he.sspFillerGroup}</option>
            </select>
          </label>
          {fillerMode === "users" ? (
            <Input
              id="assign-users"
              label={he.sspFillerUsers}
              value={userIds}
              onChange={(e) => setUserIds(e.target.value)}
            />
          ) : null}
          {fillerMode === "group" ? (
            <label className="flex flex-col gap-1 text-sm">
              <span>{he.sspFillerGroup}</span>
              <select
                className="rounded-md border border-border bg-bg px-2 py-1.5 text-sm"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                aria-label={he.sspFillerGroup}
              >
                <option value="">—</option>
                {(departments.data?.items ?? []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name_he}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <p className="text-xs text-fg-muted">{he.sspCadenceOnce}</p>
          <Button type="button" onClick={() => create.mutate()} disabled={create.isPending || !selected.length}>
            {he.sspAssignToActors}
          </Button>
        </>
      )}
      {msg ? <p className="text-sm text-fg-muted">{msg}</p> : null}
      <ul className="divide-y divide-border rounded-md border border-border">
        {(assignments.data?.items ?? []).map((a) => (
          <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
            <div>
              <Link to="/app/ssp/sites/$siteId" params={{ siteId: a.site_pk }} className="underline">
                {sites.data?.items.find((s) => s.id === a.site_pk)?.name || a.site_pk.slice(0, 8)}
              </Link>
              {" · "}
              {a.status} · {a.filler_mode}
              {a.due_at ? ` · ${a.due_at.slice(0, 10)}` : ""}
            </div>
            <div className="flex gap-2">
              {a.status === "active" ? (
                <Button type="button" variant="secondary" onClick={() => act.mutate({ id: a.id, action: "pause" })}>
                  {he.sspPause}
                </Button>
              ) : null}
              {a.status === "paused" ? (
                <Button type="button" variant="secondary" onClick={() => act.mutate({ id: a.id, action: "resume" })}>
                  {he.sspResume}
                </Button>
              ) : null}
              {a.status !== "completed" ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    if (!window.confirm(he.sspConfirmComplete)) return;
                    act.mutate({ id: a.id, action: "complete" });
                  }}
                >
                  {he.sspComplete}
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {!assignments.data?.items.length ? <p className="ss-module-empty-text">{he.sspNoItems}</p> : null}
    </Card>
  );
}
