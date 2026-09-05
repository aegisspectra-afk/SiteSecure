import type { AttentionGroup, DashboardItem, LeadOut } from "@site-secure/api-client";
import { he } from "../i18n/he";
import { leadDisplayTitle, leadRequirementsSummary } from "./leads";

const SEVERITY_ORDER: Record<DashboardItem["severity"], number> = { now: 0, next: 1, info: 2 };

/** Lower number = higher priority. Derived from domain urgency. */
export const ATTENTION_KIND_PRIORITY: Record<string, number> = {
  job_overdue: 10,
  job_unassigned: 20,
  quote_approved_pending_project: 30,
  quote_awaiting_us: 40,
  quote_expiring: 50,
  quote_awaiting_customer: 60,
  quote_stale_draft: 70,
  lead_follow_up: 80,
};

export const ATTENTION_DISPLAY_LIMIT = 5;

export type AttentionQueueItem = {
  kind: string;
  groupLabel: string;
  item: DashboardItem;
  secondarySignals: string[];
  actionLabel: string;
  priorityRank: number;
};

export type AttentionVisual = {
  color: "blue" | "yellow" | "red" | "purple";
  /** Visual priority cue only — not used as CTA text. */
  urgency: "high" | "medium" | "low";
};

function kindPriority(kind: string): number {
  return ATTENTION_KIND_PRIORITY[kind] ?? 500;
}

function reasonLabel(kind: string, item: DashboardItem, now = new Date()): string {
  const days = waitingDays(item.updated_at, now);
  if (kind === "quote_awaiting_customer") {
    return days == null ? item.title_he : he.commandAwaitingDays(days);
  }
  if (kind === "quote_awaiting_us") return he.commandViewedWhy;
  if (kind === "quote_expiring") return he.commandExpiringWhy;
  if (kind === "quote_stale_draft") return he.commandStaleWhy;
  if (kind === "quote_approved_pending_project") return item.title_he || he.commandApprovedWhy;
  if (kind === "lead_follow_up") return item.title_he;
  return item.title_he;
}

export function attentionActionLabel(
  kind: string,
  item: DashboardItem,
  opts?: { canCreateProject?: boolean },
): string {
  const actions = item.actions ?? [];
  if (actions.includes("create_project")) {
    return opts?.canCreateProject === false ? he.commandOpenQuote : he.nextActionCreateProject;
  }
  if (actions.includes("select_site")) return he.cpqSelectSiteForProject;
  if (item.entity_type === "job") {
    if (actions.includes("start") || actions.includes("complete")) return he.todayOpenJob;
    return he.todayOpenJob;
  }
  if (item.entity_type === "lead" || kind === "lead_follow_up") return he.leadsOpenLead;
  if (kind === "quote_approved_pending_project") {
    return opts?.canCreateProject === false ? he.commandOpenQuote : he.nextActionCreateProject;
  }
  return he.commandOpenQuote;
}

function entityKey(item: DashboardItem): string {
  return `${item.entity_type}:${item.entity_id}`;
}

/**
 * Flatten attention groups into one row per entity.
 * Highest-priority kind wins; other kinds become secondarySignals.
 */
export function attentionQueue(
  groups: AttentionGroup[],
  opts?: { canCreateProject?: boolean; now?: Date },
): AttentionQueueItem[] {
  const now = opts?.now ?? new Date();
  type Acc = {
    kind: string;
    groupLabel: string;
    item: DashboardItem;
    signals: { kind: string; label: string }[];
  };
  const byEntity = new Map<string, Acc>();

  for (const group of groups) {
    for (const item of group.items) {
      const key = entityKey(item);
      const signal = { kind: group.kind, label: reasonLabel(group.kind, item, now) };
      const existing = byEntity.get(key);
      if (!existing) {
        byEntity.set(key, {
          kind: group.kind,
          groupLabel: group.label_he,
          item,
          signals: [signal],
        });
        continue;
      }
      existing.signals.push(signal);
      const nextRank = kindPriority(group.kind);
      const curRank = kindPriority(existing.kind);
      const severityBetter =
        SEVERITY_ORDER[item.severity] < SEVERITY_ORDER[existing.item.severity];
      if (nextRank < curRank || (nextRank === curRank && severityBetter)) {
        existing.kind = group.kind;
        existing.groupLabel = group.label_he;
        existing.item = {
          ...item,
          actions: item.actions?.length ? item.actions : existing.item.actions,
          title_he: item.title_he || existing.item.title_he,
        };
      } else if (
        (item.actions?.length ?? 0) > (existing.item.actions?.length ?? 0)
      ) {
        existing.item = { ...existing.item, actions: item.actions };
      }
    }
  }

  const rows: AttentionQueueItem[] = [...byEntity.values()].map((acc) => {
    const primaryLabel = reasonLabel(acc.kind, acc.item, now);
    const secondarySignals = acc.signals
      .filter((s) => s.kind !== acc.kind)
      .map((s) => s.label)
      .filter((label, index, all) => label && label !== primaryLabel && all.indexOf(label) === index);
    if ((acc.item.actions ?? []).includes("expiring_soon") && !secondarySignals.includes(he.commandExpiringWhy)) {
      secondarySignals.push(he.commandExpiringWhy);
    }
    return {
      kind: acc.kind,
      groupLabel: acc.groupLabel,
      item: acc.item,
      secondarySignals,
      actionLabel: attentionActionLabel(acc.kind, acc.item, {
        canCreateProject: opts?.canCreateProject,
      }),
      priorityRank: kindPriority(acc.kind),
    };
  });

  rows.sort((a, b) => {
    if (a.priorityRank !== b.priorityRank) return a.priorityRank - b.priorityRank;
    return SEVERITY_ORDER[a.item.severity] - SEVERITY_ORDER[b.item.severity];
  });
  return rows;
}

