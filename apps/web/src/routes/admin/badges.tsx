import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/badges")({
  beforeLoad: () => {
    throw redirect({
      to: "/admin/beta",
      search: { tab: "badges" },
      replace: true,
    });
  },
});
