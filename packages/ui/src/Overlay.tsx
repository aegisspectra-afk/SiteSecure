import { X } from "lucide-react";
import {
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "./cn";

export function Modal({
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
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="w-full max-w-md rounded-[var(--radius-panel)] border border-border bg-bg-2 p-6 text-fg shadow-popover backdrop:bg-fg/40"
      onClose={onClose}
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <button
          type="button"
          className="rounded-[var(--radius-control)] p-2 text-fg-muted hover:bg-bg-subtle focus-visible:outline-2 focus-visible:outline-focus"
          aria-label="סגור"
          onClick={onClose}
        >
          <X className="size-4" />
        </button>
      </div>
      {children}
    </dialog>
  );
}

export function Drawer({
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
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-fg/40"
        aria-label="סגור תפריט"
        onClick={onClose}
      />
      <aside
        className="absolute inset-y-0 start-0 flex w-[min(100%,20rem)] flex-col bg-bg-1 shadow-popover"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="font-semibold">{title}</h2>
          <button
            type="button"
            className="rounded-[var(--radius-control)] p-2 text-fg-muted hover:bg-bg-subtle"
            aria-label="סגור"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </aside>
    </div>,
    document.body,
  );
}

export function Dropdown({
  label,
  children,
}: {
  label: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, []);
  return (
    <div className="relative" ref={wrap}>
      <button
        type="button"
        className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] px-3 text-sm hover:bg-bg-subtle focus-visible:outline-2 focus-visible:outline-focus"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        {label}
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute end-0 z-40 mt-1 min-w-44 rounded-[var(--radius-panel)] border border-border bg-bg-2 py-1 shadow-popover"
        >
          <div onClick={() => setOpen(false)}>{children}</div>
        </div>
      ) : null}
    </div>
  );
}

export function DropdownItem(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      role="menuitem"
      className="flex w-full px-3 py-2 text-start text-sm text-fg hover:bg-bg-subtle disabled:cursor-not-allowed disabled:text-fg-muted"
      {...props}
    />
  );
}

export function Tooltip({
  content,
  children,
}: {
  content: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <span className="group relative inline-flex" aria-describedby={id}>
      {children}
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none absolute bottom-full start-1/2 z-30 mb-2 -translate-x-1/2 whitespace-nowrap rounded-[var(--radius-control)] bg-fg px-2 py-1 text-xs text-bg opacity-0 shadow-popover transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {content}
      </span>
    </span>
  );
}

export function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: { id: string; message: string }[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "pointer-events-auto flex max-w-md items-center gap-3 rounded-[var(--radius-panel)] border border-border bg-bg-2 px-4 py-3 text-sm shadow-popover",
          )}
          role="status"
        >
          <span>{t.message}</span>
          <button
            type="button"
            className="text-fg-muted hover:text-fg"
            aria-label="סגור"
            onClick={() => onDismiss(t.id)}
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
