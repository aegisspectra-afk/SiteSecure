import type { AttentionGroup, BusinessChart, DashboardSummary, RecentQuote } from "@site-secure/api-client";
import { Link } from "@tanstack/react-router";
import { he } from "../../i18n/he";
import { formatMoney, quoteStatusLabel } from "../../lib/quotes";
import { relativeAgeLabel } from "../../lib/relative-age";
import { quoteConversion } from "../../lib/ux-metrics";
import { CommercialPulseChart } from "./CommercialPulseChart";

function attentionCount(groups: AttentionGroup[], kind: string): number {
  const group = groups.find((g) => g.kind === kind);
  return group?.count ?? group?.items?.length ?? 0;
}

export function AnalyticsWorkspace({
  summary,
  chart,
  attention,
  recentQuotes,
}: {
  summary: DashboardSummary;
  chart: BusinessChart | null;
  attention: AttentionGroup[];
  recentQuotes: RecentQuote[];
}) {
  const conversion = quoteConversion(summary);
  const funnel = [
    { key: "draft", label: he.quoteStatuses.draft, value: summary.quotes_draft },
    { key: "sent", label: he.quoteStatuses.sent, value: summary.quotes_sent },
    { key: "viewed", label: he.quoteStatuses.viewed, value: summary.quotes_viewed },
    { key: "approved", label: he.quoteStatuses.approved, value: summary.quotes_approved },
    { key: "rejected", label: he.quoteStatuses.rejected, value: summary.quotes_rejected },
  ];
  const funnelMax = Math.max(1, ...funnel.map((s) => s.value));
  const awaitingCustomer = attentionCount(attention, "quote_awaiting_customer");
  const awaitingUs = attentionCount(attention, "quote_awaiting_us");
  const expiring = attentionCount(attention, "quote_expiring");
  const staleDrafts = attentionCount(attention, "quote_stale_draft");
  const signals = [
    { key: "awaiting_customer", label: he.analyticsSignalAwaitingCustomer, value: awaitingCustomer },
    { key: "awaiting_us", label: he.analyticsSignalAwaitingUs, value: awaitingUs },
    { key: "expiring", label: he.analyticsSignalExpiring, value: expiring },
    { key: "stale", label: he.analyticsSignalStaleDrafts, value: staleDrafts },
  ].filter((s) => s.value > 0);
  const hasChart = Boolean(chart && chart.revenue.some((v) => v > 0));
  const recent = recentQuotes.slice(0, 6);

  return (
    <div className="ss-analytics-workspace" data-testid="analytics-workspace">
      <section className="ss-analytics-section" aria-labelledby="analytics-snapshot-heading">
        <div className="ss-analytics-section-head">
          <h2 id="analytics-snapshot-heading" className="ss-analytics-section-title">
            {he.analyticsSnapshotTitle}
          </h2>
          <Link to="/app/quotes" className="ops-section-link">
            {he.analyticsOpenQuotes}
          </Link>
        </div>
        <dl className="ss-analytics-snapshot">
          <div className="ss-analytics-metric">
            <dt>{he.snapshotOpenValue}</dt>
            <dd className="tabular-nums">{formatMoney(summary.quotes_open_value ?? 0)}</dd>
          </div>
          <div className="ss-analytics-metric">
            <dt>{he.kpiQuotesOpen}</dt>
            <dd className="tabular-nums">{summary.quotes_open ?? 0}</dd>
          </div>
          <div className="ss-analytics-metric">
            <dt>{he.snapshotApprovedValue}</dt>
            <dd className="tabular-nums">{formatMoney(summary.quotes_approved_value ?? 0)}</dd>
          </div>
          <div className="ss-analytics-metric">
            <dt>{he.kpiConversionLabel}</dt>
            <dd>
              {conversion.total === 0 ? (
                <span className="tabular-nums">—</span>
              ) : (
                <>
                  {conversion.showPercent && conversion.percent != null ? (
                    <span className="tabular-nums">{he.uxPercent(conversion.percent)}</span>
                  ) : (
                    <span className="tabular-nums">{he.kpiConversionSub(conversion.approved, conversion.total)}</span>
                  )}
                  {conversion.showPercent ? (
                    <span className="ss-analytics-metric-sub">
                      {he.kpiConversionSub(conversion.approved, conversion.total)}
                    </span>
                  ) : null}
                </>
              )}
            </dd>
          </div>
        </dl>
      </section>

      <section className="ss-analytics-section" aria-labelledby="analytics-funnel-heading">
        <h2 id="analytics-funnel-heading" className="ss-analytics-section-title">
          {he.analyticsFunnelTitle}
        </h2>
        <p className="ss-analytics-section-lead">{he.analyticsFunnelLead}</p>
        <ul className="ss-analytics-funnel">
          {funnel.map((stage) => (
            <li key={stage.key} className="ss-analytics-funnel-row">
              <div className="ss-analytics-funnel-meta">
                <span>{stage.label}</span>
                <span className="tabular-nums">{stage.value}</span>
              </div>
              <div className="ss-analytics-funnel-track" aria-hidden>
                <span
                  className="ss-analytics-funnel-fill"
                  style={{ width: `${Math.round((stage.value / funnelMax) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      {signals.length > 0 ? (
        <section className="ss-analytics-section" aria-labelledby="analytics-signals-heading">
          <h2 id="analytics-signals-heading" className="ss-analytics-section-title">
            {he.analyticsSignalsTitle}
          </h2>
          <ul className="ss-analytics-signals">
            {signals.map((signal) => (
              <li key={signal.key} className="ss-analytics-signal">
                <span className="ss-analytics-signal-label">{signal.label}</span>
                <span className="ss-analytics-signal-value tabular-nums">{signal.value}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {hasChart && chart ? (
        <section className="ss-analytics-section" aria-labelledby="analytics-trend-heading">
          <h2 id="analytics-trend-heading" className="ss-analytics-section-title">
            {he.analyticsTrendTitle}
          </h2>
          <p className="ss-analytics-section-lead">{he.analyticsTrendLead}</p>
          <CommercialPulseChart chart={chart} showExpandLink={false} />
        </section>
      ) : null}

      {recent.length > 0 ? (
        <section className="ss-analytics-section" aria-labelledby="analytics-recent-heading">
          <div className="ss-analytics-section-head">
            <h2 id="analytics-recent-heading" className="ss-analytics-section-title">
              {he.analyticsRecentTitle}
            </h2>
            <Link to="/app/quotes" className="ops-section-link">
              {he.analyticsOpenQuotes}
            </Link>
          </div>
          <ul className="ss-analytics-recent">
            {recent.map((quote) => (
              <li key={quote.id}>
                <Link to="/app/quotes/$quoteId" params={{ quoteId: quote.id }} className="ss-analytics-recent-row">
                  <span className="ss-analytics-recent-main">
                    <span className="ss-analytics-recent-title">
                      {quote.customer_name || quote.title || quote.number}
                    </span>
                    <span className="ss-analytics-recent-meta">
                      {[quote.number, quoteStatusLabel(quote.status), relativeAgeLabel(quote.updated_at)]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <span className="ss-analytics-recent-amount tabular-nums ltr-meta" dir="ltr">
                    {quote.total_gross != null ? formatMoney(quote.total_gross) : "—"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
