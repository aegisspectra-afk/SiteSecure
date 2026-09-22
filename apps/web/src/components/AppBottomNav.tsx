import { Link } from "@tanstack/react-router";
import { cn } from "@site-secure/ui";
import { useCallback, useEffect, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { he } from "../i18n/he";
import { isNavSelected, type BottomNavEntry } from "../lib/app-nav";
import { NavIcon } from "./NavIcon";

function itemSelected(
  item: BottomNavEntry,
  pathname: string,
  moreOpen?: boolean,
  moreActive?: boolean,
  workOpen?: boolean,
  workActive?: boolean,
) {
  if (item.kind === "more") return Boolean(moreOpen || moreActive);
  if (item.kind === "work") return Boolean(workOpen || workActive);
  return isNavSelected(item.to, pathname);
}

function NavSlot({
  index,
  itemRefs,
  children,
}: {
  index: number;
  itemRefs: MutableRefObject<(HTMLElement | null)[]>;
  children: ReactNode;
}) {
  return (
    <span
      className="ops-bottom-nav-slot"
      ref={(node) => {
        itemRefs.current[index] = node;
      }}
    >
      {children}
    </span>
  );
}

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
  const navRef = useRef<HTMLElement>(null);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);
  const [puck, setPuck] = useState({ x: 0, y: 0, w: 52, h: 52, ready: false });

  const activeIndex = items.findIndex((item) =>
    itemSelected(item, pathname, moreOpen, moreActive, workOpen, workActive),
  );

  const measure = useCallback(() => {
    const nav = navRef.current;
    const el = activeIndex >= 0 ? itemRefs.current[activeIndex] : null;
    if (!nav || !el) return;
    const navBox = nav.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    const w = Math.max(40, box.width - 6);
    const h = Math.max(40, box.height - 8);
    setPuck({
      x: box.left - navBox.left + (box.width - w) / 2,
      y: box.top - navBox.top + (box.height - h) / 2,
      w,
      h,
      ready: true,
    });
  }, [activeIndex]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    measure();
    const nav = navRef.current;
    if (!nav || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(nav);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [mounted, measure, items.length]);

  if (items.length === 0) return null;

  const nav = (
    <nav ref={navRef} className="ops-bottom-nav" aria-label={he.navMobile}>
      <span
        className={cn("ops-bottom-nav-puck", puck.ready && "is-ready")}
        aria-hidden
        style={{
          width: puck.w,
          height: puck.h,
          transform: `translate3d(${puck.x}px, ${puck.y}px, 0)`,
        }}
      />
      {items.map((item, index) => {
        if (item.kind === "more") {
          const active = Boolean(moreOpen || moreActive);
          return (
            <NavSlot key="more" index={index} itemRefs={itemRefs}>
              <button
                type="button"
                className={cn("ops-bottom-nav-item", active && "is-active")}
                aria-expanded={moreOpen}
                aria-haspopup="dialog"
                onClick={onMore}
              >
                <NavIcon name="more" active={active} className="size-6" />
                <span>{item.label}</span>
              </button>
            </NavSlot>
          );
        }
        if (item.kind === "work") {
          const active = Boolean(workOpen || workActive);
          return (
            <NavSlot key="work" index={index} itemRefs={itemRefs}>
              <button
                type="button"
                className={cn("ops-bottom-nav-item", active && "is-active")}
                aria-expanded={workOpen}
                aria-haspopup="dialog"
                onClick={onWork}
              >
                <NavIcon name="work" active={active} className="size-6" />
                <span>{item.label}</span>
              </button>
            </NavSlot>
          );
        }
        const selected = isNavSelected(item.to, pathname);
        return (
          <NavSlot key={item.to} index={index} itemRefs={itemRefs}>
            <Link
              to={item.to}
              className={cn("ops-bottom-nav-item", selected && "is-active")}
              aria-current={selected ? "page" : undefined}
            >
              <NavIcon name={item.icon} active={selected} className="size-6" />
              <span>{item.label}</span>
            </Link>
          </NavSlot>
        );
      })}
    </nav>
  );

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(nav, document.body);
}
