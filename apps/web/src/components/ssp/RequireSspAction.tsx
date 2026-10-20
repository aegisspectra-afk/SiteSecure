import type { ReactNode } from "react";
import { ErrorState } from "../modules/ModuleKit";
import { he } from "../../i18n/he";
import { useSspWorkspace } from "./useSspWorkspace";

export function RequireSspAction({
  permission,
  anyOf,
  children,
}: {
  permission?: string;
  anyOf?: string[];
  children: ReactNode;
}) {
  const { sspCan, orgLoading } = useSspWorkspace();
  if (orgLoading) return <p className="text-sm text-fg-muted">{he.loading}</p>;
  const allowed = anyOf?.length ? anyOf.some((key) => sspCan(key)) : permission ? sspCan(permission) : false;
  if (!allowed) {
    return <ErrorState title={he.forbiddenTitle} description={he.forbiddenBody} />;
  }
  return children;
}
