import type { AttentionGroup } from "@site-secure/api-client";
import { Status } from "@site-secure/ui";
import { Link } from "@tanstack/react-router";
import { he } from "../../i18n/he";
import {
  attentionQueue,
  attentionVisual,
  waitingDays,
  type AttentionQueueItem,
} from "../../lib/attention-queue";
import { itemHref } from "../../lib/home";

function typeLabel(type: "action" | "followup" | "urgent"): string {
  if (type === "action") return he.attentionTypeAction;
  if (type === "urgent") return he.attentionTypeUrgent;
  return he.attentionTypeFollowup;
}

function toneFor(type: "action" | "followup" | "urgent"): "info" | "warning" | "danger" {
  if (type === "action") return "info";
  if (type === "urgent") return "danger";
  return "warning";
}

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

function rowDescription(row: AttentionQueueItem): string {
  const item = row.item;
  const parts: string[] = [];
  if (item.customer_name) parts.push(item.customer_name);
  const detail = why(row);
  if (detail && detail !== item.title_he) parts.push(detail);
  else if (!item.customer_name && item.site_name) parts.push(item.site_name);
  return parts.length ? parts.join(" · ") : detail;
}

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
    <ul className={framed ? "mt-3 space-y-2" : "mt-3 space-y-2"}>
      {queue.map((row) => (
        <AttentionRow key={`${row.kind}-${row.item.entity_id}-${row.item.title_he}`} row={row} />
      ))}
    </ul>
  );
  if (!framed) return body;
  return (
    <section className="ops-panel p-4" aria-labelledby="attention-heading">
      <p className="public-mono text-[10px] tracking-[0.16em] text-fg-muted">ATTENTION</p>
      <h2 id="attention-heading" className="text-lg font-semibold text-fg">
        {he.attentionTitle}
      </h2>
      {body}
    </section>
  );
}

function AttentionRow({ row }: { row: AttentionQueueItem }) {
  const item = row.item;
  const visual = attentionVisual(row);
  const href = itemHref(item.entity_type, item.entity_id);
  const label = item.entity_type === "quote" ? he.commandOpenQuote : he.recentQuotesOpen;
  const description = rowDescription(row);

  const content = (
    <>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className={`ops-attention-dot is-${visual.color}`} aria-hidden />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-fg">
            {item.number || item.title_he}
            {item.title_he && item.number ? (
              <>
                <span className="text-fg-muted"> · </span>
                <span className="font-normal text-fg-muted">{item.title_he}</span>
              </>
            ) : null}
          </p>
          {description ? <p className="mt-0.5 text-sm text-fg-muted">{description}</p> : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Status label={typeLabel(visual.type)} tone={toneFor(visual.type)} />
        {href && label ? (
          <span className="text-sm font-medium text-action">{label}</span>
        ) : null}
      </div>
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
