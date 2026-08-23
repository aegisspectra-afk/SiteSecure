import { LogOut, Settings, Shield, Users } from "lucide-react";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@site-secure/ui";
import { ThemePicker } from "./ThemePicker";
import { he } from "../i18n/he";
import { planLabel, roleLabelEn } from "../lib/app-nav";
import { useReducedMotion } from "../lib/use-reduced-motion";
import { initialsFromName, placeAccountPopover } from "../lib/workspace-header";

function AvatarMark({ initials }: { initials: string }) {
  return (
    <span
      className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-bg-subtle text-[11px] font-semibold tracking-wide text-fg"
      aria-hidden
    >
      {initials || "•"}
    </span>
  );
}

function AccountAction({
  icon,
  children,
  onClick,
}: {
  icon: ReactNode;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      data-account-item
      className="flex min-h-11 w-full items-center gap-2 rounded-[var(--radius-control)] px-3 text-start text-sm text-fg hover:bg-bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      onClick={onClick}
    >
      <span className="flex size-4 shrink-0 items-center justify-center text-fg-muted" aria-hidden>
        {icon}
      </span>
      {children}
    </button>
  );
}

export function UserAccountMenu({
  displayName,
  email,
  roleKey,
  planKey,
  canSettings,
  canSecurity,
  canUsers,
  onSettings,
  onSecurity,
  onUsers,
  onSignOut,
  variant = "header",
  compact = false,
}: {
  displayName: string;
  email?: string | null;
  roleKey?: string;
  planKey?: string;
  canSettings: boolean;
  canSecurity: boolean;
  canUsers?: boolean;
  onSettings: () => void;
  onSecurity: () => void;
  onUsers?: () => void;
  onSignOut: () => void;
  variant?: "header" | "sidebar";
  compact?: boolean;
}) {
  const menuId = useId();
  const reducedMotion = useReducedMotion();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const initials = initialsFromName(displayName, email);
  const roleEn = roleLabelEn(roleKey);
  const plan = planLabel(planKey);
  const tenure = [roleEn, plan].filter(Boolean).join(" · ");
  const showTeam = Boolean(canUsers && onUsers);
  const showManage = canSettings || canSecurity || showTeam;

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    const update = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const rtl = document.documentElement.dir !== "ltr";
      setCoords(
        placeAccountPopover(
          { top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom, width: rect.width },
          { width: window.innerWidth, height: window.innerHeight },
          { rtl, placement: variant === "sidebar" ? "above" : "cover" },
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
  }, [open, variant]);

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
    const first = panelRef.current?.querySelector<HTMLButtonElement>("[data-account-item]");
    if (!first) return;
    first.focus();
    focusedRef.current = true;
  }, [open, coords]);

  const closeThen = (action: () => void) => {
    setOpen(false);
    action();
  };

  const onPanelKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(panelRef.current?.querySelectorAll<HTMLButtonElement>("[data-account-item]") ?? []);
    if (!items.length) return;
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const at = index < 0 ? 0 : index;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      items[(at + 1) % items.length]?.focus();
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      items[(at - 1 + items.length) % items.length]?.focus();
    }
    if (event.key === "Home") {
      event.preventDefault();
      items[0]?.focus();
    }
    if (event.key === "End") {
      event.preventDefault();
      items[items.length - 1]?.focus();
    }
    if (event.key === "Tab" && items.length) {
      if (event.shiftKey && at <= 0) {
        event.preventDefault();
        items[items.length - 1]?.focus();
      } else if (!event.shiftKey && at === items.length - 1) {
        event.preventDefault();
        items[0]?.focus();
      }
    }
  };

  const identity = (
    <span
      className={cn(
        "flex min-w-0 items-center gap-2 text-start",
        variant === "sidebar" && "w-full",
        compact && "justify-center",
      )}
    >
      <AvatarMark initials={initials} />
      {!compact ? (
        <span className={cn("min-w-0 flex-col", variant === "sidebar" ? "flex" : "hidden sm:flex")}>
          <span className="max-w-40 truncate text-sm font-medium text-fg">{displayName}</span>
          {email ? <span className="ltr-meta max-w-40 truncate text-[11px] text-fg-muted">{email}</span> : null}
        </span>
      ) : (
        <span className="sr-only">{displayName}</span>
      )}
    </span>
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={
          variant === "sidebar"
            ? "flex min-h-11 w-full items-center rounded-[var(--radius-control)] px-2 hover:bg-bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            : "inline-flex min-h-11 max-w-64 items-center rounded-[var(--radius-control)] px-2 hover:bg-bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:px-3"
        }
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? menuId : undefined}
        aria-label={he.userMenu}
        onClick={() => setOpen((value) => !value)}
      >
        <span className={open && variant === "header" ? "invisible" : undefined} aria-hidden={open && variant === "header" || undefined}>
          {identity}
        </span>
      </button>
      {open && coords && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              id={menuId}
              role="dialog"
              aria-label={he.userMenu}
              aria-modal="false"
              className={reducedMotion ? "ops-header-popover" : "ops-header-popover ops-header-popover-enter"}
              style={{
                top: coords.top,
                bottom: coords.bottom,
                left: coords.left,
                width: coords.width,
                maxHeight: coords.maxHeight,
              }}
              onKeyDown={onPanelKeyDown}
            >
              <div className="px-3 pb-3 pt-3">
                <p className="public-mono text-[10px] tracking-[0.16em] text-fg-muted">{he.accountMenuKicker}</p>
                <div className="mt-3 flex items-center gap-3">
                  <AvatarMark initials={initials} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-fg">{displayName}</p>
                    {email ? <p className="ltr-meta truncate text-xs text-fg-muted">{email}</p> : null}
                  </div>
                </div>
                {tenure ? (
                  <p className="public-mono mt-3 text-[10px] tracking-[0.16em] text-fg-muted uppercase">
                    {tenure}
                  </p>
                ) : null}
              </div>
              <div className="border-t border-border px-3 py-3">
                <ThemePicker id={`${menuId}-theme`} />
              </div>
              {showManage ? (
                <div className="border-t border-border px-1 py-1">
                  <p className="px-3 pb-1 pt-2 text-xs text-fg-muted">{he.accountManage}</p>
                  {canSettings ? (
                    <AccountAction icon={<Settings className="size-4" />} onClick={() => closeThen(onSettings)}>
                      {he.navSettings}
                    </AccountAction>
                  ) : null}
                  {canSecurity ? (
                    <AccountAction icon={<Shield className="size-4" />} onClick={() => closeThen(onSecurity)}>
                      {he.navSecurity}
                    </AccountAction>
                  ) : null}
                  {showTeam ? (
                    <AccountAction icon={<Users className="size-4" />} onClick={() => closeThen(onUsers!)}>
                      {he.navUsers}
                    </AccountAction>
                  ) : null}
                </div>
              ) : null}
              <div className="border-t border-border px-1 py-1">
                <AccountAction icon={<LogOut className="size-4" />} onClick={() => closeThen(onSignOut)}>
                  {he.signOut}
                </AccountAction>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
