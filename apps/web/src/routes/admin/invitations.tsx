import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/invitations")({
  beforeLoad: () => {
    throw redirect({
      to: "/admin/users",
      search: { tab: "invitations" },
      replace: true,
    });
  },
});
