import { he } from "../i18n/he";
import type { AppNavGroup, AppNavTo, BottomNavEntry } from "./app-nav";
import { can } from "./can";

export type WorkforceNavOpts = {
  roleKey?: string;
  features?: string[];
  permissions?: string[] | null;
};

function allow(opts: WorkforceNavOpts, permission: string): boolean {
  return can(opts.roleKey, permission, opts.features ?? [], opts.permissions);
}

export function workforceNavGroups(opts: WorkforceNavOpts = {}): AppNavGroup[] {
  const items: AppNavGroup["items"] = [];
  if (allow(opts, "workforce.view") || allow(opts, "workforce.portal.view")) {
    items.push({
      to: "/app/workforce",
      label: allow(opts, "workforce.view") ? he.workforceNavDashboard : he.workforceNavPortal,
      icon: "overview",
    });
  }
  if (allow(opts, "workforce.employees.view")) {
    items.push({ to: "/app/workforce/employees", label: he.workforceNavEmployees, icon: "team" });
  }
  if (allow(opts, "workforce.sites.view")) {
    items.push({ to: "/app/workforce/sites", label: he.workforceNavSites, icon: "sites" });
  }
  if (allow(opts, "workforce.employees.view") || allow(opts, "workforce.sites.view") || allow(opts, "workforce.schedules.view")) {
    items.push({ to: "/app/workforce/positions", label: he.workforceNavPositions, icon: "roles" });
  }
  if (allow(opts, "workforce.schedules.view")) {
    items.push({ to: "/app/workforce/schedules", label: he.workforceNavSchedules, icon: "calendar" });
  }
  if (!items.length) return [];
  return [{ id: "ops", label: he.workforceNavOps, items }];
}

export function workforceBottomNav(opts: WorkforceNavOpts = {}): BottomNavEntry[] {
  return workforceNavGroups(opts)[0]?.items.map((item) => ({
    kind: "route" as const,
    to: item.to,
    label: item.label,
    icon: item.icon,
  })) ?? [];
}

export function workforceNavDestinations(opts?: WorkforceNavOpts): AppNavTo[] {
  return workforceNavGroups(opts).flatMap((group) => group.items.map((item) => item.to));
}
