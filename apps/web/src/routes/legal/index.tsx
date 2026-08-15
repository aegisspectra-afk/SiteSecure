import { Navigate, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/legal/")({
  component: LegalIndexPage,
});

function LegalIndexPage() {
  return <Navigate to="/legal/$slug" params={{ slug: "privacy" }} />;
}
