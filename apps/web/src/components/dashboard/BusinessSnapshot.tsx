import type { DashboardSummary } from "@site-secure/api-client";
import { he } from "../../i18n/he";
import { formatMoney } from "../../lib/quotes";
import { quoteConversion } from "../../lib/ux-metrics";

const STATUS_KEYS = ["draft", "sent", "viewed", "approved"] as const;

function countFor(summary: DashboardSummary, status: (typeof STATUS_KEYS)[number]): number {
  if (status === "draft") return summary.quotes_draft;
  if (status === "sent") return summary.quotes_sent;
  if (status === "viewed") return summary.quotes_viewed;
  return summary.quotes_approved;
}

/** Executive KPI strip with compact pipeline status badges. */
export function BusinessSnapshot({ summary }: { summary: DashboardSummary }) {
  const conversion = quoteConversion(summary);
  const cells = [
    { label: he.snapshotOpenValue, value: formatMoney(summary.quotes_open_value ?? 0) },
    { label: he.snapshotApprovedValue, value: formatMoney(summary.quotes_approved_value ?? 0) },
  ];
  if (conversion.percent != null && conversion.total >= 3) {
    cells.push({
      label: he.uxQuoteConversion,
      value: he.uxPercent(conversion.percent),
    });
  }
  cells.push({
    label: he.snapshotQuoteVolume,
    value: String(conversion.total),
  });

  return (
    <section className="ops-card ops-snapshot" aria-labelledby="business-snapshot-heading">
      <div className="ops-snapshot-head">
        <p className="public-mono text-[10px] tracking-[0.16em] text-fg-muted">{he.businessKicker}</p>
        <h2 id="business-snapshot-heading" className="text-base font-semibold text-fg">
          {he.businessTitle}
        </h2>
      </div>
      <dl className="ops-snapshot-grid is-compact">
        {cells.map((cell) => (
          <div key={cell.label} className="ops-snapshot-cell">
            <dt className="text-xs text-fg-muted">{cell.label}</dt>
            <dd className="mt-1 text-lg font-semibold tracking-tight text-fg tabular-nums">{cell.value}</dd>
          </div>
        ))}
      </dl>
      <div className="ops-snapshot-status" aria-label={he.quotePipelineTitle}>
        {STATUS_KEYS.map((status) => (
          <span key={status} className="ops-snapshot-badge">
            {he.quotePipelineStages[status]}: {countFor(summary, status)}
          </span>
        ))}
      </div>
    </section>
  );
}
