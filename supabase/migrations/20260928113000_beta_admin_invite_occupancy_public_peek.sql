-- BETA-ADMIN-1 follow-up: revoke-aware occupancy + public invite peek (pre-auth)

CREATE OR REPLACE FUNCTION public._workspace_member_occupancy(p_workspace_id uuid)
RETURNS TABLE(members integer, technicians integer)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH active AS (
    SELECT m.role_key, lower(COALESCE(p.email, '')) AS email
    FROM public.workspace_memberships m
    LEFT JOIN public.profiles p ON p.id = m.user_id
    WHERE m.workspace_id = p_workspace_id
      AND m.status = 'active'
  ),
  member_emails AS (
    SELECT email FROM active WHERE email <> ''
  ),
  pending AS (
    SELECT DISTINCT ON (lower(i.email))
      i.role_key,
      lower(i.email) AS email
    FROM public.invitations i
    WHERE i.workspace_id = p_workspace_id
      AND i.accepted_at IS NULL
      AND i.revoked_at IS NULL
      AND i.expires_at > now()
      AND lower(i.email) NOT IN (SELECT email FROM member_emails)
    ORDER BY lower(i.email), i.created_at ASC
  ),
  occupied AS (
    SELECT role_key FROM active
    UNION ALL
    SELECT role_key FROM pending
  )
  SELECT
    (SELECT count(*)::integer FROM occupied) AS members,
    (SELECT count(*)::integer FROM occupied
     WHERE role_key IN ('technician', 'founding_technician')) AS technicians;
$$;

-- Pre-auth peek: safe fields only; no membership creation. Callable by anon.
CREATE OR REPLACE FUNCTION public.invitation_public_preview(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash text;
  v_inv public.invitations%ROWTYPE;
  v_ws public.workspaces%ROWTYPE;
BEGIN
  IF p_token IS NULL OR length(btrim(p_token)) < 16 THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;

  v_hash := public.token_sha256(p_token);

  SELECT * INTO v_inv
  FROM public.invitations i
  WHERE i.token_hash = v_hash;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;

  IF v_inv.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'revoked');
  END IF;

  IF v_inv.accepted_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'already_accepted');
  END IF;

  IF v_inv.expires_at <= now() THEN
    RETURN jsonb_build_object('status', 'expired');
  END IF;

  SELECT * INTO v_ws
  FROM public.workspaces w
  WHERE w.id = v_inv.workspace_id;

  IF NOT FOUND OR v_ws.status IS DISTINCT FROM 'active' THEN
    RETURN jsonb_build_object('status', 'invalid');
  END IF;

  RETURN jsonb_build_object(
    'status', 'valid',
    'workspace_name', v_ws.name,
    'role_key', v_inv.role_key,
    'email', v_inv.email,
    'expires_at', v_inv.expires_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.invitation_public_preview(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.invitation_public_preview(text) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.invitation_public_preview(text) IS
  'BETA-ADMIN-1: pre-login invite preview (workspace name, email, role, status). No auth required.';
