import { ChevronDown, UserRound } from "lucide-react";
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
  const hintParts = [customerName, siteName || null, projectName || null].filter(Boolean);

  return (
    <section
      className={`cpq-context-bar cpq-context-bar-accordion cpq-context-kai${accordionOpen ? " is-open" : ""}${
        customerName ? "" : " is-empty-customer"
      }`}
      aria-label={he.cpqContextBarAria}
    >
      <button
        type="button"
        className="cpq-context-accordion-trigger"
        aria-expanded={accordionOpen}
        onClick={onAccordionToggle}
      >
        <span className="cpq-context-accordion-title">{he.cpqContextCardTitle}</span>
        {!accordionOpen && hintParts.length ? (
          <span className="cpq-context-accordion-hint">{hintParts.join(" · ")}</span>
        ) : !accordionOpen && !customerName ? (
          <span className="cpq-context-accordion-hint is-missing">{he.cpqNoCustomer}</span>
        ) : null}
        <ChevronDown className={`cpq-context-accordion-chevron${accordionOpen ? " is-open" : ""}`} aria-hidden />
      </button>

      <div className="cpq-context-accordion-body">
        {customerName ? (
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
              {projectName ? (
                <div className="cpq-context-bar-field">
                  <span className="cpq-context-bar-kicker">{he.quoteProjectName}</span>
                  <span className="cpq-context-bar-value">{projectName}</span>
                </div>
              ) : null}
              {validUntil ? (
                <div className="cpq-context-bar-field">
                  <span className="cpq-context-bar-kicker">{he.quoteValidUntil}</span>
                  <span className="cpq-context-bar-value ltr-meta">{validUntil}</span>
                </div>
              ) : null}
            </div>
            <div className="cpq-context-bar-actions">
              {canChangeCustomer && onChangeCustomer ? (
                <button type="button" className="cpq-context-bar-link" onClick={onChangeCustomer}>
                  {he.quoteCustomerChange}
                </button>
              ) : null}
              <button type="button" className="cpq-context-bar-toggle" aria-expanded={expanded} onClick={onToggle}>
                {expanded ? he.cpqContextBarLess : he.cpqEditDetails}
              </button>
            </div>
          </div>
        ) : (
          <div className="cpq-context-empty-customer">
            <UserRound className="size-5 text-fg-muted" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="cpq-context-empty-title">{he.cpqNoCustomer}</p>
              <p className="cpq-context-empty-body">{he.quoteCustomerPickerHint}</p>
            </div>
            <span className="cpq-context-empty-action-hint">{he.cpqSelectCustomer}</span>
          </div>
        )}
        {expanded || !customerName ? <div className="cpq-context-bar-expanded">{children}</div> : null}
      </div>
    </section>
  );
}
