CREATE TYPE public.warranty_type AS ENUM (
  'manufacturer', 'installation', 'extended', 'maintenance_contract'
);

CREATE TYPE public.warranty_status AS ENUM (
  'active', 'expiring_soon', 'expired', 'cancelled'
);

CREATE TABLE public.warranties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  number text NOT NULL,
  public_token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  type public.warranty_type NOT NULL DEFAULT 'installation',
  status public.warranty_status NOT NULL DEFAULT 'active',
  customer_id uuid NOT NULL REFERENCES public.customers (id) ON DELETE RESTRICT,
  site_id uuid NOT NULL REFERENCES public.sites (id) ON DELETE RESTRICT,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  document_id uuid REFERENCES public.documents (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, number)
);

CREATE INDEX warranties_workspace_status_idx ON public.warranties (workspace_id, status);

CREATE TRIGGER warranties_set_updated_at
  BEFORE UPDATE ON public.warranties
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.warranties_set_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.number IS NULL OR NEW.number = '' THEN
    NEW.number := 'W-' || lpad(public.next_code(NEW.workspace_id, 'warranty')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER warranties_set_number
  BEFORE INSERT ON public.warranties
  FOR EACH ROW EXECUTE FUNCTION public.warranties_set_number();

ALTER TABLE public.warranties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warranties FORCE ROW LEVEL SECURITY;

CREATE POLICY warranties_select ON public.warranties FOR SELECT TO authenticated
  USING (public.auth_site_visible(workspace_id, site_id));

CREATE POLICY warranties_insert ON public.warranties FOR INSERT TO authenticated
  WITH CHECK (
    public.auth_site_visible(workspace_id, site_id)
    AND public.auth_role_in(
      workspace_id,
      ARRAY['owner','administrator','manager','technician','founding_technician']
    )
  );

CREATE POLICY warranties_update ON public.warranties FOR UPDATE TO authenticated
  USING (public.auth_is_managerial(workspace_id))
  WITH CHECK (public.auth_is_managerial(workspace_id));

CREATE POLICY warranties_delete ON public.warranties FOR DELETE TO authenticated
  USING (public.auth_is_privileged(workspace_id));
