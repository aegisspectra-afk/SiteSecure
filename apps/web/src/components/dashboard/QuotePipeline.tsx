import { Link } from "@tanstack/react-router";
import { cn } from "@site-secure/ui";
import type { DashboardSummary } from "@site-secure/api-client";
import { he } from "../../i18n/he";
import { formatMoney } from "../../lib/quotes";
import { pipelineTabForStatus } from "../../lib/quote-workspace";

const FLOW = ["draft", "sent", "viewed", "approved"] as const;

function countFor(summary: DashboardSummary, status: (typeof FLOW)[number] | "rejected"): number {
  if (status === "draft") return summary.quotes_draft;
  if (status === "sent") return summary.quotes_sent;
  if (status === "viewed") return summary.quotes_viewed;
  if (status === "approved") return summary.quotes_approved;
  return summary.quotes_rejected;
}

const TONE: Record<(typeof FLOW)[number] | "rejected", string> = {
  draft: "is-info",
  sent: "is-action",
  viewed: "is-action",
  approved: "is-success",
  rejected: "is-danger",
};

/** DASH-5 — quote lifecycle stations + commercial values. */
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
  const empty = flowTotal === 0 && rejected === 0;

  return (
    <section
      className="ops-quote-pipeline is-dash5"
      aria-labelledby="quote-pipeline-heading"
      data-testid="quote-pipeline"
    >
      <div className="ops-section-head is-pipeline">
        <h2 id="quote-pipeline-heading" className="ops-section-title is-secondary">
          {he.quotePipelineTitle}
        </h2>
        {linked ? (
          <Link to="/app/quotes" className="ops-section-link">
            {he.quotePipelineAll}
          </Link>
        ) : null}
      </div>

      {empty ? (
        <p className="ops-quote-pipeline-empty">{he.dashboardEmptyQuotes}</p>
      ) : (
        <>
          <ol className="ops-quote-pipeline-flow" aria-label={he.quotePipelineTitle}>
            {FLOW.map((status, index) => {
              const count = countFor(summary, status);
              const tab = pipelineTabForStatus(status);
              const active = count > 0;
              const className = cn(
                "ops-quote-pipeline-station",
                TONE[status],
                active ? "is-active" : "is-empty",
              );
              const body = (
                <>
                  <span className="ops-quote-pipeline-label">{he.quotePipelineStages[status]}</span>
                  <span className="ops-quote-pipeline-count tabular-nums ltr-meta" dir="ltr">
                    {count}
                  </span>
                </>
              );
              return (
                <li key={status} className="ops-quote-pipeline-item">
                  {index > 0 ? <span className="ops-quote-pipeline-sep" aria-hidden /> : null}
                  {linked && tab ? (
                    <Link
                      to="/app/quotes"
                      search={{ tab }}
                      className={className}
                      data-testid={`quote-pipeline-${status}`}
                      aria-label={`${he.quotePipelineStages[status]}: ${count}`}
                    >
                      {body}
                    </Link>
                  ) : (
                    <div className={className} data-testid={`quote-pipeline-${status}`}>
                      {body}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>

          <dl className="ops-quote-pipeline-values">
            <div className="ops-quote-pipeline-value">
              <dt>{he.snapshotOpenValue}</dt>
              <dd className="tabular-nums ltr-meta" dir="ltr">
                {formatMoney(summary.quotes_open_value ?? 0)}
              </dd>
            </div>
            <div className="ops-quote-pipeline-value is-approved">
              <dt>{he.snapshotApprovedValue}</dt>
              <dd className="tabular-nums ltr-meta" dir="ltr">
                {formatMoney(summary.quotes_approved_value ?? 0)}
              </dd>
            </div>
          </dl>

          {rejected > 0 ? (
            linked && rejectedTab ? (
              <Link
                to="/app/quotes"
                search={{ tab: rejectedTab }}
                className={cn("ops-quote-pipeline-station", TONE.rejected, "is-active")}
                data-testid="quote-pipeline-rejected"
                aria-label={`${he.quoteStatuses.rejected}: ${rejected}`}
              >
                <span className="ops-quote-pipeline-label">{he.quoteStatuses.rejected}</span>
                <span className="ops-quote-pipeline-count tabular-nums ltr-meta" dir="ltr">
                  {rejected}
                </span>
              </Link>
            ) : (
              <div
                className={cn("ops-quote-pipeline-station", TONE.rejected, "is-active")}
                data-testid="quote-pipeline-rejected"
              >
                <span className="ops-quote-pipeline-label">{he.quoteStatuses.rejected}</span>
                <span className="ops-quote-pipeline-count tabular-nums ltr-meta" dir="ltr">
                  {rejected}
                </span>
              </div>
            )
          ) : (
            <span className="sr-only" data-testid="quote-pipeline-rejected">
              0
            </span>
          )}
        </>
      )}
    </section>
  );
}
