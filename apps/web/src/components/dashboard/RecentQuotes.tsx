import { Status } from "@site-secure/ui";
import type { RecentQuote } from "@site-secure/api-client";
import { Link } from "@tanstack/react-router";
import { he } from "../../i18n/he";
import { formatMoney, quoteStatusLabel, quoteStatusTone } from "../../lib/quotes";
import { NewQuoteButton } from "../quotes/NewQuoteButton";

const MAX_RECENT = 4;

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
      <div className="ops-recent-empty">
        <p className="text-sm font-medium text-fg">{he.recentQuotesEmptyTitle}</p>
        <p className="mt-1 text-sm text-fg-muted">{he.recentQuotesEmptyBody}</p>
        {canCreate ? <NewQuoteButton className="mt-3" /> : null}
      </div>
    );
    if (embedded) return empty;
    return (
      <section className="ops-recent-card is-quiet" aria-labelledby="recent-quotes-heading">
        <h2 id="recent-quotes-heading" className="ops-section-title is-secondary">
          {he.recentQuotesTitle}
        </h2>
        {empty}
      </section>
    );
  }

  const list = (
    <ul className="ops-recent-list">
      {rows.map((quote) => (
        <li key={quote.id}>
          <Link
            to="/app/quotes/$quoteId"
            params={{ quoteId: quote.id }}
            className="ops-recent-row"
          >
            <div className="ops-recent-main min-w-0">
              <p className="ops-recent-customer">{quote.customer_name ?? "—"}</p>
              <p className="ops-recent-meta">
                <span className="ops-recent-number ltr-meta">{quote.number}</span>
                <span className="ops-recent-amount tabular-nums">{formatMoney(quote.total_gross)}</span>
              </p>
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
        <h3 className="ops-section-title is-secondary">{he.recentQuotesTitle}</h3>
        {list}
      </div>
    );
  }

  return (
    <section className="ops-recent-card is-quiet" aria-labelledby="recent-quotes-heading">
      <div className="ops-section-head">
        <h2 id="recent-quotes-heading" className="ops-section-title is-secondary">
          {he.recentQuotesTitle}
        </h2>
        <Link to="/app/quotes" className="ops-section-link">
          {he.recentQuotesViewAll}
        </Link>
      </div>
      {list}
    </section>
  );
}
