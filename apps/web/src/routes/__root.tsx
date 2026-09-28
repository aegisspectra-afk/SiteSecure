import { Outlet, createRootRoute } from "@tanstack/react-router";
import { VercelAnalytics } from "../components/VercelAnalytics";
import { ThemeRuntime } from "../lib/use-theme";

export const Route = createRootRoute({
  component: Root,
});

function Root() {
  return (
    <>
      <ThemeRuntime />
      <Outlet />
      <VercelAnalytics />
    </>
  );
}
