import { Link } from "@tanstack/react-router";
import { he } from "../../i18n/he";
import type { NextAction } from "../../lib/next-best-action";
import { NewQuoteButton } from "../quotes/NewQuoteButton";

export function NextBestAction({
  action,
  setupProgress = null,
}: {
  action: NextAction;
  setupProgress?: { percent: number; done: number; total: number } | null;
}) {
  return (
    <section className="ops-card ops-card-priority p-5" aria-labelledby="next-action-heading">
      <p className="public-mono text-[10px] tracking-[0.16em] text-fg-muted">{he.nextActionKicker}</p>
      <h2 id="next-action-heading" className="mt-1 text-base font-semibold text-fg">
        {he.nextActionTitle}
      </h2>
      <p className="mt-3 text-sm font-medium text-fg">{action.title}</p>
      <p className="mt-1 text-sm text-fg-muted">{action.body}</p>
      {setupProgress ? (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between gap-3 text-xs text-fg-muted">
            <span>{he.setupPendingLabel}</span>
            <span className="tabular-nums">
              {setupProgress.done}/{setupProgress.total} · {he.uxPercent(setupProgress.percent)}
            </span>
          </div>
          <div className="ops-setup-bar" aria-hidden>
            <span style={{ width: `${Math.max(0, Math.min(100, setupProgress.percent))}%` }} />
          </div>
        </div>
      ) : null}
      {action.href === "/app/quotes/new" ? (
        <NewQuoteButton variant="link" className="mt-4">
          {action.label}
        </NewQuoteButton>
      ) : action.href.startsWith("/app/leads/") ? (
        <Link
          to="/app/leads/$leadId"
          params={{ leadId: action.href.slice("/app/leads/".length) }}
          className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-action transition-colors duration-200 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          {action.label}
        </Link>
      ) : action.href.startsWith("/app/quotes/") && action.href !== "/app/quotes/new" ? (
        <Link
          to="/app/quotes/$quoteId"
          params={{ quoteId: action.href.slice("/app/quotes/".length) }}
          className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-action transition-colors duration-200 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          {action.label}
        </Link>
      ) : (
        <Link
          to={action.href as "/app/quotes" | "/app/settings/users"}
          className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-action transition-colors duration-200 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          {action.label}
        </Link>
      )}
    </section>
  );
}
