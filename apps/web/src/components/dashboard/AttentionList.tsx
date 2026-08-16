import { Status, cn } from "@site-secure/ui";
import type { AttentionGroup, DashboardItem } from "@site-secure/api-client";
import { Link } from "@tanstack/react-router";
import { he } from "../../i18n/he";
import { attentionQueue, waitingDays, type AttentionQueueItem } from "../../lib/attention-queue";
import { itemHref } from "../../lib/home";

function why(row: AttentionQueueItem): string {
  const days = waitingDays(row.item.updated_at);
  if (row.kind === "quote_awaiting_customer") {
    return days == null ? row.item.title_he : he.commandAwaitingDays(days);
  }
  if (row.kind === "quote_awaiting_us") return he.commandViewedWhy;
  if (row.kind === "quote_expiring") return he.commandExpiringWhy;
  if (row.kind === "quote_stale_draft") return he.commandStaleWhy;
  return row.item.title_he;
}

function actionLabel(item: DashboardItem): string | null {
  if (item.entity_type === "quote") return he.commandOpenQuote;
  return null;
}

const tone = (severity: DashboardItem["severity"]) =>
  severity === "now" ? "danger" : severity === "next" ? "warning" : "neutral";

export function AttentionList({
  groups,
  framed = true,
}: {
  groups: AttentionGroup[];
  framed?: boolean;
}) {
  const queue = attentionQueue(groups);
  if (!queue.length) return null;
  const body = (
    <>
      {framed ? (
        <>
          <p className="public-mono text-[10px] tracking-[0.16em] text-fg-muted">ATTENTION</p>
          <h2 id="attention-heading" className="text-lg font-semibold text-fg">
            {he.attentionTitle}
          </h2>
        </>
      ) : null}
      <ul className="mt-3 divide-y divide-border border-t border-border">
        {queue.map((row) => (
          <AttentionRow key={`${row.kind}-${row.item.entity_id}-${row.item.title_he}`} row={row} />
        ))}
      </ul>
    </>
  );
  if (!framed) return <div className="mt-2">{body}</div>;
  return (
    <section className="ops-card p-5" aria-labelledby="attention-heading">
      {body}
    </section>
  );
}

function AttentionRow({ row }: { row: AttentionQueueItem }) {
  const item = row.item;
  const href = itemHref(item.entity_type, item.entity_id);
  const label = actionLabel(item);
  const body = (
    <>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="truncate text-sm font-medium text-fg">{item.number || item.title_he}</span>
        <span className="text-sm text-fg-muted">{why(row)}</span>
        <Status label={row.groupLabel} tone={tone(item.severity)} />
      </span>
      {href && label ? <span className="shrink-0 text-sm font-medium text-action">{label}</span> : null}
    </>
  );
  const className = cn(
    "flex min-h-11 items-center justify-between gap-3 py-3",
    href &&
      "rounded-[var(--radius-control)] hover:bg-bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
  );
  if (href) {
    if (item.entity_type === "quote") {
      return (
        <li>
          <Link to="/app/quotes/$quoteId" params={{ quoteId: item.entity_id }} className={className}>
            {body}
          </Link>
        </li>
      );
    }
    return (
      <li>
        <a href={href} className={className}>
          {body}
        </a>
      </li>
    );
  }
  return <li className={className}>{body}</li>;
}
