import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/portal")({
  component: PortalLayout,
});

function PortalLayout() {
  return (
    <div dir="rtl" lang="he" className="min-h-dvh bg-bg text-fg">
      <Outlet />
    </div>
  );
}