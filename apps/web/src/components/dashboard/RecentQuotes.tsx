import { Status } from "@site-secure/ui";
import type { RecentQuote } from "@site-secure/api-client";
import { Link } from "@tanstack/react-router";
import { he } from "../../i18n/he";
import { formatDay, formatMoney, quoteStatusLabel, quoteStatusTone } from "../../lib/quotes";
import { NewQuoteButton } from "../quotes/NewQuoteButton";

const MAX_RECENT = 3;

export function RecentQuotes({
  quotes,
  canCreate = false,
  embedded = false,
}: {
  quotes: RecentQuote[];
  canCreate?: boolean;
  embedded?: boolean;
}) {
  const rows = quotes.slice(0, MAX_RECENT);

  if (!rows.length) {
    const empty = (
      <div className="mt-3">
        <p className="text-sm font-medium text-fg">{he.recentQuotesEmptyTitle}</p>
        <p className="mt-1 text-sm text-fg-muted">{he.recentQuotesEmptyBody}</p>
        {canCreate ? <NewQuoteButton className="mt-4" /> : null}
      </div>
    );
    if (embedded) return empty;
    return (
      <section className="ops-card p-4" aria-labelledby="recent-quotes-heading">
        <h2 id="recent-quotes-heading" className="text-base font-semibold text-fg">
          {he.recentQuotesTitle}
        </h2>
        {empty}
      </section>
    );
  }

  const table = (
    <div className="mt-3 overflow-x-auto">
      <table className="ops-quotes-table w-full text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-fg-muted">
            <th className="py-2 text-start font-medium">{he.recentQuotesColNumber}</th>
            <th className="py-2 text-start font-medium">{he.recentQuotesColClient}</th>
            <th className="py-2 text-start font-medium">{he.recentQuotesColAmount}</th>
            <th className="hidden py-2 text-start font-medium sm:table-cell">{he.recentQuotesColDate}</th>
            <th className="py-2 text-start font-medium">{he.recentQuotesColStatus}</th>
            <th className="py-2 text-end font-medium">
              <span className="sr-only">{he.recentQuotesOpen}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((quote) => (
            <tr key={quote.id} className="border-b border-border last:border-0">
              <td className="py-2.5 font-medium text-fg">{quote.number}</td>
              <td className="max-w-[8rem] truncate py-2.5 text-fg">{quote.customer_name ?? "—"}</td>
              <td className="py-2.5 tabular-nums text-fg">{formatMoney(quote.total_gross)}</td>
              <td className="hidden py-2.5 text-fg-muted sm:table-cell">{formatDay(quote.updated_at)}</td>
              <td className="py-2.5">
                <Status label={quoteStatusLabel(quote.status)} tone={quoteStatusTone(quote.status)} />
              </td>
              <td className="py-2.5 text-end">
                <Link
                  to="/app/quotes/$quoteId"
                  params={{ quoteId: quote.id }}
                  className="text-sm font-medium text-action hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  {he.recentQuotesOpen}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (embedded) {
    return (
      <div>
        <h3 className="text-sm font-medium text-fg">{he.recentQuotesTitle}</h3>
        {table}
      </div>
    );
  }

  return (
    <section className="ops-card p-4" aria-labelledby="recent-quotes-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="recent-quotes-heading" className="text-base font-semibold text-fg">
          {he.recentQuotesTitle}
        </h2>
        <Link
          to="/app/quotes"
          className="text-sm font-medium text-action hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          {he.recentQuotesViewAll}
        </Link>
      </div>
      {table}
    </section>
  );
}
