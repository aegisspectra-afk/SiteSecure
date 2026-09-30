import { createFileRoute, redirect } from "@tanstack/react-router";

/** Appearance moved into Profile — keep route for bookmarks / old links. */
export const Route = createFileRoute("/app/settings/appearance")({
  beforeLoad: () => {
    throw redirect({ to: "/app/settings/profile", replace: true });
  },
});
