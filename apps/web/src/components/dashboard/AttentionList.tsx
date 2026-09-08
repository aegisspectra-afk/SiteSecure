import type { AttentionGroup, DashboardItem } from "@site-secure/api-client";
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

function stateLabel(row: AttentionQueueItem): string {
  if (row.kind === "quote_awaiting_us") return he.attentionStateViewed;
  if (row.kind === "quote_approved_pending_project") return he.attentionStateApproved;
  if (row.kind === "quote_expiring") return he.attentionStateExpiring;
  if (row.kind === "quote_stale_draft") return he.attentionStateDraft;
  if (row.kind === "quote_awaiting_customer") return he.attentionStateWaitingCustomer;
  return row.item.title_he;
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

/** Soft warm tone for items waiting ≥2 calendar days — temperature, not alarm. */
function isAgingWarm(updatedAt: string | null | undefined): boolean {
  const days = waitingDays(updatedAt);
  return days != null && days >= 2;
}

function AttentionMeta({ row }: { row: AttentionQueueItem }) {
  const warm = isAgingWarm(row.item.updated_at);
  const reason = primaryReason(row);
  const age =
    row.kind === "quote_awaiting_customer" ? null : relativeAgeLabel(row.item.updated_at);
  const signals = row.secondarySignals.filter((signal) => signal && signal !== reason && signal !== age);

  return (
    <p className={`ops-attention-meta${warm ? " is-aging" : ""}`}>
      <span>{reason}</span>
      {age ? (
        <>
          <span className="ops-attention-meta-sep" aria-hidden>
            ·
          </span>
          <span className={warm ? "ops-attention-age is-warm" : "ops-attention-age"}>{age}</span>
        </>
      ) : null}
      {signals.map((signal) => (
        <span key={signal}>
          <span className="ops-attention-meta-sep" aria-hidden>
            ·
          </span>
          <span>{signal}</span>
        </span>
      ))}
    </p>
  );
}

function canCreateProjectAction(row: AttentionQueueItem, canCreateProject: boolean): boolean {
  if (!canCreateProject) return false;
  if (row.kind === "quote_approved_pending_project") return true;
  return (row.item.actions ?? []).includes("create_project");
}

function AttentionRow({
  row,
  canCreateProject,
  onCreateProject,
}: {
  row: AttentionQueueItem;
  canCreateProject: boolean;
  onCreateProject?: (item: DashboardItem) => void;
}) {
  const item = row.item;
  const visual = attentionVisual(row);
  const href = itemHref(item.entity_type, item.entity_id);
  const num = item.number?.trim() || null;
  const label = stateLabel(row);
  const context = item.customer_name || item.site_name || null;
  const createDirect = canCreateProjectAction(row, canCreateProject) && Boolean(onCreateProject);

  const body = (
    <>
      <div className="ops-attention-main min-w-0">
        <p className="ops-attention-title">
          {num ? (
            <span className="ops-attention-id ltr-meta" dir="ltr">
              {num}
            </span>
          ) : null}
          {num ? (
            <span className="ops-attention-title-sep" aria-hidden>
              ·
            </span>
          ) : null}
          <span className="ops-attention-state">{label}</span>
        </p>
        {context ? <p className="ops-attention-context">{context}</p> : null}
        <AttentionMeta row={row} />
      </div>
      <span className="ops-attention-cta">{row.actionLabel}</span>
    </>
  );

  const className = `ops-attention-row is-${visual.color} is-${visual.urgency}`;

  if (createDirect) {
    return (
      <li>
        <button type="button" className={className} onClick={() => onCreateProject?.(item)}>
          {body}
        </button>
      </li>
    );
  }

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
  onCreateProject,
}: {
  groups: AttentionGroup[];
  framed?: boolean;
  canCreateProject?: boolean;
  limit?: number;
  onCreateProject?: (item: DashboardItem) => void;
}) {
  const { items } = attentionQueueLimited(groups, { canCreateProject, limit });
  if (!items.length) return null;
  const body = (
    <ul className="ops-attention-list">
      {items.map((row) => (
        <AttentionRow
          key={`${row.item.entity_type}-${row.item.entity_id}`}
          row={row}
          canCreateProject={canCreateProject}
          onCreateProject={onCreateProject}
        />
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
