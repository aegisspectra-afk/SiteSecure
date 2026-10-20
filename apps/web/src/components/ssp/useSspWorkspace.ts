import { useQuery } from "@tanstack/react-query";
import { can } from "../../lib/can";
import { productCan, type SspProductRole } from "../../lib/ssp-product-authz";
import { useSession } from "../../lib/session";

export function useSspWorkspace() {
  const { session, api } = useSession();
  const membership = session?.memberships[0];
  const features = membership?.features ?? [];
  const permissions = membership?.permissions;
  const roleKey = membership?.role_key;
  const workspaceId = membership?.workspace_id;
  const catalogView = can(roleKey, "ssp.forms.view", features, permissions);
  const catalogEdit = can(roleKey, "ssp.forms.edit", features, permissions);
  const catalogAssign = can(roleKey, "ssp.assignments.manage", features, permissions);
  const catalogSubs = can(roleKey, "ssp.submissions.view", features, permissions);

  const orgQuery = useQuery({
    queryKey: ["ssp-org-me", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.getSspOrgMe(workspaceId!),
    retry: false,
    staleTime: 30_000,
  });

  const productRole = (orgQuery.data?.membership?.product_role ?? null) as SspProductRole | null;

  const sspCan = (action: string) => {
    if (can(roleKey, action, features, permissions)) return true;
    if (action === "ssp.submissions.view" && productCan(productRole, "ssp.submissions.view_own")) {
      return true;
    }
    return productCan(productRole, action);
  };

  return {
    api,
    workspaceId,
    productRole,
    org: orgQuery.data ?? null,
    orgLoading: orgQuery.isLoading,
    canEdit: catalogEdit || sspCan("ssp.forms.edit") || sspCan("ssp.sites.edit"),
    canView: catalogView || sspCan("ssp.forms.view") || sspCan("ssp.dashboard.view"),
    canAssign: catalogAssign || sspCan("ssp.assignments.manage"),
    canViewSubmissions: catalogSubs || sspCan("ssp.submissions.view") || sspCan("ssp.submissions.view_own"),
    isOfficer: productRole === "patrol_officer",
    sspCan,
  };
}
