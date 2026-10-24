import { Button, Card, Input, LoadingBlock, Select, Status } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ErrorState, ModuleScaffold } from "../../../components/modules/ModuleKit";
import { useSspWorkspace } from "../../../components/ssp/useSspWorkspace";
import { he } from "../../../i18n/he";
import { useSession } from "../../../lib/session";
import { productRoleLabelHe } from "../../../lib/ssp-product-authz";
import { sspCanChangePersonRole, sspCanDisablePerson } from "../../../lib/ssp-users-view";

export const Route = createFileRoute("/app/ssp/users/$userId")({
  component: SspUserCardPage,
});

function SspUserCardPage() {
  const { userId } = Route.useParams();
  const { api, workspaceId, sspCan } = useSspWorkspace();
  const { user } = useSession();
  const qc = useQueryClient();
  const canManage = sspCan("ssp.members.manage") || sspCan("ssp.members.manage_department");
  const actorUserId = user?.id ?? null;
  const canDisableTarget = sspCanDisablePerson(actorUserId, userId);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [productRole, setProductRole] = useState<"org_admin" | "patrol_manager" | "patrol_officer">(
    "patrol_officer",
  );
  const [officeId, setOfficeId] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [msg, setMsg] = useState<string | null>(null);

  const detail = useQuery({
    queryKey: ["ssp-person", workspaceId, userId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.getSspUser(workspaceId!, userId),
    retry: false,
  });
  const offices = useQuery({
    queryKey: ["ssp-sites", workspaceId, "actors"],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listSspSites(workspaceId!, { kind: "office,ops_center" }),
    retry: false,
  });

  useEffect(() => {
    if (!detail.data) return;
    setFullName(detail.data.full_name || "");
    setPhone(detail.data.phone || "");
    setProductRole((detail.data.product_role as typeof productRole) || "patrol_officer");
    setOfficeId(detail.data.sites[0]?.id || "");
    setStatus(detail.data.status === "inactive" ? "inactive" : "active");
  }, [detail.data]);

  const save = useMutation({
    mutationFn: () => {
      const nextRole = sspCanChangePersonRole({
        actorUserId,
        targetUserId: userId,
        currentRole: detail.data?.product_role,
        nextRole: productRole,
      })
        ? productRole
        : (detail.data?.product_role as typeof productRole) || productRole;
      return api.patchSspUser(workspaceId!, userId, {
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        product_role: nextRole,
        site_id: officeId || undefined,
        status: canDisableTarget ? status : detail.data?.status === "inactive" ? "inactive" : "active",
      });
    },
    onSuccess: async () => {
      setMsg(he.save);
      await qc.invalidateQueries({ queryKey: ["ssp-person", workspaceId, userId] });
      await qc.invalidateQueries({ queryKey: ["ssp-people", workspaceId] });
    },
    onError: (e: unknown) => setMsg(e instanceof Error ? e.message : he.apiUnavailable),
  });

  if (!workspaceId) return <ErrorState title={he.sessionError} />;
  if (detail.isLoading) return <LoadingBlock label={he.loading} />;
  if (detail.isError || !detail.data) {
    return (
      <ErrorState
        title={he.apiUnavailable}
        action={
          <Button type="button" variant="secondary" onClick={() => void detail.refetch()}>
            {he.retry}
          </Button>
        }
      />
    );
  }

  const person = detail.data;

  return (
    <div data-testid="ssp-user-card">
      <ModuleScaffold
        title={person.full_name || person.email || person.user_id.slice(0, 8)}
        lead={he.sspPeopleLead}
        action={
          <Link to="/app/ssp/users" className="ops-section-link">
            {he.sspNavPeople}
          </Link>
        }
      >
        {msg ? <p className="text-sm text-fg-muted">{msg}</p> : null}
        <Card className="flex flex-col gap-4">
          <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-xs text-fg-muted">{he.email}</dt>
              <dd className="mt-0.5 font-medium text-fg">{person.email || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-fg-muted">{he.sspProductRole}</dt>
              <dd className="mt-0.5 font-medium text-fg">{productRoleLabelHe(person.product_role)}</dd>
            </div>
            <div>
              <dt className="text-xs text-fg-muted">{he.sspWorkspaceRole}</dt>
              <dd className="mt-0.5 font-medium text-fg">{person.workspace_role_key || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-fg-muted">{he.sspAccountStatus}</dt>
              <dd className="mt-0.5">
                <Status
                  label={person.status === "active" ? he.sspSiteActive : he.sspSiteInactive}
                  tone={person.status === "active" ? "success" : "neutral"}
                />
              </dd>
            </div>
          </dl>
          {canManage ? (
            <>
              <Input id="person-name" label={he.name} value={fullName} onChange={(e) => setFullName(e.target.value)} />
              <Input id="person-phone" label={he.phone} value={phone} onChange={(e) => setPhone(e.target.value)} />
              <Select
                id="person-role"
                label={he.sspProductRole}
                value={productRole}
                disabled={!canDisableTarget && person.product_role === "org_admin"}
                onChange={(e) => {
                  const next = e.target.value as typeof productRole;
                  if (
                    !sspCanChangePersonRole({
                      actorUserId,
                      targetUserId: userId,
                      currentRole: person.product_role,
                      nextRole: next,
                    })
                  ) {
                    return;
                  }
                  setProductRole(next);
                }}
              >
                <option value="patrol_officer" disabled={!canDisableTarget && person.product_role === "org_admin"}>
                  {he.sspRolePatrolOfficer}
                </option>
                <option value="patrol_manager" disabled={!canDisableTarget && person.product_role === "org_admin"}>
                  {he.sspRolePatrolManager}
                </option>
                {sspCan("ssp.members.manage") ? <option value="org_admin">{he.sspRoleOrgAdmin}</option> : null}
              </Select>
              <Select
                id="person-office"
                label={he.sspFilterOffice}
                value={officeId}
                onChange={(e) => setOfficeId(e.target.value)}
              >
                <option value="">{person.product_role === "org_admin" ? he.sspOfficeAllOrg : he.sspOfficeOptional}</option>
                {(offices.data?.items ?? []).map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-fg-muted">{he.sspPeopleCreateHint}</p>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={status === "active"}
                  disabled={!canDisableTarget}
                  onChange={(e) => setStatus(e.target.checked ? "active" : "inactive")}
                />
                {he.sspSiteActive}
              </label>
              {!canDisableTarget ? <p className="text-sm text-fg-muted">{he.sspSelfActionBlocked}</p> : null}
              <Button type="button" onClick={() => save.mutate()} disabled={save.isPending || !fullName.trim()}>
                {he.save}
              </Button>
            </>
          ) : (
            <p className="text-sm text-fg-muted">
              {(person.sites ?? []).map((s) => s.name).filter(Boolean).join(" · ") || he.sspAssignOffice}
            </p>
          )}
        </Card>
        <Card className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-fg">{he.sspAssignedForms}</h2>
          {!(person.assignments ?? []).length ? (
            <p className="ss-module-empty-text">{he.sspNoItems}</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {(person.assignments ?? []).map((a) => (
                <li key={a.id} className="py-2">
                  {a.form_title || a.form_id || a.site_assignment_id}
                  {a.status ? ` · ${a.status}` : ""}
                  {a.due_at ? ` · ${String(a.due_at).slice(0, 10)}` : ""}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-fg">{he.sspSubmissions}</h2>
          {!(person.submissions ?? []).length ? (
            <p className="ss-module-empty-text">{he.sspNoSubmissions}</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {(person.submissions ?? []).map((s) => (
                <li key={s.id} className="py-2">
                  <Link to="/app/ssp/submissions/$submissionId" params={{ submissionId: s.id }} className="underline">
                    {s.form_id.slice(0, 8)} · {s.submitted_at ? new Date(s.submitted_at).toLocaleString("he-IL") : s.status}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </ModuleScaffold>
    </div>
  );
}
