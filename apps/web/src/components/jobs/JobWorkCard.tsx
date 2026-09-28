import { Status } from "@site-secure/ui";
import type { JobOut } from "@site-secure/api-client";
import { Link } from "@tanstack/react-router";
import { he } from "../../i18n/he";
import { jobOpenSearch, type JobNavFrom } from "../../lib/job-nav";
import {
  currentJobAssignee,
  formatJobScheduleWindow,
  jobIsUnassigned,
  jobStatusTone,
} from "../../lib/project-workspace";

function jobStatusLabel(status: string): string {
  return he.jobStatuses[status as keyof typeof he.jobStatuses] ?? status;
}

export type JobWorkCardProps = {
  job: JobOut;
  /** Show customer / site / project context (global Jobs list). */
  showContext?: boolean;
  canOpenProject?: boolean;
  canOpenCustomer?: boolean;
  canOpenSite?: boolean;
  quieter?: boolean;
  /** Contextual back source when opening FieldJob. */
  openFrom?: JobNavFrom;
  /** Required when openFrom is "project". */
  projectId?: string;
};

/**
 * Shared operational Job row for Project workspace and global Jobs list.
 * Display-only — no lifecycle mutations.
 */
export function JobWorkCard({
  job,
  showContext = false,
  canOpenProject = false,
  canOpenCustomer = false,
  canOpenSite = false,
  quieter = false,
  openFrom,
  projectId,
}: JobWorkCardProps) {
  const assignee = currentJobAssignee(job);
  const unassigned = jobIsUnassigned(job);
  const schedule = formatJobScheduleWindow(job.scheduled_for, job.scheduled_end);
  const assigneeLabel = unassigned
    ? he.projectJobUnassigned
    : (assignee?.display_name?.trim() || he.projectJobAssigned);
  const customerLabel = job.customer_name?.trim() || null;
  const siteLabel = job.site_name?.trim() || null;
  const projectLabel = job.project_name?.trim() || null;
  const openSearch = openFrom
    ? jobOpenSearch(openFrom, openFrom === "project" ? projectId ?? job.project_id ?? undefined : undefined)
    : undefined;

  return (
    <article
      className={`project-job-card jobs-list-card${quieter ? " is-quiet" : ""}${unassigned ? " is-unassigned" : ""}`}
      data-testid="project-job-card"
      data-job-id={job.id}
      data-quiet={quieter ? "true" : undefined}
    >
      <div className="project-job-card-main">
        <div className="project-job-card-top">
          <p className="public-mono text-xs text-fg-muted" dir="ltr">
            <bdi>{job.number}</bdi>
          </p>
          <Status label={jobStatusLabel(job.status)} tone={jobStatusTone(job.status)} />
        </div>
        <h3 className="project-job-card-title">{job.title}</h3>
        {showContext ? (
          <div className="jobs-list-card-context" data-testid="job-context">
            {customerLabel && job.customer_id && canOpenCustomer ? (
              <Link
                to="/app/customers/$customerId"
                params={{ customerId: job.customer_id }}
                className="jobs-list-context-link"
              >
                {customerLabel}
              </Link>
            ) : (
              <span>{customerLabel || he.projectNotDefined}</span>
            )}
            <span className="project-workspace-context-sep" aria-hidden>
              ·
            </span>
            {siteLabel && job.site_id && canOpenSite ? (
              <Link
                to="/app/sites/$siteId"
                params={{ siteId: job.site_id }}
                className="jobs-list-context-link"
              >
                {siteLabel}
              </Link>
            ) : (
              <span>{siteLabel || he.projectNotDefined}</span>
            )}
            {job.project_id ? (
              <>
                <span className="project-workspace-context-sep" aria-hidden>
                  ·
                </span>
                {projectLabel && canOpenProject ? (
                  <Link
                    to="/app/projects/$projectId"
                    params={{ projectId: job.project_id }}
                    className="jobs-list-context-link"
                  >
                    {projectLabel}
                  </Link>
                ) : (
                  <span>{projectLabel || he.navProjects}</span>
                )}
              </>
            ) : null}
          </div>
        ) : null}
        <div className="project-job-card-meta">
          <span className={unassigned ? "text-fg-muted jobs-list-unassigned" : "text-fg"}>
            {assigneeLabel}
          </span>
          {schedule ? (
            <span className="public-mono text-fg-muted" dir="ltr">
              <bdi>{schedule}</bdi>
            </span>
          ) : (
            <span className="text-fg-muted">{he.fieldNoSchedule}</span>
          )}
        </div>
      </div>
      <div className="project-job-card-action">
        <Link
          to="/app/jobs/$jobId"
          params={{ jobId: job.id }}
          search={openSearch}
          className="project-job-open"
          data-testid="project-job-open"
        >
          {he.openLinkedJob}
        </Link>
      </div>
    </article>
  );
}
