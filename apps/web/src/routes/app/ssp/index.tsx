import { Button, LoadingBlock, PageHeader, Tooltip } from "@site-secure/ui";
import { Link, Navigate, createFileRoute } from "@tanstack/react-router";
import {
  ClipboardList,
  Clock,
  FileText,
  Radio,
  Send,
  Smartphone,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { DashboardZone } from "../../../components/dashboard/DashboardZone";
import { ErrorState, useQuery } from "../../../components/modules/ModuleKit";
import { useSspWorkspace } from "../../../components/ssp/useSspWorkspace";
import { he } from "../../../i18n/he";
import {
  sspAttentionBanner,
  sspAttentionItems,
  sspCodeIssuedProgress,
  sspIdleFeedsEmpty,
  sspKpiTone,
  sspRangeFromIso,
  sspSetupComplete,
  sspSetupCounts,
  sspSetupSteps,
  sspShowExceptionsSection,
  sspSiteActivityKind,
  sspSitesWithoutForm,
  sspSiteToneClass,
  type SspDashRange,
} from "../../../lib/ssp-dashboard-view";
import { formatOpsTime, isAtOrAfter } from "../../../lib/ssp-ops-time";

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
  const [range, setRange] = useState<SspDashRange>("today");
  const rangeFrom = sspRangeFromIso(range);
  const canEvents = sspCan("ssp.events.view");
  const canPatrols = sspCan("ssp.patrols.view");

  const dash = useQuery({
    queryKey: ["ssp-dashboard", workspaceId, range],
    enabled: Boolean(workspaceId) && !isOfficer,
    queryFn: () => api.getSspDashboard(workspaceId!, { from_date: rangeFrom }),
    retry: false,
  });
  const sites = useQuery({
    queryKey: ["ssp-sites", workspaceId],
    enabled: Boolean(workspaceId) && !isOfficer,
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
    queryKey: ["ssp-submissions", workspaceId, "dash", range],
    enabled: Boolean(workspaceId) && !isOfficer,
    queryFn: () => api.listSspSubmissions(workspaceId!, { from_date: rangeFrom }),
    retry: false,
  });
  const events = useQuery({
    queryKey: ["ssp-events", workspaceId, "open"],
    enabled: Boolean(workspaceId) && canEvents,
    queryFn: () => api.listSspEvents(workspaceId!, "open"),
    retry: false,
  });
  const lateRuns = useQuery({
    queryKey: ["ssp-patrol-runs", workspaceId, "late"],
    enabled: Boolean(workspaceId) && canPatrols,
    queryFn: () => api.listSspPatrolRuns(workspaceId!, "late"),
    retry: false,
  });

  if (!workspaceId) return <ErrorState title={he.sessionError} />;
  if (isOfficer) return <Navigate to="/app/ssp/my-forms" />;

  const data = dash.data;
  const siteItems = sites.data?.items ?? [];
  const pendingEnrolls = enrollments.data?.items ?? [];
  const rangeSubs = (submissions.data?.items ?? []).filter((row) => isAtOrAfter(row.submitted_at, rangeFrom));
  const openEvents = events.data?.items ?? [];
  const late = lateRuns.data?.items ?? [];
  const pendingJoins = Math.max(
    data?.enrollments_pending ?? 0,
    data?.user_joins_pending ?? 0,
    pendingEnrolls.length,
  );
  const live = data?.data_mode === "live" && !dash.isError;
  const pendingActivation = data?.sites_pending_activation ?? 0;
  const codeProgress = sspCodeIssuedProgress(siteItems);

  const attention = sspAttentionItems({
    overdue: data?.submissions_overdue ?? 0,
    openEvents: data?.open_events ?? openEvents.length,
    lateRuns: data?.runs.late ?? late.length,
    pendingJoins,
    canEvents,
    canPatrols,
    labels: {
      overdue: he.sspMetricSubOverdue,
      openEvents: he.sspMetricOpenEvents,
      lateRuns: he.sspMetricLateRuns,
      pendingJoins: he.sspMetricUserJoins,
    },
  });

  const setup = sspSetupSteps({
    officesActive: data?.offices_active ?? siteItems.filter((s) => s.kind === "office" || s.kind === "ops_center").length,
    formsPublished: data?.forms_published ?? 0,
    assignmentsActive: data?.site_assignments_active ?? 0,
    codeIssued: codeProgress.done,
    codeDetail:
      codeProgress.total > 0 && !codeProgress.done
        ? he.sspSetupSitesOf(codeProgress.issued, codeProgress.total)
        : undefined,
    devicesActive: data?.devices_active ?? 0,
    labels: {
      offices: he.sspSetupOffices,
      formPublished: he.sspSetupFormPublished,
      formAssigned: he.sspSetupFormAssigned,
      codeIssued: he.sspSetupCodeIssued,
      device: he.sspSetupDeviceActive,
    },
    actions: {
      offices: he.sspNewActor,
      formPublished: he.sspQuickCreateForm,
      formAssigned: he.sspQuickAssignForm,
      codeIssued: he.sspQuickIssueCode,
      device: he.sspNavDevices,
    },
  });
  const setupDone = sspSetupComplete(setup);
  const setupCounts = sspSetupCounts(setup);
  const showSetup = live && (!setupDone || pendingActivation > 0);
  const sitesWithoutForm = sspSitesWithoutForm(siteItems);
  const deviceStepDone = (data?.devices_active ?? 0) > 0;
  const attentionBanner = sspAttentionBanner({
    hasExceptions: attention.length > 0,
    setupComplete: setupDone,
    pendingActivation,
    sitesWithoutForm,
  });

  const timeline: TimelineItem[] = [
    ...rangeSubs.map((row) => ({
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

  const feedsLoading = submissions.isLoading || enrollments.isLoading;
  const idleFeeds =
    !feedsLoading && sspIdleFeedsEmpty(timeline.length, pendingEnrolls.length, rangeSubs.length);

  function refreshAll() {
    void dash.refetch();
    void sites.refetch();
    void enrollments.refetch();
    void submissions.refetch();
    void events.refetch();
    void lateRuns.refetch();
  }

  const moreActions = [
    { to: "/app/ssp/activity", label: he.sspNavLast24h },
    ...(sspCan("ssp.officers.view") ? [{ to: "/app/ssp/officers", label: he.sspOfficersTitle }] : []),
    ...(canEdit ? [{ to: "/app/ssp/offices", label: he.sspNewActor }] : []),
  ];

  return (
    <div className="ss-module space-y-5" data-testid="ssp-dashboard">
      <PageHeader
        title={he.sspNavDashboard}
        description={he.sspDashboardLead}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <span className="ssp-connected" data-testid="ssp-connected">
              <span className={`ssp-connected-dot${live ? " is-live" : ""}`} aria-hidden />
              {he.sspConnected}
            </span>
            <Tooltip content={he.sspListCapped}>
              <Button type="button" variant="secondary" onClick={refreshAll}>
                {he.sspRefresh}
              </Button>
            </Tooltip>
          </div>
        }
      />

      <DashboardZone id="ssp-quick" label={he.sspQuickActionsTitle}>
        <div className="flex flex-wrap gap-2">
          {canEdit ? (
            <Link to="/app/ssp/forms" className="ssp-quick-btn">
              {he.sspQuickCreateForm}
            </Link>
          ) : null}
          {canAssign ? (
            <Link to="/app/ssp/assignments" className="ssp-quick-btn">
              {he.sspQuickAssignForm}
            </Link>
          ) : null}
          {canEdit && !isOfficer ? (
            <Link to="/app/ssp/sites" className="ssp-quick-btn">
              {he.sspQuickIssueCode}
            </Link>
          ) : null}
          <Link to="/app/ssp/submissions" className="ssp-quick-btn">
            {he.sspQuickViewReports}
          </Link>
          {moreActions.length ? <QuickMore items={moreActions} /> : null}
        </div>
      </DashboardZone>

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

      {data && !dash.isError && data.updated_at ? (
        <p className="text-xs text-fg-muted">
          {he.sspUpdatedAt}: {formatOpsTime(data.updated_at)}
        </p>
      ) : null}

      {data?.data_mode === "empty" && !dash.isError ? (
        <p className="ss-module-empty-text" data-testid="ssp-dashboard-empty">
          {he.sspDataEmpty}
        </p>
      ) : null}

      {showSetup ? (
        <DashboardZone id="ssp-setup" label={he.sspSetupProgress}>
          {!setupDone ? (
            <div className="ssp-setup-meter">
              <p className="ssp-setup-meter-label">{he.sspSetupOf(setupCounts.done, setupCounts.total)}</p>
              <div
                className="ssp-setup-meter-track"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={setupCounts.total}
                aria-valuenow={setupCounts.done}
                aria-label={he.sspSetupProgress}
              >
                <span
                  className="ssp-setup-meter-fill"
                  style={{ width: `${setupCounts.total ? (setupCounts.done / setupCounts.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          ) : null}
          {pendingActivation > 0 ? (
            <Link
              to="/app/ssp/sites"
              search={{ activation: "awaiting_activation" } as never}
              className="ssp-setup-alert"
              data-testid="ssp-setup-activation"
            >
              <strong>{pendingActivation}</strong>
              <span>{he.sspMetricSitesPendingAct}</span>
            </Link>
          ) : null}
          {!setupDone ? (
            <ol className="ssp-setup-list" data-testid="ssp-setup">
              {setup.map((step) => (
                <li key={step.id} className="ssp-setup-row">
                  <span className={step.done ? "text-success" : "text-fg-muted"} aria-hidden>
                    {step.done ? "✔" : "☐"}
                  </span>
                  <span className={step.done ? "text-fg" : "text-fg-muted"}>{step.label}</span>
                  {step.detail ? <span className="ssp-setup-detail">{step.detail}</span> : null}
                  {step.done ? null : (
                    <Link to={step.href as never} className="ssp-quick-btn ssp-setup-action">
                      {step.actionLabel}
                    </Link>
                  )}
                </li>
              ))}
            </ol>
          ) : null}
        </DashboardZone>
      ) : null}

      {live ? (
        <section
          className={`ssp-attention${attentionBanner === "clear" ? " is-clear" : attentionBanner === "neutral" ? " is-neutral" : ""}`}
          data-testid="ssp-attention"
          aria-label={
            attentionBanner === "items"
              ? he.sspAttentionNow
              : attentionBanner === "neutral"
                ? he.sspNoOperationalExceptions
                : he.sspAllClear
          }
        >
          {attentionBanner === "items" ? (
            <ul className="ssp-attention-list">
              {attention.map((item) => (
                <li key={item.id}>
                  <Link
                    to={item.href as never}
                    search={item.search as never}
                    className={`ssp-attention-chip is-${item.tone}`}
                    aria-label={he.sspKpiAria(item.label, item.value)}
                  >
                    <strong>{item.value}</strong>
                    <span>{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className={attentionBanner === "clear" ? "ssp-attention-clear" : "ssp-attention-neutral"}>
              {attentionBanner === "clear" ? he.sspAllClear : he.sspNoOperationalExceptions}
            </p>
          )}
        </section>
      ) : null}

      {live && data ? (
        <div className="flex flex-col gap-4">
          <DashboardZone
            id="ssp-core"
            label={he.sspOpsStatusTitle}
            className="is-commercial"
            action={<RangeBar range={range} onChange={setRange} />}
          >
            <div className="ssp-kpi-grid">
              <Metric
                label={he.sspMetricReportsInRange}
                value={rangeSubs.length}
                to="/app/ssp/activity"
                icon={Send}
                tone={sspKpiTone("ok", rangeSubs.length)}
              />
              <Metric
                label={he.sspMetricSubOverdue}
                value={data.submissions_overdue ?? 0}
                to="/app/ssp/assignments"
                icon={Clock}
                tone={sspKpiTone("danger", data.submissions_overdue ?? 0)}
              />
              <Metric
                label={he.sspMetricUserJoins}
                value={pendingJoins}
                to="/app/ssp/enrollments"
                search={{ status: "pending" }}
                icon={ClipboardList}
                tone={sspKpiTone("warning", pendingJoins)}
              />
              {canEvents ? (
                <Metric
                  label={he.sspMetricOpenEvents}
                  value={data.open_events}
                  to="/app/ssp/events"
                  icon={Radio}
                  tone={sspKpiTone("danger", data.open_events)}
                />
              ) : null}
              {canPatrols ? (
                <Metric
                  label={he.sspMetricLateRuns}
                  value={data.runs.late}
                  to="/app/ssp/patrols"
                  icon={Clock}
                  tone={sspKpiTone("danger", data.runs.late)}
                />
              ) : null}
            </div>
          </DashboardZone>

          <article className="ops-kpi-card ssp-org-card" data-testid="ssp-org-structure">
            <p className="ssp-org-card-title">{he.sspOrgStructureTitle}</p>
            <ul className="ssp-org-list">
              <li>
                <Link to="/app/ssp/users" className="ssp-org-row">
                  <strong>{data.users_active ?? data.officers ?? 0}</strong>
                  <span>{he.sspMetricUsersActive}</span>
                </Link>
              </li>
              <li>
                <Link to="/app/ssp/offices" className="ssp-org-row">
                  <strong>{data.offices_active ?? data.sites_active ?? 0}</strong>
                  <span>{he.sspMetricOfficesActive}</span>
                </Link>
              </li>
              <li>
                <Link to="/app/ssp/sites" className="ssp-org-row">
                  <strong>{siteItems.length}</strong>
                  <span>{he.sspMetricSitesTotal}</span>
                </Link>
              </li>
            </ul>
          </article>

          <DashboardZone id="ssp-secondary" label={he.sspSecondaryMetrics} className="is-ops">
            <div className="ssp-kpi-grid">
              <Metric
                label={he.sspMetricFormsPublished}
                value={data.forms_published ?? 0}
                to="/app/ssp/forms"
                icon={FileText}
                tone={sspKpiTone("ok", data.forms_published ?? 0)}
              />
              <Metric
                label={he.sspMetricAssignmentsActive}
                value={data.site_assignments_active ?? 0}
                to="/app/ssp/assignments"
                icon={ClipboardList}
                tone={sspKpiTone("ok", data.site_assignments_active ?? 0)}
              />
              {deviceStepDone ? (
                <Metric
                  label={he.sspMetricDevicesActive}
                  value={data.devices_active ?? 0}
                  to="/app/ssp/devices"
                  icon={Smartphone}
                  tone={sspKpiTone("ok", data.devices_active ?? 0)}
                />
              ) : null}
              {sspCan("ssp.officers.view") ? (
                <Metric label={he.sspMetricOfficers} value={data.officers} to="/app/ssp/officers" icon={Users} tone={sspKpiTone("ok", data.officers)} />
              ) : null}
              {sspCan("ssp.checkpoints.view") ? (
                <Metric
                  label={he.sspMetricCheckpoints}
                  value={data.checkpoints_active}
                  to="/app/ssp/checkpoints"
                  icon={Radio}
                  tone={sspKpiTone("ok", data.checkpoints_active)}
                />
              ) : null}
            </div>
          </DashboardZone>
        </div>
      ) : null}

      {idleFeeds ? (
        <section className="ssp-idle-row" data-testid="ssp-idle-feeds" aria-label={he.sspIdleFeedsEmpty}>
          <p>{he.sspIdleFeedsEmpty}</p>
        </section>
      ) : (
        <>
          <DashboardZone id="ssp-timeline" label={he.sspTimelineTitle}>
            {feedsLoading ? <p className="text-sm text-fg-muted">{he.loading}</p> : null}
            {!timeline.length && !feedsLoading ? <CompactEmpty message={he.sspNoTimeline} /> : (
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
                <CompactEmpty message={he.sspNoPending} />
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
            ) : !rangeSubs.length ? (
              <CompactEmpty message={he.sspNoSubmissions} actionTo="/app/ssp/assignments" actionLabel={he.sspViewAssignments} />
            ) : (
              <ul className="divide-y divide-border rounded-[var(--radius-card)] border border-border bg-bg-1">
                {rangeSubs.slice(0, 8).map((row) => (
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
        </>
      )}

      <DashboardZone id="ssp-site-activity" label={he.sspSiteActivityTitle}>
        {sites.isError ? (
          <ErrorState title={he.apiUnavailable} description={he.sspWaitingLocalDb} />
        ) : !siteItems.length ? (
          <p className="ss-module-empty-text">{he.sspNoSites}</p>
        ) : (
          <ul className="divide-y divide-border rounded-[var(--radius-card)] border border-border bg-bg-1">
            {siteItems.slice(0, 12).map((site) => {
              const kind = sspSiteActivityKind(site);
              const label =
                kind === "no_form"
                  ? he.sspSiteNoFormAssigned
                  : kind === "overdue"
                    ? he.sspSiteOverdueExec
                    : kind === "pending"
                      ? he.sspActivationAwaiting
                      : kind === "reporting"
                        ? he.sspSiteReporting
                        : he.sspSiteQuiet;
              return (
                <li key={site.id} className="ssp-site-row">
                  <Link to="/app/ssp/sites/$siteId" params={{ siteId: site.id }} className="min-w-0 flex-1 hover:underline">
                    <p className="font-medium text-fg">{site.name}</p>
                    <p className="text-xs text-fg-muted">
                      {he.sspSiteMembers} {site.members_count ?? 0} · {he.sspAssignedForms}{" "}
                      {site.assigned_forms_count ?? 0} · {he.sspSubmissionsCount} {site.submissions_count ?? 0}
                      {site.overdue_count ? ` · ${he.sspMetricSubOverdue} ${site.overdue_count}` : ""}
                    </p>
                  </Link>
                  <span className={`text-xs ${sspSiteToneClass(kind)}`}>{label}</span>
                  {kind === "no_form" ? (
                    <Link to="/app/ssp/assignments" className="ssp-site-assign">
                      {he.sspAssignFormShort}
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </DashboardZone>

      {(canEvents || canPatrols) &&
      (events.isError || lateRuns.isError || sspShowExceptionsSection(openEvents.length, late.length)) ? (
        <DashboardZone id="ssp-open-exceptions" label={he.sspExceptionsTitle} className="is-ops">
          {events.isError || lateRuns.isError ? <ErrorState title={he.apiUnavailable} /> : null}
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
    </div>
  );
}

function RangeBar({
  range,
  onChange,
}: {
  range: SspDashRange;
  onChange: (next: SspDashRange) => void;
}) {
  return (
    <div className="ssp-range-bar" role="group" aria-label={he.sspRangeLabel}>
      <span className="ssp-range-bar-label">{he.sspRangePrefix}</span>
      {(
        [
          ["today", he.sspRangeToday],
          ["7d", he.sspRange7d],
          ["30d", he.sspRange30d],
        ] as const
      ).map(([key, label]) => (
        <Button
          key={key}
          type="button"
          variant={range === key ? "primary" : "secondary"}
          aria-pressed={range === key}
          onClick={() => onChange(key)}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}

function QuickMore({ items }: { items: Array<{ to: string; label: string }> }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="ssp-quick-more" ref={wrap}>
      <button
        type="button"
        className="ssp-quick-btn"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        {he.sspQuickMore}
      </button>
      {open ? (
        <div className="ssp-quick-more-menu" role="menu">
          {items.map((item) => (
            <Link key={item.to} to={item.to as never} className="ssp-quick-more-item" role="menuitem" onClick={() => setOpen(false)}>
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CompactEmpty({
  message,
  actionTo,
  actionLabel,
}: {
  message: string;
  actionTo?: string;
  actionLabel?: string;
}) {
  return (
    <div className="ssp-empty-compact">
      <p>{message}</p>
      {actionTo && actionLabel ? (
        <Link to={actionTo as never} className="ssp-quick-btn">
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

function Metric({
  label,
  value,
  to,
  icon: Icon,
  tone = "muted",
  search,
}: {
  label: string;
  value: number;
  to: string;
  icon: LucideIcon;
  tone?: "ok" | "warning" | "danger" | "muted";
  search?: Record<string, string>;
}) {
  const valueTone =
    tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : tone === "ok" ? "text-success" : "text-fg-muted";
  const iconTone =
    tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : tone === "ok" ? "text-success" : "text-fg-subtle";
  const cardTone = tone === "warning" ? " is-warning" : tone === "danger" ? " is-danger" : tone === "ok" ? " is-ok" : " is-muted";

  return (
    <Link
      to={to as never}
      search={search as never}
      className={`ops-kpi-card ops-card-interactive ssp-kpi-link${cardTone}`}
      aria-label={he.sspKpiAria(label, value)}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-fg-muted">{label}</p>
        <Icon className={`size-4 shrink-0 ${iconTone}`} aria-hidden />
      </div>
      <p className={`public-mono mt-2 text-2xl font-semibold tracking-[-0.03em] tabular-nums ${valueTone}`}>{value}</p>
    </Link>
  );
}
