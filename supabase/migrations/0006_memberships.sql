CREATE TYPE public.membership_status AS ENUM ('active', 'disabled');

CREATE TABLE public.workspace_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  role_key text NOT NULL REFERENCES public.roles (key),
  status public.membership_status NOT NULL DEFAULT 'active',
  technician_code text,
  program_type text,
  program_started_at timestamptz,
  program_ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id),
  UNIQUE (workspace_id, technician_code)
);

CREATE INDEX workspace_memberships_user_id_idx ON public.workspace_memberships (user_id);
CREATE INDEX workspace_memberships_workspace_role_idx ON public.workspace_memberships (workspace_id, role_key);

CREATE TRIGGER workspace_memberships_set_updated_at
  BEFORE UPDATE ON public.workspace_memberships
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  email text NOT NULL,
  role_key text NOT NULL REFERENCES public.roles (key),
  token_hash text NOT NULL UNIQUE,
  invited_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX invitations_workspace_email_idx ON public.invitations (workspace_id, email);

ALTER TABLE public.workspace_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations FORCE ROW LEVEL SECURITY;
