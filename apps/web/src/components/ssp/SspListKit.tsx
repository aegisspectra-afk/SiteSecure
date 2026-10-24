import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { he } from "../../i18n/he";

export function stopSspRowNav(event: { stopPropagation(): void }) {
  event.stopPropagation();
}

export function copySspTextFallback(value: string) {
  const field = document.createElement("textarea");
  field.value = value;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.insetInlineStart = "-9999px";
  document.body.appendChild(field);
  field.select();
  document.execCommand("copy");
  field.remove();
}

export async function copySspText(value: string): Promise<boolean> {
  if (!value) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
    } else {
      copySspTextFallback(value);
    }
    return true;
  } catch {
    try {
      copySspTextFallback(value);
      return true;
    } catch {
      return true;
    }
  }
}

export function useSspWideLayout() {
  const [wide, setWide] = useState(() =>
    typeof window === "undefined" ? true : window.matchMedia("(min-width: 640px)").matches,
  );

  useEffect(() => {
    const query = window.matchMedia("(min-width: 640px)");
    const sync = () => setWide(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return wide;
}

export function SspFilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="ssp-list-filters" role="search">
      {children}
    </div>
  );
}

export function SspStatusBadge({
  tone,
  children,
}: {
  tone: "quiet" | "warning" | "admin" | "manager" | "officer" | "pending";
  children: ReactNode;
}) {
  const toneClass =
    tone === "warning"
      ? "is-no-form"
      : tone === "admin"
        ? "is-admin"
        : tone === "manager"
          ? "is-manager"
          : tone === "officer"
            ? "is-officer"
            : tone === "pending"
              ? "is-pending"
              : "is-quiet";
  return <span className={`ssp-site-tone ${toneClass}`}>{children}</span>;
}

export function SspSortHeader({
  label,
  active,
  dir,
  onSort,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onSort: () => void;
}) {
  return (
    <button
      type="button"
      className={`ssp-list-sort${active ? " is-active" : ""}`}
      onClick={onSort}
      aria-label={he.sspSortBy(label)}
    >
      <span>{label}</span>
      {active ? (
        <span className={`ssp-list-sort-arrow is-${dir}`} aria-hidden>
          {dir === "asc" ? "▲" : "▼"}
        </span>
      ) : null}
    </button>
  );
}

export function SspCopyButton({
  value,
  label,
  copiedLabel,
  copied,
  onCopy,
}: {
  value: string;
  label: string;
  copiedLabel: string;
  copied: boolean;
  onCopy: (value: string) => void;
}) {
  return (
    <button
      type="button"
      className="ssp-list-action"
      onClick={(event) => {
        stopSspRowNav(event);
        onCopy(value);
      }}
      onPointerDown={stopSspRowNav}
    >
      {copied ? copiedLabel : label}
    </button>
  );
}

export type SspRowActionItem = {
  id: string;
  label: string;
  disabled?: boolean;
  title?: string;
  onClick?: () => void;
};

export function SspRowActionsMenu({
  name,
  menuUp,
  items,
}: {
  name: string;
  menuUp: boolean;
  items: SspRowActionItem[];
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: globalThis.MouseEvent) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={`ssp-list-more${menuUp ? " is-up" : ""}`} ref={wrap}>
      <button
        type="button"
        className="ssp-list-action"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`${he.sspQuickMore} ${name}`}
        onClick={(event) => {
          stopSspRowNav(event);
          setOpen((value) => !value);
        }}
        onPointerDown={stopSspRowNav}
      >
        {he.sspQuickMore}
      </button>
      {open ? (
        <div className="ssp-quick-more-menu" role="menu">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className="ssp-quick-more-item"
              role="menuitem"
              disabled={item.disabled}
              title={item.title}
              onClick={(event) => {
                stopSspRowNav(event);
                if (item.disabled) return;
                item.onClick?.();
                setOpen(false);
              }}
              onPointerDown={stopSspRowNav}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function sspRowKeyDown(event: KeyboardEvent<HTMLElement>, open: () => void) {
  if (event.target !== event.currentTarget) return;
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    open();
  }
}
