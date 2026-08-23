import { X } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

function getFocusable(root: HTMLElement) {
  return [
    ...root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ].filter((el) => !el.hasAttribute("disabled") && el.tabIndex !== -1);
}

export function QuoteFlowSheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  variant = "center",
  returnFocusRef,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  variant?: "center" | "sheet";
  /** Optional trigger to restore focus when the sheet closes. */
  returnFocusRef?: RefObject<HTMLElement | null>;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const returnFocusRefStable = useRef(returnFocusRef);
  const autofocusedRef = useRef(false);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  onCloseRef.current = onClose;
  returnFocusRefStable.current = returnFocusRef;

  // Mount/unmount + visibility only track `open` — never parent callback identity.
  useEffect(() => {
    if (open) {
      setMounted(true);
      const id = window.requestAnimationFrame(() => setVisible(true));
      return () => window.cancelAnimationFrame(id);
    }
    setVisible(false);
    autofocusedRef.current = false;
    const timer = window.setTimeout(() => {
      setMounted(false);
      returnFocusRefStable.current?.current?.focus();
    }, 220);
    return () => window.clearTimeout(timer);
  }, [open]);

  // Focus trap + one-shot autofocus when the sheet becomes visible.
  useEffect(() => {
    if (!mounted || !visible) return;
    const panel = panelRef.current;
    if (!panel) return;

    // Autofocus once per open cycle. Never steal if the user already focused a control
    // (covers Strict Mode remounts and late effect re-runs after typing).
    if (!autofocusedRef.current) {
      autofocusedRef.current = true;
      const active = document.activeElement as HTMLElement | null;
      if (!active || !panel.contains(active)) {
        const prefer =
          panel.querySelector<HTMLElement>("[data-autofocus]") ??
          panel.querySelector<HTMLElement>("input, button.quote-flow-action, button") ??
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
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
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
    <div className={`quote-flow-root quote-flow-root--${variant}`} role="presentation">
      <button
        type="button"
        className={`quote-flow-backdrop${visible ? " is-open" : ""}`}
        aria-label="סגור"
        tabIndex={-1}
        onClick={() => onCloseRef.current()}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`quote-flow-sheet quote-flow-sheet--${variant}${visible ? " is-open" : ""}`}
      >
        <header className="quote-flow-header">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold tracking-tight text-fg">
              {title}
            </h2>
            {subtitle ? <p className="mt-1 text-sm leading-relaxed text-fg-muted">{subtitle}</p> : null}
          </div>
          <button
            ref={closeRef}
            type="button"
            className="shrink-0 rounded-[var(--radius-control)] p-2 text-fg-muted transition-colors hover:bg-bg-subtle hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            aria-label="סגור"
            onClick={() => onCloseRef.current()}
          >
            <X className="size-4" />
          </button>
        </header>
        <div className="quote-flow-body">{children}</div>
        {footer ? <div className="quote-flow-footer">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
