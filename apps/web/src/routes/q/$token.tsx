import { createFileRoute, redirect } from "@tanstack/react-router";

/** Short customer share URL → canonical public portal. */
export const Route = createFileRoute("/q/$token")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/public/quotes/$token",
      params: { token: params.token },
      replace: true,
    });
  },
});
