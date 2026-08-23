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
    <section className="ops-card p-5" aria-labelledby="leads-attention-heading">
      <h2 id="leads-attention-heading" className="text-base font-semibold text-fg">
        {he.leadsAttentionTitle}
      </h2>
      <ul className="mt-4 space-y-3">
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
      <Link to="/app/leads/$leadId" params={{ leadId: lead.id }} className="block rounded-[var(--radius-card)] border border-border p-3 hover:border-border-strong">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-medium text-fg">{leadDisplayTitle(lead)}</p>
            <p className="text-sm text-fg-muted">{leadRequirementsSummary(lead)}</p>
          </div>
          <Status label={leadStatusLabel(lead.status)} tone={tone} />
        </div>
        <p className="mt-2 text-sm text-fg-muted">
          {lead.next_action || "—"}
          {lead.priority ? ` · ${leadPriorityLabel(lead.priority)}` : null}
        </p>
      </Link>
    </li>
  );
}

export const LEAD_ATTENTION_STATUSES = new Set(["new", "contacted", "visit_scheduling", "quote_preparing", "follow_up"]);

export function filterLeadAttention(items: LeadOut[]): LeadOut[] {
  return items
    .filter((row) => LEAD_ATTENTION_STATUSES.has(row.status) || Boolean(row.next_action?.trim()))
    .slice(0, 5);
}
