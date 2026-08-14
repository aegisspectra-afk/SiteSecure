CREATE TYPE public.customer_type AS ENUM ('private', 'business');
CREATE TYPE public.customer_status AS ENUM ('active', 'inactive');
CREATE TYPE public.activity_type AS ENUM ('note', 'call', 'meeting', 'quote', 'job', 'other');

CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  display_name text NOT NULL,
  type public.customer_type NOT NULL DEFAULT 'private',
  status public.customer_status NOT NULL DEFAULT 'active',
  legal_name text,
  tax_id text,
  email text,
  phone text,
  billing_address jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX customers_workspace_created_idx ON public.customers (workspace_id, created_at DESC);
CREATE INDEX customers_workspace_status_idx ON public.customers (workspace_id, status);

CREATE TRIGGER customers_set_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.customer_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers (id) ON DELETE CASCADE,
  full_name text NOT NULL,
  role_title text,
  email text,
  phone text,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX customer_contacts_customer_idx ON public.customer_contacts (workspace_id, customer_id);

CREATE TRIGGER customer_contacts_set_updated_at
  BEFORE UPDATE ON public.customer_contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.customer_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers (id) ON DELETE CASCADE,
  body text NOT NULL,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.customer_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers (id) ON DELETE CASCADE,
  type public.activity_type NOT NULL,
  title text NOT NULL,
  body text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.auth_customer_visible(p_workspace_id uuid, p_customer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.auth_is_member(p_workspace_id)
    AND (
      NOT public.auth_is_assigned_scope(p_workspace_id)
      OR public.auth_assigned(p_workspace_id, 'customer', p_customer_id)
    );
$$;

REVOKE ALL ON FUNCTION public.auth_customer_visible(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_customer_visible(uuid, uuid) TO authenticated;

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers FORCE ROW LEVEL SECURITY;
ALTER TABLE public.customer_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_contacts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.customer_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_notes FORCE ROW LEVEL SECURITY;
ALTER TABLE public.customer_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_activities FORCE ROW LEVEL SECURITY;

CREATE POLICY customers_select ON public.customers FOR SELECT TO authenticated
  USING (public.auth_customer_visible(workspace_id, id) AND deleted_at IS NULL);

CREATE POLICY customers_insert ON public.customers FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_is_member(workspace_id)
    AND public.auth_role_in(
      workspace_id,
      ARRAY['owner','administrator','manager','sales','founding_technician']
    )
  );

CREATE POLICY customers_update ON public.customers FOR UPDATE TO authenticated
  USING (public.auth_customer_visible(workspace_id, id))
  WITH CHECK (public.auth_customer_visible(workspace_id, id));

CREATE POLICY customers_delete ON public.customers FOR DELETE TO authenticated
  USING (public.auth_is_privileged(workspace_id));

CREATE POLICY customer_contacts_select ON public.customer_contacts FOR SELECT TO authenticated
  USING (public.auth_customer_visible(workspace_id, customer_id));

CREATE POLICY customer_contacts_insert ON public.customer_contacts FOR INSERT TO authenticated
  WITH CHECK (public.auth_customer_visible(workspace_id, customer_id));

CREATE POLICY customer_contacts_update ON public.customer_contacts FOR UPDATE TO authenticated
  USING (public.auth_customer_visible(workspace_id, customer_id))
  WITH CHECK (public.auth_customer_visible(workspace_id, customer_id));

CREATE POLICY customer_contacts_delete ON public.customer_contacts FOR DELETE TO authenticated
  USING (public.auth_is_privileged(workspace_id));

CREATE POLICY customer_notes_select ON public.customer_notes FOR SELECT TO authenticated
  USING (public.auth_customer_visible(workspace_id, customer_id));

CREATE POLICY customer_notes_insert ON public.customer_notes FOR INSERT TO authenticated
  WITH CHECK (public.auth_customer_visible(workspace_id, customer_id));

CREATE POLICY customer_activities_select ON public.customer_activities FOR SELECT TO authenticated
  USING (public.auth_customer_visible(workspace_id, customer_id));

CREATE POLICY customer_activities_insert ON public.customer_activities FOR INSERT TO authenticated
  WITH CHECK (public.auth_customer_visible(workspace_id, customer_id));
