import { Button, ErrorState, Input, PageHeader, Textarea } from "@site-secure/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, getRouteApi } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { DataModeNote } from "../components/DataModeNote";
import { SspHubLinks } from "../components/SspHubLinks";
import { RequireSspAccess } from "../components/RequirePermission";
import { he } from "../i18n/he";
import { useOrg } from "../lib/org";
import { useSession } from "../lib/session";

const sitesRouteApi = getRouteApi("/authenticated/sites");

function activationLabel(status?: string) {
  if (status === "awaiting_activation") return he.activationAwaiting;
  if (status === "code_issued") return he.activationCodeIssued;
  if (status === "pending_approval") return he.activationPendingApproval;
  if (status === "device_active") return he.activationDeviceActive;
  return status || "—";
}

export function SitesListPage() {
  return (
    <RequireSspAccess anyOf={["ssp.sites.view", "ssp.forms.view"]}>
      <SitesListBody />
    </RequireSspAccess>
  );
}

function SitesListBody() {
  const { api, workspaceId } = useSession();
  const { sspCan, org, productRole } = useOrg();
  const isOfficer = productRole === "patrol_officer";
  const qc = useQueryClient();
  const search = sitesRouteApi.useSearch();
  const [q, setQ] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "true" | "false">("all");
  const [activation, setActivation] = useState(search.activation || "");
  const [region, setRegion] = useState("");
  const [dept, setDept] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [managerUserId, setManagerUserId] = useState("");
  const [orgUnitId, setOrgUnitId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ["ssp-sites", workspaceId, q, activeFilter, dept, region, activation],
    enabled: Boolean(workspaceId),
    queryFn: () =>
      api.listSspSites(workspaceId!, {
        q: q.trim() || undefined,
        is_active: activeFilter === "all" ? undefined : activeFilter === "true",
        department_id: dept || undefined,
        org_unit_id: region || undefined,
        activation_status: activation || undefined,
        kind: "physical_site,other",
      }),
    retry: false,
  });

  const units = useQuery({
    queryKey: ["ssp-org-units", workspaceId],
    enabled: Boolean(workspaceId) && Boolean(org?.company),
    queryFn: () => api.listSspOrgUnits(workspaceId!),
  });
  const departments = useQuery({
    queryKey: ["ssp-org-departments", workspaceId],
    enabled: Boolean(workspaceId) && Boolean(org?.company),
    queryFn: () => api.listSspDepartments(workspaceId!),
  });

  const create = useMutation({
    mutationFn: () =>
      api.createSspSite(workspaceId!, {
        name: name.trim(),
        phone: phone.trim() || undefined,
        description: description.trim() || undefined,
        admin_notes: adminNotes.trim() || undefined,
        manager_user_id: managerUserId.trim() || undefined,
        org_unit_id: orgUnitId || undefined,
        department_id: departmentId || undefined,
        kind: "physical_site",
      }),
    onSuccess: async () => {
      setName("");
      setPhone("");
      setDescription("");
      setAdminNotes("");
      setManagerUserId("");
      setMsg(he.create);
      await qc.invalidateQueries({ queryKey: ["ssp-sites", workspaceId] });
    },
    onError: (e: unknown) => setMsg(e instanceof Error ? e.message : he.apiUnavailable),
  });

  const unitName = useMemo(() => {
    const map = new Map((units.data?.items ?? []).map((u) => [u.id, u.name]));
    return (id: string | null) => (id ? map.get(id) || id : "—");
  }, [units.data]);
  const deptName = useMemo(() => {
    const map = new Map((departments.data?.items ?? []).map((d) => [d.id, d.name_he]));
    return (id: string | null) => (id ? map.get(id) || id : "—");
  }, [departments.data]);

  if (!workspaceId) return <ErrorState title={he.sessionError} />;

  return (
    <div className="flex flex-col gap-6" data-testid="ssp-sites">
      <PageHeader title={he.sitesTitle} description={he.sitesLead} />
      <SspHubLinks
        items={[
          { to: "/checkpoints", label: he.navCheckpoints },
          ...(!isOfficer ? [{ to: "/enrollments", label: he.navEnrollments }] : []),
        ]}
      />
      <DataModeNote mode={list.data?.data_mode} waitingDb={list.isError} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input id="site-q" label={he.sspSearch} value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="flex flex-col gap-1 text-sm">
          <span>{he.filterStatus}</span>
          <select
            className="rounded-md border border-border bg-bg px-2 py-1.5 text-sm"
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value as "all" | "true" | "false")}
            aria-label={he.filterStatus}
          >
            <option value="all">הכול</option>
            <option value="true">{he.siteActive}</option>
            <option value="false">{he.siteInactive}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>{he.filterActivation}</span>
          <select
            className="rounded-md border border-border bg-bg px-2 py-1.5 text-sm"
            value={activation}
            onChange={(e) => setActivation(e.target.value)}
            aria-label={he.filterActivation}
          >
            <option value="">הכול</option>
            <option value="awaiting_activation">{he.activationAwaiting}</option>
            <option value="code_issued">{he.activationCodeIssued}</option>
            <option value="pending_approval">{he.activationPendingApproval}</option>
            <option value="device_active">{he.activationDeviceActive}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>{he.filterRegion}</span>
          <select
            className="rounded-md border border-border bg-bg px-2 py-1.5 text-sm"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            aria-label={he.filterRegion}
          >
            <option value="">הכול</option>
            {(units.data?.items ?? []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>{he.filterDepartment}</span>
          <select
            className="rounded-md border border-border bg-bg px-2 py-1.5 text-sm"
            value={dept}
            onChange={(e) => setDept(e.target.value)}
            aria-label={he.filterDepartment}
          >
            <option value="">הכול</option>
            {(departments.data?.items ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name_he}
              </option>
            ))}
          </select>
        </label>
      </div>

      {sspCan("ssp.sites.edit") ? (
        <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <h2 className="text-sm font-semibold">{he.newSite}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input id="new-site-name" label={he.name} value={name} onChange={(e) => setName(e.target.value)} />
            <Input id="new-site-phone" label={he.sitePhone} value={phone} onChange={(e) => setPhone(e.target.value)} />
            <label className="flex flex-col gap-1 text-sm">
              <span>{he.filterRegion}</span>
              <select
                className="rounded-md border border-border bg-bg px-2 py-1.5 text-sm"
                value={orgUnitId}
                onChange={(e) => setOrgUnitId(e.target.value)}
                aria-label={he.filterRegion}
              >
                <option value="">—</option>
                {(units.data?.items ?? []).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>{he.filterDepartment}</span>
              <select
                className="rounded-md border border-border bg-bg px-2 py-1.5 text-sm"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                aria-label={he.filterDepartment}
              >
                <option value="">—</option>
                {(departments.data?.items ?? []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name_he}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <Textarea
            id="new-site-desc"
            label={he.siteDescription}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
          <Textarea
            id="new-site-notes"
            label={he.adminNotes}
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
            rows={2}
          />
          <Input
            id="new-site-manager"
            label={he.siteManager}
            value={managerUserId}
            onChange={(e) => setManagerUserId(e.target.value)}
          />
          <Button
            type="button"
            onClick={() => create.mutate()}
            disabled={create.isPending || !name.trim()}
          >
            {he.newSite}
          </Button>
        </section>
      ) : null}

      {msg ? <p className="text-sm text-fg-muted">{msg}</p> : null}
      {list.isLoading ? <p className="text-sm text-fg-muted">{he.loading}</p> : null}
      {list.isError ? (
        <ErrorState
          title={he.apiUnavailable}
          action={
            <Button type="button" variant="secondary" onClick={() => void list.refetch()}>
              {he.retry}
            </Button>
          }
        />
      ) : null}
      {!list.isLoading && !list.isError && !(list.data?.items.length) ? (
        <p className="text-sm text-fg-muted" data-testid="ssp-no-sites">
          {he.noSites}
        </p>
      ) : null}

      <ul className="divide-y divide-border rounded-lg border border-border">
        {(list.data?.items ?? []).map((site) => (
          <li key={site.id}>
            <Link
              to="/sites/$siteId"
              params={{ siteId: site.id }}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-bg-subtle"
            >
              <div>
                <div className="font-medium text-fg">{site.name}</div>
                <div className="text-xs text-fg-muted">
                  {site.site_id} · {site.phone || "—"} · {unitName(site.org_unit_id)} ·{" "}
                  {deptName(site.department_id)}
                </div>
              </div>
              <span className="text-xs text-fg-muted">
                {site.is_active ? he.siteActive : he.siteInactive} · {activationLabel(site.activation_status)}
                {` · ${he.siteForms} ${site.assigned_forms_count ?? 0}`}
                {site.overdue_count ? ` · ${he.siteOverdue} ${site.overdue_count}` : ""}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
