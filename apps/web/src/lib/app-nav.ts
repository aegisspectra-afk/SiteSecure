import catalog from "@site-secure/authz/catalog.json";
import { he } from "../i18n/he";
import { can } from "./can";
import { homeVariant } from "./home";

export type AppNavItem = {
  to:
    | "/app/dashboard"
    | "/app/today"
    | "/app/settings"
    | "/app/settings/users"
    | "/app/settings/roles"
    | "/app/settings/security"
    | "/app/settings/audit";
  label: string;
  visible: boolean;
};

export type AppNavGroup = {
  id: string;
  label: string;
  items: Omit<AppNavItem, "visible">[];
};

export function roleLabel(roleKey: string | undefined): string {
  if (!roleKey) return "";
  const row = catalog.roles.find((role) => role.key === roleKey);
  return row?.label_he ?? roleKey;
}

export function appNav(roleKey: string | undefined, features: string[] = []): AppNavGroup[] {
  const allow = (permission: string) => can(roleKey, permission, features);
  const home: AppNavItem = {
    to: homeVariant(roleKey) === "today" ? "/app/today" : "/app/dashboard",
    label: homeVariant(roleKey) === "today" ? he.navToday : he.navOverview,
    visible: allow("dashboard.view"),
  };

  const groups: { id: string; label: string; items: AppNavItem[] }[] = [
    { id: "overview", label: he.navGroupOverview, items: [home] },
    {
      id: "team",
      label: he.navGroupTeam,
      items: [
        { to: "/app/settings/users", label: he.navUsers, visible: allow("users.view") },
        {
          to: "/app/settings/roles",
          label: he.navRoles,
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
          visible: allow("settings.general") || allow("workspace.edit"),
        },
        { to: "/app/settings/audit", label: he.navAudit, visible: allow("audit.view") },
      ],
    },
    {
      id: "system",
      label: he.navGroupSystem,
      items: [{ to: "/app/settings", label: he.navSettings, visible: allow("workspace.edit") }],
    },
  ];

  return groups
    .map((group) => ({
      id: group.id,
      label: group.label,
      items: group.items.filter((item) => item.visible).map(({ to, label }) => ({ to, label })),
    }))
    .filter((group) => group.items.length > 0);
}
