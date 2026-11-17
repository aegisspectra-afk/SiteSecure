import { createFileRoute, redirect } from "@tanstack/react-router";

/** Short handover URL → public certificate page. */
export const Route = createFileRoute("/h/$token")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/public/handover/$token",
      params: { token: params.token },
      replace: true,
    });
  },
});
