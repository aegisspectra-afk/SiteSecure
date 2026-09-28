-- BETA-ADMIN-2: workspace team invitations — managers may manage invitations (RLS)

DROP POLICY IF EXISTS invitations_all_privileged ON public.invitations;

CREATE POLICY invitations_all_managerial
  ON public.invitations
  FOR ALL
  TO authenticated
  USING (public.auth_is_managerial(workspace_id))
  WITH CHECK (public.auth_is_managerial(workspace_id));

COMMENT ON POLICY invitations_all_managerial ON public.invitations IS
  'BETA-ADMIN-2: owner/administrator/manager may create, revoke, and list workspace invitations.';
