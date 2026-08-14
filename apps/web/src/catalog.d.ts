declare module "@site-secure/authz/catalog.json" {
  const value: {
    grants: Record<string, string[]>;
    permission_feature: Record<string, string>;
  };
  export default value;
}
