import { Status } from "@site-secure/ui";
import type { RecentQuote } from "@site-secure/api-client";
import { Link } from "@tanstack/react-router";
import { he } from "../../i18n/he";
import { formatMoney, quoteStatusLabel, quoteStatusTone } from "../../lib/quotes";
import { relativeAgeLabel } from "../../lib/relative-age";
import { NewQuoteButton } from "../quotes/NewQuoteButton";

const MAX_RECENT = 5;

/** DASH-5 — dense quote list (not an admin table). */
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
      <div className="ops-recent-empty" data-testid="recent-quotes-empty">
        <p className="text-sm font-medium text-fg">{he.recentQuotesEmptyTitle}</p>
        <p className="mt-1 text-sm text-fg-muted">{he.recentQuotesEmptyBody}</p>
        {canCreate ? (
          <NewQuoteButton className="mt-3 ops-qa-primary is-quote-cta">{he.newQuoteAction}</NewQuoteButton>
        ) : null}
      </div>
    );
    if (embedded) return empty;
    return (
      <section
        className="ops-recent-panel is-dash5"
        aria-labelledby="recent-quotes-heading"
        data-testid="recent-quotes"
      >
        <h2 id="recent-quotes-heading" className="ops-section-title is-secondary">
          {he.recentQuotesTitle}
        </h2>
        {empty}
      </section>
    );
  }

  const list = (
    <ul className="ops-recent-list is-dash5">
      {rows.map((quote) => {
        const title = quote.title?.trim() || quote.customer_name?.trim() || "—";
        const customer = quote.customer_name?.trim();
        const updated = relativeAgeLabel(quote.updated_at);
        return (
          <li key={quote.id}>
            <Link
              to="/app/quotes/$quoteId"
              params={{ quoteId: quote.id }}
              className="ops-recent-row is-dash5"
              data-testid="recent-quote-row"
            >
              <div className="ops-recent-row-main min-w-0">
                <p className="ops-recent-row-title truncate">{title}</p>
                <p className="ops-recent-row-meta">
                  <span className="ops-recent-number ltr-meta" dir="ltr">
                    {quote.number}
                  </span>
                  {customer && customer !== title ? (
                    <>
                      <span className="ops-recent-meta-sep" aria-hidden>
                        ·
                      </span>
                      <span className="truncate">{customer}</span>
                    </>
                  ) : null}
                  {updated ? (
                    <>
                      <span className="ops-recent-meta-sep" aria-hidden>
                        ·
                      </span>
                      <span>{updated}</span>
                    </>
                  ) : null}
                </p>
              </div>
              <div className="ops-recent-row-trailing">
                <span className="ops-recent-amount tabular-nums ltr-meta" dir="ltr">
                  {formatMoney(quote.total_gross)}
                </span>
                <Status label={quoteStatusLabel(quote.status)} tone={quoteStatusTone(quote.status)} />
                <span className="ops-recent-open">{he.recentQuotesOpen}</span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );

  if (embedded) {
    return (
      <div data-testid="recent-quotes">
        <h3 className="ops-section-title is-secondary">{he.recentQuotesTitle}</h3>
        {list}
      </div>
    );
  }

  return (
    <section
      className={`ops-recent-panel is-dash5${rows.length <= 2 ? " is-compact" : ""}`}
      aria-labelledby="recent-quotes-heading"
      data-testid="recent-quotes"
    >
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
