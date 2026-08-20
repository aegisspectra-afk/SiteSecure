import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useReducedMotion } from "../lib/use-reduced-motion";
import { placeAccountPopover } from "../lib/workspace-header";

export function HeaderPopover({
  menuLabel,
  trigger,
  children,
  placement = "below",
}: {
  menuLabel: string;
  trigger: ReactNode;
  children: ReactNode;
  placement?: "cover" | "below";
}) {
  const menuId = useId();
  const reducedMotion = useReducedMotion();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    const update = () => {
      const triggerEl = triggerRef.current;
      if (!triggerEl) return;
      const rect = triggerEl.getBoundingClientRect();
      const rtl = document.documentElement.dir !== "ltr";
      setCoords(
        placeAccountPopover(
          { top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom, width: rect.width },
          { width: window.innerWidth, height: window.innerHeight },
          { rtl, placement },
        ),
      );
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, placement]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const focusedRef = useRef(false);
  useEffect(() => {
    if (!open) {
      focusedRef.current = false;
      return;
    }
    if (!coords || focusedRef.current) return;
    panelRef.current?.focus();
    focusedRef.current = true;
  }, [open, coords]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] px-2 hover:bg-bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:px-3"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? menuId : undefined}
        aria-label={menuLabel}
        onClick={() => setOpen((value) => !value)}
      >
        {trigger}
      </button>
      {open && coords && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              id={menuId}
              role="dialog"
              tabIndex={-1}
              aria-label={menuLabel}
              aria-modal="false"
              className={reducedMotion ? "ops-header-popover" : "ops-header-popover ops-header-popover-enter"}
              style={{
                top: coords.top,
                left: coords.left,
                width: coords.width,
                maxHeight: coords.maxHeight,
              }}
            >
              {children}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
