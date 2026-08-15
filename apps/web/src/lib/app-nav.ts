import catalog from "@site-secure/authz/catalog.json";
import { planLabel as catalogPlanLabel } from "@site-secure/authz";
import { he } from "../i18n/he";
import { can } from "./can";
import { homeVariant } from "./home";

export type AppNavTo =
  | "/app/dashboard"
  | "/app/today"
  | "/app/settings"
  | "/app/settings/users"
  | "/app/settings/roles"
  | "/app/settings/security"
  | "/app/settings/audit";

export type NavIconKey =
  | "overview"
  | "today"
  | "team"
  | "roles"
  | "security"
  | "audit"
  | "settings"
  | "more";

export type AppNavItem = {
  to: AppNavTo;
  label: string;
  icon: NavIconKey;
  visible: boolean;
};

export type AppNavLink = Omit<AppNavItem, "visible">;

export type AppNavGroup = {
  id: string;
  label: string;
  items: AppNavLink[];
};

/** High-frequency operational homes. Jobs/customers join this list only when those routes exist. */
const PRIMARY_PATHS = new Set<AppNavTo>(["/app/dashboard", "/app/today"]);
const PRIMARY_MAX = 4;

export type BottomNavEntry =
  | { kind: "route"; to: AppNavTo; label: string; icon: NavIconKey }
  | { kind: "more"; label: string; icon: "more" };

export function roleLabel(roleKey: string | undefined): string {
  if (!roleKey) return "";
  const row = catalog.roles.find((role) => role.key === roleKey);
  return row?.label_he ?? roleKey;
}

export function planLabel(planKey: string | undefined): string {
  return catalogPlanLabel(planKey);
}

export function isNavSelected(to: AppNavTo, pathname: string): boolean {
  if (to === "/app/settings") {
    return pathname === "/app/settings" || pathname === "/app/settings/";
  }
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function appNav(roleKey: string | undefined, features: string[] = []): AppNavGroup[] {
  const allow = (permission: string) => can(roleKey, permission, features);
  const fieldHome = homeVariant(roleKey) === "today";
  const home: AppNavItem = {
    to: fieldHome ? "/app/today" : "/app/dashboard",
    label: fieldHome ? he.navToday : he.navDashboard,
    icon: fieldHome ? "today" : "overview",
    visible: allow("dashboard.view"),
  };

  const groups: { id: string; label: string; items: AppNavItem[] }[] = [
    { id: "overview", label: he.navGroupOverview, items: [home] },
    {
      id: "team",
      label: he.navGroupTeam,
      items: [
        { to: "/app/settings/users", label: he.navUsers, icon: "team", visible: allow("users.view") },
        {
          to: "/app/settings/roles",
          label: he.navRoles,
          icon: "roles",
          visible: allow("users.view") || allow("roles.manage"),
        },
      ],
    },
    {
      id: "security",
      label: he.navGroupSecurity,
      items: [
        {
          to: "/app/settings/security",
          label: he.navSecurity,
          icon: "security",
          visible: allow("settings.general") || allow("workspace.edit"),
        },
        { to: "/app/settings/audit", label: he.navAudit, icon: "audit", visible: allow("audit.view") },
      ],
    },
    {
      id: "system",
      label: he.navGroupSystem,
      items: [
        { to: "/app/settings", label: he.navSettings, icon: "settings", visible: allow("workspace.edit") },
      ],
    },
  ];

  return groups
    .map((group) => ({
      id: group.id,
      label: group.label,
      items: group.items
        .filter((item) => item.visible)
        .map(({ to, label, icon }) => ({ to, label, icon })),
    }))
    .filter((group) => group.items.length > 0);
}

export function bottomNav(roleKey: string | undefined, features: string[] = []): BottomNavEntry[] {
  const links = appNav(roleKey, features).flatMap((group) => group.items);
  const primary = links.filter((item) => PRIMARY_PATHS.has(item.to)).slice(0, PRIMARY_MAX);
  const overflow = links.filter((item) => !PRIMARY_PATHS.has(item.to));
  const items: BottomNavEntry[] = primary.map((item) => ({
    kind: "route",
    to: item.to,
    label: item.label,
    icon: item.icon,
  }));
  if (overflow.length > 0) {
    items.push({ kind: "more", label: he.navMore, icon: "more" });
  }
  return items;
}
