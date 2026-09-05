import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { he } from "../../i18n/he";
import { dayGreeting } from "../../lib/greeting";
import { formatMoney } from "../../lib/quotes";
import { NewQuoteButton } from "../quotes/NewQuoteButton";

function formatOpsDateHeader(now = new Date()): string {
  return new Intl.DateTimeFormat("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);
}

export function OpsDashHero({
  displayName,
  quoteAction,
  secondaryAction,
  attentionCount = 0,
  quotesOpen = 0,
  pipelineValue = null,
  showQuoteChips = false,
}: {
  displayName?: string | null;
  workspaceName?: string | null;
  quoteAction?: boolean;
  secondaryAction?: ReactNode;
  attentionCount?: number;
  /** @deprecated field chip removed in V2.2 — kept for call-site compatibility */
  fieldTodayCount?: number;
  quotesOpen?: number;
  pipelineValue?: number | null;
  showQuoteChips?: boolean;
}) {
  const greeting = dayGreeting();
  const name = displayName?.trim() || null;

  return (
    <header className="ops-dash-hero ops-dash-hero-v22 ops-dash-hero-x">
      <div className="ops-dash-hero-identity min-w-0">
        <div className="ops-dash-hero-greeting">
          <p className="ops-dash-hero-hello">
            {greeting}
            {name ? `, ${name}` : ""}
          </p>
          <p className="ops-dash-hero-date">{formatOpsDateHeader()}</p>
        </div>
        <ul className="ops-dash-hero-chips" aria-label={he.commandHeaderChipsAria}>
          <li>
            <a href="#command-attention" className="ops-cmd-chip is-attention">
              {he.commandHeaderAttention(attentionCount)}
            </a>
          </li>
          {showQuoteChips ? (
            <>
              <li>
                <Link to="/app/quotes" className="ops-cmd-chip">
                  {he.commandHeaderQuotesOpen(quotesOpen)}
                </Link>
              </li>
              <li>
                <Link to="/app/quotes" className="ops-cmd-chip is-pipeline">
                  {he.commandHeaderPipeline(formatMoney(pipelineValue ?? 0))}
                </Link>
              </li>
            </>
          ) : null}
        </ul>
      </div>
      <div className="ops-dash-hero-actions">
        {quoteAction ? <NewQuoteButton /> : null}
        {secondaryAction ??
          (quoteAction ? (
            <Link to="/app/today" className="ops-dash-secondary-cta">
              {he.todayViewAll}
            </Link>
          ) : null)}
      </div>
    </header>
  );
}
