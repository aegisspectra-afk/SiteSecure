import { Link } from "@tanstack/react-router";
import { cn } from "@site-secure/ui";
import { he } from "../i18n/he";
import { isNavSelected, type BottomNavEntry } from "../lib/app-nav";
import { NavIcon } from "./NavIcon";

export function AppBottomNav({
  items,
  pathname,
  moreOpen,
  onMore,
}: {
  items: BottomNavEntry[];
  pathname: string;
  moreOpen?: boolean;
  onMore?: () => void;
}) {
  if (items.length === 0) return null;

  return (
    <nav className="ops-bottom-nav lg:hidden" aria-label={he.navMobile}>
      {items.map((item) => {
        if (item.kind === "more") {
          return (
            <button
              key="more"
              type="button"
              className={cn("ops-bottom-nav-item", moreOpen && "is-active")}
              aria-expanded={moreOpen}
              onClick={onMore}
            >
              <NavIcon name="more" active={moreOpen} className="size-6" />
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
}
