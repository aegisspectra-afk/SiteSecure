import { Outlet, createRootRoute } from "@tanstack/react-router";
import { AppNotFound } from "../components/AppNotFound";
import { EntitlementRevokeBridge } from "../components/EntitlementRevokeBridge";
import { VercelAnalytics } from "../components/VercelAnalytics";
import { ThemeRuntime } from "../lib/use-theme";

export const Route = createRootRoute({
  component: Root,
  notFoundComponent: AppNotFound,
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
