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
      <div className={embedded ? "mt-3" : "mt-4"}>
        <p className="text-sm font-medium text-fg">{he.recentQuotesEmptyTitle}</p>
        <p className="mt-1 text-sm text-fg-muted">{he.recentQuotesEmptyBody}</p>
        {canCreate ? (
          <NewQuoteButton className="mt-4" />
        ) : null}
      </div>
    );
    if (embedded) return empty;
    return (
      <section className="ops-card p-5" aria-labelledby="recent-quotes-heading">
        <p className="public-mono text-[10px] tracking-[0.16em] text-fg-muted">RECENT QUOTES</p>
        <h2 id="recent-quotes-heading" className="mt-1 text-base font-semibold text-fg">
          {he.recentQuotesTitle}
        </h2>
        {empty}
      </section>
    );
  }

  const header = embedded ? (
    <h3 className="text-sm font-medium text-fg">{he.recentQuotesTitle}</h3>
  ) : (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="public-mono text-[10px] tracking-[0.16em] text-fg-muted">RECENT QUOTES</p>
        <h2 id="recent-quotes-heading" className="mt-1 text-base font-semibold text-fg">
          {he.recentQuotesTitle}
        </h2>
      </div>
      <Link
        to="/app/quotes"
        className="text-sm font-medium text-action hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        {he.recentQuotesViewAll}
      </Link>
    </div>
  );

  const list = (
    <ul className={embedded ? "mt-3 divide-y divide-border" : "mt-4 divide-y divide-border"}>
      {rows.map((quote) => (
        <li key={quote.id} className="flex min-h-11 items-center justify-between gap-3 py-3">
          <Link
            to="/app/quotes/$quoteId"
            params={{ quoteId: quote.id }}
            className="ops-quote-row min-w-0 flex-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <p className="truncate text-sm font-medium text-fg">
              {quote.number}
              {quote.customer_name ? ` · ${quote.customer_name}` : ""}
            </p>
            <p className="text-xs text-fg-muted">
              {formatMoney(quote.total_gross)} · {formatDay(quote.updated_at)}
            </p>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <Status label={quoteStatusLabel(quote.status)} tone={quoteStatusTone(quote.status)} />
            <Link
              to="/app/quotes/$quoteId"
              params={{ quoteId: quote.id }}
              className="text-sm font-medium text-action hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              {he.commandOpenQuote}
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );

  if (embedded) {
    return (
      <div>
        {header}
        {list}
      </div>
    );
  }

  return (
    <section className="ops-card p-5" aria-labelledby="recent-quotes-heading">
      {header}
      {list}
      <Link
        to="/app/quotes"
        className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-[var(--radius-control)] border border-border text-sm font-medium text-fg-muted transition-colors duration-200 hover:bg-bg-subtle hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        {he.recentQuotesViewAll}
      </Link>
    </section>
  );
}
