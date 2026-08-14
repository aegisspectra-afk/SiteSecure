import { LoadingBlock } from "@site-secure/ui";
import { Navigate, Outlet, createFileRoute } from "@tanstack/react-router";
import { AppShell } from "../../components/AppShell";
import { afterAuthPath, guestEntryPath } from "../../lib/auth-routes";
import { useSession } from "../../lib/session";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const { loading, user, session, error } = useSession();
  if (loading) return <LoadingBlock />;
  if (!user || error) return <Navigate to={guestEntryPath()} />;
  if (!session?.has_workspace) return <Navigate to={afterAuthPath(false)} />;
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
