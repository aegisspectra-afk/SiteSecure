import { Outlet, createRootRoute } from "@tanstack/react-router";
import { EntitlementRevokeBridge } from "../components/EntitlementRevokeBridge";
import { VercelAnalytics } from "../components/VercelAnalytics";
import { ThemeRuntime } from "../lib/use-theme";

export const Route = createRootRoute({
  component: Root,
});

function Root() {
  return (
    <>
      <ThemeRuntime />
      <EntitlementRevokeBridge />
      <Outlet />
      <VercelAnalytics />
    </>
  );
}
