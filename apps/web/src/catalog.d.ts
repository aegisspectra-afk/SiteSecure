declare module "@site-secure/authz/catalog.json" {
  const value: {
    default_plan_key?: string;
    grants: Record<string, string[]>;
    permission_feature: Record<string, string>;
    roles: { key: string; label_he: string; label_en: string; default_scope: string }[];
    permissions: { key: string; group: string }[];
    plans: {
      key: string;
      label_he: string;
      features: string[];
      limits: Record<string, number>;
      assignable_roles?: string[];
    }[];
    seat_buckets?: Record<string, string[]>;
  };
  export default value;
}
