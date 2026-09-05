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
  fieldTodayCount = 0,
  quotesOpen = 0,
  pipelineValue = null,
}: {
  displayName?: string | null;
  workspaceName?: string | null;
  quoteAction?: boolean;
  secondaryAction?: ReactNode;
  attentionCount?: number;
  fieldTodayCount?: number;
  quotesOpen?: number;
  pipelineValue?: number | null;
}) {
  const greeting = dayGreeting();
  const name = displayName?.trim() || null;

  return (
    <header className="ops-dash-hero ops-dash-hero-v21">
      <div className="ops-dash-hero-identity min-w-0">
        <h1 className="sr-only">{he.dashboardTitleShort}</h1>
        <div className="ops-dash-hero-greeting">
          <p className="ops-dash-hero-hello">
            {greeting}
            {name ? `, ${name}` : ""}
          </p>
          <p className="ops-dash-hero-date">{formatOpsDateHeader()}</p>
        </div>
        <ul className="ops-dash-hero-chips" aria-label={he.commandHeaderChipsAria}>
          <li>
            <a href="#command-heading" className="ops-cmd-chip is-attention">
              {he.commandHeaderAttention(attentionCount)}
            </a>
          </li>
          {quotesOpen > 0 ? (
            <li>
              <Link to="/app/quotes" className="ops-cmd-chip">
                {he.commandHeaderQuotesOpen(quotesOpen)}
              </Link>
            </li>
          ) : null}
          {pipelineValue != null && pipelineValue > 0 ? (
            <li>
              <Link to="/app/quotes" className="ops-cmd-chip is-pipeline">
                {he.commandHeaderPipeline(formatMoney(pipelineValue))}
              </Link>
            </li>
          ) : null}
          {fieldTodayCount > 0 ? (
            <li>
              <Link to="/app/today" className="ops-cmd-chip">
                {he.dashboardFieldJobsToday(fieldTodayCount)}
              </Link>
            </li>
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
