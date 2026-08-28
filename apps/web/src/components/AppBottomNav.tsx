import { Link } from "@tanstack/react-router";
import { cn } from "@site-secure/ui";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { he } from "../i18n/he";
import { isNavSelected, type BottomNavEntry } from "../lib/app-nav";
import { NavIcon } from "./NavIcon";

export function AppBottomNav({
  items,
  pathname,
  moreOpen,
  workOpen,
  workActive,
  moreActive,
  onMore,
  onWork,
}: {
  items: BottomNavEntry[];
  pathname: string;
  moreOpen?: boolean;
  workOpen?: boolean;
  workActive?: boolean;
  moreActive?: boolean;
  onMore?: () => void;
  onWork?: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (items.length === 0) return null;

  const nav = (
    <nav className="ops-bottom-nav" aria-label={he.navMobile}>
      {items.map((item) => {
        if (item.kind === "more") {
          const active = Boolean(moreOpen || moreActive);
          return (
            <button
              key="more"
              type="button"
              className={cn("ops-bottom-nav-item", active && "is-active")}
              aria-expanded={moreOpen}
              aria-haspopup="dialog"
              onClick={onMore}
            >
              <NavIcon name="more" active={active} className="size-6" />
              <span>{item.label}</span>
            </button>
          );
        }
        if (item.kind === "work") {
          const active = Boolean(workOpen || workActive);
          return (
            <button
              key="work"
              type="button"
              className={cn("ops-bottom-nav-item", active && "is-active")}
              aria-expanded={workOpen}
              aria-haspopup="dialog"
              onClick={onWork}
            >
              <NavIcon name="work" active={active} className="size-6" />
              <span>{item.label}</span>
            </button>
          );
        }
        const selected = isNavSelected(item.to, pathname);
        return (
          <Link
            key={item.to}
            to={item.to}
            className={cn("ops-bottom-nav-item", selected && "is-active")}
            aria-current={selected ? "page" : undefined}
          >
            <NavIcon name={item.icon} active={selected} className="size-6" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(nav, document.body);
}
