import { ErrorState } from "@site-secure/ui";
import type { ReactNode } from "react";
import { he } from "../../i18n/he";
import { can } from "../../lib/can";
import { useSession } from "../../lib/session";

export function Forbidden() {
  return <ErrorState title={he.forbiddenTitle} description={he.forbiddenBody} />;
}

export function RequirePermission({
  permission,
  children,
}: {
  permission: string;
  children: ReactNode;
}) {
  return <RequireAnyPermission permissions={[permission]}>{children}</RequireAnyPermission>;
}

export function RequireAnyPermission({
  permissions,
  children,
}: {
  permissions: string[];
  children: ReactNode;
}) {
  const { session } = useSession();
  const membership = session?.memberships[0];
  const features = membership?.features ?? [];
  if (!permissions.some((permission) => can(membership?.role_key, permission, features))) {
    return <Forbidden />;
  }
  return children;
}