export function attentionQueueLimited(
  groups: AttentionGroup[],
  opts?: { canCreateProject?: boolean; limit?: number; now?: Date },
): { items: AttentionQueueItem[]; total: number; hasMore: boolean } {
  const all = attentionQueue(groups, opts);
  const limit = opts?.limit ?? ATTENTION_DISPLAY_LIMIT;
  return {
    items: all.slice(0, limit),
    total: all.length,
    hasMore: all.length > limit,
  };
}

/** Unique entity count (deduped). */
export function attentionEntityCount(groups: AttentionGroup[]): number {
  return attentionQueue(groups).length;
}

export function attentionUrgentCount(groups: AttentionGroup[]): number {
  return attentionQueue(groups).filter((row) => row.item.severity === "now").length;
}

export function attentionVisual(row: AttentionQueueItem): AttentionVisual {
  if (row.kind === "quote_approved_pending_project") {
    return { color: "blue", urgency: "high" };
  }
  if (row.kind === "job_overdue" || row.kind === "quote_expiring" || row.item.severity === "now") {
    return { color: "red", urgency: "high" };
  }
  if (row.kind === "quote_stale_draft" || row.kind === "lead_follow_up") {
    return { color: "purple", urgency: "low" };
  }
  return { color: "yellow", urgency: "medium" };
}

export function waitingDays(updatedAt: string | null | undefined, now = new Date()): number | null {
  if (!updatedAt) return null;
  const then = new Date(updatedAt);
  if (Number.isNaN(then.getTime())) return null;
  const startNow = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const startThen = Date.UTC(then.getFullYear(), then.getMonth(), then.getDate());
  return Math.max(0, Math.round((startNow - startThen) / 86_400_000));
}

/** Convert genuine lead next-actions into attention-shaped rows (lower priority). */
export function leadsToAttentionGroups(leads: LeadOut[]): AttentionGroup[] {
  if (!leads.length) return [];
  const items: DashboardItem[] = leads.map((lead) => ({
    entity_type: "lead" as DashboardItem["entity_type"],
    entity_id: lead.id,
    number: leadDisplayTitle(lead),
    title_he: lead.next_action?.trim() || leadRequirementsSummary(lead),
    customer_name: lead.contact_name || lead.company_name || null,
    site_name: null,
    scheduled_for: null,
    severity: lead.priority === "urgent" || lead.priority === "high" ? "now" : "next",
    actions: [],
    updated_at: lead.updated_at ?? null,
  }));
  return [
    {
      kind: "lead_follow_up",
      label_he: he.leadsAttentionTitle,
      count: items.length,
      items,
    },
  ];
}

/**
 * Leads that still need a lead-level next action.
 * Excludes mid-funnel quote_preparing / won-like progression noise.
 */
export function filterLeadAttention(items: LeadOut[]): LeadOut[] {
  const allowed = new Set(["new", "contacted", "visit_scheduling"]);
  return items
    .filter((row) => allowed.has(row.status) && Boolean(row.next_action?.trim()))
    .slice(0, 3);
}

/** Meaningful chart delta only when both periods have data. */
export function meaningfulChangePercent(
  change: number | null | undefined,
  series: number[] | null | undefined,
): number | null {
  if (change == null || change === 0) return null;
  if (!series || series.length < 2) return null;
  const mid = Math.floor(series.length / 2);
  const prev = series.slice(0, mid).reduce((a, b) => a + b, 0);
  const next = series.slice(mid).reduce((a, b) => a + b, 0);
  if (prev <= 0 || next <= 0) return null;
  return change;
}
