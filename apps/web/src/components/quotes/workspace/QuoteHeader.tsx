import { Button } from "@site-secure/ui";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Menu, MoreHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import { he } from "../../../i18n/he";
import { QuoteStepper } from "./QuoteStepper";
import { QuoteSaveIndicator } from "./QuoteSaveIndicator";
import type { QuoteWorkspaceStep } from "./types";

export function QuoteHeader({
  quoteNumber,
  statusLabel,
  version,
  customerName,
  siteName,
  saveState,
  savedAt,
  dirty,
  hasLiveId,
  activeStep,
  onStepSelect,
  canEdit,
  savePending,
  saveDisabled,
  onSave,
  previewDisabled,
  onPreview,
  primaryCtaLabel,
  primaryCtaDisabled,
  primaryCtaLoading,
  primaryCtaVariant,
  onPrimaryCta,
  primaryCtaTitle,
  moreOpen,
  morePlacement,
  onMoreToggle,
  moreMenuRef,
  moreMenu,
  mobileMenuOpen,
  onMobileMenuToggle,
  mobileMenuRef,
  mobileMenu,
  showMobileMenuButton = true,
  className,
}: {
  quoteNumber?: string | null;
  statusLabel: string;
  version?: number;
  customerName?: string;
  siteName?: string;
  saveState: "saved" | "saving" | "error" | "local";
  savedAt: number | null;
  dirty: boolean;
  hasLiveId: boolean;
  activeStep: QuoteWorkspaceStep;
  onStepSelect: (step: QuoteWorkspaceStep) => void;
  canEdit: boolean;
  savePending: boolean;
  saveDisabled: boolean;
  onSave: () => void;
  previewDisabled: boolean;
  onPreview: () => void;
  primaryCtaLabel: string | null;
  primaryCtaDisabled: boolean;
  primaryCtaLoading?: boolean;
  primaryCtaVariant?: "secondary" | "ghost" | undefined;
  onPrimaryCta: () => void;
  primaryCtaTitle?: string;
  moreOpen: boolean;
  morePlacement: "down" | "up";
  onMoreToggle: () => void;
  moreMenuRef: React.RefObject<HTMLDivElement | null>;
  moreMenu: ReactNode;
  mobileMenuOpen: boolean;
  onMobileMenuToggle: () => void;
  mobileMenuRef: React.RefObject<HTMLDivElement | null>;
  mobileMenu: ReactNode;
  showMobileMenuButton?: boolean;
  className?: string;
}) {
  const contextHint = [customerName, siteName].filter(Boolean).join(" · ");

  return (
    <header className={`cpq-builder-header cpq-builder-header-compact cpq-header-kai ${className ?? ""}`}>
      <div className="cpq-header-row">
        <div className="cpq-header-start">
          <h1 className="sr-only">{he.cpqHeaderTitle(quoteNumber || "")}</h1>

          <nav className="cpq-breadcrumb cpq-breadcrumb-desktop" aria-label="breadcrumb">
            <Link to="/app/quotes" className="cpq-breadcrumb-link">
              {he.cpqBreadcrumbQuotes}
            </Link>
          </nav>

          <Link to="/app/quotes" className="cpq-header-back" aria-label={he.cpqBreadcrumbQuotes}>
            <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
          </Link>

          <div className="cpq-header-identity-desktop">
            <div className="cpq-header-title-stack">
              <p className="cpq-header-quote-kicker">{he.quoteDetailTitle}</p>
              <p className={`cpq-header-quote-title${quoteNumber ? " ltr-meta" : ""}`}>
                {quoteNumber ? `#${quoteNumber}` : he.cpqHeaderUntitled}
              </p>
            </div>
            <div className="cpq-header-secondary">
              <span className="cpq-header-status-chip">{statusLabel}</span>
              {version ? <span className="cpq-header-version-chip ltr-meta">v{version}</span> : null}
              {contextHint ? <span className="cpq-header-context-hint">{contextHint}</span> : null}
            </div>
          </div>

          <div className="cpq-header-mobile-identity">
            <div className="cpq-header-mobile-title-stack">
              <span className="cpq-header-mobile-title">{he.quoteDetailTitle}</span>
              {quoteNumber ? <span className="cpq-header-mobile-number ltr-meta">#{quoteNumber}</span> : null}
            </div>
            <span className="cpq-header-status-pill">{statusLabel}</span>
            {version ? <span className="cpq-header-version-pill ltr-meta">v{version}</span> : null}
          </div>
          <div className="cpq-header-save-anchor">
            <QuoteSaveIndicator saveState={saveState} savedAt={savedAt} dirty={dirty} hasLiveId={hasLiveId} />
          </div>
        </div>

        <div className="cpq-stepper-desktop">
          <QuoteStepper active={activeStep} onSelect={onStepSelect} />
        </div>

        <div className="cpq-header-actions cpq-header-actions-desktop">
          {canEdit ? (
            <Button variant="ghost" loading={savePending} disabled={saveDisabled} onClick={onSave}>
              {he.save}
            </Button>
          ) : null}
          <Button variant="secondary" disabled={previewDisabled} onClick={onPreview}>
            {he.cpqCustomerView}
          </Button>
          {primaryCtaLabel ? (
            <Button
              className="cpq-header-primary-cta"
              variant={primaryCtaVariant}
              disabled={primaryCtaDisabled}
              title={primaryCtaTitle}
              loading={primaryCtaLoading}
              onClick={onPrimaryCta}
            >
              {primaryCtaLabel}
            </Button>
          ) : null}
          <div className="relative" ref={moreMenuRef}>
            <Button
              variant="ghost"
              onClick={onMoreToggle}
              aria-expanded={moreOpen && morePlacement === "down"}
              aria-haspopup="menu"
              aria-label={he.cpqMoreActionsAria}
              title={he.cpqMoreActions}
            >
              <MoreHorizontal className="size-5" aria-hidden />
            </Button>
            {moreOpen && morePlacement === "down" ? moreMenu : null}
          </div>
        </div>

        {showMobileMenuButton ? (
          <div className="cpq-header-actions cpq-header-actions-mobile">
            <div className="relative" ref={mobileMenuRef}>
              <Button
                variant="ghost"
                onClick={onMobileMenuToggle}
                aria-expanded={mobileMenuOpen}
                aria-haspopup="menu"
                aria-label={he.cpqHeaderMenuAria}
              >
                <Menu className="size-5" aria-hidden />
              </Button>
              {mobileMenuOpen ? mobileMenu : null}
            </div>
          </div>
        ) : null}
      </div>

      <QuoteStepper variant="icons" className="cpq-stepper-mobile-bar" active={activeStep} onSelect={onStepSelect} />
    </header>
  );
}
