import type {
  AdminActivityItem,
  AdminAttentionItem,
  AdminFeedbackCard,
  AdminPendingInviteCard,
} from "@site-secure/api-client";

export type OpsTimeWindow = "24h" | "7d" | "30d" | "all";
export type OpsScope = "all" | "hide_suspected_qa";

export type InviteClass = "unclassified" | "suspected_qa";

/** Soft heuristic only — not a reliable classifier. Labels must stay honest in UI. */
export function classifyInviteEmail(email: string | null | undefined): InviteClass {
  const value = (email ?? "").trim().toLowerCase();
  if (!value) return "unclassified";
  if (
    value.includes("qa_probe") ||
    value.includes("sitesecure.test") ||
    value.endsWith("@example.com") ||
    value.includes("+qa@") ||
    value.includes("test+")
  ) {
    return "suspected_qa";
  }
  return "unclassified";
}

export function windowStartMs(window: OpsTimeWindow, now = Date.now()): number | null {
  if (window === "all") return null;
  const hours = window === "24h" ? 24 : window === "7d" ? 24 * 7 : 24 * 30;
  return now - hours * 3600 * 1000;
}

export function withinWindow(iso: string | null | undefined, window: OpsTimeWindow, now = Date.now()): boolean {
  const start = windowStartMs(window, now);
  if (start == null) return true;
  if (!iso) return false;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return false;
  return t >= start;
}

export type GroupedAttention = {
  id: string;
  kind: string;
  severity: string;
  title: string;
  count: number;
  realCount: number;
  suspectedQaCount: number;
  href: string;
  sampleDetail?: string | null;
  created_at?: string | null;
};

function attentionEmail(detail?: string | null): string {
  if (!detail) return "";
  const part = detail.split("·")[0]?.trim() ?? "";
  return part.includes("@") ? part : "";
}

export function groupAttentionItems(items: AdminAttentionItem[]): GroupedAttention[] {
  const map = new Map<string, GroupedAttention>();
  for (const item of items) {
    const key = `${item.kind}:${item.severity}`;
    const existing = map.get(key);
    const emailClass = classifyInviteEmail(attentionEmail(item.detail));
    if (!existing) {
      map.set(key, {
        id: key,
        kind: item.kind,
        severity: item.severity,
        title: item.title,
        count: 1,
        realCount: emailClass === "suspected_qa" ? 0 : 1,
        suspectedQaCount: emailClass === "suspected_qa" ? 1 : 0,
        href: item.href,
        sampleDetail: item.detail,
        created_at: item.created_at,
      });
      continue;
    }
    existing.count += 1;
    if (emailClass === "suspected_qa") existing.suspectedQaCount += 1;
    else existing.realCount += 1;
    if (!existing.sampleDetail && item.detail) existing.sampleDetail = item.detail;
  }
  const severityRank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  return [...map.values()]
    .sort((a, b) => (severityRank[a.severity] ?? 9) - (severityRank[b.severity] ?? 9) || b.count - a.count)
    .slice(0, 7);
}

export type GroupedActivity = {
  id: string;
  action: string;
  title: string;
  count: number;
  firstAt?: string | null;
  lastAt?: string | null;
  sampleSummary?: string | null;
  workspace_id?: string | null;
};

const ACTION_TITLES: Record<string, string> = {
  workspace_created: "סביבת עבודה נוצרה",
  workspace_beta_updated: "עדכון סטטוס בטא לסביבה",
  invitation_created: "הזמנה נוצרה",
  invitation_accepted: "הזמנה התקבלה",
  invitation_revoked: "הזמנה בוטלה",
  invitation_reissued: "הזמנה הונפקה מחדש",
  feedback_submitted: "פידבק התקבל",
  organization_created: "סביבת עבודה נוצרה",
};

export function humanizeActivityAction(action?: string | null): string {
  if (!action) return "פעילות מערכת";
  return ACTION_TITLES[action] ?? action.replaceAll("_", " ");
}

