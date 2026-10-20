import { Button, Card, Input, LoadingBlock, Status, Textarea } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ErrorState, ModuleScaffold } from "../../../components/modules/ModuleKit";
import { SiteActivationPanel } from "../../../components/ssp/SiteActivationPanel";
import { useSspWorkspace } from "../../../components/ssp/useSspWorkspace";
import { he } from "../../../i18n/he";

export const Route = createFileRoute("/app/ssp/sites/$siteId")({
  component: SspSiteDetailPage,
});

function kindLabel(kind?: string) {
  if (kind === "ops_center") return he.sspSiteKindOps;
  if (kind === "physical_site") return he.sspSiteKindPhysical;
  if (kind === "other") return he.sspSiteKindOther;
  return he.sspSiteKindOffice;
}

function SspSiteDetailPage() {
  const { siteId } = Route.useParams();
  const { api, workspaceId, canEdit, isOfficer } = useSspWorkspace();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [kind, setKind] = useState<"office" | "ops_center" | "physical_site" | "other">("office");
  const [msg, setMsg] = useState<string | null>(null);
  const [fillId, setFillId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});

  const ops = useQuery({
    queryKey: ["ssp-site-ops", workspaceId, siteId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.getSspSiteOps(workspaceId!, siteId),
    retry: false,
  });

  useEffect(() => {
    if (!ops.data?.site) return;
    setName(ops.data.site.name);
    setPhone(ops.data.site.phone || "");
    setDescription(ops.data.site.description || "");
    setIsActive(ops.data.site.is_active);
    setKind(ops.data.site.kind || "office");
  }, [ops.data?.site]);

  const fillDetail = useQuery({
    queryKey: ["ssp-site-assignment", workspaceId, fillId],
    enabled: Boolean(workspaceId && fillId),
    queryFn: () => api.getSspSiteAssignment(workspaceId!, fillId!),
    retry: false,
  });

  const save = useMutation({
    mutationFn: () =>
      api.patchSspSite(workspaceId!, siteId, {
        name: name.trim(),
        phone: phone.trim() || null,
        description,
        is_active: isActive,
        kind,
      }),
    onSuccess: async () => {
      setMsg(he.save);
      await qc.invalidateQueries({ queryKey: ["ssp-site-ops", workspaceId, siteId] });
      await qc.invalidateQueries({ queryKey: ["ssp-sites", workspaceId] });
    },
    onError: (e: unknown) => setMsg(e instanceof Error ? e.message : he.apiUnavailable),
  });
  const removeMember = useMutation({
    mutationFn: (userId: string) => api.removeSspSiteMember(workspaceId!, siteId, userId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["ssp-site-ops", workspaceId, siteId] });
    },
    onError: (e: unknown) => setMsg(e instanceof Error ? e.message : he.apiUnavailable),
  });
  const submitFill = useMutation({
    mutationFn: () => api.submitSspSiteAssignment(workspaceId!, fillId!, { answers }),
    onSuccess: async () => {
      setMsg(he.sspSubmitSuccess);
      setFillId(null);
      setAnswers({});
      await qc.invalidateQueries({ queryKey: ["ssp-site-ops", workspaceId, siteId] });
    },
    onError: (e: unknown) => setMsg(e instanceof Error ? e.message : he.apiUnavailable),
  });

  if (!workspaceId) return <ErrorState title={he.sessionError} />;
  if (ops.isLoading) return <LoadingBlock label={he.loading} />;
  if (ops.isError || !ops.data) {
    return (
      <ErrorState
        title={he.apiUnavailable}
        description={he.sspWaitingLocalDb}
        action={
          <Button type="button" variant="secondary" onClick={() => void ops.refetch()}>
            {he.retry}
          </Button>
        }
      />
    );
  }

  const site = ops.data.site;

  return (
    <div data-testid="ssp-site-detail">
      <ModuleScaffold
        title={site.name}
        lead={`${he.sspSiteId}: ${site.site_id}`}
        action={
          <Link
            to={site.kind === "office" || site.kind === "ops_center" ? "/app/ssp/users" : "/app/ssp/sites"}
            className="ops-section-link"
          >
            {site.kind === "office" || site.kind === "ops_center" ? he.sspBackToActors : he.sspBackToSites}
          </Link>
        }
      >
        {msg ? <p className="text-sm text-fg-muted">{msg}</p> : null}

        <Card className="flex flex-col gap-4">
          <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-xs text-fg-muted">{he.sspSiteKind}</dt>
              <dd className="mt-0.5 font-medium text-fg">{kindLabel(site.kind)}</dd>
            </div>
            <div>
              <dt className="text-xs text-fg-muted">{he.sspSitePhone}</dt>
              <dd className="mt-0.5 font-medium text-fg">{site.phone || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-fg-muted">{he.sspFilterStatus}</dt>
              <dd className="mt-0.5">
                <Status
                  label={site.is_active ? he.sspSiteActive : he.sspSiteInactive}
                  tone={site.is_active ? "success" : "neutral"}
                />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-fg-muted">{he.sspSiteMembers}</dt>
              <dd className="mt-0.5 font-medium text-fg">{ops.data.members?.length ?? 0}</dd>
            </div>
          </dl>
          {canEdit ? (
            <>
              <Input id="site-name" label={he.name} value={name} onChange={(e) => setName(e.target.value)} />
              <Input id="site-phone" label={he.sspSitePhone} value={phone} onChange={(e) => setPhone(e.target.value)} />
              <label className="flex flex-col gap-1 text-sm">
                <span>{he.sspSiteKind}</span>
                <select
                  className="rounded-md border border-border bg-bg px-2 py-1.5 text-sm"
                  value={kind}
                  onChange={(e) => setKind(e.target.value as typeof kind)}
                  aria-label={he.sspSiteKind}
                >
                  <option value="office">{he.sspSiteKindOffice}</option>
                  <option value="ops_center">{he.sspSiteKindOps}</option>
                  <option value="physical_site">{he.sspSiteKindPhysical}</option>
                  <option value="other">{he.sspSiteKindOther}</option>
                </select>
              </label>
              <Textarea
                id="site-desc"
                label="תיאור"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                {he.sspSiteActive}
              </label>
              <Button type="button" onClick={() => save.mutate()} disabled={save.isPending || !name.trim()}>
                {he.save}
              </Button>
            </>
          ) : (
            <p className="text-sm text-fg-muted">{site.description || he.sspNoItems}</p>
          )}
        </Card>

        {site.kind === "physical_site" || site.kind === "other" ? (
          <p className="text-xs text-fg-muted">
            {he.sspSiteAddress} / {he.sspSiteServiceReq}: {site.description || "—"} · {he.sspSiteNoSchedule} ·{" "}
            <Link to="/app/ssp/checkpoints" className="ops-section-link">
              {he.sspNavCheckpoints}
            </Link>
            {" — "}
            {he.sspCheckpointsCompanyScoped}
          </p>
        ) : null}

        <SiteActivationPanel siteId={siteId} canManage={canEdit} />

        <Card className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-fg">{he.sspSiteMembers}</h2>
          {!(ops.data.members ?? []).length ? (
            <p className="ss-module-empty-text">{he.sspNoItems}</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {(ops.data.members ?? []).map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <code className="text-xs">{m.user_id}</code>
                  {canEdit ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        if (!window.confirm(he.sspConfirmRemoveMember)) return;
                        removeMember.mutate(m.user_id);
                      }}
                    >
                      {he.sspRemoveMember}
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>

        {fillId ? (
          <Card className="flex flex-col gap-3" data-testid="ssp-site-fill">
            <h2 className="text-base font-semibold text-fg">{he.sspFillForm}</h2>
            {fillDetail.isLoading ? <p className="text-sm text-fg-muted">{he.loading}</p> : null}
            {(fillDetail.data?.definition_snapshot?.fields ?? []).map((field) => (
              <Input
                key={field.id}
                id={`fill-${field.id}`}
                label={field.label}
                value={String(answers[field.id] ?? "")}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [field.id]: e.target.value }))}
              />
            ))}
            <div className="flex gap-2">
              <Button type="button" onClick={() => submitFill.mutate()} disabled={submitFill.isPending}>
                {he.sspSubmit}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setFillId(null)}>
                {he.retry}
              </Button>
            </div>
          </Card>
        ) : null}

        <Card className="flex flex-col gap-3">
          <h2 className="text-base font-semibold text-fg">{he.sspAssignedForms}</h2>
          {!ops.data.assignments.length ? (
            <p className="ss-module-empty-text">{he.sspNoItems}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {ops.data.assignments.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-control)] bg-bg-subtle px-3 py-2 text-sm">
                  <span className="font-medium text-fg">{a.form_title || a.form_id}</span>
                  <span className="flex items-center gap-2 text-xs text-fg-muted">
                    {a.fill_status || a.status}
                    {a.due_at ? ` · ${a.due_at.slice(0, 10)}` : ""}
                    {(a.fill_status === "available" || a.fill_status === "overdue" || isOfficer) && a.status === "active" ? (
                      <Button type="button" variant="secondary" onClick={() => setFillId(a.id)}>
                        {he.sspFillForm}
                      </Button>
                    ) : null}
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
