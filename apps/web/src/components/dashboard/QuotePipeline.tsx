import { Link } from "@tanstack/react-router";
import type { DashboardSummary } from "@site-secure/api-client";
import { he } from "../../i18n/he";

export function QuotePipeline({
  summary,
  linked = true,
}: {
  summary: DashboardSummary;
  linked?: boolean;
}) {
  const rows = [
    { status: "draft", count: summary.quotes_draft },
    { status: "sent", count: summary.quotes_sent },
    { status: "viewed", count: summary.quotes_viewed },
    { status: "approved", count: summary.quotes_approved },
    { status: "rejected", count: summary.quotes_rejected },
  ] as const;
  const total = rows.reduce((sum, row) => sum + row.count, 0);

  return (
    <section className="ops-card p-5" aria-labelledby="quote-pipeline-heading">
      <p className="public-mono text-[10px] tracking-[0.16em] text-fg-muted">QUOTE PIPELINE</p>
      <h2 id="quote-pipeline-heading" className="mt-1 text-base font-semibold text-fg">
        {he.quotePipelineTitle}
      </h2>
      {total === 0 ? (
        <p className="mt-4 text-sm text-fg-muted">{he.dashboardEmptyQuotes}</p>
      ) : (
        <ol className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2">
          {rows.map((row, index) => (
            <li key={row.status} className="flex items-center gap-2 text-sm">
              {index > 0 ? (
                <span className="hidden text-fg-muted sm:inline" aria-hidden>
                  ·
                </span>
              ) : null}
              <span className="text-fg">{he.quoteStatuses[row.status]}</span>
              <span className="font-semibold text-fg">{row.count}</span>
            </li>
          ))}
        </ol>
      )}
      {linked ? (
        <Link
          to="/app/quotes"
          className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-action hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          {he.kpiViewQuotes}
        </Link>
      ) : null}
    </section>
  );
}
