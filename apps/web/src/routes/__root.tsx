import { Outlet, createRootRoute } from "@tanstack/react-router";
import { ThemeRuntime } from "../lib/use-theme";

export const Route = createRootRoute({
  component: Root,
});

function Root() {
  return (
    <>
      <ThemeRuntime />
      <Outlet />
    </>
  );
}
