import type { TaskOut } from "@site-secure/api-client";
import { he } from "../i18n/he";

export type TasksStatusFilter = "open" | "all";

export function taskStatusLabel(status: string): string {
  switch (status) {
    case "open":
      return he.tasksStatusOpen;
    case "done":
      return he.tasksStatusDone;
    case "cancelled":
      return he.tasksStatusCancelled;
    default:
      return status;
  }
}

export function taskTypeLabel(type: string): string {
  switch (type) {
    case "visit":
      return he.tasksTypeVisit;
    case "follow_up":
      return he.tasksTypeFollowUp;
    case "call":
      return he.tasksTypeCall;
    case "review_request":
      return he.tasksTypeReviewRequest;
    case "service_followup":
      return he.tasksTypeServiceFollowup;
    case "maintenance":
      return he.tasksTypeMaintenance;
    case "other":
      return he.tasksTypeOther;
    default:
      return type;
  }
}

export function formatTaskDue(dueAt: string | null | undefined): string {
  if (!dueAt) return he.tasksNoDue;
  try {
    return new Date(dueAt).toLocaleString("he-IL", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return he.tasksNoDue;
  }
}

export function sortTasksForDisplay(items: TaskOut[]): TaskOut[] {
  const rank = (status: string) => (status === "open" ? 0 : status === "cancelled" ? 2 : 1);
  return [...items].sort((a, b) => {
    const byStatus = rank(a.status) - rank(b.status);
    if (byStatus !== 0) return byStatus;
    const aDue = a.due_at ? Date.parse(a.due_at) : Number.POSITIVE_INFINITY;
    const bDue = b.due_at ? Date.parse(b.due_at) : Number.POSITIVE_INFINITY;
    if (aDue !== bDue) return aDue - bDue;
    return Date.parse(b.created_at) - Date.parse(a.created_at);
  });
}
