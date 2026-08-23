import { ErrorState, LoadingBlock } from "@site-secure/ui";
import { createFileRoute } from "@tanstack/react-router";
import { QuoteBuilder } from "../../../components/quotes/QuoteBuilder";
import { RequirePermission } from "../../../components/settings/RequirePermission";
import { he } from "../../../i18n/he";
import { unsavedQuote } from "../../../lib/quote-builder";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/app/quotes/new")({
  validateSearch: (search: Record<string, unknown>): { customerId?: string; siteId?: string; leadId?: string } => ({
    customerId: typeof search.customerId === "string" && search.customerId ? search.customerId : undefined,
    siteId: typeof search.siteId === "string" && search.siteId ? search.siteId : undefined,
    leadId: typeof search.leadId === "string" && search.leadId ? search.leadId : undefined,
  }),
  component: NewQuotePage,
});

function NewQuotePage() {
  return (
    <RequirePermission permission="quotes.create">
      <NewQuoteBody />
    </RequirePermission>
  );
}

function NewQuoteBody() {
  const { customerId, siteId, leadId } = Route.useSearch();
  const { session, loading } = useSession();
  const membership = session?.memberships[0];
  const workspaceId = membership?.workspace_id;

  if (loading || !workspaceId) return <LoadingBlock label={he.loading} />;
  if (!membership) return <ErrorState title={he.quotesError} />;

  return (
    <QuoteBuilder
      quote={unsavedQuote(workspaceId, { customerId, siteId, leadId })}
      workspaceId={workspaceId}
      roleKey={membership.role_key}
      features={membership.features ?? []}
      workspaceName={membership.workspace_name}
      initialCustomerId={customerId}
      initialSiteId={siteId}
      initialLeadId={leadId}
    />
  );
}
