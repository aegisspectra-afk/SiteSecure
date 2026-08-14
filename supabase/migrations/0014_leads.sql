CREATE TYPE public.lead_status AS ENUM (
  'new', 'contacted', 'meeting', 'spec', 'quoted', 'follow_up', 'won', 'lost'
);

CREATE TYPE public.lead_source AS ENUM (
  'website', 'referral', 'advertising', 'phone', 'other', 'manual'
);

CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  title text NOT NULL,
  status public.lead_status NOT NULL DEFAULT 'new',
  source public.lead_source NOT NULL DEFAULT 'manual',
  owner_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers (id) ON DELETE SET NULL,
  site_id uuid REFERENCES public.sites (id) ON DELETE SET NULL,
  contact_name text,
  email text,
  phone text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX leads_workspace_status_idx ON public.leads (workspace_id, status);
CREATE INDEX leads_workspace_owner_idx ON public.leads (workspace_id, owner_user_id);

CREATE TRIGGER leads_set_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads FORCE ROW LEVEL SECURITY;

CREATE POLICY leads_select ON public.leads FOR SELECT TO authenticated
  USING (
    public.auth_is_member(workspace_id)
    AND (
      public.auth_is_managerial(workspace_id)
      OR owner_user_id = auth.uid()
      OR (
        public.auth_is_assigned_scope(workspace_id)
        AND site_id IS NOT NULL
        AND public.auth_site_visible(workspace_id, site_id)
      )
    )
  );

CREATE POLICY leads_insert ON public.leads FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_role_in(workspace_id, ARRAY['owner','administrator','manager','sales'])
  );

CREATE POLICY leads_update ON public.leads FOR UPDATE TO authenticated
  USING (
    public.auth_is_managerial(workspace_id) OR owner_user_id = auth.uid()
  )
  WITH CHECK (
    public.auth_is_managerial(workspace_id) OR owner_user_id = auth.uid()
  );

CREATE POLICY leads_delete ON public.leads FOR DELETE TO authenticated
  USING (public.auth_is_privileged(workspace_id));
