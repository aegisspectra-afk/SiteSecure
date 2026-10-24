import type { SessionMembership } from "@site-secure/api-client";

export type ActiveMembershipSession = {
  profile?: { last_workspace_id?: string | null } | null;
  memberships?: SessionMembership[] | null;
};

/** Resolve the active membership from session data. Never invents a workspace. */
export function activeMembership(
  session: ActiveMembershipSession | null | undefined,
): SessionMembership | undefined {
  const memberships = session?.memberships;
  if (!memberships?.length) return undefined;
  const preferred = session?.profile?.last_workspace_id;
  if (preferred) {
    const match = memberships.find((row) => row.workspace_id === preferred);
    if (match) return match;
  }
  return memberships[0];
}
