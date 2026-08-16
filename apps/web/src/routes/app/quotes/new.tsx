import { Button, ErrorState, Input, PageHeader } from "@site-secure/ui";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { RequirePermission } from "../../../components/settings/RequirePermission";
import { he } from "../../../i18n/he";
import { ApiClientError } from "@site-secure/api-client";
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
  const { session, api } = useSession();
  const navigate = useNavigate();
  const workspaceId = session?.memberships[0]?.workspace_id;
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: () => api.createQuote(workspaceId!, title.trim() ? { title: title.trim() } : {}),
    onSuccess: (quote) => {
      void navigate({ to: "/app/quotes/$quoteId", params: { quoteId: quote.id } });
    },
    onError: (err) => {
      setError(err instanceof ApiClientError ? err.message : he.quotesError);
    },
  });

  if (!workspaceId) return <ErrorState title={he.quotesError} />;

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    mutation.mutate();
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <PageHeader title={he.newQuote} description={he.quoteCreateLead} />
      <form className="ops-card flex flex-col gap-4 p-5" onSubmit={onSubmit}>
        <Input id="title" label={he.quoteTitle} value={title} onChange={(ev) => setTitle(ev.target.value)} />
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <Button type="submit" loading={mutation.isPending}>
          {he.quoteCreate}
        </Button>
      </form>
    </div>
  );
}
