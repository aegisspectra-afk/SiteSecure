import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { LoadingBlock } from "@site-secure/ui";
import { PublicHome } from "../components/public/PublicHome";
import { he } from "../i18n/he";
import { hasAuthCallback } from "../lib/auth-redirect";

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

  if (handoff) return <LoadingBlock label={he.loading} />;
  return <PublicHome />;
}
