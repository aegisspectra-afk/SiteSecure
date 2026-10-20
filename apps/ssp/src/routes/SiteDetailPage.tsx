import type { SspFormField, SspSiteAssignmentOut } from "@site-secure/api-client";
import { Button, ErrorState, Input, PageHeader, Textarea } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FormFillFields } from "../components/FormFillFields";
import { RequireSspAccess } from "../components/RequirePermission";
import { SiteActivationPanel } from "../components/SiteActivationPanel";
import { he } from "../i18n/he";
import { useOrg } from "../lib/org";
import { useSession } from "../lib/session";

function statusHe(status: string) {
  if (status === "available") return he.siteAvailable;
  if (status === "unfilled") return he.siteUnfilled;
  if (status === "submitted") return he.siteSubmitted;
  if (status === "overdue") return he.siteOverdue;
  if (status === "paused") return he.sspPause;
  if (status === "completed") return he.sspComplete;
  if (status === "upcoming") return he.sspStartDate;
  return status;
}

export function SiteDetailPage() {
  return (
    <RequireSspAccess anyOf={["ssp.sites.view", "ssp.forms.view"]}>
      <SiteDetailBody />
    </RequireSspAccess>
  );
}

function SiteDetailBody() {
  const { siteId } = useParams({ from: "/authenticated/sites/$siteId" });
  const { api, workspaceId } = useSession();
  const { sspCan } = useOrg();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [managerUserId, setManagerUserId] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [memberUserId, setMemberUserId] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [fillId, setFillId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});

  const ops = useQuery({
    queryKey: ["ssp-site-ops", workspaceId, siteId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.getSspSiteOps(workspaceId!, siteId),
    retry: false,
  });
  const members = useQuery({
    queryKey: ["ssp-site-members", workspaceId, siteId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listSspSiteMembers(workspaceId!, siteId),
  });
  const fillDetail = useQuery({
    queryKey: ["ssp-site-assignment", workspaceId, fillId],
    enabled: Boolean(workspaceId && fillId),
    queryFn: () => api.getSspSiteAssignment(workspaceId!, fillId!),
  });

  useEffect(() => {
    if (!ops.data?.site) return;
    setName(ops.data.site.name);
    setPhone(ops.data.site.phone || "");
    setDescription(ops.data.site.description || "");
    setAdminNotes(ops.data.site.admin_notes || "");
    setManagerUserId(ops.data.site.manager_user_id || "");
    setIsActive(ops.data.site.is_active);
  }, [ops.data?.site]);

  const save = useMutation({
    mutationFn: () =>
      api.patchSspSite(workspaceId!, siteId, {
        name: name.trim(),
        phone: phone.trim() || null,
        description,
        admin_notes: adminNotes.trim() || null,
        manager_user_id: managerUserId.trim() || null,
        is_active: isActive,
      }),
    onSuccess: async () => {
      setMsg(he.save);
      await qc.invalidateQueries({ queryKey: ["ssp-site-ops", workspaceId, siteId] });
      await qc.invalidateQueries({ queryKey: ["ssp-sites", workspaceId] });
    },
    onError: (e: unknown) => setMsg(e instanceof Error ? e.message : he.apiUnavailable),
  });
  const addMember = useMutation({
    mutationFn: () => api.addSspSiteMember(workspaceId!, siteId, { user_id: memberUserId.trim() }),
    onSuccess: async () => {
      setMemberUserId("");
      await qc.invalidateQueries({ queryKey: ["ssp-site-members", workspaceId, siteId] });
    },
    onError: (e: unknown) => setMsg(e instanceof Error ? e.message : he.apiUnavailable),
  });
  const removeMember = useMutation({
    mutationFn: (userId: string) => api.removeSspSiteMember(workspaceId!, siteId, userId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["ssp-site-members", workspaceId, siteId] });
    },
  });
  const setStatus = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "pause" | "resume" | "complete" }) => {
      if (action === "pause") return api.pauseSspSiteAssignment(workspaceId!, id);
      if (action === "resume") return api.resumeSspSiteAssignment(workspaceId!, id);
      return api.completeSspSiteAssignment(workspaceId!, id);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["ssp-site-ops", workspaceId, siteId] });
    },
    onError: (e: unknown) => setMsg(e instanceof Error ? e.message : he.apiUnavailable),
  });
  const submit = useMutation({
    mutationFn: () => api.submitSspSiteAssignment(workspaceId!, fillId!, { answers }),
    onSuccess: async () => {
      setMsg(he.officerSubmit);
      setFillId(null);
      setAnswers({});
      await qc.invalidateQueries({ queryKey: ["ssp-site-ops", workspaceId, siteId] });
    },
    onError: (e: unknown) => setMsg(e instanceof Error ? e.message : he.apiUnavailable),
  });

  if (!workspaceId) return <ErrorState title={he.sessionError} />;
  if (ops.isLoading) return <p className="text-sm text-fg-muted">{he.loading}</p>;
  if (ops.isError || !ops.data) {
    return (
      <ErrorState
        title={he.apiUnavailable}
        action={
          <Button type="button" variant="secondary" onClick={() => void ops.refetch()}>
            {he.retry}
          </Button>
        }
      />
    );
  }

  const site = ops.data.site;
  const buckets = ops.data.buckets;
  const byId = new Map(ops.data.assignments.map((a) => [a.id, a]));
  const canEdit = sspCan("ssp.sites.edit");
  const canAssign = sspCan("ssp.assignments.manage");
  const canFill = sspCan("ssp.forms.submit") || sspCan("ssp.assignments.manage");
  const fillFields = (fillDetail.data?.definition_snapshot?.fields ?? []) as SspFormField[];

  function bucketList(key: string) {
    const ids = buckets[key] ?? [];
    const rows = ids.map((id) => byId.get(id)).filter(Boolean) as SspSiteAssignmentOut[];
    if (!rows.length) {
      return (
        <p className="text-sm text-fg-muted" data-testid={`ssp-site-empty-${key}`}>
          {he.noItems}
        </p>
      );
    }
    return (
      <ul className="divide-y divide-border rounded-md border border-border">
        {rows.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
            <div>
              <div className="font-medium">{a.form_title || a.form_id}</div>
              <div className="text-xs text-fg-muted">
                {statusHe(a.fill_status || a.status)} · {a.due_at ? a.due_at.slice(0, 10) : "—"}
                {a.submission_count ? ` · ${a.submission_count}` : ""}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {canFill && (a.fill_status === "available" || a.fill_status === "overdue") ? (
                <Button type="button" variant="secondary" onClick={() => setFillId(a.id)}>
                  {he.sspFill}
                </Button>
              ) : null}
              {canAssign && a.status === "active" ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setStatus.mutate({ id: a.id, action: "pause" })}
                >
                  {he.sspPause}
                </Button>
              ) : null}
              {canAssign && a.status === "paused" ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setStatus.mutate({ id: a.id, action: "resume" })}
                >
                  {he.sspResume}
                </Button>
              ) : null}
              {canAssign && a.status !== "completed" ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    if (!window.confirm(he.sspConfirmComplete)) return;
                    setStatus.mutate({ id: a.id, action: "complete" });
                  }}
                >
                  {he.sspComplete}
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="flex flex-col gap-6" data-testid="ssp-site-detail">
      <PageHeader
        title={site.name}
        description={`${he.siteId}: ${site.site_id}`}
        action={
          <Link to="/sites" className="rounded-md bg-bg-subtle px-3 py-2 text-sm">
            {he.navSites}
          </Link>
        }
      />
      {msg ? <p className="text-sm text-fg-muted">{msg}</p> : null}

      <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-fg-muted">{he.sitePhone}</dt>
            <dd>{site.phone || "—"}</dd>
          </div>
          <div>
            <dt className="text-fg-muted">{he.filterStatus}</dt>
            <dd>{site.is_active ? he.siteActive : he.siteInactive}</dd>
          </div>
          <div>
            <dt className="text-fg-muted">{he.updatedAt}</dt>
            <dd>{site.updated_at}</dd>
          </div>
          <div>
            <dt className="text-fg-muted">{he.create}</dt>
            <dd>{site.created_at}</dd>
          </div>
        </dl>
        {canEdit ? (
          <>
            <Input id="site-name" label={he.name} value={name} onChange={(e) => setName(e.target.value)} />
            <Input id="site-phone" label={he.sitePhone} value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Textarea
              id="site-desc"
              label={he.siteDescription}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
            <Textarea
              id="site-notes"
              label={he.adminNotes}
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              rows={2}
            />
            <Input
              id="site-manager"
              label={he.siteManager}
              value={managerUserId}
              onChange={(e) => setManagerUserId(e.target.value)}
            />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              {he.siteActive}
            </label>
            <Button type="button" onClick={() => save.mutate()} disabled={save.isPending || !name.trim()}>
              {he.save}
            </Button>
          </>
        ) : (
          <p className="text-sm text-fg-muted">{site.description || he.noItems}</p>
        )}
      </section>

      <SiteActivationPanel siteId={siteId} canManage={canEdit} />

      {canEdit ? (
        <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <h2 className="text-base font-semibold">{he.siteMembers}</h2>
          <p className="text-xs text-fg-muted">{he.siteMemberHint}</p>
          <div className="flex flex-wrap items-end gap-2">
            <Input
              id="site-member"
              label={he.siteAddMember}
              value={memberUserId}
              onChange={(e) => setMemberUserId(e.target.value)}
            />
            <Button
              type="button"
              onClick={() => addMember.mutate()}
              disabled={addMember.isPending || !memberUserId.trim()}
            >
              {he.siteAddMember}
            </Button>
          </div>
          {!members.data?.items.length ? (
            <p className="text-sm text-fg-muted">{he.noItems}</p>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {(members.data?.items ?? []).map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <code className="text-xs">{m.user_id}</code>
                  <Button type="button" variant="ghost" onClick={() => removeMember.mutate(m.user_id)}>
                    מחיקה
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {fillId ? (
        <section className="flex flex-col gap-3 rounded-lg border border-border p-4" data-testid="ssp-site-fill">
          <h2 className="text-base font-semibold">{he.sspFill}</h2>
          {fillDetail.isLoading ? <p className="text-sm text-fg-muted">{he.loading}</p> : null}
          <FormFillFields
            fields={fillFields}
            answers={answers}
            onChange={(id, value) => setAnswers((prev) => ({ ...prev, [id]: value }))}
          />
          <div className="flex gap-2">
            <Button type="button" onClick={() => submit.mutate()} disabled={submit.isPending || !fillFields.length}>
              {he.officerSubmit}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setFillId(null)}>
              ביטול
            </Button>
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">{he.siteAvailable}</h2>
        {bucketList("available")}
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">{he.siteUnfilled}</h2>
        {bucketList("unfilled")}
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">{he.siteSubmitted}</h2>
        {bucketList("submitted")}
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">{he.siteOverdue}</h2>
        {bucketList("overdue")}
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">{he.siteForms}</h2>
        {!ops.data.assignments.length ? (
          <p className="text-sm text-fg-muted">{he.noItems}</p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {ops.data.assignments.map((a) => (
              <li key={a.id} className="px-3 py-2 text-sm">
                {a.form_title || a.form_id} · {a.status} · {he.sspAssignedVersion}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">{he.siteHistory}</h2>
        {!ops.data.submissions.length ? (
          <p className="text-sm text-fg-muted" data-testid="ssp-site-no-submissions">
            {he.sspNoSubmissions}
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {ops.data.submissions.map((s) => (
              <li key={s.id} className="flex flex-wrap justify-between gap-2 px-3 py-2 text-sm">
                <span>
                  {s.submitted_at} · {s.submitted_by || (s.device_id ? he.viaSiteDevice : "—")} · {s.status}
                </span>
                <Link
                  to="/submissions/$submissionId"
                  params={{ submissionId: s.id }}
                  className="text-xs text-fg-muted underline"
                >
                  {he.sspViewSubmission}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
