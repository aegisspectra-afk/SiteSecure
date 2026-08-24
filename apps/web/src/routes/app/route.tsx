import { Button, ErrorState } from "@site-secure/ui";
import { Navigate, Outlet, createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "../../components/AppShell";
import { AuthLaunchScreen } from "../../components/auth";
import { he } from "../../i18n/he";
import { authLaunchSequence } from "../../lib/auth-launch";
import { afterAuthPath, guestEntryPath } from "../../lib/auth-routes";
import { useSession } from "../../lib/session";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

type BootPhase = "loading" | "workspace" | "ready" | "done";

function AppLayout() {
  const { loading, user, session, error, refresh } = useSession();
  const [boot, setBoot] = useState<BootPhase>("loading");
  const lastLaunchedWorkspaceId = useRef<string | null>(null);
  const launchingRef = useRef(false);
  const activeWorkspaceId = session?.memberships[0]?.workspace_id ?? null;

  useEffect(() => {
    if (loading) {
      setBoot("loading");
      return;
    }
    if (!user || (error && !session) || !session?.has_workspace) {
      lastLaunchedWorkspaceId.current = null;
      launchingRef.current = false;
      setBoot("done");
      return;
    }

    if (activeWorkspaceId && lastLaunchedWorkspaceId.current === activeWorkspaceId) {
      setBoot("done");
      return;
    }
    if (launchingRef.current) return;

    let cancelled = false;
    void (async () => {
      launchingRef.current = true;
      setBoot("workspace");
      await authLaunchSequence({
        workspaceMs: 380,
        readyMs: 340,
        onReady: () => {
          if (!cancelled) setBoot("ready");
        },
      });
      if (!cancelled) {
        setBoot("done");
        lastLaunchedWorkspaceId.current = activeWorkspaceId;
      }
      launchingRef.current = false;
    })();

    return () => {
      cancelled = true;
      launchingRef.current = false;
    };
  }, [activeWorkspaceId, error, loading, session?.has_workspace, user]);

  if (boot !== "done" && (loading || (user && session?.has_workspace))) {
    return (
      <AuthLaunchScreen
        phase={boot === "ready" ? "ready" : boot === "workspace" ? "workspace" : "session"}
        workspaceName={session?.memberships[0]?.workspace_name}
        ready={boot === "ready"}
      />
    );
  }

  if (!user) return <Navigate to={guestEntryPath()} />;
  if (error && !session) {
    return (
      <ErrorState
        title={he.apiUnavailable}
        description={error}
        action={
          <Button variant="secondary" onClick={() => void refresh()}>
            {he.retry}
          </Button>
        }
      />
    );
  }
  if (!session?.has_workspace) return <Navigate to={afterAuthPath(false)} />;
  return (
    <div className="auth-app-enter">
      <AppShell>
        <Outlet />
      </AppShell>
    </div>
  );
}
