import { LoadingBlock } from "@site-secure/ui";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { afterAuthPath, guestEntryPath } from "../lib/auth-routes";
import { useSession } from "../lib/session";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { loading, user, session } = useSession();
  if (loading) return <LoadingBlock />;
  if (!user) return <Navigate to={guestEntryPath()} />;
  return <Navigate to={afterAuthPath(Boolean(session?.has_workspace))} />;
}
