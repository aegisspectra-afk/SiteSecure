import type { AttentionGroup } from "@site-secure/api-client";
import { Link } from "@tanstack/react-router";
import { he } from "../../i18n/he";
import {
  attentionQueueLimited,
  attentionVisual,
  waitingDays,
  type AttentionQueueItem,
} from "../../lib/attention-queue";
import { itemHref } from "../../lib/home";

function primaryReason(row: AttentionQueueItem): string {
  if (row.kind === "quote_awaiting_us") return he.commandViewedWhy;
  if (row.kind === "quote_expiring") return he.commandExpiringWhy;
  if (row.kind === "quote_stale_draft") return he.commandStaleWhy;
  if (row.kind === "quote_approved_pending_project") return he.commandApprovedWhy;
  if (row.kind === "quote_awaiting_customer") {
    const days = waitingDays(row.item.updated_at);
    return days == null ? row.item.title_he : he.commandAwaitingDays(days);
  }
  return row.item.title_he;
}

function AttentionRow({ row }: { row: AttentionQueueItem }) {
  const item = row.item;
  const visual = attentionVisual(row);
  const href = itemHref(item.entity_type, item.entity_id);
  const reason = primaryReason(row);
  const context = [item.customer_name, item.site_name].filter(Boolean).join(" · ");

  const content = (
    <>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className={`ops-attention-dot is-${visual.color}`} aria-hidden />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-fg">
            {item.number || reason}
            {context ? (
              <>
                <span className="text-fg-muted"> · </span>
                <span className="font-normal text-fg-muted">{context}</span>
              </>
            ) : null}
          </p>
          <p className="mt-0.5 text-sm text-fg-muted">{reason}</p>
          {row.secondarySignals.length ? (
            <ul className="mt-1 space-y-0.5">
              {row.secondarySignals.map((signal) => (
                <li key={signal} className="text-xs text-fg-subtle">
                  {signal}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
      <span className="shrink-0 text-sm font-medium text-action">{row.actionLabel}</span>
    </>
  );

  const className = `ops-attention-row is-${visual.color}`;

  if (href && item.entity_type === "quote") {
    return (
      <li>
        <Link to="/app/quotes/$quoteId" params={{ quoteId: item.entity_id }} className={className}>
          {content}
        </Link>
      </li>
    );
  }
  if (href && item.entity_type === "lead") {
    return (
      <li>
        <Link to="/app/leads/$leadId" params={{ leadId: item.entity_id }} className={className}>
          {content}
        </Link>
      </li>
    );
  }
  if (href && item.entity_type === "project") {
    return (
      <li>
        <Link to="/app/projects/$projectId" params={{ projectId: item.entity_id }} className={className}>
          {content}
        </Link>
      </li>
    );
  }
  if (href) {
    return (
      <li>
        <a href={href} className={className}>
          {content}
        </a>
      </li>
    );
  }
  return <li className={className}>{content}</li>;
}

export function AttentionList({
  groups,
  framed = true,
  canCreateProject = true,
  limit,
}: {
  groups: AttentionGroup[];
  framed?: boolean;
  canCreateProject?: boolean;
  limit?: number;
}) {
  const { items } = attentionQueueLimited(groups, { canCreateProject, limit });
  if (!items.length) return null;
  const body = (
    <ul className="mt-3 space-y-2">
      {items.map((row) => (
        <AttentionRow key={`${row.item.entity_type}-${row.item.entity_id}`} row={row} />
      ))}
    </ul>
  );
  if (!framed) return body;
  return (
    <section className="ops-panel p-4" aria-labelledby="attention-heading">
      <h2 id="attention-heading" className="text-lg font-semibold text-fg">
        {he.attentionTitle}
      </h2>
      {body}
    </section>
  );
}
