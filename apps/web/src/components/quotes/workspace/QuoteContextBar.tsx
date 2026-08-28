import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { he } from "../../../i18n/he";

export function QuoteContextBar({
  expanded,
  onToggle,
  accordionOpen,
  onAccordionToggle,
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
  accordionOpen: boolean;
  onAccordionToggle: () => void;
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
  const hintParts = [customerName, siteName || null, validUntil || null].filter(Boolean);

  const summaryFields = customerName ? (
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
  ) : null;

  const actions = customerName ? (
    <div className="cpq-context-bar-actions">
      {canChangeCustomer && onChangeCustomer ? (
        <button type="button" className="cpq-context-bar-link" onClick={onChangeCustomer}>
          {he.quoteCustomerChange}
        </button>
      ) : null}
      <button type="button" className="cpq-context-bar-toggle" aria-expanded={expanded} onClick={onToggle}>
        {expanded ? he.cpqContextBarLess : he.cpqContextBarMore}
      </button>
    </div>
  ) : null;

  return (
    <section
      className={`cpq-context-bar cpq-context-bar-accordion${accordionOpen ? " is-open" : ""}`}
      aria-label={he.cpqContextBarAria}
    >
      <button
        type="button"
        className="cpq-context-accordion-trigger"
        aria-expanded={accordionOpen}
        onClick={onAccordionToggle}
      >
        <span className="cpq-context-accordion-title">{he.cpqContextAccordionTitle}</span>
        {!accordionOpen && hintParts.length ? (
          <span className="cpq-context-accordion-hint">{hintParts.join(" · ")}</span>
        ) : null}
        <ChevronDown className={`cpq-context-accordion-chevron${accordionOpen ? " is-open" : ""}`} aria-hidden />
      </button>

      <div className="cpq-context-accordion-body">
        {customerName ? (
          <div className="cpq-context-bar-summary">
            {summaryFields}
            {actions}
          </div>
        ) : null}
        {expanded || !customerName ? <div className="cpq-context-bar-expanded">{children}</div> : null}
        {customerName && !expanded ? (
          <div className="cpq-context-bar-more-row">
            <button type="button" className="cpq-context-bar-toggle" onClick={onToggle}>
              {he.cpqContextBarMore}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
