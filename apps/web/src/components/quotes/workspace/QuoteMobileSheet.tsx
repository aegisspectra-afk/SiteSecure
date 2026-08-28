import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { he } from "../../../i18n/he";

const SWIPE_THRESHOLD_PX = 50;

export function QuoteMobileSheet({
  open,
  onOpenChange,
  totalLabel,
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalLabel: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const dragDelta = useRef(0);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      const id = window.requestAnimationFrame(() => setVisible(true));
      return () => window.cancelAnimationFrame(id);
    }
    setVisible(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  function onPointerDown(event: React.PointerEvent) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    dragStartY.current = event.clientY;
    dragDelta.current = 0;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent) {
    if (dragStartY.current === null) return;
    dragDelta.current = event.clientY - dragStartY.current;
    const panel = panelRef.current;
    if (!panel) return;
    if (!open && dragDelta.current < 0) {
      panel.style.transform = `translateY(${Math.max(dragDelta.current, -window.innerHeight * 0.65)}px)`;
    } else if (open && dragDelta.current > 0) {
      panel.style.transform = `translateY(${Math.min(dragDelta.current, window.innerHeight * 0.65)}px)`;
    }
  }

  function onPointerUp(event: React.PointerEvent) {
    if (dragStartY.current === null) return;
    const delta = dragDelta.current;
    dragStartY.current = null;
    dragDelta.current = 0;
    const panel = panelRef.current;
    if (panel) panel.style.transform = "";

    if (!open && delta < -SWIPE_THRESHOLD_PX) {
      onOpenChange(true);
      return;
    }
    if (open && delta > SWIPE_THRESHOLD_PX) {
      onOpenChange(false);
    }
  }

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div className={`cpq-mobile-sheet-root lg:hidden${visible ? " is-open" : ""}`} role="presentation">
      {open ? (
        <button
          type="button"
          className="cpq-mobile-sheet-backdrop"
          aria-label={he.cpqMobileSheetClose}
          onClick={() => onOpenChange(false)}
        />
      ) : null}
      <div
        ref={panelRef}
        className={`cpq-mobile-sheet${visible ? " is-open" : ""}`}
        role="dialog"
        aria-modal={open}
        aria-labelledby={titleId}
      >
        <button
          type="button"
          className="cpq-mobile-sheet-handle"
          aria-expanded={open}
          aria-controls={titleId}
          onClick={() => onOpenChange(!open)}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <span className="cpq-mobile-sheet-grabber" aria-hidden />
          {!open ? (
            <span className="cpq-mobile-sheet-mini">
              <span className="cpq-mobile-sheet-mini-label">{he.cpqMobileSheetTotal}</span>
              <span className="cpq-mobile-sheet-mini-value ltr-meta">{totalLabel}</span>
            </span>
          ) : (
            <span id={titleId} className="cpq-mobile-sheet-title">
              {he.cpqMobileSheetTitle}
            </span>
          )}
        </button>
        <div className="cpq-mobile-sheet-body">{children}</div>
        {footer ? <footer className="cpq-mobile-sheet-footer">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}
