import { Link } from "@tanstack/react-router";
import { cn } from "@site-secure/ui";
import type { DashboardSummary } from "@site-secure/api-client";
import { he } from "../../i18n/he";
import { pipelineTabForStatus } from "../../lib/quote-workspace";

const FLOW = ["draft", "sent", "viewed", "approved"] as const;

function countFor(summary: DashboardSummary, status: (typeof FLOW)[number] | "rejected"): number {
  if (status === "draft") return summary.quotes_draft;
  if (status === "sent") return summary.quotes_sent;
  if (status === "viewed") return summary.quotes_viewed;
  if (status === "approved") return summary.quotes_approved;
  return summary.quotes_rejected;
}

/** Enterprise workflow bar — navigation, not KPI duplication. */
export function QuotePipeline({
  summary,
  linked = true,
}: {
  summary: DashboardSummary;
  linked?: boolean;
}) {
  const flowTotal = FLOW.reduce((sum, status) => sum + countFor(summary, status), 0);
  const rejected = countFor(summary, "rejected");
  const rejectedTab = pipelineTabForStatus("rejected");

  return (
    <section className="ops-flow-panel" aria-labelledby="quote-pipeline-heading">
      <div className="ops-flow-head">
        <h2 id="quote-pipeline-heading" className="text-base font-semibold text-fg">
          {he.quotePipelineTitle}
        </h2>
        {linked ? (
          <Link
            to="/app/quotes"
            className="ops-flow-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            {he.quotePipelineAll}
          </Link>
        ) : null}
      </div>

      {flowTotal === 0 && rejected === 0 ? (
        <p className="mt-4 text-sm text-fg-muted">{he.dashboardEmptyQuotes}</p>
      ) : (
        <ol className="ops-flow" aria-label={he.quotePipelineTitle}>
          {FLOW.map((status, index) => {
            const count = countFor(summary, status);
            const tab = pipelineTabForStatus(status);
            const active = count > 0;
            const className = cn(
              "ops-flow-station",
              `is-${status}`,
              active ? "is-active" : "is-empty",
            );
            const body = (
              <>
                <span className="ops-flow-dot" aria-hidden />
                <span className="ops-flow-meta">
                  <span className="ops-flow-label">{he.quotePipelineStages[status]}</span>
                  <span className="ops-flow-count tabular-nums">{count}</span>
                </span>
              </>
            );
            return (
              <li key={status} className="ops-flow-item">
                {index > 0 ? <span className="ops-flow-rail" aria-hidden /> : null}
                {linked && tab ? (
                  <Link
                    to="/app/quotes"
                    search={{ tab }}
                    className={className}
                    aria-label={`${he.quotePipelineStages[status]}: ${count}`}
                  >
                    {body}
                  </Link>
                ) : (
                  <div className={className}>{body}</div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {rejected > 0 ? (
        <div className="ops-flow-outcome">
          {linked && rejectedTab ? (
            <Link
              to="/app/quotes"
              search={{ tab: rejectedTab }}
              className="ops-flow-outcome-link focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              aria-label={`${he.quoteStatuses.rejected}: ${rejected}`}
            >
              <span className="ops-flow-outcome-kicker">{he.quotePipelineOutcome}</span>
              <span>
                {he.quoteStatuses.rejected} · {rejected}
              </span>
            </Link>
          ) : (
            <p className="text-sm text-fg-muted">
              {he.quotePipelineOutcome}: {he.quoteStatuses.rejected} · {rejected}
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}
