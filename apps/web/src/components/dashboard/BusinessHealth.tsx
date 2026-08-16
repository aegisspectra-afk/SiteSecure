import type { DashboardSummary } from "@site-secure/api-client";
import { he } from "../../i18n/he";
import { formatMoney } from "../../lib/quotes";
import { hasQuoteRecords, quoteConversion, quotesInPlay } from "../../lib/ux-metrics";

export function BusinessHealth({ summary }: { summary: DashboardSummary }) {
  if (!hasQuoteRecords(summary)) return null;
  const conversion = quoteConversion(summary);
  const openValue = summary.quotes_open_value ?? 0;

  return (
    <section className="ops-card p-5" aria-labelledby="business-health-heading">
      <p className="public-mono text-[10px] tracking-[0.16em] text-fg-muted">{he.businessKicker}</p>
      <h2 id="business-health-heading" className="mt-1 text-base font-semibold text-fg">
        {he.businessTitle}
      </h2>
      <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div>
          <dt className="text-xs text-fg-muted">{he.businessOpenValue}</dt>
          <dd className="mt-1 text-2xl font-semibold tracking-tight text-fg">{formatMoney(openValue)}</dd>
          <p className="mt-1 text-xs text-fg-muted">{he.quotesKpiOpenHint(quotesInPlay(summary))}</p>
        </div>
        <div>
          <dt className="text-xs text-fg-muted">{he.businessApprovedValue}</dt>
          <dd className="mt-1 text-2xl font-semibold tracking-tight text-fg">
            {formatMoney(summary.quotes_approved_value)}
          </dd>
        </div>
        {conversion.percent != null && conversion.total >= 3 ? (
          <div>
            <dt className="text-xs text-fg-muted">{he.uxQuoteConversion}</dt>
            <dd className="mt-1 text-2xl font-semibold tracking-tight text-fg">{he.uxPercent(conversion.percent)}</dd>
            <p className="mt-1 text-xs text-fg-muted">
              {he.uxQuoteConversionHint(conversion.approved, conversion.total)}
            </p>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
