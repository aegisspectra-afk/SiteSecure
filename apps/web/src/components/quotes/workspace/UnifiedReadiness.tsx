import { Button } from "@site-secure/ui";
import { AlertCircle, CircleDot, Info } from "lucide-react";
import { he } from "../../../i18n/he";
import type { UnifiedReadinessItem } from "../../../lib/quote-readiness";

function SeverityIcon({ status }: { status: UnifiedReadinessItem["status"] }) {
  if (status === "warning") return <Info className="size-4" aria-hidden />;
  if (status === "critical") return <AlertCircle className="size-4" aria-hidden />;
  return <CircleDot className="size-4" aria-hidden />;
}

function severityLabel(status: UnifiedReadinessItem["status"]) {
  if (status === "critical") return he.cpqReadinessBlocking;
  if (status === "warning") return he.cpqReadinessRecommended;
  return "";
}

function actionLabel(id: string) {
  if (id === "customer") return he.cpqSelectCustomer;
  if (id === "items") return he.cpqAddToQuotePrimary;
  if (id === "payment") return he.cpqReadinessDefine;
  if (id === "valid") return he.cpqReadinessDefine;
  if (id === "site") return he.cpqReadinessDefine;
  return he.quoteGoToField;
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
  const blocking = issues.filter((item) => item.status === "critical");
  const recommended = issues.filter((item) => item.status === "warning");
  const prioritized = [...blocking, ...recommended];
  const showList = prioritized.length > 0;
  const completed = items.filter((item) => item.status === "ok").length;
  const totalChecks = items.length;

  return (
    <section className="cpq-unified-readiness cpq-readiness-kai" aria-label={he.cpqReadinessTitle}>
      <div className="cpq-unified-readiness-head">
        <div className="min-w-0">
          <p className="cpq-unified-readiness-title">{he.cpqReadinessTitle}</p>
          {canSend ? (
            <p className="cpq-unified-readiness-ready">{he.cpqReadinessReady}</p>
          ) : totalChecks > 0 ? (
            <p className="cpq-unified-readiness-sub">{he.cpqReadinessProgress(completed, totalChecks)}</p>
          ) : (
            <p className="cpq-unified-readiness-sub">
              {he.cpqReadinessMissing(blocking.length || prioritized.length || 1)}
            </p>
          )}
        </div>
      </div>

      {!canSend ? (
        <div
          className={`cpq-readiness-progress is-${percent >= 100 ? "complete" : percent >= 50 ? "partial" : "low"}`}
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={he.cpqReadinessTitle}
        >
          <div className="cpq-readiness-progress-bar" style={{ width: `${Math.max(percent, 4)}%` }} />
        </div>
      ) : null}

      {showList ? (
        <ul className="cpq-unified-readiness-list">
          {prioritized.map((item) => {
            const highlight = highlightIssues && item.status === "critical";
            return (
              <li
                key={item.id}
                className={`cpq-unified-readiness-item is-${item.status}${highlight ? " is-highlight" : ""}`}
              >
                <button type="button" className="cpq-unified-readiness-btn" onClick={() => onSelectItem(item)}>
                  <span className="cpq-unified-readiness-icon">
                    <SeverityIcon status={item.status} />
                  </span>
                  <span className="cpq-unified-readiness-copy">
                    <span className="cpq-unified-readiness-label">{item.label}</span>
                    <span className="cpq-unified-readiness-sev">{severityLabel(item.status)}</span>
                  </span>
                  <span className="cpq-unified-readiness-cta">{actionLabel(item.id)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

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

      {!canSend && highlightIssues && blocking.length ? (
        <p className="cpq-unified-readiness-blocked" role="alert">
          {he.cpqSendBlockedHint(blocking.length)}
        </p>
      ) : null}
    </section>
  );
}
