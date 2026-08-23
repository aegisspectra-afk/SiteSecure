import { Building2, MapPin } from "lucide-react";
import { he } from "../../../i18n/he";

export function QuoteContextCard({
  customerName,
  customerKind,
  siteName,
  siteAddress,
  unassigned,
  onChange,
  canChange,
  onCreateSite,
  canCreateSite,
}: {
  customerName?: string | null;
  customerKind?: string | null;
  siteName?: string | null;
  siteAddress?: string | null;
  unassigned?: boolean;
  onChange?: () => void;
  canChange?: boolean;
  onCreateSite?: () => void;
  canCreateSite?: boolean;
}) {
  if (unassigned) {
    return (
      <div id="customer_id" tabIndex={-1} className="quote-context-card is-empty">
        <div className="min-w-0">
          <p className="text-sm font-medium text-fg">{he.workflowUnassignedCustomer}</p>
          <p className="mt-0.5 text-xs text-fg-muted">{he.workflowUnassignedCustomerHint}</p>
        </div>
      </div>
    );
  }

  if (!customerName) return null;

  return (
    <div id="customer_id" tabIndex={-1} className="quote-context-card">
      <div className="flex min-w-0 flex-1 gap-3">
        <span className="quote-context-icon" aria-hidden>
          <Building2 className="size-4" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 space-y-2">
          <div>
            <p className="truncate text-sm font-semibold text-fg">{customerName}</p>
            {customerKind ? <p className="text-xs text-fg-muted">{customerKind}</p> : null}
          </div>
          {siteName ? (
            <div className="flex gap-2">
              <MapPin className="mt-0.5 size-3.5 shrink-0 text-fg-muted" aria-hidden />
              <div className="min-w-0">
                <p className="truncate text-sm text-fg">{siteName}</p>
                {siteAddress ? <p className="truncate text-xs text-fg-muted">{siteAddress}</p> : null}
              </div>
            </div>
          ) : canCreateSite && onCreateSite ? (
            <button type="button" className="text-xs font-medium text-action hover:underline" onClick={onCreateSite}>
              {he.workflowCreateSiteOptional}
            </button>
          ) : (
            <p className="text-xs text-fg-muted">{he.workflowNoSiteAttached}</p>
          )}
        </div>
      </div>
      {canChange && onChange ? (
        <button type="button" className="quote-context-change shrink-0" onClick={onChange}>
          {he.quoteCustomerChange}
        </button>
      ) : null}
    </div>
  );
}
