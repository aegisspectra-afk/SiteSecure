import { Button } from "@site-secure/ui";
import { Link } from "@tanstack/react-router";
import { Menu, MoreHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import { he } from "../../../i18n/he";
import { QuoteStepper } from "./QuoteStepper";
import type { QuoteWorkspaceStep } from "./types";

export function QuoteHeader({
  quoteNumber,
  statusLabel,
  version,
  customerName,
  siteName,
  saveState,
  saveLabel,
  dirty,
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
  className,
}: {
  quoteNumber?: string | null;
  statusLabel: string;
  version?: number;
  customerName?: string;
  siteName?: string;
  saveState: "saved" | "saving" | "error" | "local";
  saveLabel: string;
  dirty: boolean;
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
  className?: string;
}) {
  const metaParts = [
    quoteNumber,
    statusLabel,
    version ? `v${version}` : null,
    customerName,
    siteName,
  ].filter(Boolean);

  return (
    <header className={`cpq-builder-header cpq-builder-header-compact sticky top-0 z-20 ${className ?? ""}`}>
      <div className="cpq-header-row">
        <div className="cpq-header-start">
          <h1 className="sr-only">{he.cpqHeaderTitle(quoteNumber || "")}</h1>
          <nav className="cpq-breadcrumb cpq-breadcrumb-desktop" aria-label="breadcrumb">
            <Link to="/app/quotes" className="cpq-breadcrumb-link">
              {he.cpqBreadcrumbQuotes}
            </Link>
            {quoteNumber ? (
              <>
                <span className="cpq-breadcrumb-sep" aria-hidden>
                  /
                </span>
                <span className="cpq-breadcrumb-current ltr-meta">{quoteNumber}</span>
              </>
            ) : null}
          </nav>
          <Link to="/app/quotes" className="cpq-header-back" aria-label={he.cpqBreadcrumbQuotes}>
            ←
          </Link>
          <div className="cpq-header-mobile-identity">
            {quoteNumber ? <span className="cpq-header-mobile-number ltr-meta">{quoteNumber}</span> : null}
            <span className="cpq-header-status-pill">{statusLabel}</span>
            {version ? <span className="cpq-header-version-pill ltr-meta">v{version}</span> : null}
          </div>
          <p className="cpq-header-meta cpq-header-meta-desktop" title={metaParts.join(" · ")}>
            {metaParts.join(" · ")}
          </p>
          <p className="cpq-save-state cpq-save-state-inline" aria-live="polite">
            <span className={`cpq-save-dot is-${saveState === "error" ? "error" : dirty ? "dirty" : saveState}`} />
            {saveLabel}
          </p>
        </div>

        <div className="cpq-stepper-desktop">
          <QuoteStepper active={activeStep} onSelect={onStepSelect} />
        </div>

        <div className="cpq-header-actions cpq-header-actions-desktop">
          {canEdit ? (
            <Button variant="secondary" loading={savePending} disabled={saveDisabled} onClick={onSave}>
              {he.save}
            </Button>
          ) : null}
          <Button variant="secondary" disabled={previewDisabled} onClick={onPreview}>
            {he.cpqCustomerView}
          </Button>
          {primaryCtaLabel ? (
            <Button
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
      </div>

      <QuoteStepper variant="icons" className="cpq-stepper-mobile-bar" active={activeStep} onSelect={onStepSelect} />
    </header>
  );
}
