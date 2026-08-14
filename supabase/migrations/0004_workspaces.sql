-- Workspaces are the tenant. Ownership is a membership role, not owner_id.

CREATE TYPE public.workspace_status AS ENUM ('active', 'suspended', 'pending_deletion');

CREATE TABLE public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  status public.workspace_status NOT NULL DEFAULT 'active',
  timezone text NOT NULL DEFAULT 'Asia/Jerusalem',
  country_code text NOT NULL DEFAULT 'IL',
  vat_percent numeric(5, 2) NOT NULL DEFAULT 18.00,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspaces_vat_percent_chk CHECK (vat_percent >= 0 AND vat_percent <= 100)
);

CREATE TRIGGER workspaces_set_updated_at
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.workspace_counters (
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  kind text NOT NULL,
  last_value integer NOT NULL DEFAULT 0,
  PRIMARY KEY (workspace_id, kind)
);

CREATE TABLE public.workspace_settings (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces (id) ON DELETE CASCADE,
  branding jsonb NOT NULL DEFAULT '{}'::jsonb,
  quotes jsonb NOT NULL DEFAULT '{}'::jsonb,
  taxes jsonb NOT NULL DEFAULT '{}'::jsonb,
  scheduling jsonb NOT NULL DEFAULT '{}'::jsonb,
  notifications jsonb NOT NULL DEFAULT '{}'::jsonb,
  localization jsonb NOT NULL DEFAULT '{"locale":"he","currency":"ILS"}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER workspace_settings_set_updated_at
  BEFORE UPDATE ON public.workspace_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.next_code(p_workspace_id uuid, p_kind text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v integer;
BEGIN
  INSERT INTO public.workspace_counters (workspace_id, kind, last_value)
  VALUES (p_workspace_id, p_kind, 1)
  ON CONFLICT (workspace_id, kind)
  DO UPDATE SET last_value = public.workspace_counters.last_value + 1
  RETURNING last_value INTO v;
  RETURN v;
END;
$$;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_last_workspace_id_fkey
  FOREIGN KEY (last_workspace_id) REFERENCES public.workspaces (id) ON DELETE SET NULL;

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces FORCE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_counters FORCE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_settings FORCE ROW LEVEL SECURITY;

-- Policies that need membership helpers are added in 0007 after those functions exist.
