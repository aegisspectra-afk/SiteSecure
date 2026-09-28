-- Customer portal grants are not workspace memberships.
-- Accepting an invite must never insert workspace_memberships or touch seats.
-- Secret tables are service-role only. Staff and portal APIs read them after authorize().

INSERT INTO public.permissions (key, group_key)
VALUES
  ('customer_portal.view', 'customer_portal'),
  ('customer_portal.create', 'customer_portal'),
  ('customer_portal.manage', 'customer_portal'),
  ('customer_portal.revoke', 'customer_portal')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.role_permissions (role_key, permission_key)
SELECT role_key, permission_key
FROM (
  VALUES
    ('owner', 'customer_portal.view'),
    ('owner', 'customer_portal.create'),
    ('owner', 'customer_portal.manage'),
    ('owner', 'customer_portal.revoke'),
    ('administrator', 'customer_portal.view'),
    ('administrator', 'customer_portal.create'),
    ('administrator', 'customer_portal.manage'),
    ('administrator', 'customer_portal.revoke'),
    ('manager', 'customer_portal.view'),
    ('manager', 'customer_portal.create'),
    ('manager', 'customer_portal.manage'),
    ('manager', 'customer_portal.revoke'),
    ('sales', 'customer_portal.view'),
    ('technician', 'customer_portal.view')
) AS seed(role_key, permission_key)
ON CONFLICT DO NOTHING;

-- Existing system roles store a grant snapshot. Append portal keys without
-- replacing custom edits. Empty snapshots stay empty so the API fills them
-- from the catalog. Owner remains ["*"].
DO $$
DECLARE
  r record;
  keys text[];
BEGIN
  FOR r IN
    SELECT id, key, grants
    FROM public.workspace_roles
    WHERE is_system
      AND key IN ('administrator', 'manager', 'sales', 'technician')
      AND jsonb_typeof(grants) = 'array'
      AND jsonb_array_length(grants) > 0
      AND NOT (grants @> '["*"]'::jsonb)
  LOOP
    IF r.key IN ('administrator', 'manager') THEN
      keys := ARRAY[
        'customer_portal.view',
        'customer_portal.create',
        'customer_portal.manage',
        'customer_portal.revoke'
      ];
    ELSE
      keys := ARRAY['customer_portal.view'];
    END IF;

    UPDATE public.workspace_roles
    SET grants = (
      SELECT jsonb_agg(to_jsonb(item) ORDER BY item)
      FROM (
        SELECT DISTINCT item
        FROM (
          SELECT jsonb_array_elements_text(r.grants) AS item
          UNION
          SELECT unnest(keys)
        ) s
      ) q
    )
    WHERE id = r.id;
  END LOOP;
END $$;

