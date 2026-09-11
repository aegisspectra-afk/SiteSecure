import { Link } from "@tanstack/react-router";
import { he } from "../../i18n/he";
import { formatMoney } from "../../lib/quotes";

export function DashboardSignalStrip({
  attentionCount,
  todayCount,
  quotesOpen,
  pipelineValue,
  showQuotes = false,
  showToday = false,
}: {
  attentionCount: number;
  todayCount: number;
  quotesOpen: number;
  pipelineValue: number | null;
  showQuotes?: boolean;
  showToday?: boolean;
}) {
  return (
    <nav className="ops-signal-strip" aria-label={he.commandHeaderChipsAria}>
      <a
        href="#command-attention"
        className={`ops-signal${attentionCount > 0 ? " is-attention" : ""}`}
      >
        <span className="ops-signal-label">{he.dashSignalAttention}</span>
        <span className="ops-signal-value tabular-nums">{attentionCount}</span>
      </a>
      {showToday ? (
        <Link to="/app/today" className="ops-signal">
          <span className="ops-signal-label">{he.dashSignalToday}</span>
          <span className="ops-signal-value tabular-nums">{todayCount}</span>
        </Link>
      ) : null}
      {showQuotes ? (
        <>
          <Link to="/app/quotes" className="ops-signal">
            <span className="ops-signal-label">{he.dashSignalQuotes}</span>
            <span className="ops-signal-value tabular-nums">{quotesOpen}</span>
          </Link>
          <Link to="/app/quotes" className="ops-signal is-pipeline">
            <span className="ops-signal-label">{he.dashSignalPipeline}</span>
            <span className="ops-signal-value tabular-nums ltr-meta" dir="ltr">
              {formatMoney(pipelineValue ?? 0)}
            </span>
          </Link>
        </>
      ) : null}
    </nav>
  );
}
