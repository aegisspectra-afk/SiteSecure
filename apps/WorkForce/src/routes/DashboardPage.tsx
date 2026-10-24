import { Link, Navigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import type { WorkforceWeekOut } from "@site-secure/api-client";
import { EmptyRows, ErrorState, ModuleScaffold, useQuery } from "../components/Kit";
import { he } from "../i18n/he";
import { can } from "../lib/can";
import {
  blockingIssues,
  coveragePercent,
  coverageRows,
  formatCount,
  formatHours,
  nightShiftCount,
  pendingTimeOff,
  plannedHours,
  uncoveredSlots,
  unfilledSlotCount,
  weeklyAssignmentCount,
  type CoverageCell,
} from "../lib/dashboard-metrics";
import { queryErrorDescription } from "../lib/query-error";
import { useSession } from "../lib/session";
import { addDays, formatDayHeading, formatTimeRange, formatWeekLabel, startOfWeekSunday, toIso, weekDays } from "../lib/week";

export function DashboardPage() {
  const { session, api } = useSession();
  const membership = session?.memberships[0];
  const workspaceId = membership?.workspace_id;
  const features = membership?.features ?? [];
  const grants = membership?.permissions ?? null;
  const canViewOps = can(membership?.role_key, "workforce.view", features, grants);
  const canSchedules = can(membership?.role_key, "workforce.schedules.view", features, grants);
  const canSites = can(membership?.role_key, "workforce.sites.view", features, grants);
  const [weekStart, setWeekStart] = useState(() => startOfWeekSunday(new Date()));
  const [siteId, setSiteId] = useState("");
  const [selectedCell, setSelectedCell] = useState<CoverageCell | null>(null);
  const weekEnd = addDays(weekStart, 7);
  const days = weekDays(weekStart);

  const summaryQuery = useQuery({
    queryKey: ["workforce-summary", workspaceId],
    enabled: Boolean(workspaceId && canViewOps),
    queryFn: () => api.getWorkforceSummary(workspaceId!),
  });
  const tablesReady = summaryQuery.isSuccess;
  const weekQuery = useQuery({
    queryKey: ["workforce-week", workspaceId, weekStart.toISOString()],
    enabled: Boolean(workspaceId && canViewOps && canSchedules && tablesReady),
    queryFn: () => api.listWorkforceWeek(workspaceId!, { startsFrom: toIso(weekStart), startsTo: toIso(weekEnd) }),
  });
  const sitesQuery = useQuery({
    queryKey: ["workforce-sites", workspaceId, "dashboard"],
    enabled: Boolean(workspaceId && canViewOps && canSites && tablesReady),
    queryFn: () => api.listWorkforceSites(workspaceId!),
  });
  const timeOffQuery = useQuery({
    queryKey: ["workforce-time-off", workspaceId, weekStart.toISOString()],
    enabled: Boolean(workspaceId && canViewOps && canSchedules && tablesReady),
    queryFn: () => api.listWorkforceTimeOff(workspaceId!, { startsFrom: toIso(weekStart), startsTo: toIso(weekEnd) }),
  });

  if (!canViewOps) {
    return <Navigate to="/my-shifts" />;
  }

  const week: WorkforceWeekOut | undefined = weekQuery.data;
  const mapRows = useMemo(
    () => (week ? coverageRows(week, days, siteId) : []),
    [week, days, siteId],
  );

  const siteOptions = sitesQuery.data?.items ?? [];

  return (
    <ModuleScaffold title={he.dashboardTitle} lead={he.dashboardLead}>
      <section className="wf-ops-filters" aria-label={he.filterWeek}>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="wf-ops-chip" onClick={() => setWeekStart((current) => addDays(current, -7))}>
            {he.weekPrev}
          </button>
          <p className="text-sm font-medium text-fg">{formatWeekLabel(weekStart)}</p>
          <button type="button" className="wf-ops-chip" onClick={() => setWeekStart((current) => addDays(current, 7))}>
            {he.weekNext}
          </button>
          <button type="button" className="wf-ops-chip" onClick={() => setWeekStart(startOfWeekSunday(new Date()))}>
            {he.weekThis}
          </button>
        </div>
        <label className="wf-ops-filter-field">
          <span>{he.filterUnit}</span>
          <select value={siteId} onChange={(event) => { setSiteId(event.target.value); setSelectedCell(null); }}>
            <option value="">{he.filterAllOrg}</option>
            {siteOptions.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      {summaryQuery.isError ? (
        <ErrorState title={he.loadError} description={queryErrorDescription(summaryQuery.error)} />
      ) : summaryQuery.isLoading ? (
        <p className="text-sm text-fg-muted">{he.loading}</p>
      ) : (
        <div className="wf-kpi-grid">
          <Kpi label={he.metricEmployees} hint={he.metricEmployeesHint} value={formatCount(summaryQuery.data?.employees_active ?? 0)} to="/employees" />
          <Kpi label={he.metricSubmitted} unavailable={he.submissionsUnavailable} />
          <Kpi label={he.metricUnsubmitted} unavailable={he.submissionsUnavailable} />
          <Kpi
            label={he.metricUnfilled}
            hint={he.metricUnfilledHint}
            value={canSchedules && week ? formatCount(unfilledSlotCount(week.slots, siteId)) : null}
            unavailable={canSchedules ? undefined : he.metricUnavailable}
            to="/schedules"
          />
          <Kpi
            label={he.metricAssignments}
            hint={he.metricAssignmentsHint}
            value={canSchedules && week ? formatCount(weeklyAssignmentCount(week.assignments, siteId)) : null}
            to="/schedules"
          />
          <Kpi
            label={he.metricHours}
            hint={he.metricHoursHint}
            value={canSchedules && week ? formatHours(plannedHours(week.assignments, siteId)) : null}
            to="/schedules"
          />
          <Kpi
            label={he.metricNights}
            hint={he.metricNightsHint}
            value={canSchedules && week ? formatCount(nightShiftCount(week.assignments, siteId)) : null}
            to="/schedules"
          />
          <Kpi label={he.metricPublished} unavailable={he.publishedUnavailable} />
        </div>
      )}

      {canSchedules && !summaryQuery.isError ? (
        <section className="wf-ops-panel" aria-labelledby="coverage-heading">
          <div className="wf-ops-panel-head">
            <div>
              <h2 id="coverage-heading" className="wf-ops-heading">{he.coverageTitle}</h2>
              <p className="text-xs text-fg-muted">{he.coverageLead}</p>
            </div>
            <div className="wf-cov-legend">
              <span data-tone="full">{he.coverageFull}</span>
              <span data-tone="partial">{he.coveragePartial}</span>
              <span data-tone="gap">{he.coverageGap}</span>
              <span data-tone="none">{he.coverageNone}</span>
            </div>
          </div>
          {weekQuery.isError ? (
            <ErrorState title={he.loadError} description={queryErrorDescription(weekQuery.error)} />
          ) : weekQuery.isLoading ? (
            <p className="text-sm text-fg-muted">{he.loading}</p>
          ) : !mapRows.length ? (
            <EmptyRows message={he.coverageEmpty} />
          ) : (
            <div className="wf-cov-scroll">
              <table className="wf-cov-table">
                <thead>
                  <tr>
                    <th>{he.filterUnit}</th>
                    {days.map((day) => (
                      <th key={day.toISOString()}>{formatDayHeading(day)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mapRows.map((row) => (
                    <tr key={row.siteId}>
                      <th scope="row">{row.siteName}</th>
                      {row.cells.map((cell) => {
                        const percent = coveragePercent(cell.required, cell.assigned);
                        return (
                          <td key={`${row.siteId}-${cell.dayIndex}`}>
                            <button
                              type="button"
                              className="wf-cov-cell"
                              data-tone={cell.tone}
                              disabled={cell.tone === "none"}
                              onClick={() => setSelectedCell(cell)}
                            >
                              <strong>{percent ?? "—"}</strong>
                              <span>
                                {cell.tone === "none"
                                  ? he.coverageNone
                                  : `${cell.assigned}/${cell.required}`}
                              </span>
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {selectedCell && selectedCell.slots.length ? (
            <div className="wf-ops-subpanel">
              <h3 className="wf-ops-heading">{he.missingShiftsTitle}</h3>
              <ul className="wf-attention-list">
                {selectedCell.slots.map((slot) => (
                  <li key={slot.id}>
                    <span>
                      {slot.position_name || slot.site_name} · {formatTimeRange(slot.starts_at, slot.ends_at)}
                    </span>
                    <span className="text-fg-muted">
                      {slot.assigned_count}/{slot.required_count}
                    </span>
                  </li>
                ))}
              </ul>
              <Link className="text-sm text-action underline" to="/schedules">
                {he.navSchedules}
              </Link>
            </div>
          ) : null}
        </section>
      ) : null}

      {canSchedules && !summaryQuery.isError ? (
        <section className="wf-ops-panel" aria-labelledby="attention-heading">
          <h2 id="attention-heading" className="wf-ops-heading">{he.attentionTitle}</h2>
          <div className="wf-attention-grid">
            <AttentionCard
              title={he.attentionUnfilled}
              items={week ? uncoveredSlots(week.slots, siteId) : []}
              to="/schedules"
              loading={weekQuery.isLoading}
            />
            <AttentionCard
              title={he.attentionTimeOff}
              items={timeOffQuery.data ? pendingTimeOff(timeOffQuery.data.items) : []}
              to="/time-off"
              loading={timeOffQuery.isLoading}
            />
            <AttentionCard
              title={he.attentionIssues}
              items={week ? blockingIssues(week, siteId) : []}
              to="/schedules"
              loading={weekQuery.isLoading}
            />
            <AttentionCard title={he.attentionSubmissions} unavailable={he.submissionsUnavailable} />
            <AttentionCard title={he.attentionPublish} unavailable={he.publishedUnavailable} />
          </div>
        </section>
      ) : null}
    </ModuleScaffold>
  );
}

function Kpi({
  label,
  hint,
  value,
  unavailable,
  to,
}: {
  label: string;
  hint?: string;
  value?: string | null;
  unavailable?: string;
  to?: "/employees" | "/schedules";
}) {
  const body = (
    <>
      <p className="text-xs text-fg-muted">{label}</p>
      {unavailable ? (
        <p className="mt-1 text-lg font-semibold text-fg-muted">—</p>
      ) : (
        <p className="mt-1 text-2xl font-semibold tabular-nums text-fg">{value ?? "—"}</p>
      )}
      <p className="mt-1 text-[11px] leading-5 text-fg-muted">{unavailable ?? hint}</p>
    </>
  );
  if (to && !unavailable) {
    return (
      <Link to={to} className="wf-kpi-card">
        {body}
      </Link>
    );
  }
  return <div className="wf-kpi-card">{body}</div>;
}

function AttentionCard({
  title,
  items,
  to,
  unavailable,
  loading,
}: {
  title: string;
  items?: { id: string; title: string; meta: string }[];
  to?: "/schedules" | "/time-off";
  unavailable?: string;
  loading?: boolean;
}) {
  return (
    <div className="wf-attention-card">
      <div className="flex items-baseline justify-between gap-2">
        <h3>{title}</h3>
        {to && !unavailable ? (
          <Link className="text-xs text-action underline" to={to}>
            {he.attentionSeeAll}
          </Link>
        ) : null}
      </div>
      {unavailable ? (
        <p className="text-xs text-fg-muted">{unavailable}</p>
      ) : loading ? (
        <p className="text-xs text-fg-muted">{he.loading}</p>
      ) : !items?.length ? (
        <p className="text-xs text-fg-muted">{he.attentionEmpty}</p>
      ) : (
        <ul className="wf-attention-list">
          {items.map((item) => (
            <li key={item.id}>
              <span>{item.title}</span>
              <span className="text-fg-muted">{item.meta}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
