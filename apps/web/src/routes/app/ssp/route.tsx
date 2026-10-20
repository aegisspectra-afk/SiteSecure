import { Button } from "@site-secure/ui";
import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ErrorState } from "../../../components/modules/ModuleKit";
import { RequirePermission } from "../../../components/settings/RequirePermission";
import { SspProductShell } from "../../../components/ssp/SspProductShell";
import { he } from "../../../i18n/he";
import { hasFeature } from "../../../lib/home";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/app/ssp")({
  component: SspLayoutPage,
});

function SspLayoutPage() {
  const { session } = useSession();
  const features = session?.memberships[0]?.features ?? [];
  const navigate = useNavigate();
  if (!hasFeature(features, "ssp")) {
    return (
      <div className="ss-module flex flex-col gap-4">
        <ErrorState title={he.forbiddenTitle} description={he.platformPathSspBlockedNote} />
        <Button type="button" variant="secondary" onClick={() => void navigate({ to: "/platform" })}>
          {he.platformHomeTitle}
        </Button>
      </div>
    );
  }
  return (
    <RequirePermission permission="ssp.forms.view">
      <SspProductShell>
        <Outlet />
      </SspProductShell>
    </RequirePermission>
  );
}
