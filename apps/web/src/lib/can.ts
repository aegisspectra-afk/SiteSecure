import catalog from "@site-secure/authz/catalog.json";

type Catalog = {
  grants: Record<string, string[]>;
  permission_feature: Record<string, string>;
};

const data = catalog as Catalog;

export function can(roleKey: string | undefined, permission: string, features: string[] = []) {
  if (!roleKey) return false;
  const grants = data.grants[roleKey] ?? [];
  const allowed = grants.includes("*") || grants.includes(permission);
  if (!allowed) return false;
  const feature = data.permission_feature[permission];
  if (feature && !features.includes(feature)) return false;
  return true;
}
