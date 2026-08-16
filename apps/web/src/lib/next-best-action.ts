import type { AttentionGroup, DashboardSummary, WorkspaceUsage } from "@site-secure/api-client";
import { he } from "../i18n/he";
import { quoteConversion } from "./ux-metrics";
import type { SetupStep } from "./workspace-setup";

export type NextActionHref = "/app/quotes" | "/app/quotes/new" | "/app/settings/users";

export type NextAction = {
  id: string;
  title: string;
  body: string;
  href: NextActionHref;
  label: string;
};

export function nextBestAction(opts: {
  setup: { complete: boolean; steps: SetupStep[] };
  summary: DashboardSummary | null;
  attention: AttentionGroup[];
  usage: WorkspaceUsage | null;
  canCreateQuote: boolean;
  canInvite: boolean;
  canViewQuotes: boolean;
}): NextAction | null {
  const current = opts.setup.steps.find((step) => step.current);
  if (!opts.setup.complete && current?.href && opts.canInvite) {
    return {
      id: "setup-invite",
      title: he.nextActionInvite,
      body: he.nextActionInviteBody,
      href: current.href,
      label: he.inviteUser,
    };
  }

  const conversion = quoteConversion(opts.summary);
  if (opts.canCreateQuote && conversion.total === 0) {
    return {
      id: "first-quote",
      title: he.uxStartFirstQuote,
      body: he.nextActionFirstQuoteBody,
      href: "/app/quotes/new",
      label: he.nextActionCreateQuote,
    };
  }

  const quoteAttention = opts.attention.find((group) => group.items.some((item) => item.entity_type === "quote"));
  if (opts.canViewQuotes && quoteAttention && quoteAttention.count > 0) {
    return {
      id: "quote-attention",
      title: he.nextActionOpenQuotes(quoteAttention.count),
      body: quoteAttention.label_he,
      href: "/app/quotes",
      label: he.kpiViewQuotes,
    };
  }

  if (opts.canViewQuotes && (opts.summary?.quotes_open ?? 0) > 0) {
    return {
      id: "open-quotes",
      title: he.nextActionOpenQuotes(opts.summary!.quotes_open),
      body: he.kpiQuotesOpenHint(
        opts.summary?.quotes_draft ?? 0,
        opts.summary?.quotes_sent ?? 0,
        opts.summary?.quotes_viewed ?? 0,
      ),
      href: "/app/quotes",
      label: he.kpiViewQuotes,
    };
  }

  const field = opts.usage?.meters.find((meter) => meter.key === "seats_field");
  if (opts.canInvite && field && !field.unlimited && field.current === 0) {
    return {
      id: "invite-field",
      title: he.uxInviteField,
      body: he.uxSeatEmpty,
      href: "/app/settings/users",
      label: he.inviteUser,
    };
  }

  return null;
}

export function attentionCount(groups: AttentionGroup[]): number {
  return groups.reduce((sum, group) => sum + group.count, 0);
}
