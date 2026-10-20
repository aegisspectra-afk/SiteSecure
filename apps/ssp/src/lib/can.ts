import catalog from "@site-secure/authz/catalog.json";

type Catalog = {
  grants: Record<string, string[]>;
  permission_feature: Record<string, string>;
};

const data = catalog as Catalog;

/** UI gate only — server re-checks via authorize() on every API call. */
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

export function hasFeature(features: string[], feature: string): boolean {
  return features.includes(feature);
}
