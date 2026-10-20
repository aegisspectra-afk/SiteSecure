import { Button } from "@site-secure/ui";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PlatformPathShell } from "../../../components/platform-path/PlatformPathShell";
import { he } from "../../../i18n/he";
import { markPlatformSetupDone } from "../../../lib/platform-setup";
import { displayWorkspaceName } from "../../../lib/quotes";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/app/platform-path/")({
  component: PlatformPathIndex,
});

function PlatformPathIndex() {
  const { session } = useSession();
  const navigate = useNavigate();
  const m = session?.memberships[0];
  const name = displayWorkspaceName(m?.workspace_name) || he.brand;

  return (
    <PlatformPathShell step="products">
      <div className="flex flex-col gap-4 rounded-[var(--radius-control)] border border-border bg-bg-1 p-5">
        <p className="text-sm text-fg-muted">{he.platformPathIntroWorkspace}</p>
        <p className="text-lg font-semibold text-fg">{name}</p>
        <ol className="list-decimal space-y-2 pe-5 text-sm text-fg-muted">
          <li>{he.platformPathIntro1}</li>
          <li>{he.platformPathIntro2}</li>
          <li>{he.platformPathIntro3}</li>
          <li>{he.platformPathIntro4}</li>
        </ol>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            type="button"
            variant="primary"
            onClick={() => void navigate({ to: "/app/platform-path/products" })}
          >
            {he.platformPathStart}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              if (m?.workspace_id) markPlatformSetupDone(m.workspace_id);
              void navigate({ to: "/app" });
            }}
          >
            {he.platformPathSkipToApp}
          </Button>
        </div>
      </div>
    </PlatformPathShell>
  );
}
