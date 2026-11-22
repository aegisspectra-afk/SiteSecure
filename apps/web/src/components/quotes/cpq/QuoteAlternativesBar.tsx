import type { QuoteAlternativeOut } from "@site-secure/api-client";
import { Button } from "@site-secure/ui";
import { he } from "../../../i18n/he";
import { formatMoney } from "../../../lib/quotes";

export function QuoteAlternativesBar({
  currency,
  alternatives,
  activeAlternativeId,
  canEdit,
  canViewCost,
  enabling,
  generating,
  onEnable,
  onGenerateCctv,
  onSelect,
  onMarkRecommended,
}: {
  currency: string;
  alternatives: QuoteAlternativeOut[];
  activeAlternativeId: string | null;
  canEdit: boolean;
  canViewCost?: boolean;
  enabling?: boolean;
  generating?: boolean;
  onEnable: () => void;
  onGenerateCctv?: () => void;
  onSelect: (alternativeId: string) => void;
  onMarkRecommended?: (alternativeId: string) => void;
}) {
  if (!alternatives.length) {
    if (!canEdit) return null;
    return (
      <div className="cpq-alternatives-bar">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-fg">{he.quoteAlternativesTitle}</p>
          <p className="text-xs text-fg-muted">{he.quoteAlternativesEnableHint}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onGenerateCctv ? (
            <Button type="button" variant="secondary" disabled={generating || enabling} onClick={onGenerateCctv}>
              {he.quoteAlternativesGenerateCctv}
            </Button>
          ) : null}
          <Button type="button" variant="secondary" disabled={enabling || generating} onClick={onEnable}>
            {he.quoteAlternativesEnable}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="cpq-alternatives-bar is-active" role="tablist" aria-label={he.quoteAlternativesTitle}>
      <p className="cpq-alternatives-bar-label">{he.quoteAlternativesTitle}</p>
      <div className="cpq-alternatives-tabs">
        {alternatives.map((alt) => {
          const id = String(alt.id);
          const selected = id === activeAlternativeId;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={`cpq-alternatives-tab${selected ? " is-selected" : ""}${alt.is_recommended ? " is-recommended" : ""}`}
              onClick={() => onSelect(id)}
            >
              <span className="block text-sm font-semibold text-fg">{alt.label}</span>
              {alt.is_recommended ? (
                <span className="block text-[0.65rem] text-action">{he.quoteAlternativeRecommended}</span>
              ) : null}
              <span className="mt-0.5 block text-xs text-fg-muted ltr-meta" dir="ltr">
                {formatMoney(Number(alt.total_gross ?? 0), currency)}
              </span>
              {canViewCost && alt.margin_percent != null ? (
                <span className="block text-[0.65rem] text-fg-subtle">
                  {he.quoteMargin}: {alt.margin_percent}%
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {canEdit && onGenerateCctv ? (
        <Button type="button" variant="ghost" disabled={generating} onClick={onGenerateCctv}>
          {he.quoteAlternativesGenerateCctv}
        </Button>
      ) : null}
      {canEdit && activeAlternativeId && onMarkRecommended ? (
        <Button type="button" variant="ghost" onClick={() => onMarkRecommended(activeAlternativeId)}>
          {he.quoteAlternativeMarkRecommended}
        </Button>
      ) : null}
    </div>
  );
}
