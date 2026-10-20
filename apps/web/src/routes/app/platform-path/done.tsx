import { Button, PageHeader } from "@site-secure/ui";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { PlatformPathShell } from "../../../components/platform-path/PlatformPathShell";
import { he } from "../../../i18n/he";
import { hasFeature } from "../../../lib/home";
import { markPlatformSetupDone } from "../../../lib/platform-setup";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/app/platform-path/done")({
  component: PlatformPathDonePage,
});

function PlatformPathDonePage() {
  const { session } = useSession();
  const workspaceId = session?.memberships[0]?.workspace_id;
  const features = session?.memberships[0]?.features ?? [];
  const sspLive = hasFeature(features, "ssp");
  const navigate = useNavigate();

  useEffect(() => {
    if (workspaceId) markPlatformSetupDone(workspaceId);
  }, [workspaceId]);

  return (
    <PlatformPathShell step="done">
      <PageHeader title={he.platformPathDoneTitle} description={he.platformPathDoneLead} />
      <div className="flex flex-col gap-3">
        <Button type="button" variant="primary" onClick={() => void navigate({ to: "/app" })}>
          {he.enterWorkspace}
        </Button>
        {sspLive ? (
          <Button type="button" variant="secondary" onClick={() => void navigate({ to: "/app/ssp" })}>
            {he.platformPathOpenSsp}
          </Button>
        ) : (
          <Button
            type="button"
            variant="secondary"
            onClick={() => void navigate({ to: "/demo/ssp" })}
          >
            {he.platformPathOpenSspDemo}
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          onClick={() => void navigate({ to: "/app/settings/products" })}
        >
          {he.settingsNavProducts}
        </Button>
      </div>
      {!sspLive ? <p className="text-xs text-fg-muted">{he.platformPathSspBlockedNote}</p> : null}
    </PlatformPathShell>
  );
}
