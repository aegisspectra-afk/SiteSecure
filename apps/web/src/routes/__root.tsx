import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, createRootRoute } from "@tanstack/react-router";
import { ThemeRuntime } from "../lib/use-theme";
import { SessionProvider } from "../lib/session";

const queryClient = new QueryClient();

export const Route = createRootRoute({
  component: Root,
});

function Root() {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <ThemeRuntime />
        <Outlet />
      </SessionProvider>
    </QueryClientProvider>
  );
}
