import { Button, ErrorState } from "@site-secure/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { QuotesWorkspace } from "../../../components/quotes/QuotesWorkspace";
import { RequirePermission } from "../../../components/settings/RequirePermission";
import { he } from "../../../i18n/he";
import { can } from "../../../lib/can";
import type { QuoteTab } from "../../../lib/quote-workspace";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/app/quotes/")({
  component: QuotesPage,
});

function QuotesPage() {
  return (
    <RequirePermission permission="quotes.view">
      <QuotesBody />
    </RequirePermission>
  );
}

function QuotesBody() {
  const { session, api } = useSession();
  const navigate = useNavigate();
  const membership = session?.memberships[0];
  const workspaceId = membership?.workspace_id;
  const features = membership?.features ?? [];
  const canCreate = can(membership?.role_key, "quotes.create", features);
  const canViewCost = can(membership?.role_key, "quotes.view_cost", features);
  const [tab, setTab] = useState<QuoteTab>("all");
  const [search, setSearch] = useState("");

  const quotesQuery = useQuery({
    queryKey: ["quotes", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.listQuotes(workspaceId!),
  });
  const dashQuery = useQuery({
    queryKey: ["dashboard", workspaceId],
    enabled: Boolean(workspaceId),
    retry: false,
    queryFn: () => api.getDashboard(workspaceId!),
  });

  if (!workspaceId) return <ErrorState title={he.quotesError} />;
  if (quotesQuery.isError) {
    return (
      <ErrorState
        title={he.quotesError}
        action={
          <Button variant="secondary" onClick={() => void quotesQuery.refetch()}>
            {he.retry}
          </Button>
        }
      />
    );
  }

  return (
    <QuotesWorkspace
      quotes={quotesQuery.data?.items ?? []}
      summary={dashQuery.data?.summary ?? null}
      search={search}
      tab={tab}
      canCreate={canCreate}
      canViewCost={canViewCost}
      loading={quotesQuery.isLoading}
      onSearch={setSearch}
      onTab={setTab}
      onOpenQuote={(quoteId) =>
        void navigate({ to: "/app/quotes/$quoteId", params: { quoteId } })
      }
    />
  );
}
