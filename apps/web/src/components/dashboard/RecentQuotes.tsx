import { Status } from "@site-secure/ui";
import type { RecentQuote } from "@site-secure/api-client";
import { Link } from "@tanstack/react-router";
import { he } from "../../i18n/he";
import { formatDay, formatMoney, quoteStatusLabel, quoteStatusTone } from "../../lib/quotes";

export function RecentQuotes({
  quotes,
  embedded = false,
}: {
  quotes: RecentQuote[];
  canCreate?: boolean;
  embedded?: boolean;
}) {
  if (!quotes.length) return null;
  const list = (
    <ul className={embedded ? "mt-3 divide-y divide-border" : "mt-4 divide-y divide-border"}>
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
    <section className="ops-card p-5" aria-labelledby="recent-quotes-heading">
      <p className="public-mono text-[10px] tracking-[0.16em] text-fg-muted">RECENT QUOTES</p>
      <h2 id="recent-quotes-heading" className="mt-1 text-base font-semibold text-fg">
        {he.recentQuotesTitle}
      </h2>
      {list}
    </section>
  );
}
