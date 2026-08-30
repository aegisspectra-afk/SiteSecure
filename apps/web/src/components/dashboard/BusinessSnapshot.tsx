import type { BusinessChart, DashboardSummary } from "@site-secure/api-client";
import { TrendingDown, TrendingUp } from "lucide-react";
import { he } from "../../i18n/he";
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

function TrendBadge({ value, suffix = "%" }: { value: number | null | undefined; suffix?: string }) {
  if (value == null || value === 0) return null;
  const positive = value > 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs ${positive ? "text-success" : "text-danger"}`}>
      <Icon className="size-3 shrink-0" aria-hidden />
      <span>
        {positive ? "+" : ""}
        {value}
        {suffix}
      </span>
    </span>
  );
}

export function BusinessSnapshot({
  summary,
  chart = null,
}: {
  summary: DashboardSummary;
  chart?: BusinessChart | null;
}) {
  const conversion = quoteConversion(summary);
  const rangeLabel =
    chart && chart.labels_he.length >= 2
      ? `${chart.labels_he[0]} – ${chart.labels_he[chart.labels_he.length - 1]}`
      : null;

  return (
    <section className="ops-card ops-snapshot ops-snapshot-compact" aria-labelledby="business-snapshot-heading">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 id="business-snapshot-heading" className="text-base font-semibold text-fg">
          {he.businessTitle}
        </h2>
        {chart ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-fg-muted">
            <span>{he.businessChartWindow}</span>
            {rangeLabel ? <span className="ops-snapshot-range">{rangeLabel}</span> : null}
          </div>
        ) : null}
      </div>

      {chart ? (
        <div className="ops-snapshot-chart mt-3">
          <div className="mb-1 flex items-center justify-between gap-2 text-xs text-fg-muted">
            <span>{he.businessChartRevenueTrend}</span>
            <TrendBadge value={chart.revenue_change_percent} />
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

      <dl className="ops-snapshot-grid is-compact-v2 mt-3">
        <div className="ops-metric-tile">
          <dt className="text-xs text-fg-muted">{he.snapshotOpenValue}</dt>
          <dd className="mt-1 text-lg font-semibold tracking-tight text-fg tabular-nums">
            {formatMoney(summary.quotes_open_value ?? 0)}
          </dd>
        </div>
        <div className="ops-metric-tile">
          <dt className="text-xs text-fg-muted">{he.snapshotApprovedValue}</dt>
          <dd className="mt-1 text-lg font-semibold tracking-tight text-fg tabular-nums">
            {formatMoney(summary.quotes_approved_value ?? 0)}
          </dd>
        </div>
        <div className="ops-metric-tile">
          <dt className="text-xs text-fg-muted">{he.snapshotQuoteVolume}</dt>
          <dd className="mt-1 text-lg font-semibold text-fg">{he.snapshotQuoteVolumeCount(conversion.total)}</dd>
        </div>
        <div className="ops-metric-tile">
          <dt className="text-xs text-fg-muted">{he.kpiConversionLabel}</dt>
          <dd className="mt-1 flex items-baseline gap-2 text-lg font-semibold text-fg">
            {conversion.percent != null && conversion.total >= 1 ? he.uxPercent(conversion.percent) : "—"}
            <TrendBadge value={chart?.conversion_change_percent} />
          </dd>
        </div>
      </dl>

      <div className="ops-snapshot-status" aria-label={he.quotePipelineTitle}>
        {STATUS_KEYS.map((status) => (
          <span key={status} className={`ops-snapshot-badge is-${status}`}>
            {he.quotePipelineStages[status]} {countFor(summary, status)}
          </span>
        ))}
      </div>
    </section>
  );
}
