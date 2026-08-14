import type { ReactNode } from "react";
import { can } from "../lib/can";
import { useSession } from "../lib/session";

export function Can({
  permission,
  children,
}: {
  permission: string;
  children: ReactNode;
}) {
  const { session } = useSession();
  const membership = session?.memberships[0];
  if (!can(membership?.role_key, permission, membership?.features ?? [])) return null;
  return children;
}
