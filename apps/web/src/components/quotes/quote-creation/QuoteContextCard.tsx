import { Building2, MapPin } from "lucide-react";
import type { ReactNode } from "react";
import { he } from "../../../i18n/he";

export function QuoteContextCard({
  customerName,
  customerKind,
  customerPhone,
  siteName,
  siteAddress,
  unassigned,
  onChange,
  canChange,
  onCreateSite,
  canCreateSite,
  siteSlot,
  siteFileLink,
}: {
  customerName?: string | null;
  customerKind?: string | null;
  customerPhone?: string | null;
  siteName?: string | null;
  siteAddress?: string | null;
  unassigned?: boolean;
  onChange?: () => void;
  canChange?: boolean;
  onCreateSite?: () => void;
  canCreateSite?: boolean;
  siteSlot?: ReactNode;
  siteFileLink?: ReactNode;
}) {
  if (unassigned) {
    return (
      <div id="customer_id" tabIndex={-1} className="quote-context-card is-empty">
        <div className="min-w-0">
          <p className="public-mono text-[10px] tracking-[0.14em] text-fg-muted">{he.cpqContextCustomerKicker}</p>
          <p className="mt-1 text-sm font-medium text-fg">{he.workflowUnassignedCustomer}</p>
          <p className="mt-0.5 text-xs text-fg-muted">{he.workflowUnassignedCustomerHint}</p>
        </div>
      </div>
    );
  }

  if (!customerName) return null;

  return (
    <div id="customer_id" tabIndex={-1} className="quote-context-card quote-context-card--split">
      <div className="quote-context-block">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex gap-3">
            <span className="quote-context-icon" aria-hidden>
              <Building2 className="size-4" strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <p className="public-mono text-[10px] tracking-[0.14em] text-fg-muted">{he.cpqContextCustomerKicker}</p>
              <p className="mt-1 truncate text-sm font-semibold text-fg">{customerName}</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-fg-muted">
                {customerKind ? <span>{customerKind}</span> : null}
                {customerPhone ? <span className="ltr-meta">{customerPhone}</span> : null}
              </div>
            </div>
          </div>
          {canChange && onChange ? (
            <button type="button" className="quote-context-change shrink-0" onClick={onChange}>
              {he.quoteCustomerChange}
            </button>
          ) : null}
        </div>
      </div>

      <div className="quote-context-block">
        <div className="flex gap-3">
          <span className="quote-context-icon" aria-hidden>
            <MapPin className="size-4" strokeWidth={1.75} />
          </span>
          <div className="min-w-0 flex-1 space-y-2">
            {siteSlot ? null : (
              <p className="public-mono text-[10px] tracking-[0.14em] text-fg-muted">{he.cpqContextSiteKicker}</p>
            )}
            {siteSlot ? (
              siteSlot
            ) : siteName ? (
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-fg">{siteName}</p>
                {siteAddress ? <p className="truncate text-xs text-fg-muted">{siteAddress}</p> : null}
              </div>
            ) : (
              <p className="text-sm text-fg-muted">{he.quoteSiteNone}</p>
            )}
            {siteFileLink ? <div className="pt-0.5">{siteFileLink}</div> : null}
            {!siteName && !siteSlot && canCreateSite && onCreateSite ? (
              <button type="button" className="text-xs font-medium text-action hover:underline" onClick={onCreateSite}>
                {he.workflowCreateSiteOptional}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
