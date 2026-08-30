import type { LeadOut } from "@site-secure/api-client";
import { Status } from "@site-secure/ui";
import { Link } from "@tanstack/react-router";
import { he } from "../../i18n/he";
import {
  leadDisplayTitle,
  leadPriorityLabel,
  leadRequirementsSummary,
  leadStatusLabel,
} from "../../lib/leads";

export function LeadsAttention({ items = [] }: { items?: LeadOut[] }) {
  if (!items.length) return null;

  return (
    <section className="ops-card p-4" aria-labelledby="leads-attention-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="leads-attention-heading" className="text-base font-semibold text-fg">
          {he.leadsAttentionTitle}
        </h2>
        <Link
          to="/app/leads"
          className="text-sm font-medium text-action hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          {he.leadsViewAll}
        </Link>
      </div>
      <ul className="mt-3 space-y-2">
        {items.map((row) => (
          <LeadAttentionRow key={row.id} lead={row} />
        ))}
      </ul>
    </section>
  );
}

function LeadAttentionRow({ lead }: { lead: LeadOut }) {
  const tone = lead.priority === "urgent" || lead.priority === "high" ? "warning" : "info";
  return (
    <li>
      <div className="ops-lead-row">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-fg">{leadDisplayTitle(lead)}</p>
          <p className="text-sm text-fg-muted">{leadRequirementsSummary(lead)}</p>
          {lead.next_action ? (
            <p className="mt-0.5 text-xs text-fg-muted">
              {lead.next_action}
              {lead.priority ? ` · ${leadPriorityLabel(lead.priority)}` : null}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Status label={leadStatusLabel(lead.status)} tone={tone} />
          <Link
            to="/app/leads/$leadId"
            params={{ leadId: lead.id }}
            className="inline-flex min-h-9 items-center rounded-[var(--radius-control)] border border-border px-3 text-sm font-medium text-fg transition-colors hover:bg-bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            {he.leadsOpenLead}
          </Link>
        </div>
      </div>
    </li>
  );
}

export const LEAD_ATTENTION_STATUSES = new Set(["new", "contacted", "visit_scheduling", "quote_preparing", "follow_up"]);

export function filterLeadAttention(items: LeadOut[]): LeadOut[] {
  return items
    .filter((row) => LEAD_ATTENTION_STATUSES.has(row.status) || Boolean(row.next_action?.trim()))
    .slice(0, 5);
}
