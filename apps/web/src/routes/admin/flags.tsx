import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/flags")({
  beforeLoad: () => {
    throw redirect({
      to: "/admin/beta",
      search: { tab: "flags" },
      replace: true,
    });
  },
});
