import type { QuoteListCounts, QuoteOut } from "@site-secure/api-client";
import { quoteConversion } from "./ux-metrics";

export type QuoteTab = "all" | "draft" | "open" | "approved" | "rejected" | "expired" | "archived";
export type QuoteDraftGap = "empty" | "no_customer" | "no_items";

/** Active commercial pipeline — archived quotes are a separate tab. */
export const PIPELINE_STATUSES = ["draft", "sent", "viewed", "approved", "rejected", "expired", "cancelled"] as const;
export const OPEN_STATUSES = new Set(["draft", "sent", "viewed"]);
export const AWAITING_STATUSES = new Set(["sent", "viewed"]);
/** Q4: only drafts may be deleted; everything else is archived. */
export const DELETABLE_QUOTE_STATUSES = new Set(["draft"]);
export const ARCHIVABLE_QUOTE_STATUSES = new Set([
  "sent",
  "viewed",
  "approved",
  "rejected",
  "expired",
  "cancelled",
]);

const EMPTY_COUNTS: QuoteListCounts = {
  draft: 0,
  sent: 0,
  viewed: 0,
  approved: 0,
  rejected: 0,
  expired: 0,
  cancelled: 0,
  total: 0,
  open_value: 0,
};

export function quoteIsDeletable(status: string, archivedAt?: string | null): boolean {
  if (archivedAt) return false;
  return DELETABLE_QUOTE_STATUSES.has(status);
}

export function quoteIsArchivable(status: string, archivedAt?: string | null): boolean {
  if (archivedAt) return false;
  return ARCHIVABLE_QUOTE_STATUSES.has(status);
}

export function quoteIsArchived(quote: Pick<QuoteOut, "archived_at">): boolean {
  return Boolean(quote.archived_at);
}

export function quoteTabStatuses(tab: QuoteTab): string[] | null {
  if (tab === "all") return [...PIPELINE_STATUSES];
  if (tab === "draft") return ["draft"];
  if (tab === "open") return ["sent", "viewed"];
  if (tab === "approved") return ["approved"];
  if (tab === "rejected") return ["rejected"];
  if (tab === "archived") return null; // server filters via archived=true
  return ["expired"];
}

export function listStatusParam(tab: QuoteTab): string | undefined {
  const filter = listQuotesFilter(tab);
  return filter.status;
}

export function listQuotesFilter(tab: QuoteTab): {
  status?: string;
  exclude_status?: string;
  archived?: boolean;
} {
  if (tab === "archived") return { archived: true };
  // Active pipeline; archived rows are excluded server-side (archived_at is null).
  if (tab === "all") return {};
  if (tab === "open") return { status: "sent,viewed" };
  const statuses = quoteTabStatuses(tab);
  if (!statuses?.length) return {};
  return { status: statuses[0] };
}

export function pipelineTabForStatus(status: string, archivedAt?: string | null): QuoteTab | null {
  if (archivedAt) return "archived";
  if (status === "draft") return "draft";
  if (status === "sent" || status === "viewed") return "open";
  if (status === "approved") return "approved";
  if (status === "rejected") return "rejected";
  if (status === "expired") return "expired";
  return null;
}

export function filterQuotes(quotes: QuoteOut[], tab: QuoteTab, search: string): QuoteOut[] {
  const statuses = quoteTabStatuses(tab);
  const query = search.trim().toLowerCase();
  return quotes.filter((quote) => {
    if (tab === "archived") {
      if (!quote.archived_at) return false;
    } else if (quote.archived_at) {
      return false;
    }
    if (statuses && !statuses.includes(quote.status)) return false;
    if (!query) return true;
    const haystack = [
      quote.number,
      quote.title,
      quote.project_name,
      quote.site_name,
      quote.customer_name,
      quote.customer_notes,
      quote.internal_notes,
      quote.status,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });
}

export function quotesOpenValue(quotes: QuoteOut[]): number {
  return quotes
    .filter((quote) => OPEN_STATUSES.has(quote.status))
    .reduce((sum, quote) => sum + Number(quote.total_gross || 0), 0);
}

export function countsFromQuotes(quotes: QuoteOut[]): QuoteListCounts {
  const counts: QuoteListCounts = { ...EMPTY_COUNTS, total: quotes.length };
  for (const quote of quotes) {
    if (quote.status === "draft") counts.draft += 1;
    else if (quote.status === "sent") counts.sent += 1;
    else if (quote.status === "viewed") counts.viewed += 1;
    else if (quote.status === "approved") counts.approved += 1;
    else if (quote.status === "rejected") counts.rejected += 1;
    else if (quote.status === "expired") counts.expired += 1;
    else if (quote.status === "cancelled") counts.cancelled += 1;
    if (OPEN_STATUSES.has(quote.status)) counts.open_value += Number(quote.total_gross || 0);
  }
  return counts;
}

export function quotesWorkspaceKpis(counts: QuoteListCounts | null | undefined, quotes: QuoteOut[]) {
  const source = counts ?? countsFromQuotes(quotes);
  const draft = source.draft;
  const sent = source.sent;
  const viewed = source.viewed;
  const approved = source.approved;
  const rejected = source.rejected;
  return {
    draft,
    sent,
    viewed,
    awaiting: sent + viewed,
    approved,
    rejected,
    expired: source.expired,
    total: source.total || quotes.length,
    openCount: draft + sent + viewed,
    openValue: source.open_value,
    conversion: quoteConversion({
      quotes_draft: draft,
      quotes_sent: sent,
      quotes_viewed: viewed,
      quotes_approved: approved,
      quotes_rejected: rejected,
      quotes_open: sent + viewed,
      quotes_approved_value: 0,
      jobs_open: 0,
      jobs_overdue: 0,
      jobs_unassigned: 0,
    }),
  };
}

export function quotesMarginTotals(quotes: QuoteOut[]) {
  const priced = quotes.filter(
    (quote) => Number(quote.total_gross || 0) > 0 && (quote.margin_amount != null || quote.cost_total != null),
  );
  if (!priced.length) return null;
  const hasLifecycle = priced.some((quote) => quote.status !== "draft");
  if (priced.length < 2 && !hasLifecycle) return null;
  const amount = priced.reduce((sum, quote) => sum + Number(quote.margin_amount || 0), 0);
  // Same base as pricing.recalculate: margin over net revenue (after discounts, before VAT).
  const net = priced.reduce((sum, quote) => sum + Number(quote.subtotal_net || 0), 0);
  return {
    amount,
    percent: net > 0 ? Math.round((amount / net) * 1000) / 10 : null,
  };
}

export function quoteDraftGap(quote: QuoteOut): QuoteDraftGap | null {
  if (quote.status !== "draft") return null;
  const hasCustomer = Boolean(quote.customer_id || quote.customer_name?.trim());
  const hasTitle = Boolean(quote.title?.trim() || quote.project_name?.trim());
  const hasValue = Number(quote.total_gross || 0) > 0;
  if (!hasCustomer && !hasTitle && !hasValue) return "empty";
  if (!hasCustomer) return "no_customer";
  if (!hasValue) return "no_items";
  return null;
}
