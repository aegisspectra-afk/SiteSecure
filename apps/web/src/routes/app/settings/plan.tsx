import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/app/settings/plan")({
  beforeLoad: () => {
    throw redirect({ to: "/app/settings/billing" });
  },
});