export function groupActivityItems(items: AdminActivityItem[]): GroupedActivity[] {
  const buckets = new Map<string, GroupedActivity>();
  for (const item of items) {
    const action = item.action ?? "unknown";
    const hourKey = item.created_at ? item.created_at.slice(0, 13) : "unknown";
    const groupMachineSpam = action.includes("updated") || action.includes("workspace_beta");
    const bucketKey = groupMachineSpam ? `${action}:${hourKey}` : `solo:${item.id}`;
    const row = buckets.get(bucketKey);
    if (!row) {
      buckets.set(bucketKey, {
        id: bucketKey,
        action,
        title: humanizeActivityAction(action),
        count: 1,
        firstAt: item.created_at,
        lastAt: item.created_at,
        sampleSummary: item.summary,
        workspace_id: item.workspace_id,
      });
      continue;
    }
    row.count += 1;
    if (item.created_at) {
      if (!row.firstAt || item.created_at < row.firstAt) row.firstAt = item.created_at;
      if (!row.lastAt || item.created_at > row.lastAt) row.lastAt = item.created_at;
    }
    if (!row.sampleSummary && item.summary) row.sampleSummary = item.summary;
  }
  return [...buckets.values()]
    .sort((a, b) => Date.parse(b.lastAt ?? "") - Date.parse(a.lastAt ?? ""))
    .slice(0, 12);
}

export function filterPendingInvites(
  invites: AdminPendingInviteCard[],
  scope: OpsScope,
  time: OpsTimeWindow,
): AdminPendingInviteCard[] {
  return invites.filter((inv) => {
    if (!withinWindow(inv.created_at, time)) return false;
    if (scope === "hide_suspected_qa" && classifyInviteEmail(inv.email) === "suspected_qa") return false;
    return true;
  });
}

export function filterFeedback(
  rows: AdminFeedbackCard[],
  scope: OpsScope,
  time: OpsTimeWindow,
): AdminFeedbackCard[] {
  return rows.filter((row) => {
    if (!withinWindow(row.created_at, time)) return false;
    if (scope === "hide_suspected_qa") {
      // Prefer explicit is_beta when present; otherwise keep unclassified (honest).
      if (row.is_beta === false) return false;
    }
    return true;
  });
}

export function filterActivity(rows: AdminActivityItem[], time: OpsTimeWindow): AdminActivityItem[] {
  return rows.filter((row) => withinWindow(row.created_at, time));
}

export function filterAttention(items: AdminAttentionItem[], scope: OpsScope, time: OpsTimeWindow): AdminAttentionItem[] {
  return items.filter((item) => {
    if (!withinWindow(item.created_at, time)) return false;
    if (scope === "hide_suspected_qa" && classifyInviteEmail(attentionEmail(item.detail)) === "suspected_qa") {
      return false;
    }
    return true;
  });
}

export type HealthTone = "ok" | "warning" | "danger" | "disconnected";

export function mapSystemTone(
  kind: "api" | "web" | "auth" | "backup" | "invite" | "quote",
  system?: {
    api_ok?: boolean;
    backup_status?: string;
    auth_status?: string;
    web_status?: string;
    invite_flow_status?: string;
    quote_flow_status?: string;
  } | null,
  apiReachable?: boolean,
): HealthTone {
  if (kind === "api") {
    if (apiReachable === false) return "danger";
    if (system?.api_ok) return "ok";
    return "disconnected";
  }
  if (!system) return "disconnected";
  if (kind === "backup") {
    if (system.backup_status === "ok") return "ok";
    if (system.backup_status === "failed") return "danger";
    return "disconnected";
  }
  if (kind === "auth") {
    if (system.auth_status === "ok") return "ok";
    if (system.auth_status === "degraded") return "warning";
    return "disconnected";
  }
  if (kind === "web") {
    if (system.web_status === "ok") return "ok";
    // Page is rendering — web process is alive, but no dedicated probe exists.
    return "disconnected";
  }
  if (kind === "invite") {
    if (system.invite_flow_status === "ok") return "ok";
    return "disconnected";
  }
  if (system.quote_flow_status === "ok") return "ok";
  return "disconnected";
}
