import { Button } from "@site-secure/ui";
import { ChevronUp, MoreHorizontal } from "lucide-react";
import { memo, useEffect, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { he } from "../../../i18n/he";

/**
 * Single persistent Quote Builder mobile dock.
 * Secondary actions (add / preview) live in overflow — same handlers, no new semantics.
 * Portaled to document.body (outside .ops-shell), so bottom offset must not rely on
 * inherited --ops-bottom-nav-offset; CSS uses --ss-mobile-nav-reserve instead.
 */
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
      <div className="cpq-mobile-actions-row">
        <button
          type="button"
          className="cpq-mobile-actions-total"
          onClick={onOpenSummary}
          aria-label={`${he.cpqMobileSheetTitle}: ${he.cpqMobileSheetTotal} ${totalLabel}`}
          aria-haspopup="dialog"
          title={`${statusLabel} · ${he.cpqMobileOpenSummary}`}
        >
          <span className="cpq-mobile-total-label">
            {he.cpqMobileSheetTotal}
            <ChevronUp className="cpq-mobile-total-chevron" aria-hidden />
          </span>
          <span className="cpq-mobile-total ltr-meta">{totalLabel}</span>
          {!canSendNow ? (
            <span className="cpq-mobile-readiness-pill" aria-label={he.cpqReadinessTitle}>
              {readinessPercent}%
            </span>
          ) : null}
        </button>

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
          {overflowOpen ? (
            <div className="cpq-dock-overflow" role="presentation">
              <div className="cpq-overflow-menu is-mobile is-up cpq-dock-secondary-menu" role="menu">
                {canEdit ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onAdd();
                    }}
                  >
                    {he.cpqAddCommand}
                  </button>
                ) : null}
                <button
                  type="button"
                  role="menuitem"
                  disabled={previewDisabled}
                  onClick={() => {
                    onPreview();
                    onOverflowToggle();
                  }}
                >
                  {he.cpqCustomerView}
                </button>
              </div>
              {overflowMenu}
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
});
