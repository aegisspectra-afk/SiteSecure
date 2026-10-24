import { Button, ErrorState } from "@site-secure/ui";
import type { ReactNode } from "react";
import { he } from "../i18n/he";
import { can } from "../lib/can";
import { openConfiguredUrl, platformHomeUrl } from "../lib/env";
import { useSession } from "../lib/session";

export function Forbidden() {
  return (
    <div className="flex flex-col gap-4" data-testid="workforce-forbidden">
      <ErrorState title={he.forbiddenTitle} description={he.forbiddenBody} />
      {platformHomeUrl() ? (
        <Button type="button" variant="secondary" onClick={() => openConfiguredUrl(platformHomeUrl())}>
          {he.backToPlatform}
        </Button>
      ) : null}
    </div>
  );
}

export function RequirePermission({
  permission,
  children,
}: {
  permission: string;
  children: ReactNode;
}) {
  const { session } = useSession();
  const membership = session?.memberships[0];
  const features = membership?.features ?? [];
  const grants = membership?.permissions ?? null;
  if (!can(membership?.role_key, permission, features, grants)) {
    return <Forbidden />;
  }
  return children;
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
  const grants = membership?.permissions ?? null;
  if (!permissions.some((permission) => can(membership?.role_key, permission, features, grants))) {
    return <Forbidden />;
  }
  return children;
}
