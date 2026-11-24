import { Suspense, lazy, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AuthLaunchScreen } from "../components/auth";
import { hasAuthCallback } from "../lib/auth-redirect";

const PublicHome = lazy(() =>
  import("../components/public/PublicHome").then((m) => ({ default: m.PublicHome })),
);

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const [handoff] = useState(() =>
    typeof window === "undefined" ? false : hasAuthCallback(window.location.search, window.location.hash),
  );

  useEffect(() => {
    if (!handoff) return;
    window.location.replace(`/login${window.location.search}${window.location.hash}`);
  }, [handoff]);

  if (handoff) return <AuthLaunchScreen phase="session" />;
  return (
    <Suspense fallback={null}>
      <PublicHome />
    </Suspense>
  );
}
