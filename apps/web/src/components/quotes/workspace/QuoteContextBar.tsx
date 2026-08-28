import type { ReactNode } from "react";
import { he } from "../../../i18n/he";

export function QuoteContextBar({
  expanded,
  onToggle,
  customerName,
  customerKind,
  customerPhone,
  siteName,
  siteAddress,
  validUntil,
  projectName,
  onChangeCustomer,
  canChangeCustomer,
  children,
}: {
  expanded: boolean;
  onToggle: () => void;
  customerName?: string | null;
  customerKind?: string | null;
  customerPhone?: string | null;
  siteName?: string | null;
  siteAddress?: string | null;
  validUntil?: string | null;
  projectName?: string | null;
  onChangeCustomer?: () => void;
  canChangeCustomer?: boolean;
  children?: ReactNode;
}) {
  if (!customerName) return <>{children}</>;

  return (
    <section className="cpq-context-bar" aria-label={he.cpqContextBarAria}>
      <div className="cpq-context-bar-summary">
        <div className="cpq-context-bar-fields">
          <div id="customer_id" tabIndex={-1} className="cpq-context-bar-field">
            <span className="cpq-context-bar-kicker">{he.cpqContextCustomerKicker}</span>
            <span className="cpq-context-bar-value">{customerName}</span>
            {customerKind ? <span className="cpq-context-bar-sub">{customerKind}</span> : null}
            {customerPhone ? <span className="cpq-context-bar-sub ltr-meta">{customerPhone}</span> : null}
          </div>
          <div className="cpq-context-bar-field">
            <span className="cpq-context-bar-kicker">{he.cpqContextSiteKicker}</span>
            <span className="cpq-context-bar-value">{siteName || he.quoteSiteNone}</span>
            {siteAddress ? <span className="cpq-context-bar-sub">{siteAddress}</span> : null}
          </div>
          {validUntil ? (
            <div className="cpq-context-bar-field">
              <span className="cpq-context-bar-kicker">{he.quoteValidUntil}</span>
              <span className="cpq-context-bar-value ltr-meta">{validUntil}</span>
            </div>
          ) : null}
          {projectName ? (
            <div className="cpq-context-bar-field">
              <span className="cpq-context-bar-kicker">{he.quoteProjectName}</span>
              <span className="cpq-context-bar-value">{projectName}</span>
            </div>
          ) : null}
        </div>
        <div className="cpq-context-bar-actions">
          {canChangeCustomer && onChangeCustomer ? (
            <button type="button" className="cpq-context-bar-link" onClick={onChangeCustomer}>
              {he.quoteCustomerChange}
            </button>
          ) : null}
          <button
            type="button"
            className="cpq-context-bar-toggle"
            aria-expanded={expanded}
            onClick={onToggle}
          >
            {expanded ? he.cpqContextBarLess : he.cpqContextBarMore}
          </button>
        </div>
      </div>
      {expanded ? <div className="cpq-context-bar-expanded">{children}</div> : null}
    </section>
  );
}
