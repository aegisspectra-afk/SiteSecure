import { ErrorState, PageHeader, Status } from "@site-secure/ui";
import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { QuoteBuilder } from "../../../components/quotes/QuoteBuilder";
import { RequirePermission } from "../../../components/settings/RequirePermission";
import { he } from "../../../i18n/he";
import { quoteStatusLabel, quoteStatusTone } from "../../../lib/quotes";
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
  const { session, api } = useSession();
  const membership = session?.memberships[0];
  const workspaceId = membership?.workspace_id;
  const query = useQuery({
    queryKey: ["quote", workspaceId, quoteId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.getQuote(workspaceId!, quoteId),
  });

  if (!workspaceId) return <ErrorState title={he.quotesError} />;
  if (query.isError || (!query.isLoading && !query.data)) {
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
  const quote = query.data;
  if (!quote) return <ErrorState title={he.quotesError} />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={quote.title ? `${quote.number} · ${quote.title}` : `${he.quoteDetailTitle} ${quote.number}`}
        description={he.quoteBuilderLead}
      />
      <Status label={quoteStatusLabel(quote.status)} tone={quoteStatusTone(quote.status)} />
      <QuoteBuilder
        quote={quote}
        workspaceId={workspaceId}
        roleKey={membership?.role_key}
        features={membership?.features ?? []}
      />
    </div>
  );
}
