import { Button } from "@site-secure/ui";
import { he } from "../../../i18n/he";
import type { QuoteReadiness } from "../../../lib/quote-readiness";
import { goToQuoteField } from "../../../lib/quote-builder";

export function QuoteReadinessCard({
  readiness,
  onFix,
}: {
  readiness: QuoteReadiness;
  onFix?: () => void;
}) {
  return (
    <section className="cpq-readiness-card" aria-label={he.cpqReadinessTitle}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-semibold tracking-wide text-fg-muted">{he.cpqReadinessTitle}</p>
        <p className="text-lg font-semibold tracking-tight text-fg">{readiness.percent}%</p>
      </div>
      <ul className="cpq-readiness-list">
        {readiness.checks.map((check) => (
          <li key={check.id} className={check.ok ? "is-ok" : check.warning ? "is-warn" : "is-bad"}>
            <span aria-hidden>{check.ok ? "✓" : check.warning ? "⚠" : "✕"}</span>
            <span>{check.label}</span>
          </li>
        ))}
      </ul>
      {readiness.critical[0] ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <p className="text-xs text-fg-muted">{readiness.critical[0].message}</p>
          <Button
            variant="ghost"
            onClick={() => {
              goToQuoteField(readiness.critical[0].field);
              onFix?.();
            }}
          >
            {he.cpqReadinessFix}
          </Button>
        </div>
      ) : readiness.canSend ? (
        <p className="mt-2 text-xs text-success">{he.cpqReadinessReady}</p>
      ) : null}
    </section>
  );
}
