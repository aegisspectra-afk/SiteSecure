import { createFileRoute, redirect } from "@tanstack/react-router";

/** Soft user archive lives under Users; workspace cold archive under Organizations. */
export const Route = createFileRoute("/admin/archive")({
  beforeLoad: () => {
    throw redirect({
      to: "/admin/organizations",
      search: { tab: "archived" },
      replace: true,
    });
  },
});
