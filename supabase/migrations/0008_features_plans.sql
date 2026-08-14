-- Features, plans, subscriptions. Role/permission catalog rows (production, not seed-only).

CREATE TABLE public.features (
  key text PRIMARY KEY
);

CREATE TABLE public.plans (
  key text PRIMARY KEY,
  label_he text NOT NULL,
  label_en text NOT NULL,
  is_public boolean NOT NULL DEFAULT true
);

CREATE TABLE public.plan_features (
  plan_key text NOT NULL REFERENCES public.plans (key) ON DELETE CASCADE,
  feature_key text NOT NULL REFERENCES public.features (key) ON DELETE CASCADE,
  PRIMARY KEY (plan_key, feature_key)
);

CREATE TABLE public.plan_limits (
  plan_key text NOT NULL REFERENCES public.plans (key) ON DELETE CASCADE,
  limit_key text NOT NULL,
  limit_value integer NOT NULL,
  PRIMARY KEY (plan_key, limit_key)
);

CREATE TYPE public.subscription_status AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'manual');

CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL UNIQUE REFERENCES public.workspaces (id) ON DELETE CASCADE,
  plan_key text NOT NULL REFERENCES public.plans (key),
  status public.subscription_status NOT NULL DEFAULT 'active',
  current_period_end timestamptz,
  provider_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER subscriptions_set_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.workspace_feature_overrides (
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  feature_key text NOT NULL REFERENCES public.features (key) ON DELETE CASCADE,
  enabled boolean NOT NULL,
  PRIMARY KEY (workspace_id, feature_key)
);

INSERT INTO public.features (key) VALUES
  ('core'), ('crm'), ('sales'), ('catalog'), ('quotes'), ('projects'), ('service'),
  ('settings'), ('inventory'), ('finance'), ('reports'), ('automation'), ('team'),
  ('audit'), ('api'), ('ai'), ('branches');

INSERT INTO public.plans (key, label_he, label_en) VALUES
  ('solo', 'Solo', 'Solo'),
  ('business', 'Business', 'Business'),
  ('enterprise', 'Enterprise', 'Enterprise');

INSERT INTO public.plan_features (plan_key, feature_key)
SELECT 'solo', f FROM unnest(ARRAY[
  'core','crm','sales','catalog','quotes','projects','service','settings'
]) AS f;

INSERT INTO public.plan_features (plan_key, feature_key)
SELECT 'business', f FROM unnest(ARRAY[
  'core','crm','sales','catalog','quotes','projects','service','settings',
  'inventory','finance','reports','automation','team','audit','api'
]) AS f;

INSERT INTO public.plan_features (plan_key, feature_key)
SELECT 'enterprise', key FROM public.features;

INSERT INTO public.plan_limits (plan_key, limit_key, limit_value) VALUES
  ('solo', 'seats_operator', 1),
  ('solo', 'seats_field', 3),
  ('business', 'seats_operator', 15),
  ('business', 'seats_field', 40),
  ('enterprise', 'seats_operator', 0),
  ('enterprise', 'seats_field', 0);

INSERT INTO public.roles (key, label_he, label_en, default_scope) VALUES
  ('owner', 'בעלים', 'Owner', 'all'),
  ('administrator', 'מנהל מערכת', 'Administrator', 'all'),
  ('manager', 'מנהל', 'Manager', 'team'),
  ('sales', 'מכירות', 'Sales', 'owned'),
  ('technician', 'טכנאי', 'Technician', 'assigned'),
  ('founding_technician', 'טכנאי מייסד', 'Founding Technician', 'assigned'),
  ('viewer', 'צפייה בלבד', 'Viewer', 'all');

