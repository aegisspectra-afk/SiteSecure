import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { cn } from "@site-secure/ui";
import { useEffect, type ReactNode } from "react";
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

export type SettingsNavGroupId = "account" | "commercial" | "operations" | "team" | "advanced";

type NavItem = {
  id: SettingsNavId;
  to: string;
  label: string;
  group: SettingsNavGroupId;
  visible: boolean;
};

type NavGroup = {
  id: SettingsNavGroupId;
  label: string;
  items: NavItem[];
};

const GROUP_ORDER: SettingsNavGroupId[] = ["account", "commercial", "operations", "team", "advanced"];

const GROUP_LABEL: Record<SettingsNavGroupId, string> = {
  account: he.settingsNavGroupWorkspace,
  commercial: he.settingsNavGroupCommercial,
  operations: he.settingsNavGroupOperations,
  team: he.settingsNavGroupTeam,
  advanced: he.settingsNavGroupAdvanced,
};

export function isSettingsNavActive(pathname: string, to: string): boolean {
  if (to === "/app/settings") return pathname === "/app/settings" || pathname === "/app/settings/";
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function useSettingsNavItems(): NavItem[] {
  const { session } = useSession();
  const roleKey = session?.memberships[0]?.role_key;
  const features = session?.memberships[0]?.features ?? [];
  const grants = session?.memberships[0]?.permissions ?? null;
  const allow = (permission: string) => can(roleKey, permission, features, grants);
  const allowAny = (permissions: string[]) => canAny(roleKey, permissions, features, grants);

  const items: NavItem[] = [
    { id: "general", to: "/app/settings", label: he.settingsNavGeneral, group: "account", visible: allow("workspace.edit") },
    {
      id: "company",
      to: "/app/settings/company",
      label: he.settingsNavCompany,
      group: "account",
      visible: allow("workspace.edit") || allow("settings.branding"),
    },
    {
      id: "appearance",
      to: "/app/settings/appearance",
      label: he.settingsNavAppearance,
      group: "account",
      visible: allow("workspace.edit"),
    },
    {
      id: "quotes",
      to: "/app/settings/quotes",
      label: he.settingsNavQuotes,
      group: "commercial",
      visible: allow("workspace.edit"),
    },
    {
      id: "numbering",
      to: "/app/settings/numbering",
      label: he.settingsNavNumbering,
      group: "commercial",
      visible: allow("workspace.edit"),
    },
    {
      id: "pdf",
      to: "/app/settings/pdf-templates",
      label: he.settingsNavPdf,
      group: "commercial",
      visible: allow("workspace.edit"),
    },
    {
      id: "sites",
      to: "/app/settings/sites",
      label: he.settingsNavSites,
      group: "operations",
      visible: allow("workspace.edit"),
    },
    {
      id: "notifications",
      to: "/app/settings/notifications",
      label: he.settingsNavNotifications,
      group: "operations",
      visible: allow("workspace.edit"),
    },
    { id: "users", to: "/app/settings/users", label: he.navUsers, group: "team", visible: allow("users.view") },
    {
      id: "roles",
      to: "/app/settings/roles",
      label: he.settingsNavRoles,
      group: "team",
      visible: allow("roles.manage"),
    },
    {
      id: "security",
      to: "/app/settings/security",
      label: he.navSecurity,
      group: "team",
      visible: allowAny(["settings.general", "workspace.edit"]),
    },
    {
      id: "system",
      to: "/app/settings/system",
      label: he.settingsNavSystem,
      group: "advanced",
      visible: allow("workspace.edit"),
    },
    { id: "audit", to: "/app/settings/audit", label: he.navAudit, group: "advanced", visible: allow("audit.view") },
  ];
  return items.filter((item) => item.visible);
}

export function useSettingsNavGroups(): NavGroup[] {
  const items = useSettingsNavItems();
  return GROUP_ORDER.map((id) => ({
    id,
    label: GROUP_LABEL[id],
    items: items.filter((item) => item.group === id),
  })).filter((group) => group.items.length > 0);
}

function SettingsNav() {
  const groups = useSettingsNavGroups();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const flat = groups.flatMap((g) => g.items);
  const activeTo = flat.find((item) => isSettingsNavActive(pathname, item.to))?.to ?? flat[0]?.to ?? "";

  return (
    <nav className="settings-nav" aria-label={he.settingsNavAria}>
      <label className="settings-nav-mobile-label" htmlFor="settings-nav-select">
        {he.settingsNavMobileLabel}
      </label>
      <select
        id="settings-nav-select"
        className="settings-nav-select"
        data-testid="settings-nav-select"
        aria-label={he.settingsNavMobileLabel}
        value={activeTo}
        onChange={(event) => {
          const next = event.target.value;
          if (!next) return;
          void navigate({ to: next });
        }}
      >
        {groups.map((group) => (
          <optgroup key={group.id} label={group.label}>
            {group.items.map((item) => (
              <option key={item.id} value={item.to}>
                {item.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      <div className="settings-nav-desktop" data-testid="settings-nav-desktop">
        {groups.map((group) => (
          <div key={group.id} className="settings-nav-group">
            <p className="settings-nav-group-label">{group.label}</p>
            <ul className="settings-nav-list">
              {group.items.map((item) => {
                const active = isSettingsNavActive(pathname, item.to);
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
          </div>
        ))}
      </div>
    </nav>
  );
}

/** When landing on /app/settings without general access, send to first permitted page. */
function SettingsEntryRedirect() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const items = useSettingsNavItems();
  const onIndex = pathname === "/app/settings" || pathname === "/app/settings/";
  const canGeneral = items.some((item) => item.id === "general");

  useEffect(() => {
    if (!onIndex || canGeneral || items.length === 0) return;
    const fallback = items[0];
    if (fallback.to !== "/app/settings") {
      void navigate({ to: fallback.to, replace: true });
    }
  }, [onIndex, canGeneral, items, navigate]);

  return null;
}

export function SettingsShell({ children }: { children: ReactNode }) {
  return (
    <div className="settings-shell" data-testid="settings-shell">
      <SettingsEntryRedirect />
      <aside className="settings-aside">
        <div className="settings-aside-head">
          <p className="settings-aside-title">{he.settingsTitle}</p>
          <p className="settings-aside-lead">{he.settingsLead}</p>
        </div>
        <SettingsNav />
      </aside>
      <div className="settings-main min-w-0">{children}</div>
    </div>
  );
}
