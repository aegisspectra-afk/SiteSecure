import type { QuoteGap } from "@site-secure/api-client";
import { Button } from "@site-secure/ui";
import { useState } from "react";
import { he } from "../../../i18n/he";
import { goToQuoteField } from "../../../lib/quote-builder";
import {
  completenessScore,
  filterEmptyQuoteMarginGaps,
  gapSeverity,
  groupGapsByDomain,
  partitionGaps,
} from "../../../lib/quote-cpq";

export function QuoteValidationPanel({
  gaps,
  pricedCount,
  compact = false,
}: {
  gaps: QuoteGap[];
  pricedCount: number;
  compact?: boolean;
}) {
  const [showDetails, setShowDetails] = useState(!compact);
  const visible = filterEmptyQuoteMarginGaps(gaps, pricedCount);
  const { completeness, technical, financial } = groupGapsByDomain(visible);
  const { critical, warning } = partitionGaps(visible);
  const score = completenessScore(visible);
  const ready = critical.length === 0 && score.done === score.total;

  const domainStatus = (domainGaps: QuoteGap[]) => {
    if (!domainGaps.length) return "ok" as const;
    if (domainGaps.some((g) => gapSeverity(g) === "critical")) return "critical" as const;
    if (domainGaps.some((g) => gapSeverity(g) === "warning")) return "warning" as const;
    return "info" as const;
  };

  return (
    <section className="cpq-checks-card flex flex-col gap-3 p-4" id={compact ? undefined : "cpq-validation-panel"}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-semibold tracking-wide text-fg-muted">{he.cpqChecksBeforeSend}</p>
        <span className="cpq-internal-badge">{he.cpqInternalBadge}</span>
      </div>

      {ready ? (
        <p className="text-sm font-medium text-success">{he.quoteChecksOk}</p>
      ) : (
        <ul className="cpq-checks-overview">
          <CheckRow label={he.cpqCheckCustomer} status={domainStatus(completeness.filter((g) => g.field === "customer" || g.field === "customer_id"))} />
          <CheckRow label={he.cpqCheckQuote} status={domainStatus(completeness.filter((g) => g.field !== "customer" && g.field !== "customer_id" && g.field !== "items"))} />
          <CheckRow label={he.cpqCheckItems} status={domainStatus([...completeness.filter((g) => g.field === "items"), ...technical])} />
          {warning.length ? (
            <li className="cpq-check-row is-warning">
              <span aria-hidden>🟡</span>
              <span>{he.cpqCheckWarnings(warning.length)}</span>
            </li>
          ) : null}
        </ul>
      )}

      {compact && !ready ? (
        <Button variant="ghost" onClick={() => setShowDetails((v) => !v)}>
          {showDetails ? he.cpqHideChecks : he.cpqShowChecks}
        </Button>
      ) : null}

      {(!compact || showDetails) && !ready ? (
        <>
          <DomainGroup title={he.cpqValidationCompleteness} gaps={completeness} defaultOpen={completeness.length > 0} />
          <DomainGroup
            title={he.cpqValidationTechnical}
            gaps={technical}
            defaultOpen={technical.some((g) => gapSeverity(g) === "critical")}
          />
          <DomainGroup
            title={he.cpqValidationFinancial}
            gaps={financial}
            defaultOpen={financial.length > 0 && pricedCount > 0}
          />
        </>
      ) : null}
    </section>
  );
}

function CheckRow({ label, status }: { label: string; status: "ok" | "critical" | "warning" | "info" }) {
  const icon = status === "ok" ? "🟢" : status === "critical" ? "🔴" : status === "warning" ? "🟡" : "🔵";
  return (
    <li className={`cpq-check-row is-${status}`}>
      <span aria-hidden>{icon}</span>
      <span>{label}</span>
    </li>
  );
}

function DomainGroup({
  title,
  gaps,
  defaultOpen,
}: {
  title: string;
  gaps: QuoteGap[];
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (!gaps.length) return null;
  const { critical, warning, info } = partitionGaps(gaps);
  const summary = he.cpqValidationSummary(critical.length, warning.length, info.length);

  return (
    <div className="cpq-domain-group">
      <button type="button" className="cpq-domain-toggle" onClick={() => setOpen((v) => !v)}>
        <span>
          {open ? "▾" : "▸"} {title}
        </span>
        <span className="text-fg-muted">{summary}</span>
      </button>
      {open ? (
        <ul className="mt-2 space-y-2">
          {gaps.map((gap) => (
            <li key={`${gap.field}-${gap.code}`} className={`cpq-gap-row is-${gapSeverity(gap)}`}>
              <span className="min-w-0 flex-1 text-sm">{gap.message}</span>
              <Button variant="ghost" onClick={() => goToQuoteField(gap.field)}>
                {he.quoteGoToField}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
