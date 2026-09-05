import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { cn } from "@site-secure/ui";
import type { KeyboardEvent } from "react";
import { he } from "../i18n/he";
import {
  isNavSelected,
  nextSidebarIndex,
  planLabel,
  type AppNavGroup,
} from "../lib/app-nav";
import { NavIcon } from "./NavIcon";
import { UserAccountMenu } from "./UserAccountMenu";

function workspaceMetaLine(planKey?: string, active?: boolean): string {
  const plan = planLabel(planKey);
  const status = active === false ? he.workspaceMetaInactive : he.workspaceMetaActive;
  return [plan, status].filter(Boolean).join(" · ");
}

function BrandMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2.75 20.25 8v5.2c0 4.35-3.35 8.05-8.25 9.8-4.9-1.75-8.25-5.45-8.25-9.8V8L12 2.75Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M12 7.25 16 11l-4 3.75L8 11l4-3.75Z" fill="currentColor" opacity="0.28" />
      <path
        d="M12 7.25 16 11l-4 3.75L8 11l4-3.75Z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SidebarBrand({
  workspaceName,
  planKey,
  workspaceActive = true,
  collapsed = false,
  onToggleCollapse,
}: {
  workspaceName?: string | null;
  planKey?: string;
  workspaceActive?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const meta = workspaceMetaLine(planKey, workspaceActive);
  const primary = workspaceName?.trim() || he.brand;

  return (
    <div className={cn("ops-sidebar-brand", collapsed && "is-collapsed")}>
      <div className="ops-sidebar-brand-row">
        <div className="ops-sidebar-brand-identity">
          <BrandMark className="ops-sidebar-brand-mark" />
          {!collapsed ? (
            <div className="ops-sidebar-brand-copy min-w-0 flex-1">
              <p className="ops-sidebar-workspace-name" title={primary}>
                {primary}
              </p>
              {meta ? <p className="ops-sidebar-workspace-meta">{meta}</p> : null}
              <p className="sr-only">{he.brand}</p>
            </div>
          ) : (
            <span className="sr-only">
              {primary}
              {meta ? ` · ${meta}` : ""}
            </span>
          )}
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
      className={cn("ops-sidebar-nav", collapsed && "is-collapsed")}
      onKeyDown={onKeyDown}
    >
      {groups.map((group) => (
        <div key={group.id} className="ops-sidebar-group">
          {!collapsed ? (
            <p className="ops-sidebar-group-label">{group.label}</p>
          ) : (
            <span className="sr-only">{group.label}</span>
          )}
          <div className="ops-sidebar-group-items">
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
        </div>
      ))}
    </nav>
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
  onAdmin,
  isBeta = false,
  isPlatformAdmin = false,
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
  onAdmin?: () => void;
  isBeta?: boolean;
  isPlatformAdmin?: boolean;
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
        onAdmin={onAdmin}
        isBeta={isBeta}
        isPlatformAdmin={isPlatformAdmin}
        compact={collapsed}
        showAegisLink
      />
    </div>
  );
}
