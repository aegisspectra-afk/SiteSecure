import { Button } from "@site-secure/ui";
import { he } from "../../../i18n/he";
import type { UnifiedReadinessItem } from "../../../lib/quote-readiness";

function statusIcon(status: UnifiedReadinessItem["status"]) {
  if (status === "ok") return "✅";
  if (status === "warning") return "⚠️";
  return "❌";
}

export function UnifiedReadiness({
  percent,
  items,
  canSend,
  highlightIssues,
  showDetails,
  onSelectItem,
}: {
  percent: number;
  items: UnifiedReadinessItem[];
  canSend: boolean;
  highlightIssues?: boolean;
  showDetails?: boolean;
  onSelectItem: (item: UnifiedReadinessItem) => void;
}) {
  const issues = items.filter((item) => item.status !== "ok");

  return (
    <section className="cpq-unified-readiness" aria-label={he.cpqReadinessTitle}>
      <div className="cpq-unified-readiness-head">
        <p className="cpq-unified-readiness-title">{he.cpqReadinessTitle}</p>
        <p className="cpq-unified-readiness-percent">{percent}%</p>
      </div>

      <div
        className={`cpq-readiness-progress is-${percent >= 100 ? "complete" : percent >= 50 ? "partial" : "low"}`}
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={he.cpqReadinessTitle}
      >
        <div className="cpq-readiness-progress-bar" style={{ width: `${percent}%` }} />
      </div>

      <ul className="cpq-unified-readiness-list">
        {items.map((item) => {
          const actionable = item.status !== "ok";
          const highlight = highlightIssues && actionable;
          const content = (
            <>
              <span className="cpq-unified-readiness-icon" aria-hidden>
                {statusIcon(item.status)}
              </span>
              <span className="cpq-unified-readiness-label">{item.label}</span>
            </>
          );
          return (
            <li
              key={item.id}
              className={`cpq-unified-readiness-item is-${item.status}${highlight ? " is-highlight" : ""}`}
            >
              {actionable ? (
                <button type="button" className="cpq-unified-readiness-btn" onClick={() => onSelectItem(item)}>
                  {content}
                </button>
              ) : (
                <div className="cpq-unified-readiness-row">{content}</div>
              )}
            </li>
          );
        })}
      </ul>

      {showDetails && issues.length ? (
        <ul className="cpq-unified-readiness-details">
          {issues.map((item) => (
            <li key={`detail-${item.id}`} className={`is-${item.status}`}>
              <span className="min-w-0 flex-1 text-sm">{item.message || item.label}</span>
              <Button variant="ghost" onClick={() => onSelectItem(item)}>
                {he.quoteGoToField}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {canSend ? (
        <p className="cpq-unified-readiness-ready">{he.cpqReadinessReady}</p>
      ) : highlightIssues && issues.length ? (
        <p className="cpq-unified-readiness-blocked" role="alert">
          {he.cpqSendBlockedHint(issues.filter((item) => item.status === "critical").length || 1)}
        </p>
      ) : null}
    </section>
  );
}
