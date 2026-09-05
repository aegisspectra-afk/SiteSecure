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
import { relativeAgeLabel } from "../../lib/relative-age";

function primaryTitle(row: AttentionQueueItem): string {
  const num = row.item.number?.trim();
  if (row.kind === "quote_awaiting_us") return num ? `${num} · ${he.attentionStateViewed}` : he.attentionStateViewed;
  if (row.kind === "quote_approved_pending_project") {
    return num ? `${num} · ${he.attentionStateApproved}` : he.attentionStateApproved;
  }
  if (row.kind === "quote_expiring") return num ? `${num} · ${he.attentionStateExpiring}` : he.attentionStateExpiring;
  if (row.kind === "quote_stale_draft") return num ? `${num} · ${he.attentionStateDraft}` : he.attentionStateDraft;
  if (row.kind === "quote_awaiting_customer") {
    return num ? `${num} · ${he.attentionStateWaitingCustomer}` : he.attentionStateWaitingCustomer;
  }
  return num || row.item.title_he;
}

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

function metaLine(row: AttentionQueueItem): string {
  const parts: string[] = [primaryReason(row)];
  const age = relativeAgeLabel(row.item.updated_at);
  if (age && row.kind !== "quote_awaiting_customer") parts.push(age);
  for (const signal of row.secondarySignals) {
    if (signal && !parts.includes(signal)) parts.push(signal);
  }
  return parts.join(" · ");
}

function AttentionRow({ row }: { row: AttentionQueueItem }) {
  const item = row.item;
  const visual = attentionVisual(row);
  const href = itemHref(item.entity_type, item.entity_id);
  const title = primaryTitle(row);
  const context = item.customer_name || item.site_name || null;
  const meta = metaLine(row);

  const body = (
    <>
      <div className="ops-attention-main min-w-0">
        <p className="ops-attention-title">{title}</p>
        {context ? <p className="ops-attention-context">{context}</p> : null}
        <p className="ops-attention-meta">{meta}</p>
      </div>
      <span className="ops-attention-cta">{row.actionLabel}</span>
    </>
  );

  const className = `ops-attention-row is-${visual.color} is-${visual.urgency}`;

  if (href && item.entity_type === "quote") {
    return (
      <li>
        <Link to="/app/quotes/$quoteId" params={{ quoteId: item.entity_id }} className={className}>
          {body}
        </Link>
      </li>
    );
  }
  if (href && item.entity_type === "lead") {
    return (
      <li>
        <Link to="/app/leads/$leadId" params={{ leadId: item.entity_id }} className={className}>
          {body}
        </Link>
      </li>
    );
  }
  if (href && item.entity_type === "project") {
    return (
      <li>
        <Link to="/app/projects/$projectId" params={{ projectId: item.entity_id }} className={className}>
          {body}
        </Link>
      </li>
    );
  }
  if (href) {
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
    <ul className="ops-attention-list">
      {items.map((row) => (
        <AttentionRow key={`${row.item.entity_type}-${row.item.entity_id}`} row={row} />
      ))}
    </ul>
  );
  if (!framed) return body;
  return (
    <section className="ops-panel ops-attention-card is-active" aria-labelledby="attention-heading">
      <h2 id="attention-heading" className="ops-section-title">
        {he.attentionTitle}
      </h2>
      {body}
    </section>
  );
}
