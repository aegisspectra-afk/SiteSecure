import { PanelLeftClose, PanelLeftOpen, SquareArrowOutUpRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { cn } from "@site-secure/ui";
import type { KeyboardEvent } from "react";
import { he } from "../i18n/he";
import {
  isNavSelected,
  nextSidebarIndex,
  planLabel,
  roleLabel,
  type AppNavGroup,
} from "../lib/app-nav";
import { NavIcon } from "./NavIcon";
import { UserAccountMenu } from "./UserAccountMenu";

function tenureLine(roleKey?: string, planKey?: string): string {
  return [roleLabel(roleKey), planLabel(planKey)].filter(Boolean).join(" · ");
}

export function SidebarBrand({
  workspaceName,
  roleKey,
  planKey,
  collapsed = false,
  onToggleCollapse,
}: {
  workspaceName?: string | null;
  roleKey?: string;
  planKey?: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const tenure = tenureLine(roleKey, planKey);
  return (
    <div className={cn("ops-sidebar-brand", collapsed && "is-collapsed")}>
      <div className="ops-sidebar-brand-row">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold tracking-[-0.02em] text-fg">{collapsed ? "SS" : he.brand}</p>
          {!collapsed ? (
            <p className="public-mono mt-1 text-[10px] tracking-[0.16em] text-fg-subtle">{he.opsPlatform}</p>
          ) : null}
        </div>
        {onToggleCollapse ? (
          <button
            type="button"
            className="ops-sidebar-collapse"
            onClick={onToggleCollapse}
            aria-label={collapsed ? he.sidebarExpand : he.sidebarCollapse}
            title={collapsed ? he.sidebarExpand : he.sidebarCollapse}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4" aria-hidden />
            ) : (
              <PanelLeftClose className="size-4" aria-hidden />
            )}
          </button>
        ) : null}
      </div>
      {workspaceName ? (
        <>
          {!collapsed ? (
            <p className="public-mono mt-3 text-[10px] tracking-[0.16em] text-fg-subtle">{he.navWorkspace}</p>
          ) : null}
          <p
            className={cn("truncate text-sm font-medium text-fg", collapsed ? "mt-3 text-center" : "mt-1")}
            title={workspaceName}
          >
            {collapsed ? workspaceName.slice(0, 1) : workspaceName}
          </p>
        </>
      ) : null}
      {!collapsed && tenure ? <p className="mt-1 truncate text-xs text-fg-muted">{tenure}</p> : null}
    </div>
  );
}

export function SidebarNav({
  groups,
  pathname,
  onNavigate,
  collapsed = false,
}: {
  groups: AppNavGroup[];
  pathname: string;
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const links = Array.from(event.currentTarget.querySelectorAll<HTMLAnchorElement>("[data-sidebar-item]"));
    if (!links.length) return;
    const current = links.indexOf(document.activeElement as HTMLAnchorElement);
    const next = nextSidebarIndex(current < 0 ? 0 : current, event.key, links.length);
    if (next == null) return;
    event.preventDefault();
    links[next]?.focus();
  };

  return (
    <nav
      aria-label={he.navDesktop}
      className={cn("flex flex-col gap-5 px-2 py-3", collapsed && "items-stretch")}
      onKeyDown={onKeyDown}
    >
      {groups.map((group) => (
        <div key={group.id} className="flex flex-col gap-0.5">
          {!collapsed ? (
            <p className="public-mono px-3 pb-1 text-[10px] tracking-[0.16em] text-fg-subtle">{group.label}</p>
          ) : (
            <span className="sr-only">{group.label}</span>
          )}
          {group.items.map((item) => {
            const selected = isNavSelected(item.to, pathname);
            return (
              <Link
                key={item.to}
                to={item.to}
                data-sidebar-item
                title={item.label}
                className={cn("ops-sidebar-link", selected && "is-active", collapsed && "is-collapsed")}
                aria-current={selected ? "page" : undefined}
                aria-label={item.label}
                onClick={onNavigate}
              >
                <NavIcon name={item.icon} active={selected} className="size-4 shrink-0" />
                {!collapsed ? <span className="min-w-0 truncate">{item.label}</span> : null}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function SidebarExternal({
  onNavigate,
  collapsed = false,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  return (
    <div className="ops-sidebar-external">
      {!collapsed ? (
        <p className="public-mono px-3 pb-1 text-[10px] tracking-[0.16em] text-fg-subtle">{he.navExternal}</p>
      ) : (
        <span className="sr-only">{he.navExternal}</span>
      )}
      <Link
        to="/"
        data-sidebar-item
        className={cn("ops-sidebar-link ops-sidebar-external-link", collapsed && "is-collapsed")}
        title={he.navAegis}
        aria-label={he.navAegis}
        onClick={onNavigate}
      >
        <SquareArrowOutUpRight className="size-4 shrink-0" aria-hidden />
        {!collapsed ? <span className="min-w-0 truncate">{he.navAegis}</span> : null}
      </Link>
    </div>
  );
}

export function SidebarAccount({
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
  collapsed = false,
}: {
  displayName: string;
  email?: string | null;
  roleKey?: string;
  planKey?: string;
  canSettings: boolean;
  canSecurity: boolean;
  canUsers: boolean;
  onSettings: () => void;
  onSecurity: () => void;
  onUsers: () => void;
  onSignOut: () => void;
  collapsed?: boolean;
}) {
  return (
    <div className={cn("ops-sidebar-account", collapsed && "is-collapsed")}>
      <UserAccountMenu
        variant="sidebar"
        displayName={displayName}
        email={email}
        roleKey={roleKey}
        planKey={planKey}
        canSettings={canSettings}
        canSecurity={canSecurity}
        canUsers={canUsers}
        onSettings={onSettings}
        onSecurity={onSecurity}
        onUsers={onUsers}
        onSignOut={onSignOut}
        compact={collapsed}
      />
    </div>
  );
}
