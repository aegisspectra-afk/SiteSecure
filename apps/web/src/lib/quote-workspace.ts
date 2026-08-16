import type { DashboardSummary, QuoteOut } from "@site-secure/api-client";
import { quoteConversion, quotesInPlay } from "./ux-metrics";

export type QuoteTab = "all" | "draft" | "open" | "approved" | "expired";

export const OPEN_STATUSES = new Set(["draft", "sent", "viewed"]);
export const AWAITING_STATUSES = new Set(["sent", "viewed"]);

export function quoteTabStatuses(tab: QuoteTab): string[] | null {
  if (tab === "all") return null;
  if (tab === "draft") return ["draft"];
  if (tab === "open") return ["sent", "viewed"];
  if (tab === "approved") return ["approved"];
  return ["expired"];
}

export function listStatusParam(tab: QuoteTab): string | undefined {
  const statuses = quoteTabStatuses(tab);
  if (!statuses || statuses.length !== 1) return undefined;
  return statuses[0];
}

export function filterQuotes(quotes: QuoteOut[], tab: QuoteTab, search: string): QuoteOut[] {
  const statuses = quoteTabStatuses(tab);
  const query = search.trim().toLowerCase();
  return quotes.filter((quote) => {
    if (statuses && !statuses.includes(quote.status)) return false;
    if (!query) return true;
    const haystack = [quote.number, quote.customer_notes, quote.internal_notes, quote.status]
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

export function quotesWorkspaceKpis(summary: DashboardSummary | null | undefined, quotes: QuoteOut[]) {
  const draft = summary?.quotes_draft ?? quotes.filter((row) => row.status === "draft").length;
  const sent = summary?.quotes_sent ?? quotes.filter((row) => row.status === "sent").length;
  const viewed = summary?.quotes_viewed ?? quotes.filter((row) => row.status === "viewed").length;
  const approved = summary?.quotes_approved ?? quotes.filter((row) => row.status === "approved").length;
  const rejected = summary?.quotes_rejected ?? quotes.filter((row) => row.status === "rejected").length;
  const total = draft + sent + viewed + approved + rejected;
  return {
    draft,
    sent,
    viewed,
    awaiting: sent + viewed,
    approved,
    openCount: summary ? quotesInPlay(summary) : quotes.filter((row) => OPEN_STATUSES.has(row.status)).length,
    openValue: quotesOpenValue(quotes),
    conversion: summary
      ? quoteConversion(summary)
      : {
          percent: total === 0 ? null : Math.round((approved / total) * 100),
          approved,
          total,
        },
  };
}

export function quotesMarginTotals(quotes: QuoteOut[]) {
  const rows = quotes.filter((quote) => quote.margin_amount != null || quote.cost_total != null);
  if (!rows.length) return null;
  const amount = rows.reduce((sum, quote) => sum + Number(quote.margin_amount || 0), 0);
  const gross = rows.reduce((sum, quote) => sum + Number(quote.total_gross || 0), 0);
  return {
    amount,
    percent: gross > 0 ? Math.round((amount / gross) * 1000) / 10 : null,
  };
}
