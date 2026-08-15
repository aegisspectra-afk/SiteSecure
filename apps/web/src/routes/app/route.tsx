import { Button, ErrorState, LoadingBlock } from "@site-secure/ui";
import { Navigate, Outlet, createFileRoute } from "@tanstack/react-router";
import { AppShell } from "../../components/AppShell";
import { he } from "../../i18n/he";
import { afterAuthPath, guestEntryPath } from "../../lib/auth-routes";
import { useSession } from "../../lib/session";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const { loading, user, session, error, refresh } = useSession();
  if (loading) return <LoadingBlock />;
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
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
