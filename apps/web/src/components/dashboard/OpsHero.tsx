import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { he } from "../../i18n/he";
import { dayGreeting } from "../../lib/greeting";
import { formatMoney } from "../../lib/quotes";
import { NewQuoteButton } from "../quotes/NewQuoteButton";

function formatOpsDateHeader(now = new Date()): string {
  return new Intl.DateTimeFormat("he-IL", {
    weekday: "short",
    day: "numeric",
    month: "short",
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
  const summaryParts: string[] = [he.commandHeaderAttention(attentionCount)];
  if (fieldTodayCount > 0) summaryParts.push(he.dashboardFieldJobsToday(fieldTodayCount));
  if (quotesOpen > 0) summaryParts.push(he.commandHeaderQuotesOpen(quotesOpen));
  if (pipelineValue != null && pipelineValue > 0) {
    summaryParts.push(he.commandHeaderPipeline(formatMoney(pipelineValue)));
  }

  return (
    <header className="ops-dash-hero ops-dash-hero-v2">
      <div className="min-w-0">
        <p className="text-sm text-fg-muted">
          {greeting}
          {name ? `, ${name}` : ""}
          <span className="text-fg-subtle"> · </span>
          <span className="ltr-meta" dir="ltr">
            {formatOpsDateHeader()}
          </span>
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-fg">{he.dashboardTitleShort}</h1>
        <p className="mt-2 text-sm text-fg-muted">{summaryParts.join(" · ")}</p>
      </div>
      <div className="ops-dash-hero-actions">
        {quoteAction ? <NewQuoteButton /> : null}
        {secondaryAction ??
          (quoteAction ? (
            <Link
              to="/app/today"
              className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] border border-border px-4 text-sm font-medium text-fg-muted transition-colors duration-200 hover:bg-bg-subtle hover:text-fg"
            >
              {he.todayViewAll}
            </Link>
          ) : null)}
      </div>
    </header>
  );
}