INSERT INTO public.permissions (key, group_key) VALUES
  ('dashboard.view', 'core'),
  ('calendar.view', 'core'),
  ('calendar.edit', 'core'),
  ('settings.view', 'settings'),
  ('settings.general', 'settings'),
  ('settings.branding', 'settings'),
  ('workspace.edit', 'workspace'),
  ('workspace.billing', 'billing'),
  ('workspace.delete', 'workspace'),
  ('users.view', 'users'),
  ('users.invite', 'users'),
  ('users.manage', 'users'),
  ('roles.manage', 'roles'),
  ('audit.view', 'audit'),
  ('crm.view', 'crm'),
  ('crm.create', 'crm'),
  ('crm.edit', 'crm'),
  ('crm.delete', 'crm'),
  ('crm.export', 'crm'),
  ('leads.view', 'leads'),
  ('leads.create', 'leads'),
  ('leads.edit', 'leads'),
  ('leads.delete', 'leads'),
  ('leads.assign', 'leads'),
  ('quotes.view', 'quotes'),
  ('quotes.create', 'quotes'),
  ('quotes.edit', 'quotes'),
  ('quotes.delete', 'quotes'),
  ('quotes.send', 'quotes'),
  ('quotes.approve', 'quotes'),
  ('quotes.export', 'quotes'),
  ('quotes.view_cost', 'quotes'),
  ('quotes.override_price', 'quotes'),
  ('catalog.view', 'catalog'),
  ('catalog.edit', 'catalog'),
  ('projects.view', 'projects'),
  ('projects.create', 'projects'),
  ('projects.edit', 'projects'),
  ('projects.close', 'projects'),
  ('projects.delete', 'projects'),
  ('jobs.view', 'jobs'),
  ('jobs.create', 'jobs'),
  ('jobs.assign', 'jobs'),
  ('jobs.start', 'jobs'),
  ('jobs.complete', 'jobs'),
  ('jobs.cancel', 'jobs'),
  ('service.view', 'service'),
  ('service.create', 'service'),
  ('service.edit', 'service'),
  ('service.close', 'service'),
  ('service.assign', 'service'),
  ('sites.view', 'sites'),
  ('sites.create', 'sites'),
  ('sites.edit', 'sites'),
  ('sites.delete', 'sites'),
  ('systems.view', 'systems'),
  ('systems.edit', 'systems'),
  ('documents.view', 'documents'),
  ('documents.upload', 'documents'),
  ('documents.delete', 'documents'),
  ('inventory.view', 'inventory'),
  ('inventory.edit', 'inventory'),
  ('finance.view', 'finance'),
  ('finance.edit', 'finance'),
  ('reports.view', 'reports'),
  ('reports.export', 'reports'),
  ('reports.financial', 'reports'),
  ('warranties.view', 'warranties'),
  ('warranties.issue', 'warranties'),
  ('knowledge.view', 'knowledge'),
  ('knowledge.edit', 'knowledge');

-- Owner receives every permission
INSERT INTO public.role_permissions (role_key, permission_key)
SELECT 'owner', key FROM public.permissions;

INSERT INTO public.role_permissions (role_key, permission_key)
SELECT 'administrator', p FROM unnest(ARRAY[
  'dashboard.view','calendar.view','calendar.edit',
  'settings.view','settings.general','settings.branding','workspace.edit',
  'users.view','users.invite','users.manage','roles.manage','audit.view',
  'crm.view','crm.create','crm.edit','crm.delete','crm.export',
  'leads.view','leads.create','leads.edit','leads.delete','leads.assign',
  'quotes.view','quotes.create','quotes.edit','quotes.delete','quotes.send',
  'quotes.approve','quotes.export','quotes.view_cost','quotes.override_price',
  'catalog.view','catalog.edit',
  'projects.view','projects.create','projects.edit','projects.close','projects.delete',
  'jobs.view','jobs.create','jobs.assign','jobs.start','jobs.complete','jobs.cancel',
  'service.view','service.create','service.edit','service.close','service.assign',
  'sites.view','sites.create','sites.edit','sites.delete',
  'systems.view','systems.edit',
  'documents.view','documents.upload','documents.delete',
  'inventory.view','inventory.edit','finance.view','finance.edit',
  'reports.view','reports.export','reports.financial',
  'warranties.view','warranties.issue','knowledge.view','knowledge.edit'
]) AS p;

INSERT INTO public.role_permissions (role_key, permission_key)
SELECT 'manager', p FROM unnest(ARRAY[
  'dashboard.view','calendar.view','calendar.edit',
  'settings.view','settings.general','users.view',
  'crm.view','crm.create','crm.edit','crm.delete','crm.export',
  'leads.view','leads.create','leads.edit','leads.delete','leads.assign',
  'quotes.view','quotes.create','quotes.edit','quotes.delete','quotes.send',
  'quotes.approve','quotes.export','quotes.view_cost','quotes.override_price',
  'catalog.view','catalog.edit',
  'projects.view','projects.create','projects.edit','projects.close',
  'jobs.view','jobs.create','jobs.assign','jobs.start','jobs.complete','jobs.cancel',
  'service.view','service.create','service.edit','service.close','service.assign',
  'sites.view','sites.create','sites.edit',
  'systems.view','systems.edit',
  'documents.view','documents.upload','documents.delete',
  'inventory.view','inventory.edit','finance.view',
  'reports.view','reports.export',
  'warranties.view','warranties.issue','knowledge.view','knowledge.edit'
]) AS p;

INSERT INTO public.role_permissions (role_key, permission_key)
SELECT 'sales', p FROM unnest(ARRAY[
  'dashboard.view','calendar.view','calendar.edit','settings.view',
  'crm.view','crm.create','crm.edit',
  'leads.view','leads.create','leads.edit','leads.assign',
  'quotes.view','quotes.create','quotes.edit','quotes.send','quotes.approve','quotes.export',
  'catalog.view','projects.view','jobs.view','service.view',
  'sites.view','systems.view','documents.view','documents.upload',
  'warranties.view','knowledge.view'
]) AS p;