CREATE TABLE public.customer_portal_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces (id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers (id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.customer_contacts (id) ON DELETE SET NULL,
  portal_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'invited',
  scope text NOT NULL DEFAULT 'customer',
  site_id uuid,
  capabilities text[] NOT NULL DEFAULT ARRAY[
    'portal.profile.view',
    'portal.sites.view',
    'portal.installations.view',
    'portal.equipment.view',
    'portal.warranties.view',
    'portal.quotes.view',
    'portal.documents.view',
    'portal.service.view'
  ]::text[],
  enabled_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  enabled_at timestamptz NOT NULL DEFAULT now(),
  revoked_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  revoked_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_portal_access_status_chk CHECK (status IN ('invited', 'active', 'revoked')),
  CONSTRAINT customer_portal_access_email_chk CHECK (
    email = lower(email) AND position('@' IN email) > 1
  ),
  CONSTRAINT customer_portal_access_scope_chk CHECK (scope = 'customer' AND site_id IS NULL),
  CONSTRAINT customer_portal_access_capabilities_chk CHECK (
    capabilities <@ ARRAY[
      'portal.profile.view',
      'portal.sites.view',
      'portal.installations.view',
      'portal.equipment.view',
      'portal.warranties.view',
      'portal.quotes.view',
      'portal.documents.view',
      'portal.service.view'
    ]::text[]
  )
);

CREATE UNIQUE INDEX customer_portal_access_live_email_idx
  ON public.customer_portal_access (workspace_id, customer_id, email)
  WHERE status IN ('invited', 'active');

CREATE INDEX customer_portal_access_customer_idx
  ON public.customer_portal_access (workspace_id, customer_id);

CREATE INDEX customer_portal_access_user_idx
  ON public.customer_portal_access (portal_user_id)
  WHERE status = 'active';

CREATE TRIGGER customer_portal_access_set_updated_at
  BEFORE UPDATE ON public.customer_portal_access
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.customer_portal_invite (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_id uuid NOT NULL REFERENCES public.customer_portal_access (id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  delivery text NOT NULL DEFAULT 'copy',
  consumed_at timestamptz,
  revoked_at timestamptz,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_portal_invite_delivery_chk CHECK (delivery IN ('copy', 'email'))
);

CREATE INDEX customer_portal_invite_access_idx
  ON public.customer_portal_invite (access_id, created_at DESC);

CREATE TABLE public.portal_login_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_id uuid NOT NULL REFERENCES public.customer_portal_access (id) ON DELETE CASCADE,
  portal_user_id uuid NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  ip inet,
  user_agent text
);

CREATE INDEX portal_login_events_access_idx
  ON public.portal_login_events (access_id, occurred_at DESC);

ALTER TABLE public.customer_portal_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_portal_access FORCE ROW LEVEL SECURITY;
ALTER TABLE public.customer_portal_invite ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_portal_invite FORCE ROW LEVEL SECURITY;
ALTER TABLE public.portal_login_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_login_events FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.customer_portal_access FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.customer_portal_invite FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.portal_login_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customer_portal_access TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customer_portal_invite TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.portal_login_events TO service_role;

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'internal';

ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_visibility_chk;

ALTER TABLE public.documents
  ADD CONSTRAINT documents_visibility_chk CHECK (visibility IN ('internal', 'customer'));

COMMENT ON COLUMN public.documents.visibility IS
  'internal by default. Portal downloads require visibility=customer plus an active grant.';

CREATE OR REPLACE FUNCTION public.peek_customer_portal_invite(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash text;
  v_invite public.customer_portal_invite%ROWTYPE;
  v_access public.customer_portal_access%ROWTYPE;
  v_customer_name text;
  v_workspace_name text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  IF p_token IS NULL OR length(btrim(p_token)) < 16 THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;

  v_hash := public.token_sha256(p_token);

  SELECT * INTO v_invite
  FROM public.customer_portal_invite i
  WHERE i.token_hash = v_hash;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;

  IF v_invite.consumed_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'consumed');
  END IF;

  IF v_invite.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'revoked');
  END IF;

  IF v_invite.expires_at <= now() THEN
    RETURN jsonb_build_object('status', 'expired');
  END IF;

  SELECT * INTO v_access
  FROM public.customer_portal_access a
  WHERE a.id = v_invite.access_id;

  IF NOT FOUND OR v_access.status IS DISTINCT FROM 'invited' THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;

  SELECT c.display_name INTO v_customer_name
  FROM public.customers c
  WHERE c.id = v_access.customer_id AND c.deleted_at IS NULL;

  SELECT w.name INTO v_workspace_name
  FROM public.workspaces w
  WHERE w.id = v_access.workspace_id AND w.status = 'active';

  IF v_customer_name IS NULL OR v_workspace_name IS NULL THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;

  RETURN jsonb_build_object(
    'status', 'valid',
    'email', v_access.email,
    'customer_name', v_customer_name,
    'workspace_name', v_workspace_name,
    'expires_at', v_invite.expires_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_customer_portal_invite(p_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash text := public.token_sha256(p_token);
  v_invite public.customer_portal_invite%ROWTYPE;
  v_access public.customer_portal_access%ROWTYPE;
  v_email text;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED';
  END IF;

  IF p_token IS NULL OR length(btrim(p_token)) < 16 THEN
    RAISE EXCEPTION 'PORTAL_INVITE_INVALID';
  END IF;

  SELECT COALESCE(u.email, '') INTO v_email
  FROM auth.users u
  WHERE u.id = v_uid;

  SELECT * INTO v_invite
  FROM public.customer_portal_invite i
  WHERE i.token_hash = v_hash
  FOR UPDATE;

  IF NOT FOUND
     OR v_invite.consumed_at IS NOT NULL
     OR v_invite.revoked_at IS NOT NULL
     OR v_invite.expires_at <= now() THEN
    RAISE EXCEPTION 'PORTAL_INVITE_INVALID';
  END IF;

  SELECT * INTO v_access
  FROM public.customer_portal_access a
  WHERE a.id = v_invite.access_id
  FOR UPDATE;

  IF NOT FOUND OR v_access.status IS DISTINCT FROM 'invited' THEN
    RAISE EXCEPTION 'PORTAL_INVITE_INVALID';
  END IF;

  IF lower(v_access.email) <> lower(v_email) THEN
    RAISE EXCEPTION 'PORTAL_INVITE_EMAIL_MISMATCH';
  END IF;

  UPDATE public.customer_portal_invite
  SET consumed_at = now()
  WHERE id = v_invite.id;

  UPDATE public.customer_portal_invite
  SET revoked_at = now()
  WHERE access_id = v_access.id
    AND id <> v_invite.id
    AND consumed_at IS NULL
    AND revoked_at IS NULL;

  UPDATE public.customer_portal_access
  SET status = 'active',
      portal_user_id = v_uid,
      last_login_at = now()
  WHERE id = v_access.id;

  -- Staff membership and seat counters are intentionally untouched.
  RETURN v_access.id;
END;
$$;

REVOKE ALL ON FUNCTION public.peek_customer_portal_invite(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_customer_portal_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.peek_customer_portal_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_customer_portal_invite(text) TO authenticated;
