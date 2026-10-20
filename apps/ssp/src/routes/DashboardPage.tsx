import { Button, ErrorState, Input, PageHeader } from "@site-secure/ui";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { DataModeNote } from "../components/DataModeNote";
import { SspHubLinks } from "../components/SspHubLinks";
import { RequireSspAccess } from "../components/RequirePermission";
import { he } from "../i18n/he";
import { useOrg } from "../lib/org";
import { useSession } from "../lib/session";

export function DashboardPage() {
  return (
    <RequireSspAccess anyOf={["ssp.dashboard.view", "ssp.forms.view"]}>
      <DashboardBody />
    </RequireSspAccess>
  );
}

function DashboardBody() {
  const { api, workspaceId } = useSession();
  const { sspCan, productRole } = useOrg();
  const isOfficer = productRole === "patrol_officer";
  const [status, setStatus] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [siteId, setSiteId] = useState("");
  const [orgUnitId, setOrgUnitId] = useState("");
  const [formId, setFormId] = useState("");
  const [assignmentStatus, setAssignmentStatus] = useState("");

  const q = useQuery({
    queryKey: [
      "ssp-dashboard",
      workspaceId,
      status,
      departmentId,
      fromDate,
      toDate,
      siteId,
      orgUnitId,
      formId,
      assignmentStatus,
    ],
    enabled: Boolean(workspaceId),
    queryFn: () =>
      api.getSspDashboard(workspaceId!, {
        status: status || undefined,
        department_id: departmentId || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        site_id: siteId || undefined,
        org_unit_id: orgUnitId || undefined,
        form_id: formId || undefined,
        assignment_status: assignmentStatus || undefined,
      }),
    retry: false,
  });
  const sites = useQuery({
    queryKey: ["ssp-sites", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listSspSites(workspaceId!),
    retry: false,
  });
  const forms = useQuery({
    queryKey: ["ssp-forms", workspaceId, "published"],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listSspForms(workspaceId!, { status: "published" }),
    retry: false,
  });
  const enrollments = useQuery({
    queryKey: ["ssp-enrollments", workspaceId, "pending"],
    enabled: Boolean(workspaceId) && !isOfficer,
    queryFn: () => api.listSspEnrollments(workspaceId!, { status: "pending" }),
    retry: false,
  });
  const submissions = useQuery({
    queryKey: ["ssp-submissions", workspaceId, "dash"],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listSspSubmissions(workspaceId!),
    retry: false,
  });
  const events = useQuery({
    queryKey: ["ssp-events", workspaceId, "open"],
    enabled: Boolean(workspaceId) && sspCan("ssp.events.view"),
    queryFn: () => api.listSspEvents(workspaceId!, "open"),
    retry: false,
  });
  const units = useQuery({
    queryKey: ["ssp-org-units", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listSspOrgUnits(workspaceId!),
    retry: false,
  });
  const departments = useQuery({
    queryKey: ["ssp-org-departments", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listSspDepartments(workspaceId!),
    retry: false,
  });

  if (!workspaceId) return <ErrorState title={he.sessionError} />;

  const waitingDb = q.isError;
  const data = q.data;

  return (
    <div className="flex flex-col gap-4" data-testid="ssp-dashboard">
      <PageHeader title={he.dashboardTitle} description={he.dashboardLead} />
      <SspHubLinks
        items={[
          { to: "/activity", label: he.navLast24h },
          ...(sspCan("ssp.officers.view") ? [{ to: "/officers", label: he.navOfficers }] : []),
        ]}
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FilterSelect
          id="dash-site"
          label={he.filterSite}
          value={siteId}
          onChange={setSiteId}
          options={(sites.data?.items ?? []).map((s) => ({ id: s.id, label: s.name }))}
        />
        <FilterSelect
          id="dash-unit"
          label={he.filterRegion}
          value={orgUnitId}
          onChange={setOrgUnitId}
          options={(units.data?.items ?? []).map((u) => ({ id: u.id, label: u.name }))}
        />
        <FilterSelect
          id="dash-dept"
          label={he.filterDepartment}
          value={departmentId}
          onChange={setDepartmentId}
          options={(departments.data?.items ?? []).map((d) => ({ id: d.id, label: d.name_he }))}
        />
        <FilterSelect
          id="dash-form"
          label={he.filterForm}
          value={formId}
          onChange={setFormId}
          options={(forms.data?.items ?? []).map((f) => ({ id: f.id, label: f.title }))}
        />
        <Input
          id="dash-status"
          label={he.filterStatus}
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          hint="planned|active|completed|late"
        />
        <label className="flex flex-col gap-1 text-sm">
          <span>{he.filterAssignStatus}</span>
          <select
            className="rounded-md border border-border bg-bg px-2 py-1.5 text-sm"
            value={assignmentStatus}
            onChange={(e) => setAssignmentStatus(e.target.value)}
            aria-label={he.filterAssignStatus}
          >
            <option value="">הכול</option>
            <option value="active">{he.siteActive}</option>
            <option value="paused">{he.sspPause}</option>
            <option value="completed">{he.sspComplete}</option>
          </select>
        </label>
        <Input
          id="dash-from"
          label={he.filterFrom}
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          hint="YYYY-MM-DD"
        />
        <Input
          id="dash-to"
          label={he.filterTo}
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          hint="YYYY-MM-DD"
        />
      </div>
      <DataModeNote mode={data?.data_mode} waitingDb={waitingDb} />
      {data?.updated_at ? (
        <p className="text-xs text-fg-muted">
          {he.updatedAt}: {data.updated_at}
        </p>
      ) : null}
      {q.isLoading ? <p className="text-sm text-fg-muted">{he.loading}</p> : null}
      {waitingDb ? (
        <Button type="button" variant="secondary" onClick={() => void q.refetch()}>
          {he.retry}
        </Button>
      ) : null}
      {data && data.data_mode === "empty" && !waitingDb ? (
        <p className="text-sm text-fg-muted" data-testid="ssp-dashboard-empty">
          {he.dataEmpty}
        </p>
      ) : null}
      {data && data.data_mode === "live" ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label={he.metricSitesActive} value={data.sites_active ?? 0} to="/sites" />
          <Metric
            label={he.metricSitesPendingAct}
            value={data.sites_pending_activation ?? 0}
            to="/sites"
            search={{ activation: "awaiting_activation" }}
          />
          <Metric
            label={he.metricEnrollPending}
            value={data.enrollments_pending ?? 0}
            to="/enrollments"
            search={{ status: "pending" }}
          />
          <Metric label={he.metricDevicesActive} value={data.devices_active ?? 0} to="/sites" />
          <Metric label={he.metricDevicesRevoked} value={data.devices_revoked ?? 0} to="/sites" />
          <Metric label={he.metricFormsPublished} value={data.forms_published ?? 0} to="/forms" />
          <Metric label={he.metricAssignmentsActive} value={data.site_assignments_active ?? 0} to="/sites" />
          <Metric label={he.metricSubPending} value={data.submissions_pending ?? 0} to="/submissions" />
          <Metric label={he.metricSubSubmitted} value={data.submissions_submitted ?? 0} to="/submissions" />
          <Metric label={he.metricSubOverdue} value={data.submissions_overdue ?? 0} to="/submissions" />
          <Metric label={he.metricOfficers} value={data.officers} to="/officers" />
          <Metric label={he.metricCheckpoints} value={data.checkpoints_active} to="/checkpoints" />
          <Metric label={he.metricScansOk} value={data.checkpoint_scans_ok ?? 0} to="/checkpoints" />
          <Metric label={he.metricOpenEvents} value={data.open_events} to="/events" />
          <Metric label={he.metricRunsActive} value={data.runs.active} to="/patrols" />
          <Metric label={he.metricRunsPlanned} value={data.runs.planned} to="/patrols" />
          <Metric label={he.metricRunsCompleted} value={data.runs.completed} to="/patrols" />
          <Metric label={he.metricRunsLate} value={data.runs.late} to="/patrols" />
          <Metric label={he.metricDistOverdue} value={data.distributions_overdue ?? 0} to="/distributions" />
        </div>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-fg">{he.timelineTitle}</h2>
        {!(submissions.data?.items.length) && !(enrollments.data?.items.length) && !(events.data?.items.length) ? (
          <p className="text-sm text-fg-muted">{he.noTimeline}</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border text-sm">
            {[
              ...(submissions.data?.items ?? []).map((row) => ({
                id: `sub-${row.id}`,
                at: row.submitted_at,
                title: he.navSubmissions,
                href: `/submissions/${row.id}`,
              })),
              ...(enrollments.data?.items ?? []).map((row) => ({
                id: `enr-${row.id}`,
                at: row.created_at,
                title: he.navEnrollments,
                href: "/enrollments",
              })),
              ...(events.data?.items ?? []).map((row) => ({
                id: `evt-${row.id}`,
                at: row.created_at,
                title: row.title,
                href: `/events/${row.id}`,
              })),
            ]
              .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
              .slice(0, 12)
              .map((item) => (
                <li key={item.id} className="flex justify-between gap-2 px-4 py-2">
                  <Link to={item.href} className="font-medium text-fg underline">
                    {item.title}
                  </Link>
                  <span className="text-xs text-fg-muted">{item.at.slice(0, 16)}</span>
                </li>
              ))}
          </ul>
        )}
      </section>

      {!isOfficer ? <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-fg">{he.pendingQueueTitle}</h2>
        {!(enrollments.data?.items.length) ? (
          <p className="text-sm text-fg-muted">{he.noEnrollments}</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border text-sm">
            {(enrollments.data?.items ?? []).map((row) => (
              <li key={row.id} className="flex justify-between gap-2 px-4 py-2">
                <Link to="/enrollments" search={{ status: "pending" }} className="underline">
                  {row.site_name || row.site_pk}
                </Link>
                <span className="text-xs text-fg-muted">{row.created_at.slice(0, 16)}</span>
              </li>
            ))}
          </ul>
        )}
      </section> : null}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-fg">{he.siteActivityTitle}</h2>
        {!(sites.data?.items.length) ? (
          <p className="text-sm text-fg-muted">{he.noSites}</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border text-sm">
            {(sites.data?.items ?? []).slice(0, 12).map((site) => {
              const overdue = site.overdue_count ?? 0;
              const label =
                site.activation_status === "pending_approval" || overdue > 0
                  ? he.siteNeedsCare
                  : site.activation_status === "device_active"
                    ? he.siteReporting
                    : he.siteQuiet;
              return (
                <li key={site.id} className="flex justify-between gap-2 px-4 py-2">
                  <Link to="/sites/$siteId" params={{ siteId: site.id }} className="underline">
                    {site.name}
                  </Link>
                  <span className="text-xs text-fg-muted">{label}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-fg">{he.quickActionsTitle}</h2>
        <div className="flex flex-wrap gap-2">
          <Link to="/sites" className="rounded-md bg-bg-subtle px-3 py-2 text-sm">
            {he.newSite}
          </Link>
          <Link to="/forms" className="rounded-md bg-bg-subtle px-3 py-2 text-sm">
            {he.sspNewForm}
          </Link>
          {!isOfficer ? (
            <Link to="/enrollments" className="rounded-md bg-bg-subtle px-3 py-2 text-sm">
              {he.navEnrollments}
            </Link>
          ) : null}
          <Link to="/submissions" className="rounded-md bg-bg-subtle px-3 py-2 text-sm">
            {he.navSubmissions}
          </Link>
        </div>
      </section>
    </div>
  );
}

function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ id: string; label: string }>;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm" htmlFor={id}>
      <span>{label}</span>
      <select
        id={id}
        className="rounded-md border border-border bg-bg px-2 py-1.5 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">הכול</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Metric({
  label,
  value,
  to,
  search,
}: {
  label: string;
  value: number;
  to: string;
  search?: Record<string, string>;
}) {
  return (
    <Link to={to} search={search as never} className="rounded-lg border border-border px-4 py-3 hover:bg-bg-subtle">
      <div className="text-xs text-fg-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-fg">{value}</div>
    </Link>
  );
}
