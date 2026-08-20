import { SquareArrowOutUpRight } from "lucide-react";
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
}: {
  workspaceName?: string | null;
  roleKey?: string;
  planKey?: string;
}) {
  const tenure = tenureLine(roleKey, planKey);
  return (
    <div className="ops-sidebar-brand">
      <p className="text-sm font-semibold tracking-[-0.02em] text-fg">{he.brand}</p>
      <p className="public-mono mt-1 text-[10px] tracking-[0.16em] text-fg-subtle">{he.opsPlatform}</p>
      {workspaceName ? (
        <>
          <p className="public-mono mt-4 text-[10px] tracking-[0.16em] text-fg-subtle">{he.navWorkspace}</p>
          <p className="mt-1 truncate text-sm font-medium text-fg">{workspaceName}</p>
        </>
      ) : null}
      {tenure ? <p className="mt-1 truncate text-xs text-fg-muted">{tenure}</p> : null}
    </div>
  );
}

export function SidebarNav({
  groups,
  pathname,
  onNavigate,
}: {
  groups: AppNavGroup[];
  pathname: string;
  onNavigate?: () => void;
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
    <nav aria-label={he.navDesktop} className="flex flex-col gap-5 px-2 py-3" onKeyDown={onKeyDown}>
      {groups.map((group) => (
        <div key={group.id} className="flex flex-col gap-0.5">
          <p className="public-mono px-3 pb-1 text-[10px] tracking-[0.16em] text-fg-subtle">{group.label}</p>
          {group.items.map((item) => {
            const selected = isNavSelected(item.to, pathname);
            return (
              <Link
                key={item.to}
                to={item.to}
                data-sidebar-item
                title={item.label}
                className={cn("ops-sidebar-link", selected && "is-active")}
                aria-current={selected ? "page" : undefined}
                onClick={onNavigate}
              >
                <NavIcon name={item.icon} active={selected} className="size-4 shrink-0" />
                <span className="min-w-0 truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function SidebarExternal({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="ops-sidebar-external">
      <p className="public-mono px-3 pb-1 text-[10px] tracking-[0.16em] text-fg-subtle">{he.navExternal}</p>
      <Link
        to="/"
        data-sidebar-item
        className="ops-sidebar-link ops-sidebar-external-link"
        title={he.navAegis}
        onClick={onNavigate}
      >
        <SquareArrowOutUpRight className="size-4 shrink-0" aria-hidden />
        <span className="min-w-0 truncate">{he.navAegis}</span>
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
}) {
  return (
    <div className="ops-sidebar-account">
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
      />
    </div>
  );
}
