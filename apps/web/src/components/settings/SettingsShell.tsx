import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { cn } from "@site-secure/ui";
import {
  Bell,
  Building2,
  ChevronLeft,
  FileStack,
  FileText,
  Hash,
  KeyRound,
  MapPin,
  Monitor,
  ScrollText,
  Settings2,
  Shield,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { he } from "../../i18n/he";
import { accountAvatarUrl } from "../../lib/account-avatar";
import { can, canAny } from "../../lib/can";
import { roleLabel } from "../../lib/app-nav";
import { useAccountAvatar } from "../../lib/use-account-avatar";
import { useSession } from "../../lib/session";

export type SettingsNavId =
  | "hub"
  | "profile"
  | "security"
  | "general"
  | "company"
  | "numbering"
  | "quotes"
  | "pdf"
  | "sites"
  | "notifications"
  | "roles"
  | "users"
  | "system"
  | "audit";

export type SettingsNavGroupId =
  | "profile"
  | "workspace"
  | "commercial"
  | "operations"
  | "team"
  | "advanced";

type NavItem = {
  id: SettingsNavId;
  to: string;
  label: string;
  group: SettingsNavGroupId;
  icon: LucideIcon;
  visible: boolean;
};

type NavGroup = {
  id: SettingsNavGroupId;
  label: string;
  items: NavItem[];
};

const GROUP_ORDER: SettingsNavGroupId[] = [
  "profile",
  "workspace",
  "commercial",
  "operations",
  "team",
  "advanced",
];

const GROUP_LABEL: Record<SettingsNavGroupId, string> = {
  profile: he.settingsNavGroupProfile,
  workspace: he.settingsNavGroupWorkspace,
  commercial: he.settingsNavGroupCommercial,
  operations: he.settingsNavGroupOperations,
  team: he.settingsNavGroupTeam,
  advanced: he.settingsNavGroupAdvanced,
};

export function isSettingsHubPath(pathname: string): boolean {
  return pathname === "/app/settings" || pathname === "/app/settings/";
}

export function isSettingsNavActive(pathname: string, to: string): boolean {
  if (to === "/app/settings") return isSettingsHubPath(pathname);
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
    {
      id: "profile",
      to: "/app/settings/profile",
      label: he.settingsNavProfile,
      group: "profile",
      icon: User,
      visible: allow("settings.view"),
    },
    {
      id: "security",
      to: "/app/settings/security",
      label: he.navSecurity,
      group: "profile",
      icon: Shield,
      visible: allowAny(["settings.general", "workspace.edit"]),
    },
    {
      id: "general",
      to: "/app/settings/general",
      label: he.settingsNavGeneral,
      group: "workspace",
      icon: Settings2,
      visible: allow("workspace.edit"),
    },
    {
      id: "company",
      to: "/app/settings/company",
      label: he.settingsNavCompany,
      group: "workspace",
      icon: Building2,
      visible: allow("workspace.edit") || allow("settings.branding"),
    },
    {
      id: "quotes",
      to: "/app/settings/quotes",
      label: he.settingsNavQuotes,
      group: "commercial",
      icon: FileText,
      visible: allow("workspace.edit"),
    },
    {
      id: "numbering",
      to: "/app/settings/numbering",
      label: he.settingsNavNumbering,
      group: "commercial",
      icon: Hash,
      visible: allow("workspace.edit"),
    },
    {
      id: "pdf",
      to: "/app/settings/pdf-templates",
      label: he.settingsNavPdf,
      group: "commercial",
      icon: FileStack,
      visible: allow("workspace.edit"),
    },
    {
      id: "sites",
      to: "/app/settings/sites",
      label: he.settingsNavSites,
      group: "operations",
      icon: MapPin,
      visible: allow("workspace.edit"),
    },
    {
      id: "notifications",
      to: "/app/settings/notifications",
      label: he.settingsNavNotifications,
      group: "operations",
      icon: Bell,
      visible: allow("workspace.edit"),
    },
    {
      id: "users",
      to: "/app/settings/users",
      label: he.navUsers,
      group: "team",
      icon: Users,
      visible: allow("users.view"),
    },
    {
      id: "roles",
      to: "/app/settings/roles",
      label: he.settingsNavRoles,
      group: "team",
      icon: KeyRound,
      visible: allow("roles.manage"),
    },
    {
      id: "audit",
      to: "/app/settings/audit",
      label: he.navAudit,
      group: "team",
      icon: ScrollText,
      visible: allow("audit.view"),
    },
    {
      id: "system",
      to: "/app/settings/system",
      label: he.settingsNavSystem,
      group: "advanced",
      icon: Monitor,
      visible: allow("workspace.edit"),
    },
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

export function useSettingsIdentity() {
  const { session } = useSession();
  const avatarId = useAccountAvatar();
  const membership = session?.memberships[0];
  const rawName = session?.profile?.full_name?.trim() || "";
  const email = session?.email?.trim() || "";
  const role = roleLabel(membership?.role_key);
  const workspace = membership?.workspace_name?.trim() || "";
  return {
    name: rawName || he.settingsProfileNamePlaceholder,
    hasName: Boolean(rawName),
    email,
    role,
    workspace,
    avatarUrl: accountAvatarUrl(avatarId),
    canEditProfile: can(
      membership?.role_key,
      "settings.view",
      membership?.features ?? [],
      membership?.permissions ?? null,
    ),
  };
}

function SettingsRailProfile() {
  const identity = useSettingsIdentity();
  return (
    <div className="settings-rail-profile" data-testid="settings-rail-profile">
      <img
        className="settings-rail-avatar"
        src={identity.avatarUrl}
        alt=""
        width={56}
        height={56}
        decoding="async"
      />
      <div className="settings-rail-profile-text min-w-0">
        <p className="settings-rail-name truncate">{identity.name}</p>
        {identity.role || identity.workspace ? (
          <p className="settings-rail-meta truncate">
            {[identity.role, identity.workspace].filter(Boolean).join(" · ")}
          </p>
        ) : null}
      </div>
      {identity.canEditProfile ? (
        <Link to="/app/settings/profile" className="settings-rail-edit">
          {he.settingsEditProfile}
        </Link>
      ) : null}
    </div>
  );
}

function SettingsNav() {
  const groups = useSettingsNavGroups();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const hub = isSettingsHubPath(pathname);
  const flat = groups.flatMap((g) => g.items);
  const activeTo = hub
    ? "/app/settings"
    : (flat.find((item) => isSettingsNavActive(pathname, item.to))?.to ?? flat[0]?.to ?? "");

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
        <option value="/app/settings">{he.settingsTitle}</option>
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
                const Icon = item.icon;
                return (
                  <li key={item.id}>
                    <Link
                      to={item.to}
                      className={cn("settings-nav-link", active && "is-active")}
                      aria-current={active ? "page" : undefined}
                    >
                      <Icon className="settings-nav-icon" aria-hidden size={16} strokeWidth={1.75} />
                      <span>{item.label}</span>
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

/** Hub is the landing for everyone with settings access — no forced redirect. */
function SettingsHubGate({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const membership = session?.memberships[0];
  const allowed = canAny(
    membership?.role_key,
    [
      "settings.view",
      "workspace.edit",
      "settings.general",
      "settings.branding",
      "users.view",
      "roles.manage",
      "audit.view",
    ],
    membership?.features ?? [],
    membership?.permissions ?? null,
  );
  if (!allowed) {
    return (
      <div className="settings-main min-w-0 p-6">
        <p className="text-sm text-fg-muted">{he.forbiddenBody}</p>
      </div>
    );
  }
  return children;
}

export function SettingsHubRows({ groups }: { groups: NavGroup[] }) {
  return (
    <div className="settings-hub-groups" data-testid="settings-hub-groups">
      {groups.map((group) => (
        <section key={group.id} className="settings-hub-group" aria-labelledby={`hub-group-${group.id}`}>
          <h2 id={`hub-group-${group.id}`} className="settings-hub-group-label">
            {group.label}
          </h2>
          <ul className="settings-hub-list">
            {group.items.map((item, index) => {
              const Icon = item.icon;
              return (
                <li key={item.id}>
                  <Link
                    to={item.to}
                    className={cn("settings-hub-row", index === 0 && "is-first", index === group.items.length - 1 && "is-last")}
                  >
                    <span className="settings-hub-row-icon" aria-hidden>
                      <Icon size={20} strokeWidth={1.6} />
                    </span>
                    <span className="settings-hub-row-label">{item.label}</span>
                    <ChevronLeft className="settings-hub-row-chevron" size={18} strokeWidth={1.75} aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function SettingsShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hub = isSettingsHubPath(pathname);

  return (
    <SettingsHubGate>
      <div className={cn("settings-shell", hub && "is-hub")} data-testid="settings-shell">
        <aside className={cn("settings-aside", hub && "is-hub-hidden-mobile")}>
          <div className="settings-aside-head settings-aside-head-desktop">
            <Link to="/app/settings" className="settings-aside-title-link">
              <p className="settings-aside-title">{he.settingsTitle}</p>
            </Link>
            <SettingsRailProfile />
          </div>
          <div className="settings-aside-head settings-aside-head-mobile">
            <p className="settings-aside-title">{he.settingsTitle}</p>
          </div>
          <SettingsNav />
        </aside>
        <div className="settings-main min-w-0">
          <div className="settings-main-inner">{children}</div>
        </div>
      </div>
    </SettingsHubGate>
  );
}
