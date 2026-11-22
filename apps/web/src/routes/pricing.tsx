import { createFileRoute } from "@tanstack/react-router";
import { PublicPricingPage } from "../components/public/marketing/PublicPricingPage";

export const Route = createFileRoute("/pricing")({
  component: PricingRoute,
});

function PricingRoute() {
  return <PublicPricingPage />;
}