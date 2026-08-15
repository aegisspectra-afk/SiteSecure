declare module "@site-secure/authz/catalog.json" {
  const value: {
    grants: Record<string, string[]>;
    permission_feature: Record<string, string>;
    roles: { key: string; label_he: string; label_en: string; default_scope: string }[];
    permissions: { key: string; group: string }[];
  };
  export default value;
}
