import { Button, ErrorState, LoadingBlock } from "@site-secure/ui";
import { ApiClientError, type QuoteGap } from "@site-secure/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { QuoteCustomerView } from "../../../components/quotes/QuoteCustomerView";
import { RequirePermission } from "../../../components/settings/RequirePermission";
import { he } from "../../../i18n/he";
import { can } from "../../../lib/can";
import { useSession } from "../../../lib/session";

export const Route = createFileRoute("/app/quotes/$quoteId/preview")({
  component: QuotePreviewPage,
});

function QuotePreviewPage() {
  return (
    <RequirePermission permission="quotes.view">
      <QuotePreviewBody />
    </RequirePermission>
  );
}

function QuotePreviewBody() {
  const { quoteId } = Route.useParams();
  const { session, api } = useSession();
  const queryClient = useQueryClient();
  const membership = session?.memberships[0];
  const workspaceId = membership?.workspace_id;
  const features = membership?.features ?? [];
  const canSend = can(membership?.role_key, "quotes.send", features);
  const [formError, setFormError] = useState<string | null>(null);
  const [publicUrl, setPublicUrl] = useState("");

  const previewQuery = useQuery({
    queryKey: ["quote-preview", workspaceId, quoteId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.getQuotePreview(workspaceId!, quoteId),
  });
  const quoteQuery = useQuery({
    queryKey: ["quote", workspaceId, quoteId],
    enabled: Boolean(workspaceId),
    queryFn: () => api.getQuote(workspaceId!, quoteId),
  });

  const send = useMutation({
    mutationFn: () => api.sendQuote(workspaceId!, quoteId),
    onSuccess: (row) => {
      setPublicUrl(row.public_url ?? "");
      setFormError(null);
      void queryClient.invalidateQueries({ queryKey: ["quote", workspaceId, quoteId] });
      void queryClient.invalidateQueries({ queryKey: ["quote-preview", workspaceId, quoteId] });
      void queryClient.invalidateQueries({ queryKey: ["quotes", workspaceId] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard", workspaceId] });
    },
    onError: (err) => {
      if (err instanceof ApiClientError && err.code === "QUOTE_INCOMPLETE") {
        setFormError(he.quoteSendBlocked);
        return;
      }
      setFormError(err instanceof ApiClientError ? err.message : he.quotesError);
    },
  });

  if (!workspaceId) return <ErrorState title={he.quotesError} />;
  if (previewQuery.isLoading || quoteQuery.isLoading) return <LoadingBlock />;
  if (previewQuery.isError || !previewQuery.data || quoteQuery.isError || !quoteQuery.data) {
    return <ErrorState title={he.quotesError} />;
  }

  const quote = quoteQuery.data;
  const gaps = (quote.validation?.gaps ?? []) as QuoteGap[];
  const canSendNow = canSend && quote.status === "draft" && gaps.length === 0;
  const preview = previewQuery.data;

  return (
    <div className="flex flex-col gap-6">
      <QuoteCustomerView
        quote={preview}
        actions={
          <div className="flex flex-col gap-3">
            <p className="text-sm text-fg-muted">{he.quotePreviewLead}</p>
            {formError ? <p className="text-sm text-danger">{formError}</p> : null}
            {gaps.length ? (
              <section className="ops-card flex flex-col gap-2 p-4">
                <p className="text-sm font-medium">{he.quoteSendBlocked}</p>
                {gaps.map((gap) => (
                  <p key={`${gap.field}-${gap.code}`} className="text-sm">
                    {gap.message}
                  </p>
                ))}
              </section>
            ) : null}
            {publicUrl ? (
              <a className="text-sm text-action" href={publicUrl} target="_blank" rel="noreferrer">
                {publicUrl}
              </a>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Link
                to="/app/quotes/$quoteId"
                params={{ quoteId }}
                className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] border border-border bg-bg px-4 text-sm font-medium text-fg hover:bg-bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                {he.quotePreviewBack}
              </Link>
              {quote.status === "draft" && canSend ? (
                <Button disabled={!canSendNow} loading={send.isPending} onClick={() => send.mutate()}>
                  {he.quoteSend}
                </Button>
              ) : null}
            </div>
          </div>
        }
      />
    </div>
  );
}
