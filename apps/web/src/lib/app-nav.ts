import catalog from "@site-secure/authz/catalog.json";
import { planLabel as catalogPlanLabel } from "@site-secure/authz";
import { he } from "../i18n/he";
import { can } from "./can";
import { hasFeature, homeVariant } from "./home";

export type AppNavTo =
  | "/app/dashboard"
  | "/app/today"
  | "/app/tasks"
  | "/app/customers"
  | "/app/leads"
  | "/app/quotes"
  | "/app/catalog"
  | "/app/projects"
  | "/app/sites"
  | "/app/service"
  | "/app/warranties"
  | "/app/knowledge"
  | "/app/settings"
  | "/app/settings/users"
  | "/app/settings/roles"
  | "/app/settings/security"
  | "/app/settings/audit";

export type NavIconKey =
  | "overview"
  | "today"
  | "calendar"
  | "customers"
  | "leads"
  | "quotes"
  | "catalog"
  | "projects"
  | "sites"
  | "service"
  | "warranties"
  | "knowledge"
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

/** Locked Target IA — modules flip planned → live when shipped. */
export const TARGET_IA = [
  {
    id: "overview",
    label: () => he.navGroupOverview,
    items: [
      { id: "dashboard", status: "live" as const, routeHint: "/app/dashboard" },
      { id: "today", status: "live" as const, routeHint: "/app/today" },
      { id: "calendar", status: "live" as const, routeHint: "/app/tasks" },
    ],
  },
  {
    id: "sales",
    label: () => he.navGroupSales,
    items: [
      { id: "customers", status: "live" as const, routeHint: "/app/customers" },
      { id: "leads", status: "live" as const, routeHint: "/app/leads" },
      { id: "quotes", status: "live" as const, routeHint: "/app/quotes" },
      { id: "catalog", status: "live" as const, routeHint: "/app/catalog" },
    ],
  },
  {
    id: "ops",
    label: () => he.navGroupOps,
    items: [
      { id: "projects", status: "live" as const, routeHint: "/app/projects" },
      { id: "site-files", status: "live" as const, routeHint: "/app/sites" },
      { id: "service", status: "live" as const, routeHint: "/app/service" },
      { id: "warranties", status: "live" as const, routeHint: "/app/warranties" },
      { id: "knowledge", status: "live" as const, routeHint: "/app/knowledge" },
    ],
  },
  {
    id: "admin",
    label: () => he.navGroupAdmin,
    items: [
      { id: "users", status: "live" as const, routeHint: "/app/settings/users" },
      { id: "roles", status: "live" as const, routeHint: "/app/settings/roles" },
    ],
  },
  {
    id: "system",
    label: () => he.navGroupSystem,
    items: [
      { id: "security", status: "live" as const, routeHint: "/app/settings/security" },
      { id: "audit", status: "live" as const, routeHint: "/app/settings/audit" },
      { id: "settings", status: "live" as const, routeHint: "/app/settings" },
    ],
  },
] as const;

const PRIMARY_MAX = 4;

export type BottomNavEntry =
  | { kind: "route"; to: AppNavTo; label: string; icon: NavIconKey }
  | { kind: "more"; label: string; icon: "more" };

export function roleLabel(roleKey: string | undefined): string {
  if (!roleKey) return "";
  const row = catalog.roles.find((role) => role.key === roleKey);
  return row?.label_he ?? roleKey;
}

export function roleLabelEn(roleKey: string | undefined): string {
  if (!roleKey) return "";
  const row = catalog.roles.find((role) => role.key === roleKey);
  return row?.label_en ?? "";
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

  const groups: { id: string; label: string; items: AppNavItem[] }[] = [
    {
      id: "overview",
      label: he.navGroupOverview,
      items: [
        {
          to: fieldHome ? "/app/today" : "/app/dashboard",
          label: fieldHome ? he.navToday : he.navDashboard,
          icon: fieldHome ? "today" : "overview",
          visible: allow("dashboard.view"),
        },
        {
          to: "/app/tasks",
          label: he.navCalendar,
          icon: "calendar",
          visible: allow("calendar.view"),
        },
      ],
    },
    {
      id: "sales",
      label: he.navGroupSales,
      items: [
        {
          to: "/app/customers",
          label: he.navCustomers,
          icon: "customers",
          visible: allow("crm.view") && hasFeature(features, "crm"),
        },
        {
          to: "/app/leads",
          label: he.navLeads,
          icon: "leads",
          visible: allow("leads.view"),
        },
        {
          to: "/app/quotes",
          label: he.navQuotes,
          icon: "quotes",
          visible: allow("quotes.view") && hasFeature(features, "quotes"),
        },
        {
          to: "/app/catalog",
          label: he.navCatalog,
          icon: "catalog",
          visible: allow("catalog.view") && hasFeature(features, "catalog"),
        },
      ],
    },
    {
      id: "ops",
      label: he.navGroupOps,
      items: [
        {
          to: "/app/projects",
          label: he.navProjects,
          icon: "projects",
          visible: allow("projects.view") && hasFeature(features, "projects"),
        },
        {
          to: "/app/sites",
          label: he.navSiteFiles,
          icon: "sites",
          visible: allow("sites.view"),
        },
        {
          to: "/app/service",
          label: he.navService,
          icon: "service",
          visible: allow("service.view") && hasFeature(features, "service"),
        },
        {
          to: "/app/warranties",
          label: he.navWarranties,
          icon: "warranties",
          visible: allow("warranties.view"),
        },
        {
          to: "/app/knowledge",
          label: he.navKnowledge,
          icon: "knowledge",
          visible: allow("knowledge.view"),
        },
      ],
    },
    {
      id: "admin",
      label: he.navGroupAdmin,
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
      id: "system",
      label: he.navGroupSystem,
      items: [
        {
          to: "/app/settings/security",
          label: he.navSecurity,
          icon: "security",
          visible: allow("settings.general") || allow("workspace.edit"),
        },
        { to: "/app/settings/audit", label: he.navAudit, icon: "audit", visible: allow("audit.view") },
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

function isPrimary(to: AppNavTo, roleKey: string | undefined, features: string[]): boolean {
  if (to === "/app/dashboard" || to === "/app/today") return true;
  if (to === "/app/customers") return can(roleKey, "crm.view", features);
  if (to === "/app/quotes") return can(roleKey, "quotes.create", features);
  if (to === "/app/sites") return can(roleKey, "sites.view", features);
  if (to === "/app/service") return can(roleKey, "service.view", features);
  return false;
}

export function bottomNav(roleKey: string | undefined, features: string[] = []): BottomNavEntry[] {
  const links = appNav(roleKey, features).flatMap((group) => group.items);
  const primary = links.filter((item) => isPrimary(item.to, roleKey, features)).slice(0, PRIMARY_MAX);
  const overflow = links.filter((item) => !isPrimary(item.to, roleKey, features));
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

export function nextSidebarIndex(current: number, key: string, count: number): number | null {
  if (count < 1) return null;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  if (key === "ArrowDown") return (current + 1) % count;
  if (key === "ArrowUp") return (current - 1 + count) % count;
  return null;
}

export function liveTargetRouteHints(): string[] {
  return TARGET_IA.flatMap((group) =>
    group.items.filter((item) => item.status === "live").map((item) => item.routeHint),
  );
}
