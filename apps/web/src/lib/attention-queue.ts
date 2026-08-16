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

export function waitingDays(updatedAt: string | null | undefined, now = new Date()): number | null {
  if (!updatedAt) return null;
  const then = new Date(updatedAt);
  if (Number.isNaN(then.getTime())) return null;
  const startNow = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const startThen = Date.UTC(then.getFullYear(), then.getMonth(), then.getDate());
  return Math.max(0, Math.round((startNow - startThen) / 86_400_000));
}
