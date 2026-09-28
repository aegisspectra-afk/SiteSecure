import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/portal")({
  component: PortalLayout,
});

function PortalLayout() {
  return (
    <div className="min-h-dvh text-fg">
      <Outlet />
    </div>
  );
}
