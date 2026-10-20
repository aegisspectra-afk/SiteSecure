import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/app/platform-path")({
  component: PlatformPathLayout,
});

function PlatformPathLayout() {
  return <Outlet />;
}
