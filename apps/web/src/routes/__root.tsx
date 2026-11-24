import { Outlet, createRootRoute, useRouterState } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { AppNotFound } from "../components/AppNotFound";
import { VercelAnalytics } from "../components/VercelAnalytics";

const CookieConsentBanner = lazy(() =>
  import("../components/public/CookieConsentBanner").then((m) => ({ default: m.CookieConsentBanner })),
);
import { ThemeRuntime } from "../lib/use-theme";

const EntitlementRevokeBridge = lazy(() =>
  import("../components/EntitlementRevokeBridge").then((m) => ({ default: m.EntitlementRevokeBridge })),
);

export const Route = createRootRoute({
  component: Root,
  notFoundComponent: AppNotFound,
});

function productShellPath(pathname: string): boolean {
  return (
    pathname === "/app" ||
    pathname.startsWith("/app/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/platform" ||
    pathname.startsWith("/platform/") ||
    pathname === "/portal" ||
    pathname.startsWith("/portal/") ||
    pathname === "/unit" ||
    pathname.startsWith("/unit/")
  );
}

function Root() {
  const productShell = useRouterState({ select: (s) => productShellPath(s.location.pathname) });
  return (
    <>
      <ThemeRuntime />
      {productShell ? (
        <Suspense fallback={null}>
          <EntitlementRevokeBridge />
        </Suspense>
      ) : null}
      <Outlet />
      <Suspense fallback={null}>
        <CookieConsentBanner />
      </Suspense>
      <VercelAnalytics />
    </>
  );
}
