import type { BusinessChart, DashboardSummary } from "@site-secure/api-client";
import { he } from "../../i18n/he";
import { meaningfulChangePercent } from "../../lib/attention-queue";
import { formatMoney } from "../../lib/quotes";
import { quoteConversion } from "../../lib/ux-metrics";

const STATUS_KEYS = ["draft", "sent", "viewed", "approved", "rejected"] as const;

function countFor(summary: DashboardSummary, status: (typeof STATUS_KEYS)[number]): number {
  if (status === "draft") return summary.quotes_draft;
  if (status === "sent") return summary.quotes_sent;
  if (status === "viewed") return summary.quotes_viewed;
  if (status === "approved") return summary.quotes_approved;
  return summary.quotes_rejected;
}

function SparklineChart({
  data,
  height = 36,
  color = "var(--color-fg-muted)",
  fillColor = "var(--color-fg-muted)",
  label,
}: {
  data: number[];
  height?: number;
  color?: string;
  fillColor?: string;
  label: string;
}) {
  if (data.length < 2) return null;
  const max = Math.max(...data) * 1.15 || 1;
  const min = Math.min(...data) * 0.85;
  const range = max - min || 1;

  const points = data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * 100;
      const y = 100 - ((value - min) / range) * 100;
      return `${x},${y}`;
    })
    .join(" ");

  const last = data[data.length - 1];
  const lastY = 100 - ((last - min) / range) * 100;

  return (
    <div className="ops-sparkline is-secondary" style={{ height }} role="img" aria-label={label}>
      <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        <polygon points={`0,100 ${points} 100,100`} fill={fillColor} opacity={0.06} />
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.7}
        />
        <circle cx={100} cy={lastY} r="2" fill={color} vectorEffect="non-scaling-stroke" opacity={0.8} />
      </svg>
    </div>
  );
}

export function CommercialPulse({
  summary,
  chart = null,
}: {
  summary: DashboardSummary;
  chart?: BusinessChart | null;
}) {
  const conversion = quoteConversion(summary);
  const open = summary.quotes_open ?? 0;
  const change = meaningfulChangePercent(chart?.revenue_change_percent, chart?.revenue ?? null);
  const hasChart = Boolean(chart && chart.revenue.some((v) => v > 0));

  return (
    <section className="ops-commercial-card" aria-labelledby="commercial-pulse-heading">
      <h2 id="commercial-pulse-heading" className="ops-section-title is-secondary">
        {he.commercialPulseTitle}
      </h2>

      <dl className="ops-commercial-metrics">
        <div className="ops-commercial-metric">
          <dt>{he.snapshotOpenValue}</dt>
          <dd className="tabular-nums">{formatMoney(summary.quotes_open_value ?? 0)}</dd>
        </div>
        <div className="ops-commercial-metric">
          <dt>{he.kpiQuotesOpen}</dt>
          <dd className="tabular-nums">{open}</dd>
        </div>
        <div className="ops-commercial-metric">
          <dt>{he.snapshotApprovedValue}</dt>
          <dd className="tabular-nums">{formatMoney(summary.quotes_approved_value ?? 0)}</dd>
        </div>
        <div className="ops-commercial-metric">
          <dt>{he.kpiConversionLabel}</dt>
          <dd className="tabular-nums">
            {conversion.percent != null && conversion.total >= 1 ? he.uxPercent(conversion.percent) : "—"}
          </dd>
        </div>
      </dl>

      <div className="ops-commercial-status" aria-label={he.quotePipelineTitle}>
        {STATUS_KEYS.map((status) => (
          <span key={status} className={`ops-status-chip is-${status}`}>
            {he.quotePipelineStages[status]} {countFor(summary, status)}
          </span>
        ))}
      </div>

      {hasChart && chart ? (
        <div className="ops-commercial-chart">
          <div className="ops-commercial-chart-label">
            <span>{he.businessChartQuoteValueTrend}</span>
            {change != null ? (
              <span className={change > 0 ? "text-success" : "text-danger"}>
                {change > 0 ? "+" : ""}
                {change}%
              </span>
            ) : null}
          </div>
          <SparklineChart data={chart.revenue} label={he.businessChartAria(chart.labels_he, chart.revenue)} />
        </div>
      ) : null}
    </section>
  );
}
