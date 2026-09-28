import type { JobAssigneeOut, JobOut, ProjectOut } from "@site-secure/api-client";
import { he } from "../i18n/he";

/** Authoritative project lifecycle values shown in filters / status patch UI. */
export const PROJECT_STATUS_VALUES = [
  "draft",
  "planned",
  "in_progress",
  "on_hold",
  "completed",
  "cancelled",
] as const;

export type ProjectStatusValue = (typeof PROJECT_STATUS_VALUES)[number];

/** Open field work — mirrors apps/api/app/job_lifecycle.py OPEN_JOB_STATUSES. */
export const PROJECT_ACTIVE_JOB_STATUSES = new Set([
  "scheduled",
  "en_route",
  "arrived",
  "in_progress",
  "blocked",
]);

export type ProjectJobSummary = {
  total: number;
  active: number;
  completed: number;
  unassigned: number;
};

export function currentJobAssignee(job: Pick<JobOut, "assignees" | "is_assigned">): JobAssigneeOut | null {
  const assignees = job.assignees ?? [];
  if (assignees.length === 0) return null;
  return assignees[0] ?? null;
}

export function jobIsUnassigned(job: Pick<JobOut, "assignees" | "is_assigned">): boolean {
  if (typeof job.is_assigned === "boolean") return !job.is_assigned;
  return (job.assignees?.length ?? 0) === 0;
}

export function deriveProjectJobSummary(jobs: JobOut[]): ProjectJobSummary {
  let active = 0;
  let completed = 0;
  let unassigned = 0;
  for (const job of jobs) {
    if (PROJECT_ACTIVE_JOB_STATUSES.has(job.status)) active += 1;
    if (job.status === "completed") completed += 1;
    if (jobIsUnassigned(job)) unassigned += 1;
  }
  return { total: jobs.length, active, completed, unassigned };
}

export function formatProjectJobSummary(summary: ProjectJobSummary): string {
  if (summary.total === 0) return he.projectJobsSummaryEmpty;
  const parts = [he.projectJobsCount(summary.total)];
  if (summary.active > 0) parts.push(he.projectJobsActiveCount(summary.active));
  if (summary.completed > 0) parts.push(he.projectJobsCompletedCount(summary.completed));
  if (summary.unassigned > 0) parts.push(he.projectJobsUnassignedCount(summary.unassigned));
  return parts.join(" · ");
}

export function jobStatusTone(
  status: string,
): "warning" | "info" | "neutral" | "success" | "danger" {
  if (status === "completed") return "success";
  if (status === "cancelled") return "neutral";
  if (status === "blocked") return "danger";
  if (status === "en_route" || status === "arrived" || status === "in_progress") return "warning";
  if (status === "scheduled") return "info";
  return "neutral";
}

export function projectStatusTone(
  status: string,
): "warning" | "info" | "neutral" | "success" | "danger" {
  if (status === "completed") return "success";
  if (status === "cancelled") return "neutral";
  if (status === "on_hold") return "warning";
  if (status === "in_progress") return "info";
  if (status === "planned") return "info";
  return "neutral";
}

export type ProjectListContext = {
  customerName?: string | null;
  siteName?: string | null;
};

/** Dense row subtitle: customer · site — no invented fields. */
export function formatProjectListMeta(
  project: Pick<ProjectOut, "customer_id" | "site_id">,
  ctx: ProjectListContext = {},
): string {
  const customer =
    ctx.customerName?.trim() ||
    (project.customer_id ? he.projectNotDefined : "");
  const site = project.site_id
    ? ctx.siteName?.trim() || he.projectNotDefined
    : he.projectNoSite;
  if (!customer) return site;
  return `${customer} · ${site}`;
}

export function formatJobScheduleWindow(
  start?: string | null,
  end?: string | null,
): string | null {
  if (!start) return null;
  const startDate = new Date(start);
  if (Number.isNaN(startDate.getTime())) return null;
  const day = startDate.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" });
  const startTime = startDate.toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  if (!end) return `${day} · ${startTime}`;
  const endDate = new Date(end);
  if (Number.isNaN(endDate.getTime())) return `${day} · ${startTime}`;
  const endTime = endDate.toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${day} · ${startTime}–${endTime}`;
}
