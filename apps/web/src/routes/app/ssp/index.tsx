import { Button, LoadingBlock, PageHeader } from "@site-secure/ui";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  Building2,
  ClipboardList,
  Clock,
  FileText,
  Inbox,
  Radio,
  Send,
  Smartphone,
  Users,
  type LucideIcon,
} from "lucide-react";
import { DashboardZone } from "../../../components/dashboard/DashboardZone";
import { ErrorState, useQuery } from "../../../components/modules/ModuleKit";
import { SspHubLinks } from "../../../components/ssp/SspHubLinks";
import { useSspWorkspace } from "../../../components/ssp/useSspWorkspace";
import { he } from "../../../i18n/he";
import { formatOpsTime, hoursAgoIso, isAtOrAfter, startOfUtcDayIso } from "../../../lib/ssp-ops-time";

export const Route = createFileRoute("/app/ssp/")({
  component: SspDashboardPage,
});

type TimelineItem = {
  id: string;
  at: string;
  title: string;
  meta: string;
  href: string;
};

function SspDashboardPage() {
  const { api, workspaceId, canEdit, canAssign, sspCan, isOfficer } = useSspWorkspace();
  const since24h = hoursAgoIso(24);
  const todayStart = startOfUtcDayIso();

  const dash = useQuery({
    queryKey: ["ssp-dashboard", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.getSspDashboard(workspaceId!),
    retry: false,
  });
  const sites = useQuery({
    queryKey: ["ssp-sites", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listSspSites(workspaceId!),
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
  const lateRuns = useQuery({
    queryKey: ["ssp-patrol-runs", workspaceId, "late"],
    enabled: Boolean(workspaceId) && sspCan("ssp.patrols.view"),
    queryFn: () => api.listSspPatrolRuns(workspaceId!, "late"),
    retry: false,
  });

  if (!workspaceId) return <ErrorState title={he.sessionError} />;

  const data = dash.data;
  const siteItems = sites.data?.items ?? [];
  const pendingEnrolls = enrollments.data?.items ?? [];
  const recentSubs = (submissions.data?.items ?? []).filter((row) => isAtOrAfter(row.submitted_at, since24h));
  const todaySubs = recentSubs.filter((row) => isAtOrAfter(row.submitted_at, todayStart));
  const openEvents = events.data?.items ?? [];
  const late = lateRuns.data?.items ?? [];

  const timeline: TimelineItem[] = [
    ...recentSubs.map((row) => ({
      id: `sub-${row.id}`,
      at: row.submitted_at,
      title: he.sspRecentReportsTitle,
      meta: `${row.status} · ${row.form_id.slice(0, 8)}…`,
      href: `/app/ssp/submissions/${row.id}`,
    })),
    ...pendingEnrolls.map((row) => ({
      id: `enr-${row.id}`,
      at: row.created_at,
      title: he.sspActivationPendingApproval,
      meta: row.site_name || row.site_pk,
      href: "/app/ssp/enrollments",
    })),
    ...openEvents.map((row) => ({
      id: `evt-${row.id}`,
      at: row.created_at,
      title: row.title,
      meta: `${row.status} · ${row.severity}`,
      href: `/app/ssp/events/${row.id}`,
    })),
  ]
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, 12);

  return (
    <div className="ss-module space-y-5" data-testid="ssp-dashboard">
      <PageHeader title={he.sspNavDashboard} description={he.sspDashboardLead} eyebrow={he.sspProductLine} />
      <SspHubLinks
        items={[
          { to: "/app/ssp/activity", label: he.sspNavLast24h },
          ...(sspCan("ssp.officers.view") ? [{ to: "/app/ssp/officers" as const, label: he.sspNavOfficers }] : []),
        ]}
      />
      {dash.isLoading ? <LoadingBlock label={he.loading} /> : null}
      {dash.isError ? (
        <ErrorState
          title={he.apiUnavailable}
          description={he.sspWaitingLocalDb}
          action={
            <Button type="button" variant="secondary" onClick={() => void dash.refetch()}>
              {he.retry}
            </Button>
          }
        />
      ) : null}
      {data?.updated_at && !dash.isError ? (
        <p className="text-xs text-fg-muted">
          {he.sspUpdatedAt}: {formatOpsTime(data.updated_at)}
        </p>
      ) : null}
      {data?.data_mode === "empty" && !dash.isError ? (
        <p className="ss-module-empty-text" data-testid="ssp-dashboard-empty">
          {he.sspDataEmpty}
        </p>
      ) : null}

      {data?.data_mode === "live" && !dash.isError ? (
        <div className="flex flex-col gap-4">
          <DashboardZone id="ssp-sites" label={he.sspNavSites} className="is-ops">
            <div className="ssp-kpi-grid">
              <Metric label={he.sspMetricSitesTotal} value={siteItems.length} to="/app/ssp/sites" icon={Building2} />
              <Metric label={he.sspMetricSitesActive} value={data.sites_active ?? 0} to="/app/ssp/sites" icon={Building2} />
              <Metric label={he.sspMetricMembers} value={data.site_members_active ?? 0} to="/app/ssp/sites" icon={Users} />
              <Metric
                label={he.sspMetricUserJoins}
                value={data.user_joins_pending ?? 0}
                to="/app/ssp/enrollments"
                search={{ status: "pending" }}
                icon={ClipboardList}
                tone="warning"
              />
              <Metric
                label={he.sspMetricSitesPendingAct}
                value={data.sites_pending_activation ?? 0}
                to="/app/ssp/sites"
                search={{ activation: "awaiting_activation" }}
                icon={Building2}
                tone="warning"
              />
            </div>
          </DashboardZone>
          <DashboardZone id="ssp-devices" label={he.sspNavDevices} className="is-ops">
            <div className="ssp-kpi-grid">
              <Metric label={he.sspMetricDevicesActive} value={data.devices_active ?? 0} to="/app/ssp/devices" icon={Smartphone} />
              <Metric
                label={he.sspMetricEnrollPending}
                value={data.enrollments_pending ?? 0}
                to="/app/ssp/enrollments"
                search={{ status: "pending" }}
                icon={ClipboardList}
                tone="warning"
              />
              <Metric
                label={he.sspMetricDevicesRevoked}
                value={data.devices_revoked ?? 0}
                to="/app/ssp/devices"
                icon={Smartphone}
                tone="danger"
              />
            </div>
          </DashboardZone>
          <DashboardZone id="ssp-forms" label={he.sspNavFormsGroup} className="is-commercial">
            <div className="ssp-kpi-grid">
              <Metric label={he.sspMetricAssignmentsActive} value={data.site_assignments_active ?? 0} to="/app/ssp/forms" icon={ClipboardList} />
              <Metric
                label={he.sspMetricSubsToday}
                value={todaySubs.length}
                to="/app/ssp/activity"
                icon={Send}
                hint={he.sspListCapped}
              />
              <Metric
                label={he.sspMetricSubsLast24h}
                value={recentSubs.length}
                to="/app/ssp/activity"
                icon={Send}
                hint={he.sspListCapped}
              />
              <Metric
                label={he.sspMetricSubPending}
                value={data.submissions_pending ?? 0}
                to="/app/ssp/submissions"
                icon={Inbox}
                tone="warning"
              />
              <Metric label={he.sspMetricFormsPublished} value={data.forms_published ?? 0} to="/app/ssp/forms" icon={FileText} />
              <Metric
                label={he.sspMetricSubOverdue}
                value={data.submissions_overdue ?? 0}
                to="/app/ssp/sites"
                icon={Clock}
                tone="danger"
              />
            </div>
          </DashboardZone>
          {sspCan("ssp.events.view") || sspCan("ssp.patrols.view") || sspCan("ssp.officers.view") ? (
            <DashboardZone id="ssp-exceptions" label={he.sspExceptionsTitle} className="is-ops">
              <div className="ssp-kpi-grid">
                {sspCan("ssp.events.view") ? (
                  <Metric
                    label={he.sspMetricOpenEvents}
                    value={data.open_events}
                    to="/app/ssp/events"
                    icon={Radio}
                    tone={data.open_events ? "warning" : "default"}
                  />
                ) : null}
                {sspCan("ssp.patrols.view") ? (
                  <Metric
                    label={he.sspMetricLateRuns}
                    value={data.runs.late}
                    to="/app/ssp/patrols"
                    icon={Clock}
                    tone={data.runs.late ? "danger" : "default"}
                  />
                ) : null}
                {sspCan("ssp.officers.view") ? (
                  <Metric label={he.sspMetricOfficers} value={data.officers} to="/app/ssp/officers" icon={Users} />
                ) : null}
                {sspCan("ssp.checkpoints.view") ? (
                  <Metric
                    label={he.sspMetricCheckpoints}
                    value={data.checkpoints_active}
                    to="/app/ssp/checkpoints"
                    icon={Radio}
                  />
                ) : null}
              </div>
            </DashboardZone>
          ) : null}
        </div>
      ) : null}

      <DashboardZone id="ssp-timeline" label={he.sspTimelineTitle}>
        {submissions.isLoading || enrollments.isLoading ? <p className="text-sm text-fg-muted">{he.loading}</p> : null}
        {!timeline.length && !submissions.isLoading ? (
          <p className="ss-module-empty-text">{he.sspNoTimeline}</p>
        ) : (
          <ul className="divide-y divide-border rounded-[var(--radius-card)] border border-border bg-bg-1">
            {timeline.map((item) => (
              <li key={item.id}>
                <Link to={item.href as never} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-bg-subtle">
                  <div className="min-w-0">
                    <p className="font-medium text-fg">{item.title}</p>
                    <p className="text-xs text-fg-muted">{item.meta}</p>
                  </div>
                  <p className="text-xs text-fg-muted">{formatOpsTime(item.at)}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </DashboardZone>

      {!isOfficer ? (
        <DashboardZone id="ssp-pending" label={he.sspPendingQueueTitle} className="is-ops">
          {enrollments.isError ? (
            <ErrorState title={he.apiUnavailable} description={he.sspWaitingLocalDb} />
          ) : !pendingEnrolls.length ? (
            <p className="ss-module-empty-text">{he.sspNoPending}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {pendingEnrolls.map((row) => (
                <li key={row.id} className="ops-card flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <Link to="/app/ssp/enrollments" search={{ status: "pending" } as never} className="font-medium text-fg hover:underline">
                    {row.site_name || row.site_pk}
                  </Link>
                  <span className="text-xs text-fg-muted">{formatOpsTime(row.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </DashboardZone>
      ) : null}

      <DashboardZone id="ssp-recent-reports" label={he.sspRecentReportsTitle}>
        {submissions.isError ? (
          <ErrorState title={he.apiUnavailable} />
        ) : !recentSubs.length ? (
          <p className="ss-module-empty-text">{he.sspNoSubmissions}</p>
        ) : (
          <ul className="divide-y divide-border rounded-[var(--radius-card)] border border-border bg-bg-1">
            {recentSubs.slice(0, 8).map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <Link to="/app/ssp/submissions/$submissionId" params={{ submissionId: row.id }} className="font-medium text-fg hover:underline">
                  {row.id.slice(0, 8)}…
                </Link>
                <span className="text-xs text-fg-muted">
                  {row.status} · {formatOpsTime(row.submitted_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </DashboardZone>

      <DashboardZone id="ssp-site-activity" label={he.sspSiteActivityTitle}>
        {sites.isError ? (
          <ErrorState title={he.apiUnavailable} description={he.sspWaitingLocalDb} />
        ) : !siteItems.length ? (
          <p className="ss-module-empty-text">{he.sspNoSites}</p>
        ) : (
          <ul className="divide-y divide-border rounded-[var(--radius-card)] border border-border bg-bg-1">
            {siteItems.slice(0, 12).map((site) => {
              const overdue = site.overdue_count ?? 0;
              const label =
                site.activation_status === "pending_approval" || overdue > 0
                  ? he.sspSiteNeedsCare
                  : site.activation_status === "device_active"
                    ? he.sspSiteReporting
                    : he.sspSiteQuiet;
              return (
                <li key={site.id}>
                  <Link
                    to="/app/ssp/sites/$siteId"
                    params={{ siteId: site.id }}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-bg-subtle"
                  >
                    <div>
                      <p className="font-medium text-fg">{site.name}</p>
                      <p className="text-xs text-fg-muted">
                        {he.sspSiteMembers} {site.members_count ?? 0} · {he.sspAssignedForms}{" "}
                        {site.assigned_forms_count ?? 0} · {he.sspSubmissionsCount} {site.submissions_count ?? 0}
                        {overdue ? ` · ${he.sspMetricSubOverdue} ${overdue}` : ""}
                      </p>
                    </div>
                    <span className="text-xs text-fg-muted">{label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </DashboardZone>

      {sspCan("ssp.events.view") || sspCan("ssp.patrols.view") ? (
        <DashboardZone id="ssp-open-exceptions" label={he.sspExceptionsTitle} className="is-ops">
          {events.isError || lateRuns.isError ? <ErrorState title={he.apiUnavailable} /> : null}
          {!openEvents.length && !late.length ? <p className="ss-module-empty-text">{he.sspNoExceptions}</p> : null}
          <ul className="flex flex-col gap-2">
            {openEvents.slice(0, 6).map((row) => (
              <li key={row.id} className="ops-card px-4 py-3">
                <Link to="/app/ssp/events/$eventId" params={{ eventId: row.id }} className="font-medium text-fg hover:underline">
                  {row.title}
                </Link>
                <p className="text-xs text-fg-muted">
                  {row.status} · {row.severity} · {formatOpsTime(row.created_at)}
                </p>
              </li>
            ))}
            {late.slice(0, 6).map((row) => (
              <li key={row.id} className="ops-card px-4 py-3 text-sm">
                <Link to="/app/ssp/patrols" className="font-medium text-fg hover:underline">
                  {he.sspMetricLateRuns}
                </Link>
                <p className="text-xs text-fg-muted">{row.status}</p>
              </li>
            ))}
          </ul>
        </DashboardZone>
      ) : null}

      <DashboardZone id="ssp-quick" label={he.sspQuickActionsTitle}>
        <div className="flex flex-wrap gap-2">
          {canEdit ? (
            <Link to="/app/ssp/sites" className="ops-kpi-card ops-card-interactive px-4 py-3 text-sm font-medium">
              {he.sspQuickCreateSite}
            </Link>
          ) : null}
          {canEdit ? (
            <Link to="/app/ssp/forms" className="ops-kpi-card ops-card-interactive px-4 py-3 text-sm font-medium">
              {he.sspQuickCreateForm}
            </Link>
          ) : null}
          {canAssign ? (
            <Link to="/app/ssp/forms" className="ops-kpi-card ops-card-interactive px-4 py-3 text-sm font-medium">
              {he.sspQuickAssignForm}
            </Link>
          ) : null}
          {canEdit && !isOfficer ? (
            <Link to="/app/ssp/sites" className="ops-kpi-card ops-card-interactive px-4 py-3 text-sm font-medium">
              {he.sspQuickIssueCode}
            </Link>
          ) : null}
          <Link to="/app/ssp/submissions" className="ops-kpi-card ops-card-interactive px-4 py-3 text-sm font-medium">
            {he.sspQuickViewReports}
          </Link>
        </div>
      </DashboardZone>
    </div>
  );
}

function Metric({
  label,
  value,
  to,
  icon: Icon,
  tone = "default",
  search,
  hint,
}: {
  label: string;
  value: number;
  to: string;
  icon: LucideIcon;
  tone?: "default" | "warning" | "danger";
  search?: Record<string, string>;
  hint?: string;
}) {
  const valueTone = tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "text-fg";
  const iconTone = tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "text-fg-subtle";
  const cardTone = tone === "warning" ? " is-warning" : tone === "danger" ? " is-danger" : "";

  return (
    <Link
      to={to as never}
      search={search as never}
      className={`ops-kpi-card ops-card-interactive ssp-kpi-link${cardTone}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-fg-muted">{label}</p>
        <Icon className={`size-4 shrink-0 ${iconTone}`} aria-hidden />
      </div>
      <p className={`public-mono mt-2 text-2xl font-semibold tracking-[-0.03em] tabular-nums ${valueTone}`}>{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-fg-muted">{hint}</p> : null}
    </Link>
  );
}
