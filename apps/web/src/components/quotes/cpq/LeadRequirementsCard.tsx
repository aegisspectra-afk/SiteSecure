import type { LeadOut } from "@site-secure/api-client";
import { Button } from "@site-secure/ui";
import { Info } from "lucide-react";
import { he } from "../../../i18n/he";
import { leadRequirementRows } from "../../../lib/quote-cpq";

export function LeadRequirementsCard({
  lead,
  onBuildSystem,
}: {
  lead: LeadOut | null;
  onBuildSystem?: () => void;
}) {
  if (!lead) return null;
  const rows = leadRequirementRows(lead);
  if (!rows.length && !lead.title) return null;

  return (
    <section className="cpq-lead-card" aria-label={he.cpqLeadRequirements}>
      <div className="cpq-lead-card-head">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="cpq-lead-card-kicker">{he.cpqLeadRequirements}</p>
            <span className="cpq-info-tip" title={he.cpqLeadNoAutoAdd}>
              <Info className="size-3.5" aria-hidden />
              <span className="sr-only">{he.cpqLeadNoAutoAdd}</span>
            </span>
          </div>
          {lead.title ? <p className="cpq-lead-card-title">{lead.title}</p> : null}
        </div>
        {onBuildSystem ? (
          <Button type="button" onClick={onBuildSystem}>
            {he.cpqBuildSystem}
          </Button>
        ) : null}
      </div>
      {rows.length ? (
        <ul className="cpq-lead-chips" aria-label={he.cpqLeadRequirements}>
          {rows.map((row) => (
            <li key={row.id} className="cpq-lead-chip">
              <span className="cpq-lead-chip-label">{row.label}</span>
              <span className="cpq-lead-chip-value">{row.value}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
