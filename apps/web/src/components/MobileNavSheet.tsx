import { X } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

function getFocusable(root: HTMLElement) {
  return [
    ...root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ].filter((el) => !el.hasAttribute("disabled") && el.tabIndex !== -1);
}

/** Mobile-only bottom sheet — not the desktop sidebar Drawer. */
export function MobileNavSheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const autofocusedRef = useRef(false);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  onCloseRef.current = onClose;

  useEffect(() => {
    if (open) {
      setMounted(true);
      const id = window.requestAnimationFrame(() => setVisible(true));
      return () => window.cancelAnimationFrame(id);
    }
    setVisible(false);
    autofocusedRef.current = false;
    const timer = window.setTimeout(() => setMounted(false), 220);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!mounted || !visible) return;
    const panel = panelRef.current;
    if (!panel) return;
    if (!autofocusedRef.current) {
      autofocusedRef.current = true;
      const active = document.activeElement as HTMLElement | null;
      if (!active || !panel.contains(active)) {
        const prefer =
          panel.querySelector<HTMLElement>("[data-autofocus]") ??
          panel.querySelector<HTMLElement>("input, button") ??
          closeRef.current;
        prefer?.focus();
      }
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const nodes = getFocusable(panelRef.current);
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const focused = document.activeElement as HTMLElement | null;
      if (event.shiftKey && focused === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && focused === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [mounted, visible]);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div className="mobile-nav-sheet-root" role="presentation">
      <button
        type="button"
        className={`mobile-nav-sheet-backdrop${visible ? " is-open" : ""}`}
        aria-label="סגור"
        tabIndex={-1}
        onClick={() => onCloseRef.current()}
      />
      <div
        ref={panelRef}
        className={`mobile-nav-sheet${visible ? " is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="mobile-nav-sheet-header">
          <h2 id={titleId} className="mobile-nav-sheet-title">
            {title}
          </h2>
          <button
            ref={closeRef}
            type="button"
            className="mobile-nav-sheet-close"
            aria-label="סגור"
            onClick={() => onCloseRef.current()}
          >
            <X className="size-5" aria-hidden />
          </button>
        </header>
        <div className="mobile-nav-sheet-body">{children}</div>
        {footer ? <footer className="mobile-nav-sheet-footer">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}
