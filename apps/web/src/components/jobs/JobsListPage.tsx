import { ApiClientError } from "@site-secure/api-client";
import { Button, ErrorState, Input, Select } from "@site-secure/ui";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { he } from "../../i18n/he";
import { can } from "../../lib/can";
import { homeVariant } from "../../lib/home";
import {
  deriveProjectJobSummary,
  formatProjectJobSummary,
} from "../../lib/project-workspace";
import { useSession } from "../../lib/session";
import { JobWorkCard } from "./JobWorkCard";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: he.jobsFilterStatusAll },
  { value: "active", label: he.jobsFilterStatusActive },
  { value: "scheduled", label: he.jobStatuses.scheduled },
  { value: "en_route", label: he.jobStatuses.en_route },
  { value: "arrived", label: he.jobStatuses.arrived },
  { value: "in_progress", label: he.jobStatuses.in_progress },
  { value: "blocked", label: he.jobStatuses.blocked },
  { value: "completed", label: he.jobStatuses.completed },
  { value: "cancelled", label: he.jobStatuses.cancelled },
];

const ASSIGNMENT_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: he.jobsFilterAssignmentAll },
  { value: "assigned", label: he.jobsFilterAssignmentAssigned },
  { value: "unassigned", label: he.jobsFilterAssignmentUnassigned },
];

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function JobsListSkeleton() {
  return (
    <div className="jobs-list-skeleton" aria-busy="true" aria-live="polite" data-testid="jobs-list-loading">
      <p className="jobs-list-skeleton-label">{he.jobsListLoading}</p>
      <div className="jobs-list-skeleton-row" />
      <div className="jobs-list-skeleton-row" />
      <div className="jobs-list-skeleton-row is-short" />
    </div>
  );
}

export function JobsListPage() {
  const { session, api } = useSession();
  const membership = session?.memberships[0];
  const workspaceId = membership?.workspace_id;
  const roleKey = membership?.role_key;
  const features = membership?.features ?? [];
  const permissions = membership?.permissions;
  const fieldHome = homeVariant(roleKey) === "today";

  const canProjects = !fieldHome && can(roleKey, "projects.view", features, permissions);
  const canCustomers = can(roleKey, "crm.view", features, permissions);
  const canSites = can(roleKey, "sites.view", features, permissions);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [assignment, setAssignment] = useState("");
  const debouncedQ = useDebouncedValue(q, 300);

  const filtersActive = Boolean(q.trim() || status || (!fieldHome && assignment));
  const queryFiltersActive = Boolean(
    debouncedQ.trim() || status || (!fieldHome && assignment),
  );

  const jobsQuery = useQuery({
    queryKey: [
      "jobs-list",
      workspaceId,
      debouncedQ,
      status,
      fieldHome ? "" : assignment,
    ],
    enabled: Boolean(workspaceId),
    placeholderData: keepPreviousData,
    queryFn: () =>
      api.listJobs(workspaceId!, {
        q: debouncedQ.trim() || undefined,
        status: status || undefined,
        assignment:
          !fieldHome && (assignment === "assigned" || assignment === "unassigned")
            ? assignment
            : undefined,
        include_assignees: true,
        include_context: true,
        limit: 100,
      }),
  });

  const jobs = jobsQuery.data?.items ?? [];
  const summary = useMemo(() => deriveProjectJobSummary(jobs), [jobs]);
  const summaryLabel = formatProjectJobSummary(summary);

  function resetFilters() {
    setQ("");
    setStatus("");
    setAssignment("");
  }

  if (!workspaceId) return <ErrorState title={he.jobsListError} />;

  return (
    <div className="jobs-list-page" data-testid="jobs-list-page">
      <header className="jobs-list-header">
        <div>
          <h1 className="jobs-list-title">{he.jobsListTitle}</h1>
          <p className="jobs-list-lead">{fieldHome ? he.jobsListLeadField : he.jobsListLead}</p>
        </div>
        {!jobsQuery.isLoading && !jobsQuery.isError ? (
          <p className="jobs-list-summary" data-testid="jobs-list-summary">
            <span className="jobs-list-summary-scope">{he.jobsListSummaryScope}</span>
            <span>{summaryLabel}</span>
          </p>
        ) : null}
      </header>

      <div className="jobs-list-filters" data-testid="jobs-list-filters">
        <Input
          id="jobs-search"
          label={he.jobsListSearch}
          value={q}
          onChange={(ev) => setQ(ev.target.value)}
          placeholder={he.jobsListSearchPlaceholder}
        />
        <Select
          id="jobs-status"
          label={he.jobsFilterStatus}
          value={status}
          onChange={(ev) => setStatus(ev.target.value)}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value || "all"} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
        {!fieldHome ? (
          <Select
            id="jobs-assignment"
            label={he.jobsFilterAssignment}
            value={assignment}
            onChange={(ev) => setAssignment(ev.target.value)}
          >
            {ASSIGNMENT_OPTIONS.map((opt) => (
              <option key={opt.value || "all-assign"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        ) : null}
        {filtersActive ? (
          <div className="jobs-list-filter-reset">
            <Button type="button" variant="secondary" onClick={resetFilters}>
              {he.jobsFilterReset}
            </Button>
          </div>
        ) : null}
      </div>

      {jobsQuery.isLoading ? (
        <JobsListSkeleton />
      ) : jobsQuery.isError ? (
        <div className="jobs-list-error" data-testid="jobs-list-error">
          <ErrorState
            title={
              jobsQuery.error instanceof ApiClientError
                ? jobsQuery.error.message
                : he.jobsListError
            }
            action={
              <Button type="button" variant="secondary" onClick={() => void jobsQuery.refetch()}>
                {he.retry}
              </Button>
            }
          />
        </div>
      ) : jobs.length === 0 && !queryFiltersActive ? (
        <div className="jobs-list-empty" data-testid="jobs-list-empty">
          <p className="jobs-list-empty-title">{he.jobsListEmptyTitle}</p>
          <p className="jobs-list-empty-body">
            {fieldHome ? he.jobsListEmptyBodyField : he.jobsListEmptyBody}
          </p>
          {canProjects ? (
            <Link
              to="/app/projects"
              search={{ quoteId: undefined, customerId: undefined, siteId: undefined }}
              className="jobs-list-empty-link"
            >
              {he.navProjects}
            </Link>
          ) : null}
        </div>
      ) : jobs.length === 0 ? (
        <div className="jobs-list-empty" data-testid="jobs-list-filtered-empty">
          <p className="jobs-list-empty-title">{he.jobsListFilteredEmptyTitle}</p>
          <p className="jobs-list-empty-body">{he.jobsListFilteredEmptyBody}</p>
          <div className="mt-3">
            <Button type="button" variant="secondary" onClick={resetFilters}>
              {he.jobsFilterReset}
            </Button>
          </div>
        </div>
      ) : (
        <ul className="jobs-list-rows" data-testid="jobs-list-rows">
          {jobs.map((job) => (
            <li key={job.id}>
              <JobWorkCard
                job={job}
                showContext
                canOpenProject={canProjects}
                canOpenCustomer={canCustomers}
                canOpenSite={canSites}
                quieter={job.status === "completed" || job.status === "cancelled"}
                openFrom="jobs"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
