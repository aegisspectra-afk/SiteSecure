import { Outlet, createFileRoute } from "@tanstack/react-router";
import { SettingsShell } from "../../../components/settings/SettingsShell";

export const Route = createFileRoute("/app/settings")({
  component: SettingsLayout,
});

function SettingsLayout() {
  return (
    <SettingsShell>
      <Outlet />
    </SettingsShell>
  );
}
