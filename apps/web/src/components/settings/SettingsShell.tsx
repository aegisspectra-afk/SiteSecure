import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@site-secure/ui";
import type { ReactNode } from "react";
import { he } from "../../i18n/he";
import { can, canAny } from "../../lib/can";
import { useSession } from "../../lib/session";

export type SettingsNavId =
  | "general"
  | "company"
  | "appearance"
  | "numbering"
  | "quotes"
  | "pdf"
  | "sites"
  | "notifications"
  | "roles"
  | "users"
  | "security"
  | "system"
  | "audit";

type NavItem = {
  id: SettingsNavId;
  to: string;
  label: string;
  visible: boolean;
};

export function useSettingsNavItems(): NavItem[] {
  const { session } = useSession();
  const roleKey = session?.memberships[0]?.role_key;
  const features = session?.memberships[0]?.features ?? [];
  const grants = session?.memberships[0]?.permissions ?? null;
  const allow = (permission: string) => can(roleKey, permission, features, grants);
  const allowAny = (permissions: string[]) => canAny(roleKey, permissions, features, grants);

  const items: NavItem[] = [
    { id: "general", to: "/app/settings", label: he.settingsNavGeneral, visible: allow("workspace.edit") },
    {
      id: "company",
      to: "/app/settings/company",
      label: he.settingsNavCompany,
      visible: allow("workspace.edit") || allow("settings.branding"),
    },
    { id: "appearance", to: "/app/settings/appearance", label: he.settingsNavAppearance, visible: allow("workspace.edit") },
    { id: "numbering", to: "/app/settings/numbering", label: he.settingsNavNumbering, visible: allow("workspace.edit") },
    { id: "quotes", to: "/app/settings/quotes", label: he.settingsNavQuotes, visible: allow("workspace.edit") },
    { id: "pdf", to: "/app/settings/pdf-templates", label: he.settingsNavPdf, visible: allow("workspace.edit") || allow("settings.branding") },
    { id: "sites", to: "/app/settings/sites", label: he.settingsNavSites, visible: allow("workspace.edit") },
    { id: "notifications", to: "/app/settings/notifications", label: he.settingsNavNotifications, visible: allow("workspace.edit") },
    { id: "users", to: "/app/settings/users", label: he.navUsers, visible: allow("users.view") },
    {
      id: "roles",
      to: "/app/settings/roles",
      label: he.settingsNavRoles,
      visible: allow("roles.manage"),
    },
    {
      id: "security",
      to: "/app/settings/security",
      label: he.navSecurity,
      visible: allowAny(["settings.general", "workspace.edit"]),
    },
    { id: "system", to: "/app/settings/system", label: he.settingsNavSystem, visible: allow("workspace.edit") },
    { id: "audit", to: "/app/settings/audit", label: he.navAudit, visible: allow("audit.view") },
  ];
  return items.filter((item) => item.visible);
}

function isActive(pathname: string, to: string): boolean {
  if (to === "/app/settings") return pathname === "/app/settings" || pathname === "/app/settings/";
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function SettingsNav() {
  const items = useSettingsNavItems();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="settings-nav" aria-label={he.settingsNavAria}>
      <ul className="settings-nav-list">
        {items.map((item) => {
          const active = isActive(pathname, item.to);
          return (
            <li key={item.id}>
              <Link
                to={item.to}
                className={cn("settings-nav-link", active && "is-active")}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function SettingsShell({ children }: { children: ReactNode }) {
  return (
    <div className="settings-shell">
      <aside className="settings-aside">
        <p className="settings-aside-title">{he.settingsTitle}</p>
        <SettingsNav />
      </aside>
      <div className="settings-main min-w-0">{children}</div>
    </div>
  );
}
