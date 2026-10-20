import { Button, ErrorState } from "@site-secure/ui";
import type { ReactNode } from "react";
import { he } from "../i18n/he";
import { can } from "../lib/can";
import { platformHomeUrl } from "../lib/env";
import { useOrg } from "../lib/org";
import { useSession } from "../lib/session";

export function Forbidden() {
  return (
    <div className="flex flex-col gap-4" data-testid="ssp-forbidden">
      <ErrorState title={he.forbiddenTitle} description={he.forbiddenBody} />
      <Button type="button" variant="secondary" onClick={() => window.location.assign(platformHomeUrl())}>
        {he.backToPlatform}
      </Button>
    </div>
  );
}

/** Workspace catalog grant only (legacy). Prefer RequireSspAccess for product roles. */
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

/** Catalog OR SSP product-role grant. UX only — API re-enforces. */
export function RequireSspAccess({
  permission,
  anyOf,
  children,
}: {
  permission?: string;
  anyOf?: string[];
  children: ReactNode;
}) {
  const { loading, sspCan } = useOrg();
  if (loading) {
    return <p className="text-sm text-fg-muted p-4">{he.loading}</p>;
  }
  const perms = anyOf ?? (permission ? [permission] : []);
  if (!perms.some((p) => sspCan(p))) {
    return <Forbidden />;
  }
  return children;
}
