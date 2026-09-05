import catalog from "@site-secure/authz/catalog.json";

type Catalog = {
  grants: Record<string, string[]>;
  permission_feature: Record<string, string>;
};

const data = catalog as Catalog;

/**
 * Permission check for UI gates.
 * Prefer session `permissions` (workspace RBAC) when provided; fall back to catalog grants.
 */
export function can(
  roleKey: string | undefined,
  permission: string,
  features: string[] = [],
  permissions?: string[] | null,
) {
  if (!roleKey && (!permissions || !permissions.length)) return false;
  let allowed = false;
  if (permissions && permissions.length) {
    allowed = permissions.includes("*") || permissions.includes(permission);
  } else if (roleKey) {
    const grants = data.grants[roleKey] ?? [];
    allowed = grants.includes("*") || grants.includes(permission);
  }
  if (!allowed) return false;
  const feature = data.permission_feature[permission];
  if (feature && !features.includes(feature)) return false;
  return true;
}

export function canAny(
  roleKey: string | undefined,
  permissionsNeeded: string[],
  features: string[] = [],
  permissions?: string[] | null,
) {
  return permissionsNeeded.some((permission) => can(roleKey, permission, features, permissions));
}

export function canAll(
  roleKey: string | undefined,
  permissionsNeeded: string[],
  features: string[] = [],
  permissions?: string[] | null,
) {
  return (
    permissionsNeeded.length > 0 &&
    permissionsNeeded.every((permission) => can(roleKey, permission, features, permissions))
  );
}
