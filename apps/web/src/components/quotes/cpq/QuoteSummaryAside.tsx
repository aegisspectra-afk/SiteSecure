import { Button } from "@site-secure/ui";
import { he } from "../../../i18n/he";
import { formatMoney } from "../../../lib/quotes";

export function QuoteSummaryAside({
  currency,
  vatPercent,
  subtotalNet,
  vatAmount,
  totalGross,
  discountAmount,
  canViewCost,
  costTotal,
  marginAmount,
  marginPercent,
  marginStatus,
  marginTarget,
  marginMinimum,
  canOverrideMargin,
  hasMarginOverride,
  onOverrideMargin,
  pricedCount = 0,
  compact = false,
  showProfitability = true,
  totalsOnly = false,
}: {
  currency: string;
  vatPercent: number;
  subtotalNet?: number | null;
  vatAmount?: number | null;
  totalGross?: number | null;
  discountAmount?: number | null;
  canViewCost: boolean;
  costTotal?: number | null;
  marginAmount?: number | null;
  marginPercent?: number | null;
  marginStatus?: "healthy" | "warning" | "critical" | null;
  marginTarget?: number | null;
  marginMinimum?: number | null;
  canOverrideMargin?: boolean;
  hasMarginOverride?: boolean;
  onOverrideMargin?: () => void;
  pricedCount?: number;
  /** Totals only — hide profitability block */
  compact?: boolean;
  showProfitability?: boolean;
  /** Profitability panel without customer totals */
  totalsOnly?: boolean;
}) {
  const hasLines = pricedCount > 0;
  const costMissing = hasLines && canViewCost && !(Number(costTotal) > 0);
  const effectiveStatus = hasLines && !costMissing ? marginStatus : null;
  const showTotals = !totalsOnly;

  return (
    <>
      {showTotals ? (
      <section className="cpq-summary-card flex flex-col gap-3 p-4">
        <p className="text-xs font-semibold tracking-wide text-fg-muted">{he.cpqQuoteSummary}</p>
        <PriceLine label={he.quoteSubtotalBeforeVat} value={formatMoney(subtotalNet, currency)} />
        {discountAmount != null && discountAmount > 0 ? (
          <PriceLine label={he.cpqQuoteDiscount} value={`−${formatMoney(discountAmount, currency)}`} />
        ) : null}
        <PriceLine label={he.quoteTaxHint(vatPercent)} value={formatMoney(vatAmount, currency)} />
        <div className="cpq-summary-total">
          <span className="text-sm text-fg-muted">{he.quoteTotalDue}</span>
          <div className="text-end">
            <p className="text-2xl font-semibold tracking-tight text-fg">{formatMoney(totalGross, currency)}</p>
            <p className="text-xs text-fg-muted">{he.cpqTotalIncludesVat}</p>
          </div>
        </div>
      </section>
      ) : null}

      {(!compact || totalsOnly) && showProfitability && canViewCost ? (
        <section className="cpq-profit-card flex flex-col gap-2.5 p-4" aria-label={he.cpqProfitability}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold tracking-wide text-fg-muted">{he.cpqProfitability}</p>
            <span className="cpq-internal-badge">{he.cpqInternalBadge}</span>
          </div>
          {!hasLines ? (
            <p className="text-sm text-fg-muted">{he.cpqMarginUnavailable}</p>
          ) : costMissing ? (
            <div className="cpq-cost-missing">
              <p className="text-sm font-medium text-fg">{he.cpqCostMissingTitle}</p>
              <p className="mt-1 text-xs text-fg-muted">{he.cpqCostMissingBody}</p>
            </div>
          ) : (
            <>
              <PriceLine label={he.cpqRevenue} value={formatMoney(subtotalNet, currency)} />
              <PriceLine label={he.quoteCost} value={formatMoney(costTotal, currency)} />
              <PriceLine label={he.quoteGrossProfit} value={formatMoney(marginAmount, currency)} />
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-fg-muted">{he.quoteMargin}</span>
                <span className={`font-semibold ${marginToneClass(effectiveStatus)}`}>
                  {marginPercent != null ? `${marginPercent}%` : "—"}
                  {effectiveStatus ? (
                    <span className="ms-2 text-xs font-normal text-fg-muted">
                      ({marginStatusLabel(effectiveStatus)})
                    </span>
                  ) : null}
                </span>
              </div>
              {effectiveStatus && effectiveStatus !== "healthy" ? (
                <p className="text-xs text-fg-subtle">
                  {he.cpqMarginThresholdHint(marginTarget ?? 30, marginMinimum ?? 15)}
                </p>
              ) : null}
              {hasMarginOverride ? (
                <p className="text-xs text-fg-muted">{he.cpqMarginOverrideActive}</p>
              ) : null}
              {canOverrideMargin &&
              effectiveStatus === "critical" &&
              !hasMarginOverride &&
              onOverrideMargin ? (
                <Button variant="ghost" onClick={onOverrideMargin}>
                  {he.cpqMarginOverrideAction}
                </Button>
              ) : null}
            </>
          )}
        </section>
      ) : null}
    </>
  );
}

function marginToneClass(status?: string | null) {
  if (status === "critical") return "text-danger";
  if (status === "warning") return "text-warning";
  if (status === "healthy") return "text-success";
  return "";
}

function marginStatusLabel(status: string) {
  if (status === "critical") return he.cpqMarginCritical;
  if (status === "warning") return he.cpqMarginWarning;
  return he.cpqMarginHealthy;
}

function PriceLine({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-fg-muted">{label}</span>
      <span className={strong ? "text-lg font-semibold tracking-tight text-fg" : "font-medium"}>{value}</span>
    </div>
  );
}
