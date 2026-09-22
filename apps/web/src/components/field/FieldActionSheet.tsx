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

/**
 * Field-ops bottom sheet — presentation-only progressive disclosure.
 * Mirrors MobileNavSheet a11y (focus trap, Escape, backdrop) with a Kai-like handle.
 */
export function FieldActionSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
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
    const timer = window.setTimeout(() => setMounted(false), 320);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!mounted || !visible) return;
    const panel = panelRef.current;
    if (!panel) return;
    if (!autofocusedRef.current) {
      autofocusedRef.current = true;
      const prefer =
        panel.querySelector<HTMLElement>("[data-autofocus]") ??
        panel.querySelector<HTMLElement>("a, button") ??
        closeRef.current;
      prefer?.focus();
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
    <div className="field-sheet-root" role="presentation">
      <button
        type="button"
        className={`field-sheet-backdrop${visible ? " is-open" : ""}`}
        aria-label="סגור"
        tabIndex={-1}
        onClick={() => onCloseRef.current()}
      />
      <div
        ref={panelRef}
        className={`field-sheet${visible ? " is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="field-sheet-handle" aria-hidden />
        <header className="field-sheet-header">
          <h2 id={titleId} className="field-sheet-title">
            {title}
          </h2>
          <button
            ref={closeRef}
            type="button"
            className="field-sheet-close"
            aria-label="סגור"
            onClick={() => onCloseRef.current()}
          >
            <X className="size-5" aria-hidden />
          </button>
        </header>
        <div className="field-sheet-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