INSERT INTO public.role_permissions (role_key, permission_key)
SELECT 'technician', p FROM unnest(ARRAY[
  'dashboard.view','calendar.view','calendar.edit','settings.view',
  'crm.view','quotes.view','catalog.view',
  'projects.view','projects.create','projects.edit','projects.close',
  'jobs.view','jobs.create','jobs.start','jobs.complete',
  'service.view','service.create','service.edit','service.close',
  'sites.view','sites.create','sites.edit',
  'systems.view','systems.edit',
  'documents.view','documents.upload',
  'warranties.view','warranties.issue','knowledge.view'
]) AS p;

INSERT INTO public.role_permissions (role_key, permission_key)
SELECT 'founding_technician', p FROM unnest(ARRAY[
  'dashboard.view','calendar.view','calendar.edit','settings.view','settings.general',
  'crm.view','crm.create','crm.edit','leads.view',
  'quotes.view','quotes.edit','quotes.export','catalog.view',
  'projects.view','projects.create','projects.edit','projects.close',
  'jobs.view','jobs.create','jobs.start','jobs.complete',
  'service.view','service.create','service.edit','service.close',
  'sites.view','sites.create','sites.edit',
  'systems.view','systems.edit',
  'documents.view','documents.upload',
  'warranties.view','warranties.issue','knowledge.view','reports.view'
]) AS p;

INSERT INTO public.role_permissions (role_key, permission_key)
SELECT 'viewer', p FROM unnest(ARRAY[
  'dashboard.view','calendar.view','settings.view',
  'crm.view','leads.view','quotes.view','catalog.view',
  'projects.view','jobs.view','service.view',
  'sites.view','systems.view','documents.view',
  'warranties.view','knowledge.view','reports.view'
]) AS p;

CREATE OR REPLACE FUNCTION public.auth_feature(p_workspace_id uuid, p_feature_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT o.enabled
      FROM public.workspace_feature_overrides o
      WHERE o.workspace_id = p_workspace_id AND o.feature_key = p_feature_key
    ),
    EXISTS (
      SELECT 1
      FROM public.subscriptions s
      JOIN public.plan_features pf ON pf.plan_key = s.plan_key
      WHERE s.workspace_id = p_workspace_id
        AND s.status IN ('trialing', 'active', 'manual')
        AND pf.feature_key = p_feature_key
    )
  );
$$;

REVOKE ALL ON FUNCTION public.auth_feature(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_feature(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_workspace(p_name text, p_plan_key text DEFAULT 'solo')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_uid uuid := auth.uid();
  v_plan text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;
  IF p_name IS NULL OR length(trim(p_name)) < 2 THEN
    RAISE EXCEPTION 'INVALID_NAME';
  END IF;

  v_plan := COALESCE(NULLIF(p_plan_key, ''), 'solo');
  IF NOT EXISTS (SELECT 1 FROM public.plans WHERE key = v_plan) THEN
    RAISE EXCEPTION 'INVALID_PLAN';
  END IF;

  INSERT INTO public.workspaces (name)
  VALUES (trim(p_name))
  RETURNING id INTO v_id;

  INSERT INTO public.workspace_settings (workspace_id) VALUES (v_id);
  INSERT INTO public.workspace_counters (workspace_id, kind, last_value)
  VALUES
    (v_id, 'site', 0),
    (v_id, 'quote', 0),
    (v_id, 'job', 0),
    (v_id, 'warranty', 0),
    (v_id, 'ft', 0);

  INSERT INTO public.workspace_memberships (workspace_id, user_id, role_key)
  VALUES (v_id, v_uid, 'owner');

  INSERT INTO public.subscriptions (workspace_id, plan_key, status)
  VALUES (v_id, v_plan, 'active');

  UPDATE public.profiles
  SET last_workspace_id = v_id
  WHERE id = v_uid;

  RETURN v_id;
END;
$$;

ALTER TABLE public.features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.features FORCE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans FORCE ROW LEVEL SECURITY;
ALTER TABLE public.plan_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_features FORCE ROW LEVEL SECURITY;
ALTER TABLE public.plan_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_limits FORCE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_feature_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_feature_overrides FORCE ROW LEVEL SECURITY;

CREATE POLICY features_select_authenticated ON public.features FOR SELECT TO authenticated USING (true);
CREATE POLICY plans_select_authenticated ON public.plans FOR SELECT TO authenticated USING (true);
CREATE POLICY plan_features_select_authenticated ON public.plan_features FOR SELECT TO authenticated USING (true);
CREATE POLICY plan_limits_select_authenticated ON public.plan_limits FOR SELECT TO authenticated USING (true);

COMMENT ON POLICY features_select_authenticated ON public.features IS
  'Global catalog, not tenant data.';

CREATE POLICY subscriptions_select_privileged
  ON public.subscriptions FOR SELECT TO authenticated
  USING (public.auth_is_privileged(workspace_id));

CREATE POLICY overrides_select_privileged
  ON public.workspace_feature_overrides FOR SELECT TO authenticated
  USING (public.auth_is_privileged(workspace_id));
