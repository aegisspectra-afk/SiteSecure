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
  | "work"
  | "visits"
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

export type BottomNavEntry =
  | { kind: "route"; to: AppNavTo; label: string; icon: NavIconKey }
  | { kind: "work"; label: string; icon: "work" }
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

/** Home destination for the role — used by desktop overview + mobile בית. */
export function homeNavLink(roleKey: string | undefined, features: string[] = []): AppNavLink | null {
  if (!can(roleKey, "dashboard.view", features)) return null;
  const fieldHome = homeVariant(roleKey) === "today";
  return fieldHome
    ? { to: "/app/today", label: he.navHome, icon: "today" }
    : { to: "/app/dashboard", label: he.navHome, icon: "overview" };
}

/**
 * Field work destinations for the mobile Work sheet / command-center Work section.
 * Live routes only — no placeholders for unshipped modules (e.g. installations).
 */
export function mobileWorkNav(roleKey: string | undefined, features: string[] = []): AppNavLink[] {
  const allow = (permission: string) => can(roleKey, permission, features);
  const fieldHome = homeVariant(roleKey) === "today";
  const items: AppNavItem[] = [
    {
      /* Office home is dashboard — surface the day board as visits here. Field home already is today. */
      to: "/app/today",
      label: he.navVisits,
      icon: "visits",
      visible: !fieldHome && allow("dashboard.view"),
    },
    {
      to: "/app/projects",
      label: he.navProjects,
      icon: "projects",
      visible: allow("projects.view") && hasFeature(features, "projects"),
    },
    {
      to: "/app/service",
      label: he.navServiceShort,
      icon: "service",
      visible: allow("service.view") && hasFeature(features, "service"),
    },
    {
      to: "/app/sites",
      label: he.navSiteFiles,
      icon: "sites",
      visible: allow("sites.view"),
    },
  ];
  return items.filter((item) => item.visible).map(({ to, label, icon }) => ({ to, label, icon }));
}

/** Routes already covered by bottom tabs — excluded from More overflow (Work may still appear in Command Center). */
export function mobilePrimaryRoutes(roleKey: string | undefined, features: string[] = []): Set<AppNavTo> {
  const routes = new Set<AppNavTo>();
  const home = homeNavLink(roleKey, features);
  if (home) routes.add(home.to);
  if (can(roleKey, "crm.view", features) && hasFeature(features, "crm")) routes.add("/app/customers");
  if (can(roleKey, "calendar.view", features)) routes.add("/app/tasks");
  return routes;
}

export type MobileCommandSection = {
  id: string;
  label: string;
  defaultOpen: boolean;
  items: AppNavLink[];
};

export type MobileQuickAction = {
  id: string;
  label: string;
  to: AppNavTo;
  search?: Record<string, string>;
};

/** Compact command-center sections for mobile More — not a copy of the desktop sidebar. */
export function mobileCommandSections(roleKey: string | undefined, features: string[] = []): MobileCommandSection[] {
  const allow = (permission: string) => can(roleKey, permission, features);
  const primary = mobilePrimaryRoutes(roleKey, features);
  const work = mobileWorkNav(roleKey, features);

  const salesItems: AppNavItem[] = [
    { to: "/app/leads", label: he.navLeads, icon: "leads", visible: allow("leads.view") },
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
  ];

  const manageItems: AppNavItem[] = [
    { to: "/app/settings/users", label: he.navUsers, icon: "team", visible: allow("users.view") },
    {
      to: "/app/settings/roles",
      label: he.navRolesShort,
      icon: "roles",
      visible: allow("users.view") || allow("roles.manage"),
    },
    {
      to: "/app/settings/security",
      label: he.navSecurity,
      icon: "security",
      visible: allow("settings.general") || allow("workspace.edit"),
    },
    { to: "/app/settings", label: he.navSettings, icon: "settings", visible: allow("workspace.edit") },
    { to: "/app/settings/audit", label: he.navAudit, icon: "audit", visible: allow("audit.view") },
  ];

  const opsExtra: AppNavItem[] = [
    {
      to: "/app/warranties",
      label: he.navWarranties,
      icon: "warranties",
      visible: allow("warranties.view") && !work.some((item) => item.to === "/app/warranties"),
    },
    {
      to: "/app/knowledge",
      label: he.navKnowledge,
      icon: "knowledge",
      visible: allow("knowledge.view"),
    },
  ];

  const visible = (items: AppNavItem[]) =>
    items
      .filter((item) => item.visible && !primary.has(item.to))
      .map(({ to, label, icon }) => ({ to, label, icon }));

  const sections: MobileCommandSection[] = [
    { id: "work", label: he.navWork, defaultOpen: true, items: work },
    { id: "sales", label: he.navGroupSales, defaultOpen: false, items: visible(salesItems) },
    {
      id: "ops",
      label: he.navGroupOps,
      defaultOpen: false,
      items: visible(opsExtra),
    },
    { id: "manage", label: he.navGroupAdmin, defaultOpen: false, items: visible(manageItems) },
  ];

  return sections.filter((section) => section.items.length > 0);
}

/** Legacy group shape for selection helpers — flattens command sections. */
export function mobileMoreNav(roleKey: string | undefined, features: string[] = []): AppNavGroup[] {
  return mobileCommandSections(roleKey, features).map((section) => ({
    id: section.id,
    label: section.label,
    items: section.items,
  }));
}

export function mobileQuickActions(roleKey: string | undefined, features: string[] = []): MobileQuickAction[] {
  const actions: MobileQuickAction[] = [];
  if (can(roleKey, "leads.create", features)) {
    actions.push({ id: "lead", label: he.navQuickLead, to: "/app/leads", search: { new: "1" } });
  }
  if (can(roleKey, "dashboard.view", features) || can(roleKey, "calendar.view", features)) {
    actions.push({
      id: "visit",
      label: he.navQuickVisit,
      to: homeVariant(roleKey) === "today" || can(roleKey, "dashboard.view", features) ? "/app/today" : "/app/tasks",
    });
  }
  return actions.slice(0, 4);
}

export function isWorkNavSelected(pathname: string, workItems: AppNavLink[]): boolean {
  return workItems.some((item) => isNavSelected(item.to, pathname));
}

export function isMoreNavSelected(
  pathname: string,
  moreGroups: AppNavGroup[],
  workItems: AppNavLink[] = [],
): boolean {
  if (isWorkNavSelected(pathname, workItems)) return false;
  return moreGroups.some((group) => group.items.some((item) => isNavSelected(item.to, pathname)));
}

/**
 * Mobile bottom spine: בית · לקוחות · עבודה · משימות · עוד
 * Derived from the same entitlement rules as desktop — different presentation only.
 */
export function bottomNav(roleKey: string | undefined, features: string[] = []): BottomNavEntry[] {
  const items: BottomNavEntry[] = [];
  const home = homeNavLink(roleKey, features);
  if (home) {
    items.push({ kind: "route", to: home.to, label: he.navHome, icon: home.icon });
  }
  if (can(roleKey, "crm.view", features) && hasFeature(features, "crm")) {
    items.push({ kind: "route", to: "/app/customers", label: he.navCustomers, icon: "customers" });
  }
  if (mobileWorkNav(roleKey, features).length > 0) {
    items.push({ kind: "work", label: he.navWork, icon: "work" });
  }
  if (can(roleKey, "calendar.view", features)) {
    items.push({ kind: "route", to: "/app/tasks", label: he.navTasks, icon: "calendar" });
  }
  items.push({ kind: "more", label: he.navMore, icon: "more" });
  return items.slice(0, 5);
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
