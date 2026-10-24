import { he } from "../i18n/he";
import { can } from "./can";

export type WorkforceNavTo =
  | "/"
  | "/schedules"
  | "/employees"
  | "/sites"
  | "/positions"
  | "/time-off"
  | "/my-shifts"
  | "/profile"
  | "/reports"
  | "/settings";

export type WorkforceNavGroup = "ops" | "requests" | "self" | "admin";

export type WorkforceNavOpts = {
  roleKey?: string;
  features?: string[];
  permissions?: string[] | null;
};

export type WorkforceNavItem = {
  to: WorkforceNavTo;
  label: string;
  group: WorkforceNavGroup;
};

function allow(opts: WorkforceNavOpts, permission: string): boolean {
  return can(opts.roleKey, permission, opts.features ?? [], opts.permissions);
}

export function workforceNavItems(opts: WorkforceNavOpts = {}): WorkforceNavItem[] {
  const items: WorkforceNavItem[] = [];
  if (allow(opts, "workforce.view")) {
    items.push({ to: "/", label: he.navDashboard, group: "ops" });
  }
  if (allow(opts, "workforce.schedules.view")) {
    items.push({ to: "/schedules", label: he.navSchedules, group: "ops" });
  }
  if (allow(opts, "workforce.employees.view")) {
    items.push({ to: "/employees", label: he.navEmployees, group: "ops" });
  }
  if (allow(opts, "workforce.sites.view")) {
    items.push({ to: "/sites", label: he.navSites, group: "ops" });
  }
  if (allow(opts, "workforce.employees.view") || allow(opts, "workforce.sites.view") || allow(opts, "workforce.schedules.view")) {
    items.push({ to: "/positions", label: he.navPositions, group: "ops" });
  }
  if (allow(opts, "workforce.schedules.view")) {
    items.push({ to: "/time-off", label: he.navTimeOff, group: "requests" });
  }
  if (allow(opts, "workforce.portal.view")) {
    items.push({ to: "/my-shifts", label: he.navPortal, group: "self" });
  }
  if (allow(opts, "workforce.view") || allow(opts, "workforce.portal.view")) {
    items.push({ to: "/profile", label: he.navProfile, group: "self" });
  }
  if (allow(opts, "workforce.reports.view")) {
    items.push({ to: "/reports", label: he.navReports, group: "admin" });
  }
  if (allow(opts, "workforce.settings.manage")) {
    items.push({ to: "/settings", label: he.navSettings, group: "admin" });
  }
  return items;
}

export function workforceNavDestinations(opts?: WorkforceNavOpts): WorkforceNavTo[] {
  return workforceNavItems(opts).map((item) => item.to);
}

const MOBILE_PRIMARY_PREF: WorkforceNavTo[] = ["/", "/schedules", "/employees", "/my-shifts"];

/** Compact bottom-nav destinations; remaining items go into the overflow sheet. */
export function splitWorkforceMobileNav(items: WorkforceNavItem[]): {
  primary: WorkforceNavItem[];
  overflow: WorkforceNavItem[];
} {
  if (items.length <= 4) {
    return { primary: items, overflow: [] };
  }
  const chosen = new Set<WorkforceNavTo>();
  const primary: WorkforceNavItem[] = [];
  for (const to of MOBILE_PRIMARY_PREF) {
    const item = items.find((entry) => entry.to === to);
    if (!item) continue;
    primary.push(item);
    chosen.add(item.to);
    if (primary.length === 4) break;
  }
  for (const item of items) {
    if (primary.length === 4) break;
    if (chosen.has(item.to)) continue;
    primary.push(item);
    chosen.add(item.to);
  }
  return {
    primary,
    overflow: items.filter((item) => !chosen.has(item.to)),
  };
}

export const NAV_GROUP_LABEL: Record<WorkforceNavGroup, string> = {
  ops: he.navOps,
  requests: he.navRequests,
  self: he.navSelf,
  admin: he.navAdmin,
};
