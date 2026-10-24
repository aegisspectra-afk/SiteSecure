import { hoursAgoIso, startOfUtcDayIso } from "./ssp-ops-time";

export type SspDashRange = "today" | "7d" | "30d";

export type SspAttentionItem = {
  id: string;
  label: string;
  value: number;
  href: string;
  search?: Record<string, string>;
  tone: "danger" | "warning";
};

export type SspSetupStep = {
  id: string;
  label: string;
  done: boolean;
  href: string;
  actionLabel: string;
  detail?: string;
};

export type SspSiteActivityKind = "no_form" | "overdue" | "pending" | "reporting" | "quiet";

export function sspRangeFromIso(range: SspDashRange): string {
  if (range === "today") return startOfUtcDayIso();
  if (range === "7d") return hoursAgoIso(24 * 7);
  return hoursAgoIso(24 * 30);
}

export function sspKpiTone(
  kind: "danger" | "warning" | "ok",
  value: number,
): "danger" | "warning" | "ok" | "muted" {
  if (value <= 0) return "muted";
  return kind;
}

export function sspAttentionItems(input: {
  overdue: number;
  openEvents: number;
  lateRuns: number;
  pendingJoins: number;
  canEvents: boolean;
  canPatrols: boolean;
  labels: {
    overdue: string;
    openEvents: string;
    lateRuns: string;
    pendingJoins: string;
  };
}): SspAttentionItem[] {
  const items: SspAttentionItem[] = [];
  if (input.overdue > 0) {
    items.push({
      id: "overdue",
      label: input.labels.overdue,
      value: input.overdue,
      href: "/app/ssp/assignments",
      tone: "danger",
    });
  }
  if (input.canEvents && input.openEvents > 0) {
    items.push({
      id: "events",
      label: input.labels.openEvents,
      value: input.openEvents,
      href: "/app/ssp/events",
      tone: "danger",
    });
  }
  if (input.canPatrols && input.lateRuns > 0) {
    items.push({
      id: "late",
      label: input.labels.lateRuns,
      value: input.lateRuns,
      href: "/app/ssp/patrols",
      tone: "danger",
    });
  }
  if (input.pendingJoins > 0) {
    items.push({
      id: "joins",
      label: input.labels.pendingJoins,
      value: input.pendingJoins,
      href: "/app/ssp/enrollments",
      search: { status: "pending" },
      tone: "warning",
    });
  }
  return items;
}

export function sspSetupSteps(input: {
  officesActive: number;
  formsPublished: number;
  assignmentsActive: number;
  codeIssued: boolean;
  codeDetail?: string;
  devicesActive: number;
  labels: {
    offices: string;
    formPublished: string;
    formAssigned: string;
    codeIssued: string;
    device: string;
  };
  actions: {
    offices: string;
    formPublished: string;
    formAssigned: string;
    codeIssued: string;
    device: string;
  };
}): SspSetupStep[] {
  return [
    {
      id: "offices",
      label: input.labels.offices,
      done: input.officesActive > 0,
      href: "/app/ssp/offices",
      actionLabel: input.actions.offices,
    },
    {
      id: "form",
      label: input.labels.formPublished,
      done: input.formsPublished > 0,
      href: "/app/ssp/forms",
      actionLabel: input.actions.formPublished,
    },
    {
      id: "assign",
      label: input.labels.formAssigned,
      done: input.assignmentsActive > 0,
      href: "/app/ssp/assignments",
      actionLabel: input.actions.formAssigned,
    },
    {
      id: "code",
      label: input.labels.codeIssued,
      done: input.codeIssued,
      href: "/app/ssp/sites",
      actionLabel: input.actions.codeIssued,
      detail: input.codeDetail,
    },
    {
      id: "device",
      label: input.labels.device,
      done: input.devicesActive > 0,
      href: "/app/ssp/devices",
      actionLabel: input.actions.device,
    },
  ];
}

export function sspSetupComplete(steps: SspSetupStep[]): boolean {
  return steps.length > 0 && steps.every((step) => step.done);
}

export function sspSetupCounts(steps: SspSetupStep[]): { done: number; total: number } {
  return { done: steps.filter((step) => step.done).length, total: steps.length };
}

/** Live / issued activation — not merely "awaiting a first code". */
const CODE_ISSUED_STATUSES = new Set(["code_issued", "pending_approval", "device_active"]);

export function sspSiteHasIssuedCode(status?: string | null): boolean {
  return CODE_ISSUED_STATUSES.has(String(status || ""));
}

export function sspCodeIssuedProgress(sites: Array<{ activation_status?: string | null }>): {
  issued: number;
  total: number;
  done: boolean;
} {
  const total = sites.length;
  const issued = sites.filter((site) => sspSiteHasIssuedCode(site.activation_status)).length;
  return { issued, total, done: total > 0 && issued === total };
}

export function sspIdleFeedsEmpty(timeline: number, pending: number, reports: number): boolean {
  return timeline === 0 && pending === 0 && reports === 0;
}

export type SspAttentionBanner = "items" | "clear" | "neutral";
export type SspAttentionLayout = "chips" | "line";

export function sspAttentionBanner(input: {
  hasExceptions: boolean;
  setupComplete: boolean;
  pendingActivation: number;
  sitesWithoutForm: number;
}): SspAttentionBanner {
  if (input.hasExceptions) return "items";
  const setupOpen = !input.setupComplete || input.pendingActivation > 0 || input.sitesWithoutForm > 0;
  return setupOpen ? "neutral" : "clear";
}

export function sspAttentionLayout(banner: SspAttentionBanner): SspAttentionLayout {
  return banner === "items" ? "chips" : "line";
}

/** Bottom exceptions feed — hide when empty; the banner already covers the idle case. */
export function sspShowExceptionsSection(openEvents: number, lateRuns: number): boolean {
  return openEvents > 0 || lateRuns > 0;
}

export function sspSitesWithoutForm(sites: Array<{ assigned_forms_count?: number | null }>): number {
  return sites.filter((site) => (site.assigned_forms_count ?? 0) <= 0).length;
}

export function sspActivationPending(status?: string | null): boolean {
  return status === "pending_approval" || status === "awaiting_activation";
}

export function sspSiteActivityKind(site: {
  assigned_forms_count?: number | null;
  overdue_count?: number | null;
  activation_status?: string | null;
}): SspSiteActivityKind {
  const assigned = site.assigned_forms_count ?? 0;
  const overdue = site.overdue_count ?? 0;
  if (assigned <= 0) return "no_form";
  if (overdue > 0) return "overdue";
  if (sspActivationPending(site.activation_status)) return "pending";
  if (site.activation_status === "device_active") return "reporting";
  return "quiet";
}

export function sspSiteToneClass(kind: SspSiteActivityKind): string {
  if (kind === "overdue") return "ssp-site-tone is-overdue";
  if (kind === "no_form") return "ssp-site-tone is-no-form";
  if (kind === "pending") return "ssp-site-tone is-pending";
  return "ssp-site-tone is-quiet";
}
