import type { AttentionGroup, DashboardItem } from "@site-secure/api-client";

const SEVERITY_ORDER: Record<DashboardItem["severity"], number> = { now: 0, next: 1, info: 2 };

export type AttentionQueueItem = {
  kind: string;
  groupLabel: string;
  item: DashboardItem;
};

export function attentionQueue(groups: AttentionGroup[]): AttentionQueueItem[] {
  return groups
    .flatMap((group) => group.items.map((item) => ({ kind: group.kind, groupLabel: group.label_he, item })))
    .sort((a, b) => SEVERITY_ORDER[a.item.severity] - SEVERITY_ORDER[b.item.severity]);
}

export function attentionUrgentCount(groups: AttentionGroup[]): number {
  return attentionQueue(groups).filter((row) => row.item.severity === "now").length;
}

export type AttentionVisual = {
  color: "blue" | "yellow" | "red" | "purple";
  type: "action" | "followup" | "urgent";
};

export function attentionVisual(row: AttentionQueueItem): AttentionVisual {
  if (row.kind === "quote_approved_pending_project") {
    return { color: "blue", type: "action" };
  }
  if (row.kind === "quote_expiring" || row.item.severity === "now") {
    return { color: "red", type: "urgent" };
  }
  if (row.kind === "quote_stale_draft") {
    return { color: "purple", type: "followup" };
  }
  return { color: "yellow", type: "followup" };
}

export function waitingDays(updatedAt: string | null | undefined, now = new Date()): number | null {
  if (!updatedAt) return null;
  const then = new Date(updatedAt);
  if (Number.isNaN(then.getTime())) return null;
  const startNow = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const startThen = Date.UTC(then.getFullYear(), then.getMonth(), then.getDate());
  return Math.max(0, Math.round((startNow - startThen) / 86_400_000));
}
