import type { DashboardSummary } from "@site-secure/api-client";
import { he } from "../../i18n/he";
import { quoteConversion } from "../../lib/ux-metrics";
import { RingMetric } from "./RingMetric";

export function UxRings({ summary }: { summary?: DashboardSummary | null }) {
  if (!summary) return null;
  const conversion = quoteConversion(summary);
  if (conversion.percent == null) return null;

  return (
    <section className="ops-card p-5" aria-labelledby="ux-rings-heading">
      <p className="public-mono text-[10px] tracking-[0.16em] text-fg-muted">{he.uxRingsKicker}</p>
      <h2 id="ux-rings-heading" className="mt-1 text-base font-semibold text-fg">
        {he.uxRingsTitle}
      </h2>
      <div className="mt-5 flex justify-center">
        <RingMetric
          percent={conversion.percent}
          label={he.uxQuoteConversion}
          hint={he.uxQuoteConversionHint(conversion.approved, conversion.total)}
          action={he.kpiViewQuotes}
          href="/app/quotes"
          tone="action"
          size="secondary"
        />
      </div>
    </section>
  );
}
