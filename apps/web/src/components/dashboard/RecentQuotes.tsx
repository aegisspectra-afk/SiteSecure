import { Status } from "@site-secure/ui";
import type { RecentQuote } from "@site-secure/api-client";
import { Link } from "@tanstack/react-router";
import { he } from "../../i18n/he";
import { formatMoney, quoteStatusLabel, quoteStatusTone } from "../../lib/quotes";
import { NewQuoteButton } from "../quotes/NewQuoteButton";

const MAX_RECENT = 5;

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

  const list = (
    <ul className="mt-3 divide-y divide-border border-y border-border">
      {rows.map((quote) => (
        <li key={quote.id}>
          <Link
            to="/app/quotes/$quoteId"
            params={{ quoteId: quote.id }}
            className="flex flex-wrap items-center justify-between gap-2 py-2.5 transition-colors hover:bg-bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-fg">
                {quote.number}
                <span className="font-normal text-fg-muted"> · {quote.customer_name ?? "—"}</span>
              </p>
              <p className="mt-0.5 text-sm tabular-nums text-fg-muted">{formatMoney(quote.total_gross)}</p>
            </div>
            <Status label={quoteStatusLabel(quote.status)} tone={quoteStatusTone(quote.status)} />
          </Link>
        </li>
      ))}
    </ul>
  );

  if (embedded) {
    return (
      <div>
        <h3 className="text-sm font-medium text-fg">{he.recentQuotesTitle}</h3>
        {list}
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
      {list}
    </section>
  );
}
