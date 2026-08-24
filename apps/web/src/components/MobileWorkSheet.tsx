import { ChevronLeft } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { cn } from "@site-secure/ui";
import { he } from "../i18n/he";
import { isNavSelected, type AppNavLink } from "../lib/app-nav";
import { MobileNavSheet } from "./MobileNavSheet";
import { NavIcon } from "./NavIcon";

export function MobileWorkSheet({
  open,
  onClose,
  pathname,
  items,
}: {
  open: boolean;
  onClose: () => void;
  pathname: string;
  items: AppNavLink[];
}) {
  return (
    <MobileNavSheet open={open} onClose={onClose} title={he.navWorkSheetTitle}>
      <nav aria-label={he.navWork} className="mcc-section-body">
        {items.map((item) => {
          const selected = isNavSelected(item.to, pathname);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn("mcc-row", selected && "is-active")}
              aria-current={selected ? "page" : undefined}
              onClick={onClose}
            >
              <span className="mcc-row-icon">
                <NavIcon name={item.icon} active={selected} className="size-5" />
              </span>
              <span className="mcc-row-label">{item.label}</span>
              <ChevronLeft className="mcc-row-chevron size-4" aria-hidden />
            </Link>
          );
        })}
      </nav>
    </MobileNavSheet>
  );
}
