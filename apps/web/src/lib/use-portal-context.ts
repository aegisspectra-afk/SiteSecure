import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { createPortalApiClient } from "./portal-api";
import { clearPortalToken, getPortalToken } from "./portal-session";
import { useSession } from "./session";

export function usePortalContext() {
  const { user, api: sessionApi, signOut: sessionSignOut } = useSession();
  const portalBearerApi = useMemo(() => createPortalApiClient(), []);
  const portalToken = getPortalToken();
  const hasPortalBearer = Boolean(portalToken);
  const api = hasPortalBearer ? portalBearerApi : sessionApi;
  const authed = hasPortalBearer || Boolean(user);

  const sessionQuery = useQuery({
    queryKey: ["portal-session", portalToken, user?.id],
    enabled: authed,
    queryFn: () => api.getPortalSession(),
  });

  const grants = sessionQuery.data?.grants ?? [];
  const [selected, setSelected] = useState<string | null>(null);
  const accessId = selected ?? grants[0]?.access_id ?? null;

  const homeQuery = useQuery({
    queryKey: ["portal-home", accessId],
    enabled: Boolean(authed && accessId),
    queryFn: () => api.getPortalHome(accessId!),
  });

  function signOut() {
    if (hasPortalBearer) {
      clearPortalToken();
      window.location.assign("/portal/login");
      return;
    }
    void sessionSignOut();
  }

  return {
    api,
    authed,
    hasPortalBearer,
    sessionQuery,
    grants,
    accessId,
    setSelected,
    homeQuery,
    home: homeQuery.data,
    signOut,
  };
}