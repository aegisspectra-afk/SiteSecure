import catalog from "@site-secure/authz/catalog.json";

/** Foundation slice shown as a read-only matrix. CRM modules stay in the grouped catalog, not as nav. */
export const FOUNDATION_PERMISSIONS = [
  "dashboard.view",
  "settings.view",
  "settings.general",
  "workspace.edit",
  "workspace.billing",
  "workspace.delete",
  "users.view",
  "users.invite",
  "users.manage",
  "roles.manage",
  "audit.view",
] as const;

export function roleGranted(roleKey: string, permission: string): boolean {
  const grants = catalog.grants[roleKey] ?? [];
  return grants.includes("*") || grants.includes(permission);
}

export function permissionGroups(): { group: string; keys: string[] }[] {
  const groups = new Map<string, string[]>();
  for (const row of catalog.permissions) {
    const keys = groups.get(row.group) ?? [];
    keys.push(row.key);
    groups.set(row.group, keys);
  }
  return [...groups.entries()].map(([group, keys]) => ({ group, keys }));
}
