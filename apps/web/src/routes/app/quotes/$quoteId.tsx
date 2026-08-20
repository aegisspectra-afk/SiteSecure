import { ErrorState, LoadingBlock } from "@site-secure/ui";
import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { QuoteBuilder } from "../../../components/quotes/QuoteBuilder";
import { RequirePermission } from "../../../components/settings/RequirePermission";
import { he } from "../../../i18n/he";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/app/quotes/$quoteId")({
  component: QuoteDetailPage,
});

function QuoteDetailPage() {
  return (
    <RequirePermission permission="quotes.view">
      <QuoteDetailBody />
    </RequirePermission>
  );
}

function QuoteDetailBody() {
  const { quoteId } = Route.useParams();
  const { session, api, loading } = useSession();
  const membership = session?.memberships[0];
  const workspaceId = membership?.workspace_id;
  const query = useQuery({
    queryKey: ["quote", workspaceId, quoteId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.getQuote(workspaceId!, quoteId),
    staleTime: 20_000,
  });

  if (loading || !workspaceId || (query.isLoading && !query.data) || (!query.data && !query.isError)) {
    return <LoadingBlock label={he.loading} />;
  }
  if (query.isError || !query.data) {
    return (
      <ErrorState
        title={he.quotesError}
        action={
          <Link to="/app/quotes" className="text-sm font-medium text-action">
            {he.quotesTitle}
          </Link>
        }
      />
    );
  }

  return (
    <QuoteBuilder
      quote={query.data}
      workspaceId={workspaceId}
      roleKey={membership?.role_key}
      features={membership?.features ?? []}
      workspaceName={membership?.workspace_name}
    />
  );
}
