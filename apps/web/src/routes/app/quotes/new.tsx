import { ErrorState, LoadingBlock } from "@site-secure/ui";
import { createFileRoute } from "@tanstack/react-router";
import { QuoteBuilder } from "../../../components/quotes/QuoteBuilder";
import { RequirePermission } from "../../../components/settings/RequirePermission";
import { he } from "../../../i18n/he";
import { unsavedQuote } from "../../../lib/quote-builder";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/app/quotes/new")({
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
  const { session, loading } = useSession();
  const membership = session?.memberships[0];
  const workspaceId = membership?.workspace_id;

  if (loading || !workspaceId) return <LoadingBlock label={he.loading} />;
  if (!membership) return <ErrorState title={he.quotesError} />;

  return (
    <QuoteBuilder
      quote={unsavedQuote(workspaceId)}
      workspaceId={workspaceId}
      roleKey={membership.role_key}
      features={membership.features ?? []}
      workspaceName={membership.workspace_name}
    />
  );
}
