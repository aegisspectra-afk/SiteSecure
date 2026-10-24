import { Outlet, createFileRoute } from "@tanstack/react-router";
import { WorkforceLegacyRedirect } from "../../../components/workforce/WorkforceLegacyRedirect";

export const Route = createFileRoute("/app/workforce")({
  component: WorkforceLegacyLayout,
});

function WorkforceLegacyLayout() {
  return (
    <>
      <WorkforceLegacyRedirect />
      <Outlet />
    </>
  );
}
