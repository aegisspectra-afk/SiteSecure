import { Button } from "@site-secure/ui";
import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ErrorState } from "../../../components/modules/ModuleKit";
import { RequireAnyPermission } from "../../../components/settings/RequirePermission";
import { WorkforceProductShell } from "../../../components/workforce/WorkforceProductShell";
import { he } from "../../../i18n/he";
import { hasFeature } from "../../../lib/home";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/app/workforce")({
  component: WorkforceLayoutPage,
});

function WorkforceLayoutPage() {
  const { session } = useSession();
  const features = session?.memberships[0]?.features ?? [];
  const navigate = useNavigate();
  if (!hasFeature(features, "workforce")) {
    return (
      <div className="ss-module flex flex-col gap-4">
        <ErrorState title={he.forbiddenTitle} description={he.workforceBlockedNote} />
        <Button type="button" variant="secondary" onClick={() => void navigate({ to: "/platform" })}>
          {he.platformHomeTitle}
        </Button>
      </div>
    );
  }
  return (
    <RequireAnyPermission permissions={["workforce.view", "workforce.portal.view"]}>
      <WorkforceProductShell>
        <Outlet />
      </WorkforceProductShell>
    </RequireAnyPermission>
  );
}
