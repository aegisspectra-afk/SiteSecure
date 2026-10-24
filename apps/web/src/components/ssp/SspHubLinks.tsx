import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { AppNavTo } from "../../lib/app-nav";
import { he } from "../../i18n/he";

const HUB_ACTION_CLASS =
  "inline-flex min-h-11 min-w-24 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-border bg-bg px-4 text-sm font-medium text-fg hover:bg-bg-subtle active:bg-bg-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

export function SspHubLinks({
  items,
  variant = "pills",
}: {
  items: Array<{ to: AppNavTo; label: string }>;
  variant?: "pills" | "menu";
}) {
  if (!items.length) return null;
  if (variant === "menu") return <HubMenu items={items} />;
  return (
    <nav className="flex flex-wrap gap-2" aria-label={he.sspRelatedScreens}>
      {items.map((item) => (
        <Link key={item.to} to={item.to} className={HUB_ACTION_CLASS}>
          <span>{item.label}</span>
          <ChevronLeft className="size-4 shrink-0 rtl:rotate-180" aria-hidden />
        </Link>
      ))}
    </nav>
  );
}

function HubMenu({ items }: { items: Array<{ to: AppNavTo; label: string }> }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
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
    <nav className="ssp-hub-menu" ref={wrap} aria-label={he.sspQuickNav}>
      <button
        type="button"
        className="ssp-quick-btn"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        {he.sspQuickNav}
      </button>
      {open ? (
        <div className="ssp-quick-more-menu" role="menu">
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="ssp-quick-more-item"
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}
    </nav>
  );
}
