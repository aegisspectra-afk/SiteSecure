import { createFileRoute } from "@tanstack/react-router";
import { PublicHome } from "../components/public/PublicHome";

export const Route = createFileRoute("/")({
  component: PublicHome,
});
