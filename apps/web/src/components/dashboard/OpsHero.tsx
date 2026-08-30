import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { he } from "../../i18n/he";
import { dayGreeting } from "../../lib/greeting";
import { NewQuoteButton } from "../quotes/NewQuoteButton";

function formatOpsDateHeader(now = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jerusalem",
  }).format(now);
}

export function OpsDashHero({
  displayName,
  workspaceName,
  quoteAction,
  secondaryAction,
  fieldTodayCount = 0,
}: {
  displayName?: string | null;
  workspaceName?: string | null;
  quoteAction?: boolean;
  secondaryAction?: ReactNode;
  fieldTodayCount?: number;
}) {
  const greeting = dayGreeting();
  const name = displayName?.trim() || null;

  return (
    <header className="ops-dash-hero ops-dash-hero-v2">
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <h1 className="text-2xl font-semibold tracking-[-0.03em] text-fg">{he.dashboardTitleShort}</h1>
          <span className="text-sm text-fg-muted" aria-hidden>
            ·
          </span>
          <span className="text-sm text-fg-muted ltr-meta" dir="ltr">
            {formatOpsDateHeader()}
          </span>
        </div>
        <p className="mt-1 text-sm text-fg-muted">
          {greeting}
          {name ? `, ${name}` : ""}
        </p>
        {workspaceName ? <p className="mt-0.5 text-xs text-fg-subtle">{workspaceName}</p> : null}
      </div>
      <div className="ops-dash-hero-actions">
        <div className="ops-dash-field-today text-end">
          <p className="text-xs text-fg-muted">{he.dashboardFieldToday}</p>
          <p className="text-sm font-medium text-fg">
            {fieldTodayCount > 0 ? he.dashboardFieldTechnicians(fieldTodayCount) : he.dashboardFieldNone}
          </p>
        </div>
        {quoteAction ? <NewQuoteButton /> : null}
        {secondaryAction}
      </div>
    </header>
  );
}

export function OperationsHealth({
  jobsOpen,
  jobsOverdue,
  quotesOpen,
  attentionCount,
}: {
  jobsOpen: number;
  jobsOverdue: number;
  quotesOpen: number;
  attentionCount: number;
}) {
  const needsAttention = attentionCount > 0 || jobsOverdue > 0;
  const statusLabel = needsAttention ? he.opsHealthAttention : he.opsHealthOperational;

  return (
    <section className="ops-health" aria-labelledby="ops-health-heading">
      <div className="ops-health-status">
        <p className="public-mono text-[10px] tracking-[0.16em] text-fg-muted">{he.opsHealthKicker}</p>
        <h2 id="ops-health-heading" className="sr-only">
          {he.opsHealthKicker}
        </h2>
        <p className="mt-3 flex items-center gap-2 text-lg font-semibold text-fg">
          <span
            className={`size-2 rounded-full ${needsAttention ? "bg-warning" : "bg-success"}`}
            aria-hidden
          />
          <span className="ltr-meta" dir="ltr">
            {statusLabel}
          </span>
        </p>
        <p className="mt-2 text-sm text-fg-muted">
          {needsAttention ? he.commandAttention(Math.max(attentionCount, jobsOverdue || 1)) : he.statusOperational}
        </p>
      </div>
      <dl className="ops-health-metrics">
        {[
          [he.opsHealthMetricJobs, jobsOpen],
          [he.opsHealthMetricOverdue, jobsOverdue],
          [he.opsHealthMetricQuotes, quotesOpen],
          [he.opsHealthMetricAttention, attentionCount],
        ].map(([label, value]) => (
          <div key={String(label)} className="ops-health-metric">
            <dt className="text-xs text-fg-muted">{label}</dt>
            <dd className="public-mono mt-1 text-2xl font-semibold tracking-[-0.03em] text-fg">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function SiteOpsPanel({ siteNames }: { siteNames: string[] }) {
  const unique = [...new Set(siteNames.filter(Boolean))];

  return (
    <section className="ops-panel p-4" aria-labelledby="site-ops-heading">
      <p className="public-mono text-[10px] tracking-[0.16em] text-fg-muted">{he.siteOpsKicker}</p>
      <h2 id="site-ops-heading" className="mt-1 text-base font-semibold text-fg">
        {he.sitesTitle}
      </h2>
      {unique.length ? (
        <ul className="mt-4 divide-y divide-border border-y border-border">
          {unique.slice(0, 5).map((name) => (
            <li key={name} className="flex items-center justify-between gap-3 py-3">
              <span className="min-w-0 truncate text-sm font-medium text-fg">{name}</span>
              <Link
                to="/app/sites"
                className="shrink-0 text-sm font-medium text-action hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                {he.openSiteFile}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-4 border border-border px-4 py-5">
          <p className="text-sm font-medium text-fg">{he.siteOpsEmptyTitle}</p>
          <p className="mt-1 text-sm text-fg-muted">{he.siteOpsEmptyBody}</p>
          <Link
            to="/app/sites"
            className="mt-4 inline-flex min-h-10 items-center text-sm font-medium text-action hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            {he.openSitesList}
          </Link>
        </div>
      )}
    </section>
  );
}
