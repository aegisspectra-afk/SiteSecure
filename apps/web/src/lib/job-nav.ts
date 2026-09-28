import { he } from "../i18n/he";
import { homeVariant } from "./home";

/** How FieldJob was opened — drives contextual back (JOB-3 / JOB-4). */
export type JobNavFrom = "jobs" | "today" | "project";

export type JobNavSearch = {
  from?: JobNavFrom;
  projectId?: string;
};

export type FieldJobBackTarget =
  | { kind: "jobs"; to: "/app/jobs"; label: string }
  | { kind: "today"; to: "/app/today"; label: string }
  | { kind: "project"; to: "/app/projects/$projectId"; projectId: string; label: string }
  | { kind: "projects"; to: "/app/projects"; label: string };

export function parseJobNavSearch(search: Record<string, unknown>): JobNavSearch {
  const fromRaw = typeof search.from === "string" ? search.from : undefined;
  const from: JobNavFrom | undefined =
    fromRaw === "jobs" || fromRaw === "today" || fromRaw === "project" ? fromRaw : undefined;
  const projectId =
    typeof search.projectId === "string" && search.projectId.trim()
      ? search.projectId.trim()
      : undefined;
  return { from, projectId };
}

/**
 * Resolve FieldJob back control.
 * Explicit `from` wins; otherwise technicians stay on Today continuity and
 * managers return to the Jobs inventory (not forced through Today).
 */
export function resolveFieldJobBack(opts: {
  from?: JobNavFrom;
  projectId?: string | null;
  roleKey?: string;
}): FieldJobBackTarget {
  const { from, projectId, roleKey } = opts;
  if (from === "jobs") {
    return { kind: "jobs", to: "/app/jobs", label: he.navJobs };
  }
  if (from === "today") {
    return { kind: "today", to: "/app/today", label: he.navToday };
  }
  if (from === "project") {
    if (projectId) {
      return {
        kind: "project",
        to: "/app/projects/$projectId",
        projectId,
        label: he.fieldBackToProject,
      };
    }
    return { kind: "projects", to: "/app/projects", label: he.navProjects };
  }
  if (homeVariant(roleKey) === "today") {
    return { kind: "today", to: "/app/today", label: he.navToday };
  }
  return { kind: "jobs", to: "/app/jobs", label: he.navJobs };
}

export function jobOpenSearch(from: JobNavFrom, projectId?: string): JobNavSearch {
  if (from === "project" && projectId) return { from, projectId };
  return { from };
}
