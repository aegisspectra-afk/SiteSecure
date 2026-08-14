import { Navigate, createFileRoute } from "@tanstack/react-router";
import { homeVariant } from "../../lib/home";
import { useSession } from "../../lib/session";

export const Route = createFileRoute("/app/")({
  component: AppHome,
});

function AppHome() {
  const { session } = useSession();
  const variant = homeVariant(session?.memberships[0]?.role_key);
  if (variant === "today") return <Navigate to="/app/today" />;
  return <Navigate to="/app/dashboard" />;
}
