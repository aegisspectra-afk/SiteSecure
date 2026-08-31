import { Button } from "@site-secure/ui";
import { MoreHorizontal } from "lucide-react";
import { memo, useEffect, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { he } from "../../../i18n/he";

export const QuoteMobileActionsBar = memo(function QuoteMobileActionsBar({
  totalLabel,
  readinessPercent,
  canSendNow,
  statusLabel,
  canEdit,
  previewDisabled,
  onPreview,
  onAdd,
  primaryCtaLabel,
  primaryCtaDisabled,
  primaryCtaLoading,
  primaryCtaTitle,
  onPrimaryCta,
  showPrimaryCta,
  overflowOpen,
  onOverflowToggle,
  overflowRef,
  overflowMenu,
  onOpenSummary,
}: {
  totalLabel: string;
  readinessPercent: number;
  canSendNow: boolean;
  statusLabel: string;
  canEdit: boolean;
  previewDisabled: boolean;
  onPreview: () => void;
  onAdd: () => void;
  primaryCtaLabel: string | null;
  primaryCtaDisabled: boolean;
  primaryCtaLoading?: boolean;
  primaryCtaTitle?: string;
  onPrimaryCta: () => void;
  showPrimaryCta: boolean;
  overflowOpen: boolean;
  onOverflowToggle: () => void;
  overflowRef: RefObject<HTMLDivElement | null>;
  overflowMenu: ReactNode;
  onOpenSummary: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div className="quote-builder-actions lg:hidden" role="toolbar" aria-label={he.cpqMobileActionsBarAria}>
      <button type="button" className="cpq-mobile-actions-summary" onClick={onOpenSummary}>
        <span className="cpq-mobile-actions-summary-main">
          <span className="cpq-mobile-total-label">{he.cpqMobileSheetTotal}</span>
          <span className="cpq-mobile-total ltr-meta">{totalLabel}</span>
        </span>
        <span className="cpq-mobile-actions-summary-meta">
          <span className="cpq-mobile-status-pill">{statusLabel}</span>
          {!canSendNow ? (
            <span className="cpq-mobile-readiness-pill" aria-label={he.cpqReadinessTitle}>
              {readinessPercent}%
            </span>
          ) : null}
        </span>
      </button>

      <div className="cpq-mobile-actions-row">
        {canEdit ? (
          <Button type="button" variant="secondary" className="cpq-mobile-action-add" onClick={onAdd}>
            {he.cpqAddCommand}
          </Button>
        ) : null}

        <Button
          type="button"
          variant="secondary"
          className="cpq-mobile-action-preview"
          disabled={previewDisabled}
          onClick={onPreview}
        >
          {he.quotePreviewPrimary}
        </Button>

        {showPrimaryCta && primaryCtaLabel ? (
          <Button
            type="button"
            className="cpq-mobile-action-primary"
            disabled={primaryCtaDisabled}
            title={primaryCtaTitle}
            loading={primaryCtaLoading}
            onClick={onPrimaryCta}
          >
            {primaryCtaLabel}
          </Button>
        ) : null}

        <div className="relative cpq-mobile-action-overflow" ref={overflowRef}>
          <Button
            type="button"
            variant="ghost"
            aria-expanded={overflowOpen}
            aria-haspopup="menu"
            aria-label={he.cpqMoreActionsAria}
            title={he.cpqMoreActions}
            onClick={onOverflowToggle}
          >
            <MoreHorizontal className="size-5" aria-hidden />
          </Button>
          {overflowOpen ? overflowMenu : null}
        </div>
      </div>
    </div>,
    document.body,
  );
});
