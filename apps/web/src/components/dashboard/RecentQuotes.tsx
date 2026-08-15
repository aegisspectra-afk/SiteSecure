import { EmptyState, Status } from "@site-secure/ui";
import type { RecentQuote } from "@site-secure/api-client";
import { Link } from "@tanstack/react-router";
import { he } from "../../i18n/he";
import { formatDay, formatMoney, quoteStatusLabel, quoteStatusTone } from "../../lib/quotes";

export function RecentQuotes({
  quotes,
  canCreate,
}: {
  quotes: RecentQuote[];
  canCreate: boolean;
}) {
  return (
    <section className="ops-card p-5" aria-labelledby="recent-quotes-heading">
      <p className="public-mono text-[10px] tracking-[0.16em] text-fg-muted">RECENT QUOTES</p>
      <h2 id="recent-quotes-heading" className="mt-1 text-base font-semibold text-fg">
        {he.recentQuotesTitle}
      </h2>
      {quotes.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title={he.quotesEmpty}
            description={he.dashboardEmptyQuotes}
            action={
              canCreate ? (
                <Link
                  to="/app/quotes/new"
                  className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] bg-action px-4 text-sm font-medium text-action-fg"
                >
                  {he.newQuote}
                </Link>
              ) : undefined
            }
          />
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {quotes.map((quote) => (
            <li key={quote.id} className="flex min-h-11 flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-fg">
                  {quote.number}
                  {quote.customer_name ? ` · ${quote.customer_name}` : ""}
                </p>
                <p className="text-xs text-fg-muted">
                  {formatMoney(quote.total_gross)} · {formatDay(quote.updated_at)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Status label={quoteStatusLabel(quote.status)} tone={quoteStatusTone(quote.status)} />
                <Link
                  to="/app/quotes/$quoteId"
                  params={{ quoteId: quote.id }}
                  className="text-sm font-medium text-action hover:underline"
                >
                  {he.quoteOpen}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
