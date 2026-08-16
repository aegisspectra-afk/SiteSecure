import { Link } from "@tanstack/react-router";
import type { DashboardSummary, RecentQuote } from "@site-secure/api-client";
import { he } from "../../i18n/he";
import { formatMoney } from "../../lib/quotes";
import { hasQuoteRecords, quoteConversion, quotesInPlay } from "../../lib/ux-metrics";
import { RecentQuotes } from "./RecentQuotes";

export function SalesSnapshot({
  summary,
  recentQuotes,
  canCreate,
}: {
  summary: DashboardSummary;
  recentQuotes: RecentQuote[];
  canCreate: boolean;
}) {
  const openQuotes = quotesInPlay(summary);
  const pending = summary.quotes_open;
  const conversion = quoteConversion(summary);
  const hasQuotes = hasQuoteRecords(summary) || recentQuotes.length > 0;
  const openValue = summary.quotes_open_value;

  return (
    <section className="ops-card p-5" aria-labelledby="sales-heading">
      <p className="public-mono text-[10px] tracking-[0.16em] text-fg-muted">SALES</p>
      <h2 id="sales-heading" className="mt-1 text-base font-semibold text-fg">
        {he.quotesSectionTitle}
      </h2>
      <dl className={`mt-4 grid gap-3 ${hasQuotes && conversion.percent != null && conversion.total >= 3 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"}`}>
        <div>
          <dt className="public-mono text-[10px] tracking-[0.14em] text-fg-muted">{he.salesOpenKicker}</dt>
          <dd className="mt-1 text-2xl font-semibold tracking-tight text-fg">{openQuotes}</dd>
        </div>
        <div>
          <dt className="public-mono text-[10px] tracking-[0.14em] text-fg-muted">{he.salesPendingKicker}</dt>
          <dd className="mt-1 text-2xl font-semibold tracking-tight text-fg">{pending}</dd>
        </div>
        <div>
          <dt className="public-mono text-[10px] tracking-[0.14em] text-fg-muted">{he.salesApprovedKicker}</dt>
          <dd className="mt-1 text-2xl font-semibold tracking-tight text-fg">{summary.quotes_approved}</dd>
        </div>
        {hasQuotes && conversion.percent != null && conversion.total >= 3 ? (
          <div>
            <dt className="public-mono text-[10px] tracking-[0.14em] text-fg-muted">{he.salesConversionKicker}</dt>
            <dd className="mt-1 text-2xl font-semibold tracking-tight text-fg">{he.uxPercent(conversion.percent)}</dd>
          </div>
        ) : null}
      </dl>
      {hasQuotes && openValue != null ? (
        <p className="mt-3 text-sm text-fg">{he.salesOpenValueLine(formatMoney(openValue))}</p>
      ) : null}
      {hasQuotes ? (
        <div className="mt-5 border-t border-border pt-4">
          <RecentQuotes quotes={recentQuotes} embedded />
        </div>
      ) : (
        <div className="mt-5 border-t border-border pt-4">
          <p className="text-sm text-fg-muted">{he.quotesSectionEmpty}</p>
          {canCreate ? (
            <Link
              to="/app/quotes/new"
              className="mt-4 inline-flex min-h-11 items-center rounded-[var(--radius-control)] bg-action px-4 text-sm font-medium text-action-fg hover:bg-action-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              {he.newQuoteAction}
            </Link>
          ) : null}
        </div>
      )}
    </section>
  );
}
