import type { BusinessChart, DashboardSummary } from "@site-secure/api-client";
import { he } from "../../i18n/he";
import { formatMoney } from "../../lib/quotes";
import { quoteConversion } from "../../lib/ux-metrics";
import { CommercialPulseChart } from "./CommercialPulseChart";

export function CommercialPulse({
  summary,
  chart = null,
}: {
  summary: DashboardSummary;
  chart?: BusinessChart | null;
}) {
  const conversion = quoteConversion(summary);
  const open = summary.quotes_open ?? 0;
  const hasChart = Boolean(chart && chart.revenue.some((v) => v > 0));

  return (
    <section className="ops-commercial-card is-secondary" aria-labelledby="commercial-pulse-heading">
      <div className="ops-section-head">
        <h2 id="commercial-pulse-heading" className="ops-section-title is-secondary">
          {he.commercialPulseTitle}
        </h2>
        {!hasChart ? (
          <a href="/app/analytics" className="ops-section-link">
            {he.commercialFullAnalysis}
          </a>
        ) : null}
      </div>

      <dl className="ops-commercial-strip">
        <div className="ops-commercial-strip-item">
          <dt>{he.snapshotOpenValue}</dt>
          <dd className="tabular-nums">{formatMoney(summary.quotes_open_value ?? 0)}</dd>
        </div>
        <div className="ops-commercial-strip-item">
          <dt>{he.kpiQuotesOpen}</dt>
          <dd className="tabular-nums">{open}</dd>
        </div>
        <div className="ops-commercial-strip-item">
          <dt>{he.snapshotApprovedValue}</dt>
          <dd className="tabular-nums">{formatMoney(summary.quotes_approved_value ?? 0)}</dd>
        </div>
        <div className="ops-commercial-strip-item">
          <dt>{he.kpiConversionLabel}</dt>
          <dd className="ops-commercial-conversion">
            {conversion.total === 0 ? (
              <span className="tabular-nums">—</span>
            ) : (
              <>
                {conversion.showPercent && conversion.percent != null ? (
                  <span className="tabular-nums">{he.uxPercent(conversion.percent)}</span>
                ) : null}
                <span className="ops-commercial-conversion-sub">
                  {he.kpiConversionSub(conversion.approved, conversion.total)}
                </span>
              </>
            )}
          </dd>
        </div>
      </dl>

      {hasChart && chart ? <CommercialPulseChart chart={chart} /> : null}
    </section>
  );
}
