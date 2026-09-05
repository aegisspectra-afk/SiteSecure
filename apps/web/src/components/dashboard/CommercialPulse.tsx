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
  height = 52,
  color = "var(--color-action)",
  fillColor = "var(--color-action)",
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
    <div className="ops-sparkline" style={{ height }} role="img" aria-label={label}>
      <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        <polygon points={`0,100 ${points} 100,100`} fill={fillColor} opacity={0.12} />
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={100} cy={lastY} r="3" fill={color} vectorEffect="non-scaling-stroke" />
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
    <section className="ops-card ops-snapshot ops-snapshot-compact" aria-labelledby="commercial-pulse-heading">
      <h2 id="commercial-pulse-heading" className="text-base font-semibold text-fg">
        {he.commercialPulseTitle}
      </h2>

      <dl className="ops-snapshot-grid is-compact-v2 mt-3">
        <div className="ops-metric-tile">
          <dt className="text-xs text-fg-muted">{he.snapshotOpenValue}</dt>
          <dd className="mt-1 text-lg font-semibold tracking-tight text-fg tabular-nums">
            {formatMoney(summary.quotes_open_value ?? 0)}
          </dd>
        </div>
        <div className="ops-metric-tile">
          <dt className="text-xs text-fg-muted">{he.kpiQuotesOpen}</dt>
          <dd className="mt-1 text-lg font-semibold text-fg">{open}</dd>
        </div>
        <div className="ops-metric-tile">
          <dt className="text-xs text-fg-muted">{he.snapshotApprovedValue}</dt>
          <dd className="mt-1 text-lg font-semibold tracking-tight text-fg tabular-nums">
            {formatMoney(summary.quotes_approved_value ?? 0)}
          </dd>
        </div>
        <div className="ops-metric-tile">
          <dt className="text-xs text-fg-muted">{he.kpiConversionLabel}</dt>
          <dd className="mt-1 text-lg font-semibold text-fg">
            {conversion.percent != null && conversion.total >= 1 ? he.uxPercent(conversion.percent) : "—"}
          </dd>
        </div>
      </dl>

      <div className="ops-snapshot-status mt-3" aria-label={he.quotePipelineTitle}>
        {STATUS_KEYS.map((status) => (
          <span key={status} className={`ops-snapshot-badge is-${status}`}>
            {he.quotePipelineStages[status]} {countFor(summary, status)}
          </span>
        ))}
      </div>

      {hasChart && chart ? (
        <div className="ops-snapshot-chart mt-4">
          <div className="mb-1 flex items-center justify-between gap-2 text-xs text-fg-muted">
            <span>{he.businessChartQuoteValueTrend}</span>
            {change != null ? (
              <span className={change > 0 ? "text-success" : "text-danger"}>
                {change > 0 ? "+" : ""}
                {change}%
              </span>
            ) : null}
          </div>
          <SparklineChart
            data={chart.revenue}
            label={he.businessChartAria(chart.labels_he, chart.revenue)}
          />
          <div className="mt-1 flex justify-between gap-1 text-[10px] text-fg-subtle">
            {chart.labels_he.map((month) => (
              <span key={month}>{month}</span>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
