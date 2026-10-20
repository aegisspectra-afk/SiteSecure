import type { SspOrgMeOut } from "@site-secure/api-client";
import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, type ReactNode } from "react";
import { productCan } from "./productAuthz";
import { can } from "./can";
import { useSession } from "./session";

type OrgContextValue = {
  loading: boolean;
  org: SspOrgMeOut | null;
  productRole: string | null;
  refresh: () => void;
  sspCan: (action: string) => boolean;
};

const OrgContext = createContext<OrgContextValue | null>(null);

export function OrgProvider({ children }: { children: ReactNode }) {
  const { api, workspaceId, session } = useSession();
  const membership = session?.memberships[0];
  const roleKey = membership?.role_key;
  const features = membership?.features ?? [];
  const permissions = membership?.permissions;

  const query = useQuery({
    queryKey: ["ssp-org-me", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.getSspOrgMe(workspaceId!),
    staleTime: 30_000,
  });

  const productRole = query.data?.membership?.product_role ?? null;

  const sspCan = (action: string) => {
    if (can(roleKey, action, features, permissions)) return true;
    // Map catalog submission view to officer own-view for UX gates.
    if (action === "ssp.submissions.view" && productCan(productRole, "ssp.submissions.view_own")) {
      return true;
    }
    return productCan(productRole, action);
  };

  return (
    <OrgContext.Provider
      value={{
        loading: query.isLoading,
        org: query.data ?? null,
        productRole,
        refresh: () => void query.refetch(),
        sspCan,
      }}
    >
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg(): OrgContextValue {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useOrg requires OrgProvider");
  return ctx;
}
