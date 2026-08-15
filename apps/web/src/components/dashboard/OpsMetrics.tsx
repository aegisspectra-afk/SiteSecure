import { Link } from "@tanstack/react-router";
import type { DashboardSummary } from "@site-secure/api-client";
import { he } from "../../i18n/he";
import { formatMoney } from "../../lib/quotes";

export function OpsMetrics({
  summary,
  showJobs,
  showQuotes,
}: {
  summary: DashboardSummary;
  showJobs: boolean;
  showQuotes: boolean;
}) {
  if (!showQuotes && !showJobs) return null;
  const cards = [
    showQuotes
      ? {
          key: "open",
          value: String(summary.quotes_open),
          label: he.kpiQuotesOpen,
          hint: `${summary.quotes_draft} ${he.quoteStatuses.draft} · ${he.kpiQuotesOpenHint}`,
          href: "/app/quotes" as const,
          action: he.kpiViewQuotes,
        }
      : null,
    showQuotes
      ? {
          key: "approved",
          value: String(summary.quotes_approved),
          label: he.kpiQuotesApproved,
          hint: he.kpiQuotesApprovedHint,
          href: "/app/quotes" as const,
          action: he.kpiViewQuotes,
        }
      : null,
    showQuotes
      ? {
          key: "value",
          value: formatMoney(summary.quotes_approved_value),
          label: he.kpiApprovedValue,
          hint: he.kpiApprovedValueHint,
          href: "/app/quotes" as const,
          action: he.kpiViewQuotes,
        }
      : null,
    showJobs
      ? {
          key: "jobs",
          value: String(summary.jobs_open),
          label: he.kpiJobsOpen,
          hint:
            summary.jobs_overdue || summary.jobs_unassigned
              ? `${summary.jobs_overdue} באיחור · ${summary.jobs_unassigned} ללא טכנאי`
              : he.kpiJobsOpenHint,
          href: null,
          action: null,
        }
      : null,
  ].filter(Boolean) as {
    key: string;
    value: string;
    label: string;
    hint: string;
    href: "/app/quotes" | null;
    action: string | null;
  }[];

  return (
    <section aria-label={he.commandTitle} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <article key={card.key} className="ops-card p-4">
          <p className="text-2xl font-semibold tracking-tight text-fg">{card.value}</p>
          <h2 className="mt-1 text-sm font-medium text-fg">{card.label}</h2>
          <p className="mt-1 text-xs text-fg-muted">{card.hint}</p>
          {card.href && card.action ? (
            <Link
              to={card.href}
              className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-action hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              {card.action}
            </Link>
          ) : null}
        </article>
      ))}
    </section>
  );
}
