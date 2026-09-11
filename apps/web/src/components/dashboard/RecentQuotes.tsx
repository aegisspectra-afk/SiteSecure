import { Status } from "@site-secure/ui";
import type { RecentQuote } from "@site-secure/api-client";
import { Link } from "@tanstack/react-router";
import { he } from "../../i18n/he";
import { formatMoney, quoteStatusLabel, quoteStatusTone } from "../../lib/quotes";
import { relativeAgeLabel } from "../../lib/relative-age";
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
      <section className="ops-recent-panel" aria-labelledby="recent-quotes-heading">
        <h2 id="recent-quotes-heading" className="ops-section-title is-secondary">
          {he.recentQuotesTitle}
        </h2>
        {empty}
      </section>
    );
  }

  const mobileList = (
    <ul className="ops-recent-mobile">
      {rows.map((quote) => (
        <li key={quote.id}>
          <Link
            to="/app/quotes/$quoteId"
            params={{ quoteId: quote.id }}
            className="ops-recent-mobile-row"
          >
            <div className="ops-recent-mobile-top">
              <span className="ops-recent-number ltr-meta" dir="ltr">
                {quote.number}
              </span>
              <Status label={quoteStatusLabel(quote.status)} tone={quoteStatusTone(quote.status)} />
            </div>
            <p className="ops-recent-mobile-customer">{quote.customer_name?.trim() || quote.title?.trim() || "—"}</p>
            <p className="ops-recent-mobile-amount tabular-nums">{formatMoney(quote.total_gross)}</p>
          </Link>
        </li>
      ))}
    </ul>
  );

  const desktopTable = (
    <div className="ops-recent-table-wrap">
      <table className="ops-recent-table">
        <caption className="sr-only">{he.recentQuotesTitle}</caption>
        <thead>
          <tr>
            <th scope="col">{he.dashRecentColQuote}</th>
            <th scope="col">{he.dashRecentColCustomer}</th>
            <th scope="col">{he.dashRecentColAmount}</th>
            <th scope="col">{he.dashRecentColStatus}</th>
            <th scope="col">{he.dashRecentColUpdated}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((quote) => {
            const updated = relativeAgeLabel(quote.updated_at);
            return (
              <tr key={quote.id}>
                <td>
                  <Link
                    to="/app/quotes/$quoteId"
                    params={{ quoteId: quote.id }}
                    className="ops-recent-table-link ltr-meta"
                    dir="ltr"
                  >
                    {quote.number}
                  </Link>
                </td>
                <td className="ops-recent-table-customer">
                  <Link to="/app/quotes/$quoteId" params={{ quoteId: quote.id }} className="ops-recent-table-link">
                    {quote.customer_name?.trim() || quote.title?.trim() || "—"}
                  </Link>
                </td>
                <td className="tabular-nums">{formatMoney(quote.total_gross)}</td>
                <td>
                  <Status label={quoteStatusLabel(quote.status)} tone={quoteStatusTone(quote.status)} />
                </td>
                <td className="ops-recent-table-updated">{updated ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  if (embedded) {
    return (
      <div>
        <h3 className="ops-section-title is-secondary">{he.recentQuotesTitle}</h3>
        {mobileList}
        {desktopTable}
      </div>
    );
  }

  return (
    <section className="ops-recent-panel" aria-labelledby="recent-quotes-heading">
      <div className="ops-section-head">
        <h2 id="recent-quotes-heading" className="ops-section-title is-secondary">
          {he.recentQuotesTitle}
        </h2>
        <Link to="/app/quotes" className="ops-section-link">
          {he.recentQuotesViewAll}
        </Link>
      </div>
      {mobileList}
      {desktopTable}
    </section>
  );
}
