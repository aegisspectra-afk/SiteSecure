import { Outlet, createFileRoute } from "@tanstack/react-router";
import { RequirePermission } from "../../../../components/settings/RequirePermission";

export const Route = createFileRoute("/app/quotes/$quoteId")({
  component: QuoteIdLayout,
});

function QuoteIdLayout() {
  return (
    <RequirePermission permission="quotes.view">
      <Outlet />
    </RequirePermission>
  );
}
