import { Navigate, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/app/platform-path")({
  component: PlatformPathLayout,
});

function PlatformPathLayout() {
  return <Navigate to="/app/dashboard" />;
}
