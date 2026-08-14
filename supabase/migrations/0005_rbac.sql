-- RBAC catalog tables. Grants are seeded from packages/authz/catalog.json.

CREATE TABLE public.roles (
  key text PRIMARY KEY,
  label_he text NOT NULL,
  label_en text NOT NULL,
  default_scope text NOT NULL,
  is_system boolean NOT NULL DEFAULT true,
  CONSTRAINT roles_scope_chk CHECK (default_scope IN ('all', 'owned', 'assigned', 'team'))
);

CREATE TABLE public.permissions (
  key text PRIMARY KEY,
  group_key text NOT NULL,
  description text
);

CREATE TABLE public.role_permissions (
  role_key text NOT NULL REFERENCES public.roles (key) ON DELETE CASCADE,
  permission_key text NOT NULL REFERENCES public.permissions (key) ON DELETE CASCADE,
  PRIMARY KEY (role_key, permission_key)
);

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions FORCE ROW LEVEL SECURITY;

-- Catalog is readable to any authenticated user (needed before workspace pick).
CREATE POLICY roles_select_authenticated
  ON public.roles FOR SELECT TO authenticated USING (true);

CREATE POLICY permissions_select_authenticated
  ON public.permissions FOR SELECT TO authenticated USING (true);

CREATE POLICY role_permissions_select_authenticated
  ON public.role_permissions FOR SELECT TO authenticated USING (true);

COMMENT ON POLICY roles_select_authenticated ON public.roles IS
  'System catalog only — no tenant data. Documented exception to tenant USING (true) ban.';
