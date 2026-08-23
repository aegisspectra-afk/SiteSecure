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
}: {
  gaps: QuoteGap[];
  pricedCount: number;
}) {
  const visible = filterEmptyQuoteMarginGaps(gaps, pricedCount);
  const { completeness, technical, financial } = groupGapsByDomain(visible);
  const { critical } = partitionGaps(visible);
  const score = completenessScore(visible);
  const ready = critical.length === 0 && score.done === score.total;

  return (
    <section className="ops-card flex flex-col gap-3 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="public-mono text-[11px] tracking-[0.18em] text-fg-muted">{he.quoteSectionChecks}</p>
        <p className="text-xs text-fg-muted">
          {ready ? he.cpqQuoteReadyToSend : he.cpqCompletenessScore(score.done, score.total)}
        </p>
      </div>

      {ready ? (
        <p className="text-sm font-medium text-success">{he.quoteChecksOk}</p>
      ) : null}

      <DomainGroup
        title={he.cpqValidationCompleteness}
        gaps={completeness}
        defaultOpen={completeness.length > 0}
      />
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
    </section>
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
