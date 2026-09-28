import type { PortalSession } from "@site-secure/api-client";

type PortalSessionClient = {
  getPortalSession: () => Promise<PortalSession>;
};

/** Portal-only users must not fall through into workspace onboarding. */
export async function hasPortalAccess(api: PortalSessionClient): Promise<boolean> {
  try {
    const session = await api.getPortalSession();
    return session.grants.length > 0;
  } catch {
    return false;
  }
}
