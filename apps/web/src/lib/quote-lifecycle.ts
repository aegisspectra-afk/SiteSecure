import { he } from "../i18n/he";
import { quotePrimaryCtaKind, type QuotePrimaryCtaKind } from "./quote-builder";

/** Contextual primary action for quote → approval → project continuity. */
export type QuoteLifecyclePrimaryKind =
  | QuotePrimaryCtaKind
  | "create_project"
  | "select_site"
  | "open_project";

export function resolveQuoteLifecyclePrimary(input: {
  status: string;
  siteId: string | null | undefined;
  linkedProjectId: string | null | undefined;
  canCreateProject: boolean;
  canViewProjects: boolean;
  canRevise: boolean;
  canSend: boolean;
  canSendNow: boolean;
  hasLiveId?: boolean;
}): {
  kind: QuoteLifecyclePrimaryKind;
  label: string | null;
  disabled: boolean;
  title?: string;
} {
  const base = quotePrimaryCtaKind(input.status);

  if (input.status === "approved") {
    if (input.linkedProjectId && input.canViewProjects) {
      return { kind: "open_project", label: he.workflowOpenProject, disabled: false };
    }
    if (!input.siteId) {
      return {
        kind: "select_site",
        label: he.cpqSelectSiteForProject,
        disabled: false,
        title: he.workflowProjectNeedsSite,
      };
    }
    if (input.canCreateProject) {
      return { kind: "create_project", label: he.workflowCreateProject, disabled: false };
    }
    return { kind: "approved", label: he.cpqApprovedCta, disabled: true };
  }

  if (base === "send") {
    return {
      kind: "send",
      label: he.cpqSendForApproval,
      disabled: !input.canSend || !input.canSendNow,
    };
  }
  if (base === "show_link") {
    return { kind: "show_link", label: he.cpqShowLink, disabled: !input.hasLiveId };
  }
  if (base === "show_activity") {
    return { kind: "show_activity", label: he.cpqShowActivity, disabled: false };
  }
  if (base === "revise") {
    return {
      kind: "revise",
      label: he.quoteRevise,
      disabled: !input.canRevise,
    };
  }
  if (base === "cancelled") {
    return { kind: "cancelled", label: he.cpqCancelledCta, disabled: true };
  }
  return { kind: base, label: null, disabled: true };
}

export function quoteLifecycleStatusLabel(status: string, canSendNow: boolean): string {
  if (status === "draft" && canSendNow) return he.quoteDocReadyToSend;
  if (status === "sent") return he.cpqWaitingForApproval;
  if (status === "viewed") return he.cpqWaitingAfterView;
  if (status === "approved") return he.quoteStatuses.approved;
  if (status === "rejected") return he.quoteStatuses.rejected;
  return he.quoteStatuses[status as keyof typeof he.quoteStatuses] ?? status;
}

export function quoteLifecycleShowsBanner(status: string): boolean {
  return status === "sent" || status === "viewed" || status === "approved" || status === "rejected";
}
